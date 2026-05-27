import type {
  Inventory,
  Order,
  OrderItem,
  PrismaClient,
  Product,
  ProductVariant,
  ShopRating,
  Shipment,
  Shop,
  User,
} from '#generated/client/client.ts'
import type { ReviewStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type SellerDashboardShop = Pick<Shop, 'id' | 'name' | 'slug'>

export type SellerSalesOrderItem = Pick<OrderItem, 'id' | 'shopId' | 'lineTotal' | 'quantity'> & {
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

export interface SellerShopReviewAggregateRecord {
  _avg: {
    rating: number | null
  }
  _count: {
    id: number
  }
}

export type SellerDashboardShopReview = Pick<
  ShopRating,
  'id' | 'shopId' | 'rating' | 'body' | 'status' | 'moderatedAt' | 'moderationReason' | 'createdAt'
> & {
  user: Pick<User, 'id' | 'name'>
  shop: Pick<Shop, 'id' | 'name' | 'slug'>
}

export interface ISellerDashboardRepository {
  findSellerShops(ownerId: string): Promise<SellerDashboardShop[]>
  findSalesOrderItems(shopIds: string[]): Promise<SellerSalesOrderItem[]>
  findShipments(shopIds: string[]): Promise<Pick<Shipment, 'id' | 'status'>[]>
  countProductsByStatus(shopIds: string[], active: boolean): Promise<number>
  findLowStockVariants(shopIds: string[]): Promise<SellerLowStockVariant[]>
  findRecentOrders(shopIds: string[], limit: number): Promise<SellerDashboardOrder[]>
  countShopReviewsByStatus(shopIds: string[], status: ReviewStatus): Promise<number>
  aggregatePublishedShopReviews(shopIds: string[]): Promise<SellerShopReviewAggregateRecord>
  findRecentShopReviews(shopIds: string[], limit: number, statuses?: ReviewStatus[]): Promise<SellerDashboardShopReview[]>
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
      where: { ownerId, status: 'ACTIVE' },
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
        lineTotal: true,
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

  countShopReviewsByStatus(shopIds: string[], status: ReviewStatus): Promise<number> {
    this.logger.debug('PrismaSellerDashboardRepository.countShopReviewsByStatus', { shopIds, status })
    if (shopIds.length === 0) return Promise.resolve(0)

    return this.prisma.shopRating.count({
      where: {
        shopId: { in: shopIds },
        status,
      },
    })
  }

  aggregatePublishedShopReviews(shopIds: string[]): Promise<SellerShopReviewAggregateRecord> {
    this.logger.debug('PrismaSellerDashboardRepository.aggregatePublishedShopReviews', { shopIds })
    if (shopIds.length === 0) {
      return Promise.resolve({
        _avg: { rating: null },
        _count: { id: 0 },
      })
    }

    return this.prisma.shopRating.aggregate({
      where: {
        shopId: { in: shopIds },
        status: 'PUBLISHED',
      },
      _avg: { rating: true },
      _count: { id: true },
    }) as Promise<SellerShopReviewAggregateRecord>
  }

  findRecentShopReviews(shopIds: string[], limit: number, statuses?: ReviewStatus[]): Promise<SellerDashboardShopReview[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findRecentShopReviews', { shopIds, limit, statuses })
    if (shopIds.length === 0) return Promise.resolve([])

    return this.prisma.shopRating.findMany({
      where: {
        shopId: { in: shopIds },
        ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
      select: {
        id: true,
        shopId: true,
        rating: true,
        body: true,
        status: true,
        moderatedAt: true,
        moderationReason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        shop: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }) as Promise<SellerDashboardShopReview[]>
  }
}
