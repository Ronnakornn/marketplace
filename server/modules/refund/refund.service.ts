import type { RefundStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { AuditLogService } from '#server/modules/audit-log'
import { RefundServiceError } from './refund.errors.ts'
import type { IRefundRepository, RefundRecord } from './refund.repository.ts'

export interface RefundActor {
  id: string
  role: Role
}

export interface RefundResponse {
  id: string
  orderId: string
  paymentId: string
  returnRequestId: string | null
  status: string
  amount: number
  reason: string | null
  createdAt: Date
  updatedAt: Date
}

export class RefundService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IRefundRepository,
    private eventPublisher?: EventPublisherService,
    private auditLogService?: AuditLogService,
  ) {
    this.logger = appContext.logger
  }

  async listAdminRefunds(actor: RefundActor): Promise<RefundResponse[]> {
    this.assertAdmin(actor)
    const refunds = await this.repo.listRefunds()
    return refunds.map((refund) => this.toResponse(refund))
  }

  async getAdminRefund(actor: RefundActor, refundId: string): Promise<RefundResponse> {
    this.assertAdmin(actor)
    const refund = await this.repo.findRefundById(refundId)
    if (!refund) throw new RefundServiceError('Refund not found', 404, 'REFUND_NOT_FOUND')
    return this.toResponse(refund)
  }

  async processAdminRefund(actor: RefundActor, refundId: string, status: 'processing' | 'success' | 'failed' = 'processing'): Promise<RefundResponse> {
    this.assertAdmin(actor)
    this.logger.info('RefundService.processAdminRefund', { actorId: actor.id, refundId, status })
    const refund = await this.repo.findRefundById(refundId)
    if (!refund) throw new RefundServiceError('Refund not found', 404, 'REFUND_NOT_FOUND')
    const nextStatus = this.normalizeStatus(status)
    this.assertTransition(refund.status, nextStatus)
    const response = this.toResponse(await this.repo.updateRefundStatus(refund.id, nextStatus))
    await this.auditLogService?.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'REFUND_STATUS_CHANGED',
      entityType: 'refund',
      entityId: refund.id,
      before: { status: refund.status },
      after: { status: nextStatus },
      nonCritical: false,
    })
    if (nextStatus === 'SUCCESS') {
      await this.publishBestEffort('refund.succeeded', response.id, actor.id, {
        refundId: response.id,
        orderId: response.orderId,
        paymentId: response.paymentId,
        amount: response.amount,
      })
    }
    return response
  }

  private assertAdmin(actor: RefundActor): void {
    if (actor.role !== 'ADMIN') {
      throw new RefundServiceError('Admin refund APIs are only available to admins', 403, 'REFUND_FORBIDDEN')
    }
  }

  private normalizeStatus(status: 'processing' | 'success' | 'failed'): RefundStatus {
    if (status === 'processing') return 'PROCESSING'
    if (status === 'success') return 'SUCCESS'
    return 'FAILED'
  }

  private assertTransition(current: RefundStatus, next: RefundStatus): void {
    if (current === 'SUCCESS' || current === 'FAILED') {
      throw new RefundServiceError('Terminal refunds cannot be updated', 409, 'INVALID_REFUND_STATE')
    }
    if (next === 'SUCCESS' && current !== 'PROCESSING') {
      throw new RefundServiceError('Refund must be processing before success', 409, 'INVALID_REFUND_STATE')
    }
  }

  private toResponse(refund: RefundRecord): RefundResponse {
    return {
      id: refund.id,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      returnRequestId: refund.returnRequestId,
      status: refund.status.toLowerCase(),
      amount: Number(refund.amount),
      reason: refund.reason,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    }
  }

  private async publishBestEffort(
    eventName: 'refund.succeeded',
    refundId: string,
    actorUserId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName,
        aggregateType: 'refund',
        aggregateId: refundId,
        actorUserId,
        data,
      })
    } catch (error) {
      this.logger.warn('RefundService event publish failed', {
        eventName,
        refundId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
