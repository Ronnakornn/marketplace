import type {
  Order,
  OrderItem,
  PrismaClient,
  Shipment,
  ShipmentItem,
  Shop,
  ShopOrder,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type OrderShipment = Shipment & {
  items: Array<ShipmentItem & {
    orderItem: OrderItem
  }>
}

export type OrderRecord = Order & {
  items: Array<OrderItem & { remainingReturnQuantity?: number; hasActiveReturn?: boolean }>
  shipments: OrderShipment[]
  shopOrders: Array<Pick<ShopOrder, 'shopId' | 'subtotal' | 'discountTotal' | 'shippingTotal' | 'taxTotal' | 'includedTaxTotal' | 'reportedTaxTotal' | 'grandTotal' | 'currency'>>
}

export interface IOrderRepository {
  findBuyerOrders(userId: string): Promise<OrderRecord[]>
  findBuyerOrderById(orderId: string, userId: string): Promise<OrderRecord | null>
  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id' | 'name' | 'slug'>[]>
  findSellerOrders(shopIds: string[]): Promise<OrderRecord[]>
  findSellerOrderById(orderId: string, shopIds: string[]): Promise<OrderRecord | null>
}

const orderInclude = {
  shopOrders: {
    select: { shopId: true, subtotal: true, discountTotal: true, shippingTotal: true, taxTotal: true, includedTaxTotal: true, reportedTaxTotal: true, grandTotal: true, currency: true },
  },
  items: {
    include: { returnItems: { include: { returnRequest: { select: { status: true } } } }, saleSnapshot: { include: { shopSale: { select: { policyVersion: true } }, refundAllocations: { include: { refund: { select: { status: true } } } } } } },
    orderBy: { id: 'asc' },
  },
  refunds: { select: { status: true } },
  shipments: {
    include: {
      items: {
        include: {
          orderItem: true,
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

type ReadOrder = import('#generated/client/client.ts').Prisma.OrderGetPayload<{ include: typeof orderInclude }>

function withReturnCapacity(order: ReadOrder): OrderRecord {
  return { ...order, items: order.items.map((item) => {
    let hasActiveReturn = item.returnItems.some((row) => ['REQUESTED', 'APPROVED', 'RECEIVED'].includes(row.returnRequest.status))
    let remainingReturnQuantity = item.fulfillmentStatus === 'DELIVERED' ? item.quantity : 0
    const sale = item.saleSnapshot
    if (sale) {
      const successful = sale.refundAllocations.filter((row) => row.refund.status === 'SUCCESS').sort((a, b) => a.successfulQuantityBefore - b.successfulQuantityBefore)
      const held = sale.refundAllocations.filter((row) => row.refund.status === 'PENDING' || row.refund.status === 'PROCESSING')
      hasActiveReturn ||= held.length > 0
      let consumed = 0
      let valid = sale.originalQuantity === item.quantity && sale.grossMerchandise === item.lineTotal && sale.originalQuantity > 0
      valid &&= sale.shopSale.policyVersion === 1 || sale.shopSale.policyVersion === 2 && [sale.buyerMerchandiseNet, sale.buyerMerchandiseTax, sale.platformCouponNet, sale.platformCouponTax, sale.coinFundingNet, sale.coinFundingTax].every((value) => value !== null && value >= 0n)
      for (const row of successful) {
        valid &&= row.successfulQuantityBefore === consumed && row.quantity > 0
        consumed += row.quantity
      }
      valid &&= consumed <= item.quantity && held.length <= 1 && held.every((row) => row.successfulQuantityBefore === consumed && row.quantity > 0 && consumed + row.quantity <= item.quantity)
      remainingReturnQuantity = valid && !hasActiveReturn ? Math.max(0, remainingReturnQuantity - consumed) : 0
    } else if (hasActiveReturn || order.refunds.some((row) => ['SUCCESS', 'PENDING', 'PROCESSING'].includes(row.status))) remainingReturnQuantity = 0
    return { ...item, remainingReturnQuantity, hasActiveReturn }
  }) }
}

export class PrismaOrderRepository implements IOrderRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findBuyerOrders(userId: string): Promise<OrderRecord[]> {
    this.logger.debug('PrismaOrderRepository.findBuyerOrders', { userId })
    return this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    }).then((orders) => orders.map(withReturnCapacity))
  }

  findBuyerOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
    this.logger.debug('PrismaOrderRepository.findBuyerOrderById', { orderId, userId })
    return this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    }).then((order) => order ? withReturnCapacity(order) : null)
  }

  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id' | 'name' | 'slug'>[]> {
    this.logger.debug('PrismaOrderRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  findSellerOrders(shopIds: string[]): Promise<OrderRecord[]> {
    this.logger.debug('PrismaOrderRepository.findSellerOrders', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.order.findMany({
      where: {
        items: {
          some: {
            shopId: { in: shopIds },
          },
        },
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  findSellerOrderById(orderId: string, shopIds: string[]): Promise<OrderRecord | null> {
    this.logger.debug('PrismaOrderRepository.findSellerOrderById', { orderId, shopIds })
    if (shopIds.length === 0) return Promise.resolve(null)

    return this.prisma.order.findFirst({
      where: {
        id: orderId,
        items: {
          some: {
            shopId: { in: shopIds },
          },
        },
      },
      include: orderInclude,
    })
  }
}
