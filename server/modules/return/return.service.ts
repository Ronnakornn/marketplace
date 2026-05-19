import type { Role } from '#generated/client/enums.ts'
import type { Refund } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { ReturnServiceError } from './return.errors.ts'
import type { IReturnRepository, ReturnRecord } from './return.repository.ts'

export interface ReturnActor {
  id: string
  role: Role
}

export interface CreateReturnInput {
  orderId: string
  orderItemId: string
  reason: string
  description?: string
  images?: string[]
}

export interface ReturnResponse {
  id: string
  orderId: string
  userId: string
  status: string
  reason: string | null
  description: string | null
  images: string[]
  refund?: {
    id: string
    status: string
    amount: number
  } | null
  items: Array<{
    id: string
    orderItemId: string
    shopId: string
    productTitle: string
    variantTitle: string
    quantity: number
    lineTotal: number
    currency: string
    fulfillmentStatus: string
  }>
  createdAt: Date
  updatedAt: Date
}

const ACTIVE_RETURN_STATUSES = new Set(['REQUESTED', 'APPROVED', 'RECEIVED'])

export class ReturnService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IReturnRepository,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async createReturn(actor: ReturnActor, input: CreateReturnInput): Promise<ReturnResponse> {
    this.assertBuyer(actor)
    const reason = input.reason?.trim()
    if (!reason) throw new ReturnServiceError('Return reason is required', 400, 'INVALID_RETURN_STATE')
    this.logger.info('ReturnService.createReturn', { actorId: actor.id, orderItemId: input.orderItemId })

