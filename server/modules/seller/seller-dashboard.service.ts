import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import { SellerDashboardServiceError } from './seller-dashboard.errors.ts'
import type {
  ISellerDashboardRepository,
  SellerDashboardOrder,
  SellerLowStockVariant,
  SellerSalesOrderItem,
} from './seller-dashboard.repository.ts'

const DEFAULT_RECENT_ORDER_LIMIT = 10
const MAX_RECENT_ORDER_LIMIT = 50

export interface SellerDashboardActor {
  id: string
  role: Role
}

export interface SellerDashboardResponse {
  sales: SellerSalesSummaryResponse
  orders: SellerOrderSummaryResponse
  products: SellerProductSummaryResponse
  recentOrders: SellerRecentOrderResponse[]
  lowStockItems: SellerLowStockItemResponse[]
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
    lineTotalCents: number
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

export class SellerDashboardService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ISellerDashboardRepository,
    private cache?: CacheService,
  ) {
    this.logger = appContext.logger
  }

  async getDashboard(actor: SellerDashboardActor, limit?: number): Promise<SellerDashboardResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    const recentLimit = this.normalizeLimit(limit)
    this.logger.info('SellerDashboardService.getDashboard', { actorId: actor.id, shopIds, recentLimit })

    if (this.cache && shopIds.length === 1) {
      return this.cache.remember(
        this.cache.keys.sellerDashboard(shopIds[0]!),
        () => this.getDashboardForShopIds(shopIds, recentLimit),
        { ttlSeconds: this.cache.ttl().sellerDashboard },
      )
    }

    return this.getDashboardForShopIds(shopIds, recentLimit)
  }

  private async getDashboardForShopIds(shopIds: string[], recentLimit: number): Promise<SellerDashboardResponse> {
    const [salesItems, shipments, activeProducts, inactiveProducts, lowStockVariants, recentOrders] = await Promise.all([
      this.repo.findSalesOrderItems(shopIds),
      this.repo.findShipments(shopIds),
      this.repo.countProductsByStatus(shopIds, true),
      this.repo.countProductsByStatus(shopIds, false),
      this.repo.findLowStockVariants(shopIds),
      this.repo.findRecentOrders(shopIds, recentLimit),
    ])

    const lowStockItems = this.toLowStockItems(lowStockVariants)
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
      recentOrders: recentOrders.map((order) => this.toRecentOrder(order)),
      lowStockItems,
    }
  }

  async getSalesSummary(actor: SellerDashboardActor): Promise<SellerSalesSummaryResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    return this.toSalesSummary(await this.repo.findSalesOrderItems(shopIds))
  }

  async getRecentOrders(actor: SellerDashboardActor, limit?: number): Promise<SellerRecentOrderResponse[]> {
    const shopIds = await this.getSellerShopIds(actor)
    const orders = await this.repo.findRecentOrders(shopIds, this.normalizeLimit(limit))
    return orders.map((order) => this.toRecentOrder(order))
  }

  async getLowStock(actor: SellerDashboardActor): Promise<SellerLowStockItemResponse[]> {
    const shopIds = await this.getSellerShopIds(actor)
    return this.toLowStockItems(await this.repo.findLowStockVariants(shopIds))
  }

  private assertSeller(actor: SellerDashboardActor): void {
    if (actor.role !== 'SELLER') {
      throw new SellerDashboardServiceError('Seller dashboard requires a seller account', 403, 'DASHBOARD_FORBIDDEN')
    }
  }

  private async getSellerShopIds(actor: SellerDashboardActor): Promise<string[]> {
    this.assertSeller(actor)
    const shops = await this.repo.findSellerShops(actor.id)
    if (shops.length === 0) {
      throw new SellerDashboardServiceError('Seller shop not found', 404, 'SELLER_SHOP_NOT_FOUND')
    }
    return shops.map((shop) => shop.id)
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_RECENT_ORDER_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_RECENT_ORDER_LIMIT) {
      throw new SellerDashboardServiceError(`Limit must be between 1 and ${MAX_RECENT_ORDER_LIMIT}`, 400, 'DASHBOARD_FORBIDDEN')
    }
    return value
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
    return items.reduce((total, item) => total + item.lineTotalCents, 0)
  }

  private toRecentOrder(order: SellerDashboardOrder): SellerRecentOrderResponse {
    return {
      orderId: order.id,
      orderNo: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      totalCents: order.items.reduce((total, item) => total + item.lineTotalCents, 0),
      items: order.items.map((item) => ({
        orderItemId: item.id,
        productTitle: item.productTitle,
        productSlug: item.productSlug,
        variantTitle: item.variantTitle,
        variantSku: item.variantSku,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
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
}
