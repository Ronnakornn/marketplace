import type { RefundStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
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
  amountCents: number
  reason: string | null
  createdAt: Date
  updatedAt: Date
}

export class RefundService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IRefundRepository,
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
    return this.toResponse(await this.repo.updateRefundStatus(refund.id, nextStatus))
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
      amountCents: refund.amountCents,
      reason: refund.reason,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    }
  }
}
