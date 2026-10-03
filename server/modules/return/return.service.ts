import { moneyInteger } from '#server/lib/money.ts'
import type { Role } from '#generated/client/enums.ts'
import type { Refund } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import type { EventPublisherService } from '#server/modules/event-bus'
import { RefundServiceError } from '#server/modules/refund/refund.errors.ts'
import type { ReturnOrderItem } from './return.repository.ts'
import { ReturnServiceError } from './return.errors.ts'
import type { IReturnRepository, ReturnRecord, ReturnUpload } from './return.repository.ts'

const MAX_RETURN_IMAGE_COUNT = 5

export interface ReturnActor {
  id: string
  role: Role
}

export interface CreateReturnInput {
  orderId: string
  orderItemId: string
  quantity?: number
  reason: string
  description?: string
  uploadIds?: string[]
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
    amount: bigint
  } | null
  items: Array<{
    id: string
    orderItemId: string
    shopId: string
    productTitle: string
    variantTitle: string
    quantity: number
    lineTotal: bigint
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
    private eventPublisher?: EventPublisherService,
  ) {
    this.logger = appContext.logger
  }

  async createReturn(actor: ReturnActor, input: CreateReturnInput): Promise<ReturnResponse> {
    this.assertBuyer(actor)
    const reason = input.reason?.trim()
    if (!reason) throw new ReturnServiceError('Return reason is required', 400, 'INVALID_RETURN_STATE')
    this.logger.info('ReturnService.createReturn', { actorId: actor.id, orderItemId: input.orderItemId })

    const created = await this.repo.transaction(async (txRepo) => {
      await txRepo.lockOrder(input.orderId)
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
      const quantity = await this.resolveReturnQuantity(txRepo, orderItem, input.quantity)
      const images = await this.resolveReturnImages(txRepo, actor, input.uploadIds)

      const returnRecord = await txRepo.createReturn({
        orderId: orderItem.orderId,
        userId: actor.id,
        shopId: orderItem.shopId,
        orderItemId: orderItem.id,
        quantity,
        reason,
        description: this.normalizeOptionalText(input.description),
        images,
      })
      return this.toResponse(returnRecord)
    })
    await this.publishReturnEvent('return.requested', created, actor.id)
    return created
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
      await this.lockReturnOrder(txRepo, returnId)
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
    const approved = await this.repo.transaction(async (txRepo) => {
      await this.lockReturnOrder(txRepo, returnId)
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
    await this.publishReturnEvent('return.approved', approved, actor.id)
    return approved
  }

  async rejectSellerReturn(actor: ReturnActor, returnId: string): Promise<ReturnResponse> {
    const rejected = await this.repo.transaction(async (txRepo) => {
      await this.lockReturnOrder(txRepo, returnId)
      const returnRecord = await this.findSellerReturn(txRepo, actor.id, returnId)
      if (returnRecord.status !== 'REQUESTED') {
        throw new ReturnServiceError('Only requested returns can be rejected', 409, 'INVALID_RETURN_STATE')
      }
      return this.toResponse(await txRepo.updateReturnStatus(returnRecord.id, 'REJECTED'))
    })
    await this.publishReturnEvent('return.rejected', rejected, actor.id)
    return rejected
  }

  private async lockReturnOrder(repo: IReturnRepository, returnId: string): Promise<void> {
    const orderId = await repo.findReturnOrderId(returnId)
    if (!orderId) throw new ReturnServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    await repo.lockOrder(orderId)
  }

  private async resolveReturnQuantity(repo: IReturnRepository, item: ReturnOrderItem, requested: number | undefined): Promise<number> {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) {
      throw new ReturnServiceError('Original item quantity is invalid', 409, 'INVALID_RETURN_STATE')
    }
    let settlement
    try {
      settlement = await repo.findReturnSettlementState(item.orderId, item.order.currency)
    } catch (error) {
      if (error instanceof RefundServiceError) throw new ReturnServiceError(error.message, 409, 'INVALID_RETURN_STATE')
      throw error
    }
    let successful = 0
    if (settlement) {
      const original = settlement.items.find((row) => row.id === item.id)?.saleSnapshot
      if (!original || original.originalQuantity !== item.quantity) throw new ReturnServiceError('Original return entitlement is incomplete', 409, 'INVALID_RETURN_STATE')
      for (const refund of settlement.history) {
        const rows = refund.itemAllocations.filter((row) => row.orderItemId === item.id)
        if (rows.length && ['PENDING', 'PROCESSING'].includes(refund.status)) {
          throw new ReturnServiceError('Order item already has an active refund', 409, 'RETURN_ALREADY_EXISTS')
        }
        if (refund.status === 'SUCCESS') successful += rows.reduce((sum, row) => sum + row.quantity, 0)
      }
    } else if (item.order.refunds.some((refund) => ['SUCCESS', 'PENDING', 'PROCESSING'].includes(refund.status))
      || item.returnItems.some((row) => row.returnRequest.status === 'COMPLETED')) {
      throw new ReturnServiceError('Legacy return rights require original settlement evidence', 409, 'INVALID_RETURN_STATE')
    }
    const remaining = item.quantity - successful
    const quantity = requested ?? remaining
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647 || quantity > remaining) {
      throw new ReturnServiceError('Return quantity exceeds the remaining original quantity', 409, 'INVALID_RETURN_QUANTITY', { remainingQuantity: remaining })
    }
    if (!settlement && quantity !== item.quantity) {
      throw new ReturnServiceError('Partial returns require original settlement evidence', 409, 'INVALID_RETURN_STATE')
    }
    return quantity
  }

  private async publishReturnEvent(
    eventName: 'return.requested' | 'return.approved' | 'return.rejected',
    returnRecord: ReturnResponse,
    actorUserId: string,
  ): Promise<void> {
    await this.eventPublisher?.publish({
      eventName,
      aggregateType: 'return',
      aggregateId: returnRecord.id,
      actorUserId,
      data: { orderId: returnRecord.orderId },
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
    return returnRecord.order.payments.find((payment) => payment.status === 'SUCCEEDED') ?? null
  }

  private normalizeOptionalText(value: string | undefined): string | null {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }

  private async resolveReturnImages(repo: IReturnRepository, actor: ReturnActor, uploadIds: string[] | undefined): Promise<string[]> {
    const normalizedUploadIds = [...new Set(uploadIds?.map((uploadId) => uploadId.trim()).filter(Boolean) ?? [])]
    if (normalizedUploadIds.length > MAX_RETURN_IMAGE_COUNT) {
      throw new ReturnServiceError('A return request can include at most 5 images', 400, 'RETURN_MEDIA_LIMIT_EXCEEDED')
    }
    if (normalizedUploadIds.length === 0) return []

    const uploads = await repo.findUploadsByIds(normalizedUploadIds)
    const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]))
    return normalizedUploadIds.map((uploadId) => {
      const upload = uploadsById.get(uploadId)
      if (!upload) throw new ReturnServiceError('Return image upload not found', 404, 'UPLOAD_NOT_FOUND')
      this.assertValidReturnUpload(actor, upload)
      return upload.publicUrl!
    })
  }

  private assertValidReturnUpload(actor: ReturnActor, upload: ReturnUpload): void {
    if (upload.userId !== actor.id) {
      throw new ReturnServiceError('Return image upload does not belong to buyer', 403, 'RETURN_MEDIA_FORBIDDEN')
    }
    if (upload.status !== 'COMPLETED') {
      throw new ReturnServiceError('Return image upload must be completed', 400, 'RETURN_MEDIA_UPLOAD_INCOMPLETE')
    }
    if (upload.usage !== 'REVIEW_IMAGE' || !upload.contentType.startsWith('image/') || !upload.publicUrl) {
      throw new ReturnServiceError('Return evidence must use a completed review image upload', 400, 'RETURN_MEDIA_UPLOAD_INVALID')
    }
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
        amount: moneyInteger(refund.amount),
      } : null,
      items: returnRecord.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        shopId: item.orderItem.shopId,
        productTitle: item.orderItem.productTitle,
        variantTitle: item.orderItem.variantTitle,
        quantity: item.quantity,
        lineTotal: moneyInteger(item.orderItem.lineTotal),
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
