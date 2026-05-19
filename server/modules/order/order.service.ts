import type { Role } from '#generated/client/enums.ts'
import type { OrderItem } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { OrderServiceError } from './order.errors.ts'
import type { IOrderRepository, OrderRecord, OrderShipment } from './order.repository.ts'

export interface OrderActor {
  id: string
  role: Role
}

export interface OrderItemResponse {
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
}

export interface OrderShopGroupResponse {
  shopId: string
  shopName: string
  shopSlug: string
  items: OrderItemResponse[]
  shipments: ShipmentResponse[]
}

export interface ShipmentResponse {
  id: string
  orderId: string
  shopId: string
  status: string
  carrier: string | null
  trackingNumber: string | null
  trackingStatus: string
  items: Array<{
    id: string
    orderItemId: string
    quantity: number
  }>
}

export interface TrackingTimelineEvent {
  status: string
  label: string
  timestamp: Date
}

export interface TrackingShipmentResponse {
  shipmentId: string
  shopId: string
  shopName: string
  carrier: string | null
  trackingNo: string | null
  status: string
  shippedAt: Date | null
  deliveredAt: Date | null
  items: OrderItemResponse[]
  timeline: TrackingTimelineEvent[]
}

export interface OrderTrackingResponse {
  orderId: string
  orderNo: string
  orderStatus: string
  shipments: TrackingShipmentResponse[]
}

export interface OrderDetailResponse {
  id: string
  orderNo: string
  status: string
  paymentStatus: string
  totals: {
    subtotal: number
    discountTotal: number
    shippingTotal: number
    taxTotal: number
    grandTotal: number
    currency: string
  }
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
  shops: OrderShopGroupResponse[]
  items: OrderItemResponse[]
  shipments: ShipmentResponse[]
}

