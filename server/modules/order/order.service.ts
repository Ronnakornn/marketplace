import { moneyInteger } from '#server/lib/money.ts'
import type { Role } from '#generated/client/enums.ts'
import type { OrderItem } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import {
  buildBuyerShipmentTimeline,
  formatBuyerShipmentStatus,
} from '#server/modules/shipment/buyer-shipment-projection.ts'
import { adaptOrderShipmentProgress } from './buyer-shipment.adapter.ts'
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
  remainingReturnQuantity: number
  hasActiveReturn: boolean
  unitPrice: bigint
  lineTotal: bigint
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
    subtotal: bigint
    discountTotal: bigint
    shippingTotal: bigint
    taxTotal: bigint
    includedTaxTotal: bigint
    reportedTaxTotal: bigint
    grandTotal: bigint
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
    const totals = order.shopOrders.filter((shopOrder) => allowed.has(shopOrder.shopId)).reduce(
      (total, shopOrder) => ({
        subtotal: total.subtotal + this.toMoneyInteger(shopOrder.subtotal),
        discountTotal: total.discountTotal + this.toMoneyInteger(shopOrder.discountTotal),
        shippingTotal: total.shippingTotal + this.toMoneyInteger(shopOrder.shippingTotal),
        taxTotal: total.taxTotal + this.toMoneyInteger(shopOrder.taxTotal),
        includedTaxTotal: total.includedTaxTotal + this.toMoneyInteger(shopOrder.includedTaxTotal),
        reportedTaxTotal: total.reportedTaxTotal + this.toMoneyInteger(shopOrder.reportedTaxTotal),
        grandTotal: total.grandTotal + this.toMoneyInteger(shopOrder.grandTotal),
        currency: shopOrder.currency,
      }),
      { subtotal: 0n, discountTotal: 0n, shippingTotal: 0n, taxTotal: 0n, includedTaxTotal: 0n, reportedTaxTotal: 0n, grandTotal: 0n, currency: order.currency },
    )
    return { ...this.toOrderResponse(order, items, shipments), totals }
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
        subtotal: this.toMoneyInteger(order.subtotal),
        discountTotal: this.toMoneyInteger(order.discountTotal),
        shippingTotal: this.toMoneyInteger(order.shippingTotal),
        taxTotal: this.toMoneyInteger(order.taxTotal),
        includedTaxTotal: this.toMoneyInteger(order.includedTaxTotal),
        reportedTaxTotal: this.toMoneyInteger(order.reportedTaxTotal),
        grandTotal: this.toMoneyInteger(order.grandTotal),
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

  private toItemResponse(item: OrderItem & { remainingReturnQuantity?: number; hasActiveReturn?: boolean }): OrderItemResponse {
    return {
      id: item.id,
      shopId: item.shopId,
      productTitle: item.productTitle,
      productSlug: item.productSlug,
      variantTitle: item.variantTitle,
      variantSku: item.variantSku,
      quantity: item.quantity,
      remainingReturnQuantity: item.remainingReturnQuantity ?? 0,
      hasActiveReturn: item.hasActiveReturn ?? false,
      unitPrice: this.toMoneyInteger(item.unitPrice),
      lineTotal: this.toMoneyInteger(item.lineTotal),
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
      status: formatBuyerShipmentStatus(shipment.status),
      shippedAt: shipment.shippedAt,
      deliveredAt: shipment.deliveredAt,
      items: shipment.items.map((item) => this.toItemResponse(item.orderItem)),
      timeline: buildBuyerShipmentTimeline(adaptOrderShipmentProgress(shipment)),
    }
  }

  private toMoneyInteger(value: bigint | number): bigint {
    return moneyInteger(value)
  }
}