    return this.repo.transaction(async (txRepo) => {
      const orderItem = await txRepo.findOrderItemForReturn(input.orderItemId)
      if (!orderItem || orderItem.orderId !== input.orderId) {
        throw new ReturnServiceError('Order item not found', 404, 'ORDER_ITEM_NOT_FOUND')
      }
      if (orderItem.order.userId !== actor.id) {
        throw new ReturnServiceError('Return is not allowed for this order item', 403, 'RETURN_FORBIDDEN')
      }
      if (orderItem.fulfillmentStatus !== 'DELIVERED') {
        throw new ReturnServiceError('Order item must be delivered before return', 409, 'ORDER_ITEM_NOT_DELIVERED')
      }
      if (orderItem.returnItems.some((item) => ACTIVE_RETURN_STATUSES.has(item.returnRequest.status))) {
        throw new ReturnServiceError('Order item already has an active return', 409, 'RETURN_ALREADY_EXISTS')
      }

      const created = await txRepo.createReturn({
        orderId: orderItem.orderId,
        userId: actor.id,
        orderItemId: orderItem.id,
        quantity: orderItem.quantity,
        reason,
        description: this.normalizeOptionalText(input.description),
        images: this.normalizeImages(input.images),
      })
      return this.toResponse(created)
    })
  }

  async listBuyerReturns(actor: ReturnActor): Promise<ReturnResponse[]> {
    this.assertBuyer(actor)
    const returns = await this.repo.findBuyerReturns(actor.id)
    return returns.map((returnRecord) => this.toResponse(returnRecord))
  }

  async getBuyerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    this.assertBuyer(actor)
    const returnRecord = await this.repo.findBuyerReturnById(returnId, actor.id)
    if (!returnRecord) throw new ReturnServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    return this.toResponse(returnRecord)
  }

  async cancelBuyerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    this.assertBuyer(actor)
    return this.repo.transaction(async (txRepo) => {
      const returnRecord = await txRepo.findBuyerReturnById(returnId, actor.id)
      if (!returnRecord) throw new ReturnServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
      if (returnRecord.status !== 'REQUESTED') {
        throw new ReturnServiceError('Only requested returns can be cancelled', 409, 'INVALID_RETURN_STATE')
      }
      return this.toResponse(await txRepo.updateReturnStatus(returnRecord.id, 'CANCELLED'))
    })
  }

  async listSellerReturns(actor: ReturnActor): Promise<ReturnResponse[]> {
    const shopIds = await this.getSellerShopIds(actor.id)
    const returns = await this.repo.findSellerReturns(shopIds)
    return returns.map((returnRecord) => this.toResponse(this.filterReturnItems(returnRecord, shopIds)))
  }

  async getSellerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    const shopIds = await this.getSellerShopIds(actor.id)
    const returnRecord = await this.repo.findSellerReturnById(returnId, shopIds)
    if (!returnRecord) throw new ReturnServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    return this.toResponse(this.filterReturnItems(returnRecord, shopIds))
  }

  async approveSellerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    return this.repo.transaction(async (txRepo) => {
      const returnRecord = await this.findSellerReturn(txRepo, actor.id, returnId)
      if (returnRecord.status !== 'REQUESTED') {
        throw new ReturnServiceError('Only requested returns can be approved', 409, 'INVALID_RETURN_STATE')
      }
      if (!this.getRefundablePayment(returnRecord)) {
        throw new ReturnServiceError('Refund payment not found', 409, 'INVALID_RETURN_STATE')
      }

      const approved = await txRepo.updateReturnStatus(returnRecord.id, 'APPROVED')
      if (approved.refunds.length === 0) {
        const refund = await txRepo.createPendingRefundForReturn(approved)
        approved.refunds = [refund, ...approved.refunds] as Refund[]
      }
      return this.toResponse(approved)
    })
  }

  async rejectSellerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    return this.repo.transaction(async (txRepo) => {
      const returnRecord = await this.findSellerReturn(txRepo, actor.id, returnId)
      if (returnRecord.status !== 'REQUESTED') {
        throw new ReturnServiceError('Only requested returns can be rejected', 409, 'INVALID_RETURN_STATE')
      }
      return this.toResponse(await txRepo.updateReturnStatus(returnRecord.id, 'REJECTED'))
    })
  }

  private assertBuyer(actor: ReturnActor): void {
    if (actor.role === 'ADMIN') {
      throw new ReturnServiceError('Buyer return APIs are only available to buyers', 403, 'RETURN_FORBIDDEN')
    }
  }

  private async getSellerShopIds(ownerId: string): Promise<string[]> {
    const shopIds = this.activeShopResolver
      ? (await this.activeShopResolver.resolveActiveShops(ownerId)).map((shop) => shop.id)
      : (await this.repo.findSellerShops(ownerId)).map((shop) => shop.id)
    if (shopIds.length === 0) {
      throw new ReturnServiceError('Active seller shop not found', 403, 'RETURN_FORBIDDEN')
    }
    return shopIds
  }

  private async findSellerReturn(repo: IReturnRepository, ownerId: string, returnId: string): Promise<ReturnRecord> {
    const shopIds = (await repo.findSellerShops(ownerId)).map((shop) => shop.id)
    if (shopIds.length === 0) {
      throw new ReturnServiceError('Active seller shop not found', 403, 'RETURN_FORBIDDEN')
    }
    const returnRecord = await repo.findSellerReturnById(returnId, shopIds)
    if (!returnRecord) throw new ReturnServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    return this.filterReturnItems(returnRecord, shopIds)
  }

  private filterReturnItems(returnRecord: ReturnRecord, shopIds: string[]): ReturnRecord {
    const allowed = new Set(shopIds)
    return {
      ...returnRecord,
      items: returnRecord.items.filter((item) => allowed.has(item.orderItem.shopId)),
    }
  }

  private getRefundablePayment(returnRecord: ReturnRecord) {
    return returnRecord.order.payments.find((payment) => payment.status === 'SUCCEEDED') ?? returnRecord.order.payments[0] ?? null
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }

  private normalizeImages(images: string[] | undefined): string[] {
    return images?.map((image) => image.trim()).filter(Boolean) ?? []
  }

  private toResponse(returnRecord: ReturnRecord): ReturnResponse {
    const refund = returnRecord.refunds[0] ?? null
    return {
      id: returnRecord.id,
      orderId: returnRecord.orderId,
      userId: returnRecord.userId,
      status: this.formatStatus(returnRecord.status),
      reason: returnRecord.reason,
      description: returnRecord.description,
      images: returnRecord.images,
      refund: refund ? {
        id: refund.id,
        status: refund.status.toLowerCase(),
        amount: refund.amount,
      } : null,
      items: returnRecord.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        shopId: item.orderItem.shopId,
        productTitle: item.orderItem.productTitle,
        variantTitle: item.orderItem.variantTitle,
        quantity: item.quantity,
        lineTotal: item.orderItem.lineTotal,
        currency: item.orderItem.currency,
        fulfillmentStatus: item.orderItem.fulfillmentStatus,
      })),
      createdAt: returnRecord.createdAt,
      updatedAt: returnRecord.updatedAt,
    }
  }

  private formatStatus(status: ReturnRecord['status']): string {
    return status.toLowerCase()
  }
}
