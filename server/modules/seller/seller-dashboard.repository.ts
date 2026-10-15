import { Prisma } from '#generated/client/client.ts'
import type {
  Inventory,
  Order,
  OrderItem,
  PrismaClient,
  Product,
  ProductVariant,
  ShopRating,
  Shop,
  User,
} from '#generated/client/client.ts'
import type { ReviewStatus, ShipmentStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type SellerDashboardShop = Pick<Shop, 'id' | 'name' | 'slug'>

export type SalesPeriod = { from: Date; to: Date }
export type SellerSalesPeriods = { today: SalesPeriod; month: SalesPeriod }
export type SellerSalesSummary = {
  todaySalesCents: bigint
  thisMonthSalesCents: bigint
  totalSalesCents: bigint
}
export type SellerShipmentCount = { status: ShipmentStatus; count: number }

export type SellerDashboardOrder = Pick<Order, 'id' | 'orderNumber' | 'status' | 'paymentStatus' | 'createdAt'> & {
  items: OrderItem[]
}

export type SellerLowStockVariant = Pick<ProductVariant, 'id' | 'productId' | 'title' | 'sku'> & {
  inventory: Pick<Inventory, 'quantityOnHand' | 'quantityReserved' | 'reorderLevel'>
  product: Pick<Product, 'title' | 'slug'>
}

type LowStockRow = Pick<SellerLowStockVariant, 'id' | 'productId' | 'title' | 'sku'> &
  SellerLowStockVariant['inventory'] & { productTitle: string; productSlug: string }

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
  aggregateSales(shopIds: string[], periods: SellerSalesPeriods): Promise<SellerSalesSummary>
  countShipmentsByStatus(shopIds: string[]): Promise<SellerShipmentCount[]>
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

  async aggregateSales(shopIds: string[], periods: SellerSalesPeriods): Promise<SellerSalesSummary> {
    this.logger.debug('PrismaSellerDashboardRepository.aggregateSales', { shopIds, periods })
    if (shopIds.length === 0) return { todaySalesCents: 0n, thisMonthSalesCents: 0n, totalSalesCents: 0n }

    const sum = (period?: SalesPeriod) => this.prisma.orderItem.aggregate({
      where: {
        shopId: { in: shopIds },
        order: {
          paymentStatus: 'SUCCEEDED',
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED'] },
          ...(period ? { createdAt: { gte: period.from, lte: period.to } } : {}),
        },
      },
      _sum: { lineTotal: true },
    })
    const [total, today, month] = await Promise.all([sum(), sum(periods.today), sum(periods.month)])
    return {
      todaySalesCents: today._sum.lineTotal ?? 0n,
      thisMonthSalesCents: month._sum.lineTotal ?? 0n,
      totalSalesCents: total._sum.lineTotal ?? 0n,
    }
  }

  async countShipmentsByStatus(shopIds: string[]): Promise<SellerShipmentCount[]> {
    this.logger.debug('PrismaSellerDashboardRepository.countShipmentsByStatus', { shopIds })
    if (shopIds.length === 0) return []
    const groups = await this.prisma.shipment.groupBy({
      by: ['status'],
      where: { shopId: { in: shopIds } },
      _count: { _all: true },
    })
    return groups.map((group) => ({ status: group.status, count: group._count._all }))
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

  async findLowStockVariants(shopIds: string[]): Promise<SellerLowStockVariant[]> {
    this.logger.debug('PrismaSellerDashboardRepository.findLowStockVariants', { shopIds })
    if (shopIds.length === 0) return []

    const rows = await this.prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT v."id", v."productId", v."title", v."sku",
             i."quantityOnHand", i."quantityReserved", i."reorderLevel",
             p."title" AS "productTitle", p."slug" AS "productSlug"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      JOIN "Inventory" i ON i."variantId" = v."id"
      WHERE p."shopId" IN (${Prisma.join(shopIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND i."quantityOnHand"::bigint - i."quantityReserved"::bigint <= i."reorderLevel"
      ORDER BY v."updatedAt" DESC
    `)
    return rows.map((row) => ({
      id: row.id,
      productId: row.productId,
      title: row.title,
      sku: row.sku,
      inventory: {
        quantityOnHand: row.quantityOnHand,
        quantityReserved: row.quantityReserved,
        reorderLevel: row.reorderLevel,
      },
      product: { title: row.productTitle, slug: row.productSlug },
    }))
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
