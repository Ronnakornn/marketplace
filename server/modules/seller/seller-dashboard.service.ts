import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import type { ActiveShopResolver } from '#server/modules/security'
import { SellerDashboardServiceError } from './seller-dashboard.errors.ts'
import type {
  ISellerDashboardRepository,
  SellerDashboardOrder,
  SellerDashboardShopReview,
  SellerLowStockVariant,
  SellerSalesOrderItem,
} from './seller-dashboard.repository.ts'

const DEFAULT_RECENT_ORDER_LIMIT = 10
const MAX_RECENT_ORDER_LIMIT = 50
const DEFAULT_REVIEW_LIMIT = 10
const MAX_REVIEW_LIMIT = 25
const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'] as const

export interface SellerDashboardActor {
  id: string
  role: Role
}

export interface SellerDashboardResponse {
  sales: SellerSalesSummaryResponse
  orders: SellerOrderSummaryResponse
  products: SellerProductSummaryResponse
  shopInsights: SellerShopInsightSummaryResponse
  recentOrders: SellerRecentOrderResponse[]
  lowStockItems: SellerLowStockItemResponse[]
}

export interface SellerShopInsightSummaryResponse {
  averageRating: number
  publishedReviewCount: number
  pendingReviewCount: number
}

export interface SellerSalesSummaryResponse {
  todaySalesCents: number
  thisMonthSalesCents: number
  totalSalesCents: number
}

export interface SellerOrderSummaryResponse {
  pendingPack: number
  shipped: number
  delivered: number
  cancelled: number
}

export interface SellerProductSummaryResponse {
  active: number
  inactive: number
  lowStock: number
}

export interface SellerRecentOrderResponse {
  orderId: string
  orderNo: string
  status: string
  paymentStatus: string
  createdAt: Date
  totalCents: number
  items: Array<{
    orderItemId: string
    productTitle: string
    productSlug: string
    variantTitle: string
    variantSku: string
    quantity: number
    lineTotal: number
    fulfillmentStatus: string
  }>
}

export interface SellerLowStockItemResponse {
  variantId: string
  productId: string
  productTitle: string
  productSlug: string
  variantTitle: string
  sku: string
  quantityOnHand: number
  quantityReserved: number
  availableQuantity: number
  reorderLevel: number
}

export interface SellerShopReviewResponse {
  reviewId: string
  shopId: string
  shopName: string
  shopSlug: string
  buyerId: string
  buyerName: string
  rating: number
  comment: string | null
  status: string
  createdAt: Date
  moderatedAt: Date | null
  moderationReason: string | null
}

