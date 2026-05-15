import type {
  Inventory,
  Order,
  OrderItem,
  PrismaClient,
  Product,
  ProductVariant,
  Shipment,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type SellerDashboardShop = Pick<Shop, 'id' | 'name' | 'slug'>

export type SellerSalesOrderItem = Pick<OrderItem, 'id' | 'shopId' | 'lineTotalCents' | 'quantity'> & {
  order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'createdAt'>
}

export type SellerDashboardOrder = Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'createdAt'> & {
  items: OrderItem[]
}

export type SellerLowStockVariant = Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  inventory: Inventory | null
  product: Pick<Product, 'id' | 'title' | 'slug' | 'shopId' | 'status'>
}

export interface ISellerDashboardRepository {
  findSellerShops(ownerId: string): Promise<SellerDashboardShop[]>
  findSalesOrderItems(shopIds: string[]): Promise<SellerSalesOrderItem[]>
  findShipments(shopIds: string[]): Promise<Pick<Shipment, 'id' | 'status'>[]>
  countProductsByStatus(shopIds: string[], active: boolean): Promise<number>
  findLowStockVariants(shopIds: string[]): Promise<SellerLowStockVariant[]>
  findRecentOrders(shopIds: string[], limit: number): Promise<SellerDashboardOrder[]>
}

export class PrismaSellerDashboardRepository implements ISellerDashboardRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findSellerShops(ownerId: string): Promise<SellerDashboardShop[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId },
      select: { id: true, name: true, slug: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  findSalesOrderItems(shopIds: string[]): Promise<SellerSalesOrderItem[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findSalesOrderItems', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.orderItem.findMany({
      where: {
        shopId: { in: shopIds },
        order: {
          paymentStatus: 'SUCCEEDED',
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED'] },
        },
      },
      select: {
        id: true,
        shopId: true,
        lineTotalCents: true,
        quantity: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    })
  }

  findShipments(shopIds: string[]): Promise<Pick<Shipment, 'id' | 'status'>[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findShipments', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.shipment.findMany({
      where: { shopId: { in: shopIds } },
      select: { id: true, status: true },
    })
  }

  countProductsByStatus(shopIds: string[], active: boolean): Promise<number> {
    this.logger.debug('PrismaSellerDashboardRepository.countProductsByStatus', { shopIds, active })
    if (shopIds.length === 0) return Promise.resolve(0)

    return this.prisma.product.count({
      where: {
        shopId: { in: shopIds },
        status: active ? 'ACTIVE' : { not: 'ACTIVE' },
      },
    })
  }

  findLowStockVariants(shopIds: string[]): Promise<SellerLowStockVariant[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findLowStockVariants', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.productVariant.findMany({
      where: {
        product: {
          shopId: { in: shopIds },
        },
        inventory: {
          isNot: null,
        },
      },
      include: {
        inventory: true,
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            shopId: true,
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  findRecentOrders(shopIds: string[], limit: number): Promise<SellerDashboardOrder[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findRecentOrders', { shopIds, limit })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.order.findMany({
      where: {
        items: {
          some: {
            shopId: { in: shopIds },
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        items: {
          where: {
            shopId: { in: shopIds },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
