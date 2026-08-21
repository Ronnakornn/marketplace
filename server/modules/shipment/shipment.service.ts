import type { Role } from '#generated/client/enums.ts'
import type { ShipmentStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { ActiveShopResolver } from '#server/modules/security'
import type { AuditLogService } from '#server/modules/audit-log'
import type { WalletService } from '#server/modules/wallet'
import { ShipmentServiceError } from './shipment.errors.ts'
import type {
  BuyerShipment,
  IShipmentCreationRepository,
  IShipmentRepository,
  SellerShipment,
  ShipmentOrderForCreation,
  ShipmentWithItems,
} from './shipment.repository.ts'

export interface ShipmentActor {
  id: string
  role: Role
}

export interface ShipmentResponse {
  id: string
  orderId: string
  orderNo: string
  shopId: string
  status: string
  carrier: string | null
  trackingNumber: string | null
  trackingStatus: string
  shippingAddress: {
    name: string
    phone: string | null
    line1: string
    line2: string | null
    city: string
    region: string | null
    postalCode: string
    country: string
  }
  items: Array<{
    id: string
    orderItemId: string
    productTitle: string
    productSlug: string
    variantTitle: string
    variantSku: string
    quantity: number
    fulfillmentStatus: string
  }>
}

export interface ShipShipmentInput {
  carrier: string
  trackingNo: string
  service?: string
}

export interface DeliverShipmentInput {
  evidenceReference: string
}

export interface BuyerShipmentTrackingResponse {
  orderId: string
  orderNo: string
  orderStatus: string
  shipments: Array<{
    shipmentId: string
    shopId: string
    shopName: string
    carrier: string | null
    trackingNo: string | null
    status: string
    shippedAt: Date | null
    deliveredAt: Date | null
    items: Array<{
      id: string
      shopId: string
      productTitle: string
      productSlug: string
      variantTitle: string
      variantSku: string
      quantity: number
      unitPrice: number
      lineTotal: number
      currency: string
      fulfillmentStatus: string
    }>
    timeline: Array<{
      status: string
      label: string
      timestamp: Date
    }>
  }>
}

export class ShipmentService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IShipmentRepository,
    private walletService?: WalletService,
    private eventPublisher?: EventPublisherService,
    private cacheInvalidation?: CacheInvalidation,
    private activeShopResolver?: ActiveShopResolver,
    private auditLogService?: AuditLogService,
  ) {
    this.logger = appContext.logger
  }

  createShipmentsForPaidOrder(orderId: string): Promise<ShipmentWithItems[]> {
    this.logger.info('ShipmentService.createShipmentsForPaidOrder', { orderId })
    return this.repo.transaction((txRepo) => this.createShipmentsForPaidOrderWithRepo(txRepo, orderId))
  }

  async createShipmentsForPaidOrderWithRepo(
    repo: IShipmentCreationRepository,
    orderId: string,
  ): Promise<ShipmentWithItems[]> {
    const order = await repo.findOrderForShipmentCreation(orderId)
    if (!order) throw new ShipmentServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
    if (order.status !== 'PAID' || order.paymentStatus !== 'SUCCEEDED') {
      throw new ShipmentServiceError('Order is not paid', 409, 'ORDER_NOT_PAID')
    }

    const missingShopIds = this.getMissingShipmentShopIds(order)
    if (missingShopIds.length === 0) return order.shipments

    const created: ShipmentWithItems[] = []
    for (const shopId of missingShopIds) {
      const items = order.items.filter((item) => item.shopId === shopId)
      created.push(await repo.createShipment({
        orderId: order.id,
        shopId,
        items: items.map((item) => ({
          orderItemId: item.id,
          quantity: item.quantity,
        })),
      }))
    }

    return [...order.shipments, ...created]
  }

  async listSellerShipments(actor: ShipmentActor): Promise<ShipmentResponse[]> {
    const shopIds = await this.getSellerShopIds(actor.id)
    const shipments = await this.repo.findSellerShipments(shopIds)
    return shipments.map((shipment) => this.toSellerShipmentResponse(shipment))
  }

  async getSellerShipment(actor: ShipmentActor, shipmentId: string): Promise<ShipmentResponse> {
    const shopIds = await this.getSellerShopIds(actor.id)
    const shipment = await this.repo.findSellerShipmentById(shipmentId, shopIds)
    if (!shipment) throw new ShipmentServiceError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND')
    return this.toSellerShipmentResponse(shipment)
  }

  async getBuyerShipmentTracking(actor: ShipmentActor, shipmentId: string): Promise<BuyerShipmentTrackingResponse> {
    this.assertBuyer(actor)
    this.logger.info('ShipmentService.getBuyerShipmentTracking', { actorId: actor.id, shipmentId })
    const shipment = await this.repo.findBuyerShipmentById(shipmentId, actor.id)
    if (!shipment) throw new ShipmentServiceError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND')

    return {
      orderId: shipment.orderId,
      orderNo: shipment.order.orderNumber,
      orderStatus: shipment.order.status,
      shipments: [this.toBuyerTrackingShipment(shipment)],
    }
  }

  async packSellerShipment(actor: ShipmentActor, shipmentId: string): Promise<ShipmentResponse> {
    this.logger.info('ShipmentService.packSellerShipment', { actorId: actor.id, shipmentId })

    const response = await this.repo.transaction(async (txRepo) => {
      const shipment = await this.findSellerShipment(txRepo, actor.id, shipmentId)
      this.assertTransition(shipment.status, 'PACKED')

      const updated = await txRepo.updateShipmentPacked(shipment.id)
      await txRepo.updateOrderItemsStatus(this.getOrderItemIds(updated), 'PACKED')
      if (updated.order.status === 'PAID') {
        await txRepo.updateOrderStatus(updated.orderId, 'PROCESSING')
      }
      return this.toSellerShipmentResponse(updated)
    })
    await this.cacheInvalidation?.invalidateSellerDashboard(response.shopId)
    await this.auditShipmentStatus(actor, response.id, 'PENDING_PACK', 'PACKED')
    return response
  }

  async shipSellerShipment(actor: ShipmentActor, shipmentId: string, input: ShipShipmentInput): Promise<ShipmentResponse> {
    const carrier = input.carrier?.trim()
    const trackingNo = input.trackingNo?.trim()
    if (!carrier) throw new ShipmentServiceError('Carrier is required when shipping', 400, 'CARRIER_REQUIRED')
    if (!trackingNo) throw new ShipmentServiceError('Tracking number is required when shipping', 400, 'TRACKING_REQUIRED')
    this.logger.info('ShipmentService.shipSellerShipment', { actorId: actor.id, shipmentId, carrier })

    const response = await this.repo.transaction(async (txRepo) => {
      const shipment = await this.findSellerShipment(txRepo, actor.id, shipmentId)
      this.assertTransition(shipment.status, 'SHIPPED')

      const updated = await txRepo.updateShipmentShipped(shipment.id, carrier, trackingNo, new Date())
      await txRepo.updateOrderItemsStatus(this.getOrderItemIds(updated), 'SHIPPED')
      if (updated.order.status === 'PAID' || updated.order.status === 'PROCESSING') {
        await txRepo.updateOrderStatus(updated.orderId, 'SHIPPED')
      }
      return this.toSellerShipmentResponse(updated)
    })
    await this.publishBestEffort('shipment.shipped', response.id, actor.id, {
      shipmentId: response.id,
      orderId: response.orderId,
      shopId: response.shopId,
      carrier: response.carrier,
      trackingNumber: response.trackingNumber,
    })
    await this.cacheInvalidation?.invalidateSellerDashboard(response.shopId)
    await this.auditShipmentStatus(actor, response.id, 'PACKED', 'SHIPPED')
    return response
  }

  async deliverAdminShipment(actor: ShipmentActor, shipmentId: string, input: DeliverShipmentInput): Promise<ShipmentResponse> {
    this.assertAdmin(actor)
    const evidenceReference = input.evidenceReference?.trim()
    if (!evidenceReference) {
      throw new ShipmentServiceError('Carrier delivery evidence is required', 400, 'INVALID_SHIPMENT_STATE')
    }
    this.logger.info('ShipmentService.deliverAdminShipment', { actorId: actor.id, shipmentId })

    const response = await this.repo.transaction(async (txRepo) => {
      const shipment = await txRepo.findShipmentById(shipmentId)
      if (!shipment) throw new ShipmentServiceError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND')
      this.assertTransition(shipment.status, 'DELIVERED')

      const updated = await txRepo.updateShipmentDelivered(shipment.id, new Date())
      await txRepo.updateOrderItemsStatus(this.getOrderItemIds(updated), 'DELIVERED')
      if (this.allOrderShipmentsDelivered(updated)) {
        await txRepo.updateOrderStatus(updated.orderId, 'DELIVERED')
      }
      return this.toSellerShipmentResponse(updated)
    })
    await this.walletService?.createEarningsForCompletedOrder(response.orderId)
    await this.publishBestEffort('shipment.delivered', response.id, actor.id, {
      shipmentId: response.id,
      orderId: response.orderId,
      shopId: response.shopId,
      evidenceReference,
    })
    await this.cacheInvalidation?.invalidateSellerDashboard(response.shopId)
    await this.auditShipmentStatus(actor, response.id, 'SHIPPED', 'DELIVERED', { evidenceReference })
    return response
  }

  private getMissingShipmentShopIds(order: ShipmentOrderForCreation): string[] {
    const itemShopIds = new Set(order.items.map((item) => item.shopId))
    const existingShopIds = new Set(order.shipments.map((shipment) => shipment.shopId))
    return [...itemShopIds].filter((shopId) => !existingShopIds.has(shopId))
  }

  private assertBuyer(actor: ShipmentActor): void {
    if (actor.role === 'ADMIN') {
      throw new ShipmentServiceError('Buyer shipment APIs are only available to buyer accounts', 403, 'SHIPMENT_FORBIDDEN')
    }
  }

  private async getSellerShopIds(ownerId: string): Promise<string[]> {
    const shops = this.activeShopResolver
      ? await this.activeShopResolver.resolveActiveShops(ownerId)
      : await this.repo.findSellerShops(ownerId)
    if (shops.length === 0) throw new ShipmentServiceError('Active seller shop not found', 403, 'SHIPMENT_FORBIDDEN')
    return shops.map((shop) => shop.id)
  }

  private async findSellerShipment(
    repo: IShipmentRepository,
    ownerId: string,
    shipmentId: string,
  ): Promise<SellerShipment> {
    const shopIds = (await repo.findSellerShops(ownerId)).map((shop) => shop.id)
    if (shopIds.length === 0) throw new ShipmentServiceError('Active seller shop not found', 403, 'SHIPMENT_FORBIDDEN')
    const shipment = await repo.findSellerShipmentById(shipmentId, shopIds)
    if (!shipment) throw new ShipmentServiceError('Shipment not found', 404, 'SHIPMENT_NOT_FOUND')
    return shipment
  }

  private assertTransition(current: ShipmentStatus, next: 'PACKED' | 'SHIPPED' | 'DELIVERED'): void {
    if (current === 'DELIVERED') {
      throw new ShipmentServiceError('Delivered shipment cannot be updated', 409, 'INVALID_SHIPMENT_STATE')
    }
    if (next === 'PACKED' && current !== 'PENDING_PACK') {
      throw new ShipmentServiceError('Only pending shipments can be packed', 409, 'INVALID_SHIPMENT_STATE')
    }
    if (next === 'SHIPPED' && current !== 'PACKED') {
      throw new ShipmentServiceError('Shipment must be packed before shipping', 409, 'INVALID_SHIPMENT_STATE')
    }
    if (next === 'DELIVERED' && current !== 'SHIPPED') {
      throw new ShipmentServiceError('Shipment must be shipped before delivery', 409, 'INVALID_SHIPMENT_STATE')
    }
  }

  private getOrderItemIds(shipment: SellerShipment): string[] {
    return shipment.items.map((item) => item.orderItemId)
  }

  private allOrderShipmentsDelivered(shipment: SellerShipment): boolean {
    return shipment.order.shipments.every((orderShipment) =>
      orderShipment.id === shipment.id ? shipment.status === 'DELIVERED' : orderShipment.status === 'DELIVERED',
    )
  }

  private toSellerShipmentResponse(shipment: SellerShipment): ShipmentResponse {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      orderNo: shipment.order.orderNumber,
      shopId: shipment.shopId,
      status: shipment.status === 'PENDING_PACK' ? 'pending_pack' : shipment.status.toLowerCase(),
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingStatus: shipment.trackingNumber ? shipment.status.toLowerCase() : 'not_available',
      shippingAddress: {
        name: shipment.order.shippingName,
        phone: shipment.order.shippingPhone,
        line1: shipment.order.shippingLine1,
        line2: shipment.order.shippingLine2,
        city: shipment.order.shippingCity,
        region: shipment.order.shippingRegion,
        postalCode: shipment.order.shippingPostalCode,
        country: shipment.order.shippingCountry,
      },
      items: shipment.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        productTitle: item.orderItem.productTitle,
        productSlug: item.orderItem.productSlug,
        variantTitle: item.orderItem.variantTitle,
        variantSku: item.orderItem.variantSku,
        quantity: item.quantity,
        fulfillmentStatus: item.orderItem.fulfillmentStatus,
      })),
    }
  }

  private toBuyerTrackingShipment(shipment: BuyerShipment): BuyerShipmentTrackingResponse['shipments'][number] {
    const firstItem = shipment.items[0]?.orderItem
    return {
      shipmentId: shipment.id,
      shopId: shipment.shopId,
      shopName: firstItem?.shopName ?? '',
      carrier: shipment.carrier,
      trackingNo: shipment.trackingNumber,
      status: this.formatShipmentStatus(shipment.status),
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      items: shipment.items.map((item) => ({
        id: item.orderItem.id,
        shopId: item.orderItem.shopId,
        productTitle: item.orderItem.productTitle,
        productSlug: item.orderItem.productSlug,
        variantTitle: item.orderItem.variantTitle,
        variantSku: item.orderItem.variantSku,
        quantity: item.quantity,
        unitPrice: Number(item.orderItem.unitPrice),
        lineTotal: Number(item.orderItem.lineTotal),
        currency: item.orderItem.currency,
        fulfillmentStatus: item.orderItem.fulfillmentStatus,
      })),
      timeline: this.buildTimeline(shipment),
    }
  }

  private buildTimeline(shipment: Pick<BuyerShipment, 'status' | 'createdAt' | 'updatedAt' | 'shippedAt' | 'deliveredAt'>): BuyerShipmentTrackingResponse['shipments'][number]['timeline'] {
    const timeline: BuyerShipmentTrackingResponse['shipments'][number]['timeline'] = [
      {
        status: 'pending_pack',
        label: 'Seller is preparing your order',
        timestamp: shipment.createdAt,
      },
    ]

    if (shipment.status === 'PACKED' || shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') {
      timeline.push({
        status: 'packed',
        label: 'Seller packed your order',
        timestamp: shipment.updatedAt,
      })
    }

    if ((shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED') && shipment.shippedAt) {
      timeline.push({
        status: 'shipped',
        label: 'Your parcel has been shipped',
        timestamp: shipment.shippedAt,
      })
    }

    if (shipment.status === 'DELIVERED' && shipment.deliveredAt) {
      timeline.push({
        status: 'delivered',
        label: 'Delivered',
        timestamp: shipment.deliveredAt,
      })
    }

    return timeline
  }

  private formatShipmentStatus(status: BuyerShipment['status']): string {
    return status === 'PENDING_PACK' ? 'pending_pack' : status.toLowerCase()
  }

  private async publishBestEffort(
    eventName: 'shipment.shipped' | 'shipment.delivered',
    shipmentId: string,
    actorUserId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName,
        aggregateType: 'shipment',
        aggregateId: shipmentId,
        actorUserId,
        data,
      })
    } catch (error) {
      this.logger.warn('ShipmentService event publish failed', {
        eventName,
        shipmentId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private assertAdmin(actor: ShipmentActor): void {
    if (actor.role !== 'ADMIN') {
      throw new ShipmentServiceError('Admin delivery confirmation requires admin role', 403, 'SHIPMENT_FORBIDDEN')
    }
  }

  private async auditShipmentStatus(
    actor: ShipmentActor,
    shipmentId: string,
    beforeStatus: string,
    afterStatus: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditLogService?.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'SHIPMENT_STATUS_CHANGED',
      entityType: 'shipment',
      entityId: shipmentId,
      before: { status: beforeStatus },
      after: { status: afterStatus, ...details },
      nonCritical: false,
    })
  }
}