export class OrderService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IOrderRepository,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async listBuyerOrders(actor: OrderActor): Promise<OrderDetailResponse[]> {
    this.assertBuyer(actor)
    this.logger.info('OrderService.listBuyerOrders', { actorId: actor.id })
    const orders = await this.repo.findBuyerOrders(actor.id)
    return orders.map((order) => this.toBuyerOrderResponse(order))
  }

  async getBuyerOrder(actor: OrderActor, orderId: string): Promise<OrderDetailResponse> {
    this.assertBuyer(actor)
    this.logger.info('OrderService.getBuyerOrder', { actorId: actor.id, orderId })
    const order = await this.repo.findBuyerOrderById(orderId, actor.id)
    if (!order) throw new OrderServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
    return this.toBuyerOrderResponse(order)
  }

  async getBuyerOrderTracking(actor: OrderActor, orderId: string): Promise<OrderTrackingResponse> {
    this.assertBuyer(actor)
    this.logger.info('OrderService.getBuyerOrderTracking', { actorId: actor.id, orderId })
    const order = await this.repo.findBuyerOrderById(orderId, actor.id)
    if (!order) throw new OrderServiceError('Order not found', 404, 'ORDER_NOT_FOUND')

    return {
      orderId: order.id,
      orderNo: order.orderNumber,
      orderStatus: order.status,
      shipments: order.shipments.map((shipment) => this.toTrackingShipmentResponse(shipment)),
    }
  }

  async listSellerOrders(actor: OrderActor): Promise<OrderDetailResponse[]> {
    this.logger.info('OrderService.listSellerOrders', { actorId: actor.id })
    const shopIds = await this.getSellerShopIds(actor.id)
    const orders = await this.repo.findSellerOrders(shopIds)
    return orders.map((order) => this.toSellerOrderResponse(order, shopIds))
  }

  async getSellerOrder(actor: OrderActor, orderId: string): Promise<OrderDetailResponse> {
    this.logger.info('OrderService.getSellerOrder', { actorId: actor.id, orderId })
    const shopIds = await this.getSellerShopIds(actor.id)
    const order = await this.repo.findSellerOrderById(orderId, shopIds)
    if (!order) throw new OrderServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
    return this.toSellerOrderResponse(order, shopIds)
  }

  private assertBuyer(actor: OrderActor): void {
    if (actor.role === 'ADMIN') {
      throw new OrderServiceError('Buyer order APIs are only available to buyer accounts', 403, 'ORDER_FORBIDDEN')
    }
  }

  private async getSellerShopIds(ownerId: string): Promise<string[]> {
    const shops = this.activeShopResolver
      ? await this.activeShopResolver.resolveActiveShops(ownerId)
      : await this.repo.findSellerShops(ownerId)
    if (shops.length === 0) throw new OrderServiceError('Active seller shop not found', 403, 'ORDER_FORBIDDEN')
    return shops.map((shop) => shop.id)
  }

  private toBuyerOrderResponse(order: OrderRecord): OrderDetailResponse {
    return this.toOrderResponse(order, order.items, order.shipments)
  }

  private toSellerOrderResponse(order: OrderRecord, shopIds: string[]): OrderDetailResponse {
    const allowed = new Set(shopIds)
    const items = order.items.filter((item) => allowed.has(item.shopId))
    const shipments = order.shipments
      .filter((shipment) => allowed.has(shipment.shopId))
      .map((shipment) => ({
        ...shipment,
        items: shipment.items.filter((shipmentItem) => items.some((item) => item.id === shipmentItem.orderItemId)),
      }))
    return this.toOrderResponse(order, items, shipments)
  }

  private toOrderResponse(
    order: OrderRecord,
    items: OrderItem[],
    shipments: OrderShipment[],
  ): OrderDetailResponse {
    const shipmentResponses = shipments.map((shipment) => this.toShipmentResponse(shipment))
    return {
      id: order.id,
      orderNo: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totals: {
        subtotal: this.toMoneyNumber(order.subtotal),
        discountTotal: this.toMoneyNumber(order.discountTotal),
        shippingTotal: this.toMoneyNumber(order.shippingTotal),
        taxTotal: this.toMoneyNumber(order.taxTotal),
        grandTotal: this.toMoneyNumber(order.grandTotal),
        currency: order.currency,
      },
      shippingAddress: {
        name: order.shippingName,
        phone: order.shippingPhone,
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        region: order.shippingRegion,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      shops: this.groupItemsByShop(items, shipmentResponses),
      items: items.map((item) => this.toItemResponse(item)),
      shipments: shipmentResponses,
    }
  }

  private groupItemsByShop(items: OrderItem[], shipments: ShipmentResponse[]): OrderShopGroupResponse[] {
    const groups = new Map<string, OrderShopGroupResponse>()
    for (const item of items) {
      const group = groups.get(item.shopId) ?? {
        shopId: item.shopId,
        shopName: item.shopName,
        shopSlug: item.shopSlug,
        items: [],
        shipments: shipments.filter((shipment) => shipment.shopId === item.shopId),
      }
      group.items.push(this.toItemResponse(item))
      groups.set(item.shopId, group)
    }
    return [...groups.values()]
  }

  private toItemResponse(item: OrderItem): OrderItemResponse {
    return {
      id: item.id,
      shopId: item.shopId,
      productTitle: item.productTitle,
      productSlug: item.productSlug,
      variantTitle: item.variantTitle,
      variantSku: item.variantSku,
      quantity: item.quantity,
      unitPrice: this.toMoneyNumber(item.unitPrice),
      lineTotal: this.toMoneyNumber(item.lineTotal),
      currency: item.currency,
      fulfillmentStatus: item.fulfillmentStatus,
    }
  }

  private toShipmentResponse(shipment: OrderShipment): ShipmentResponse {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      shopId: shipment.shopId,
      status: shipment.status === 'PENDING_PACK' ? 'pending_pack' : shipment.status.toLowerCase(),
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingStatus: shipment.trackingNumber ? shipment.status.toLowerCase() : 'not_available',
      items: shipment.items.map((item) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
    }
  }

  private toTrackingShipmentResponse(shipment: OrderShipment): TrackingShipmentResponse {
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
      items: shipment.items.map((item) => this.toItemResponse(item.orderItem)),
      timeline: this.buildTimeline(shipment),
    }
  }

  private buildTimeline(shipment: OrderShipment): TrackingTimelineEvent[] {
    const timeline: TrackingTimelineEvent[] = [
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

  private formatShipmentStatus(status: OrderShipment['status']): string {
    return status === 'PENDING_PACK' ? 'pending_pack' : status.toLowerCase()
  }

  private toMoneyNumber(value: bigint | number): number {
    return typeof value === 'bigint' ? Number(value) : value
  }
}
