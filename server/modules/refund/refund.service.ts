import type { Role } from '#generated/client/enums.ts'
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
  ) {
    this.logger = appContext.logger
  }

  async listAdminRefunds(actor: RefundActor): Promise<RefundResponse[]> {
    this.assertAdmin(actor)
    this.logger.debug('RefundService.listAdminRefunds', { actorId: actor.id })
    const refunds = await this.repo.listRefunds()
    return refunds.map((refund) => this.toResponse(refund))
  }

  async getAdminRefund(actor: RefundActor, refundId: string): Promise<RefundResponse> {
    this.assertAdmin(actor)
    this.logger.debug('RefundService.getAdminRefund', { actorId: actor.id, refundId })
    const refund = await this.repo.findRefundById(refundId)
    if (!refund) throw new RefundServiceError('Refund not found', 404, 'REFUND_NOT_FOUND')
    return this.toResponse(refund)
  }

  private assertAdmin(actor: RefundActor): void {
    if (actor.role !== 'ADMIN') {
      throw new RefundServiceError('Admin refund APIs are only available to admins', 403, 'REFUND_FORBIDDEN')
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

}