export class SellerDashboardService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ISellerDashboardRepository,
    private cache?: CacheService,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async getDashboard(actor: SellerDashboardActor, limit?: number, shopId?: string): Promise<SellerDashboardResponse> {
    const shopIds = await this.getScopedSellerShopIds(actor, shopId)
    const recentLimit = this.normalizeLimit(limit)
    this.logger.info('SellerDashboardService.getDashboard', { actorId: actor.id, shopIds, recentLimit, shopId })

    if (this.cache && shopIds.length === 1 && recentLimit === DEFAULT_RECENT_ORDER_LIMIT) {
      return this.cache.remember(
        this.cache.keys.sellerDashboard(shopIds[0]!),
        () => this.getDashboardForShopIds(shopIds, recentLimit),
        { ttlSeconds: this.cache.ttl().sellerDashboard },
      )
    }

    return this.getDashboardForShopIds(shopIds, recentLimit)
  }

  private async getDashboardForShopIds(shopIds: string[], recentLimit: number): Promise<SellerDashboardResponse> {
    const [
      salesItems,
      shipments,
      activeProducts,
      inactiveProducts,
      lowStockVariants,
      recentOrders,
      publishedReviewAggregate,
      pendingReviewCount,
    ] = await Promise.all([
      this.repo.findSalesOrderItems(shopIds),
      this.repo.findShipments(shopIds),
      this.repo.countProductsByStatus(shopIds, true),
      this.repo.countProductsByStatus(shopIds, false),
      this.repo.findLowStockVariants(shopIds),
      this.repo.findRecentOrders(shopIds, recentLimit),
      this.repo.aggregatePublishedShopReviews(shopIds),
      this.repo.countShopReviewsByStatus(shopIds, 'PENDING'),
    ])

    const lowStockItems = this.toLowStockItems(lowStockVariants)
    const averageRating = publishedReviewAggregate._avg.rating === null
      ? 0
      : Number(publishedReviewAggregate._avg.rating.toFixed(2))

    return {
      sales: this.toSalesSummary(salesItems),
      orders: {
        pendingPack: shipments.filter((shipment) => shipment.status === 'PENDING_PACK').length,
        shipped: shipments.filter((shipment) => shipment.status === 'SHIPPED').length,
        delivered: shipments.filter((shipment) => shipment.status === 'DELIVERED').length,
        cancelled: shipments.filter((shipment) => shipment.status === 'CANCELED').length,
      },
      products: {
        active: activeProducts,
        inactive: inactiveProducts,
        lowStock: lowStockItems.length,
      },
      shopInsights: {
        averageRating,
        publishedReviewCount: publishedReviewAggregate._count.id,
        pendingReviewCount,
      },
      recentOrders: recentOrders.map((order) => this.toRecentOrder(order)),
      lowStockItems,
    }
  }

  async getSalesSummary(actor: SellerDashboardActor, shopId?: string): Promise<SellerSalesSummaryResponse> {
    const shopIds = await this.getScopedSellerShopIds(actor, shopId)
    return this.toSalesSummary(await this.repo.findSalesOrderItems(shopIds))
  }

  async getRecentOrders(actor: SellerDashboardActor, limit?: number, shopId?: string): Promise<SellerRecentOrderResponse[]> {
    const shopIds = await this.getScopedSellerShopIds(actor, shopId)
    const orders = await this.repo.findRecentOrders(shopIds, this.normalizeLimit(limit))
    return orders.map((order) => this.toRecentOrder(order))
  }

  async getLowStock(actor: SellerDashboardActor, shopId?: string): Promise<SellerLowStockItemResponse[]> {
    const shopIds = await this.getScopedSellerShopIds(actor, shopId)
    return this.toLowStockItems(await this.repo.findLowStockVariants(shopIds))
  }

  async getShopReviews(
    actor: SellerDashboardActor,
    input: { limit?: number; shopId?: string; status?: string },
  ): Promise<SellerShopReviewResponse[]> {
    const reviewLimit = this.normalizeReviewLimit(input.limit)
    const shopIds = await this.getScopedSellerShopIds(actor, input.shopId)
    const statuses = this.normalizeReviewStatuses(input.status)

    if (this.cache && shopIds.length === 1) {
      return this.cache.remember(
        this.cache.keys.sellerDashboardInsights(shopIds[0]!, {
          kind: 'shop-reviews',
          limit: reviewLimit,
          statuses,
        }),
        async () => {
          const reviews = await this.repo.findRecentShopReviews(shopIds, reviewLimit, statuses)
          return reviews.map((review) => this.toShopReview(review))
        },
        { ttlSeconds: this.cache.ttl().sellerDashboard },
      )
    }

    const reviews = await this.repo.findRecentShopReviews(shopIds, reviewLimit, statuses)
    return reviews.map((review) => this.toShopReview(review))
  }

  private async getSellerShopIds(actor: SellerDashboardActor): Promise<string[]> {
    const shops = this.activeShopResolver
      ? await this.activeShopResolver.resolveActiveShops(actor.id)
      : await this.repo.findSellerShops(actor.id)
    if (shops.length === 0) {
      throw new SellerDashboardServiceError('Active seller shop not found', 403, 'SELLER_SHOP_NOT_ACTIVE')
    }
    return shops.map((shop) => shop.id)
  }

  private async getScopedSellerShopIds(actor: SellerDashboardActor, shopId?: string): Promise<string[]> {
    const shopIds = await this.getSellerShopIds(actor)
    if (!shopId) return shopIds
    if (!shopIds.includes(shopId)) {
      throw new SellerDashboardServiceError('Seller shop scope is forbidden', 403, 'DASHBOARD_FORBIDDEN')
    }
    return [shopId]
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_RECENT_ORDER_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_RECENT_ORDER_LIMIT) {
      throw new SellerDashboardServiceError(`Limit must be between 1 and ${MAX_RECENT_ORDER_LIMIT}`, 400, 'DASHBOARD_FORBIDDEN')
    }
    return value
  }

  private normalizeReviewLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_REVIEW_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_REVIEW_LIMIT) {
      throw new SellerDashboardServiceError(`Review limit must be between 1 and ${MAX_REVIEW_LIMIT}`, 400, 'DASHBOARD_FORBIDDEN')
    }
    return value
  }

  private normalizeReviewStatuses(status?: string): Array<(typeof REVIEW_STATUSES)[number]> | undefined {
    if (!status) return undefined
    if (!REVIEW_STATUSES.includes(status as (typeof REVIEW_STATUSES)[number])) {
      throw new SellerDashboardServiceError('Review status is invalid', 400, 'DASHBOARD_FORBIDDEN')
    }
    return [status as (typeof REVIEW_STATUSES)[number]]
  }

  private toSalesSummary(items: SellerSalesOrderItem[]): SellerSalesSummaryResponse {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    return {
      todaySalesCents: this.sumSales(items.filter((item) => item.order.createdAt >= todayStart)),
      thisMonthSalesCents: this.sumSales(items.filter((item) => item.order.createdAt >= monthStart)),
      totalSalesCents: this.sumSales(items),
    }
  }

  private sumSales(items: SellerSalesOrderItem[]): number {
    return items.reduce((total, item) => total + Number(item.lineTotal), 0)
  }

  private toRecentOrder(order: SellerDashboardOrder): SellerRecentOrderResponse {
    return {
      orderId: order.id,
      orderNo: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      totalCents: order.items.reduce((total, item) => total + Number(item.lineTotal), 0),
      items: order.items.map((item) => ({
        orderItemId: item.id,
        productTitle: item.productTitle,
        productSlug: item.productSlug,
        variantTitle: item.variantTitle,
        variantSku: item.variantSku,
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
        fulfillmentStatus: item.fulfillmentStatus,
      })),
    }
  }

  private toLowStockItems(variants: SellerLowStockVariant[]): SellerLowStockItemResponse[] {
    return variants
      .filter((variant) => {
        if (!variant.inventory) return false
        const availableQuantity = variant.inventory.quantityOnHand - variant.inventory.quantityReserved
        return availableQuantity <= variant.inventory.reorderLevel
      })
      .map((variant) => {
        const inventory = variant.inventory!
        const availableQuantity = inventory.quantityOnHand - inventory.quantityReserved
        return {
          variantId: variant.id,
          productId: variant.productId,
          productTitle: variant.product.title,
          productSlug: variant.product.slug,
          variantTitle: variant.title,
          sku: variant.sku,
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          availableQuantity,
          reorderLevel: inventory.reorderLevel,
        }
      })
  }

  private toShopReview(review: SellerDashboardShopReview): SellerShopReviewResponse {
    return {
      reviewId: review.id,
      shopId: review.shopId,
      shopName: review.shop.name,
      shopSlug: review.shop.slug,
      buyerId: review.user.id,
      buyerName: review.user.name,
      rating: review.rating,
      comment: review.body,
      status: review.status,
      createdAt: review.createdAt,
      moderatedAt: review.moderatedAt,
      moderationReason: review.moderationReason,
    }
  }
}
