import type {
  Order,
  OrderItem,
  PrismaClient,
  Shipment,
  ShipmentItem,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type OrderShipment = Shipment & {
  items: Array<ShipmentItem & {
    orderItem: OrderItem
  }>
}

export type OrderRecord = Order & {
  items: OrderItem[]
  shipments: OrderShipment[]
}

export interface IOrderRepository {
  findBuyerOrders(userId: string): Promise<OrderRecord[]>
  findBuyerOrderById(orderId: string, userId: string): Promise<OrderRecord | null>
  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id' | 'name' | 'slug'>[]>
  findSellerOrders(shopIds: string[]): Promise<OrderRecord[]>
  findSellerOrderById(orderId: string, shopIds: string[]): Promise<OrderRecord | null>
}

const orderInclude = {
  items: {
    orderBy: { id: 'asc' },
  },
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
    })
  }

  findBuyerOrderById(orderId: string, userId: string): Promise<OrderRecord | null> {
    this.logger.debug('PrismaOrderRepository.findBuyerOrderById', { orderId, userId })
    return this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    })
  }

  findSellerShops(ownerId: string): Promise<Pick<Shop, 'id' | 'name' | 'slug'>[]> {
    this.logger.debug('PrismaOrderRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId },
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
