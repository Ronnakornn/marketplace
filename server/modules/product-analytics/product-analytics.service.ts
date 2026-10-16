import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { CALENDAR_DAY_MILLISECONDS, parseReportingDate, reportingDateKey, reportingDayRange, shiftCalendarDate } from '#server/lib/reporting-calendar.ts'
import { ProductAnalyticsServiceError } from './product-analytics.errors.ts'
import type {
  AnalyticsDateRange,
  IProductAnalyticsRepository,
} from './product-analytics.repository.ts'

const DEFAULT_RANGE = '30d'
const MAX_PAGE_LIMIT = 100
const DEFAULT_PAGE_LIMIT = 20
const MAX_CUSTOM_RANGE_DAYS = 366

const PRODUCT_SORTS = new Set(['views', 'addToCart', 'orders', 'unitsSold', 'revenue', 'conversionRate', 'title'])
const SKU_SORTS = new Set(['addToCart', 'orders', 'unitsSold', 'revenue', 'sku'])

export interface ProductAnalyticsActor {
  id: string
  role: Role
}

export interface ProductAnalyticsQuery {
  range?: '7d' | '30d' | '90d' | 'custom'
  from?: string
  to?: string
  productId?: string
  q?: string
  sort?: string
  page?: number
  limit?: number
}

export interface ProductAnalyticsSummary {
  views: number
  addToCart: number
  orders: number
  unitsSold: number
  revenue: bigint
  conversionRate: number
  currency: string | null
  topSkus: ProductAnalyticsSkuMetric[]
  lowPerformingProducts: ProductAnalyticsProductMetric[]
}

export interface ProductAnalyticsDailyResponse {
  items: ProductAnalyticsDailyItem[]
}

export interface ProductAnalyticsDailyItem {
  date: string
  views: number
  addToCart: number
  orders: number
  unitsSold: number
  revenue: bigint
  conversionRate: number
}

export interface ProductAnalyticsProductTableResponse {
  items: ProductAnalyticsProductMetric[]
  pagination: ProductAnalyticsPagination
}

export interface ProductAnalyticsSkuTableResponse {
  items: ProductAnalyticsSkuMetric[]
  pagination: ProductAnalyticsPagination
}

export interface ProductAnalyticsProductMetric {
  productId: string
  title: string
  slug: string
  status: string
  coverImage: string | null
  shop: {
    id: string
    name: string
    slug: string
  }
  views: number
  addToCart: number
  orders: number
  unitsSold: number
  revenue: bigint
  conversionRate: number
  currency: string | null
}

export interface ProductAnalyticsSkuMetric {
  productId: string
  productTitle: string
  productSlug: string
  variantId: string
  sku: string
  title: string
  status: string
  views: number
  addToCart: number
  addToCartQuantity: number
  orders: number
  unitsSold: number
  revenue: bigint
  currency: string | null
}

export interface ProductAnalyticsPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export class ProductAnalyticsService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IProductAnalyticsRepository,
    private activeShopResolver: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async getSummary(actor: ProductAnalyticsActor, query: ProductAnalyticsQuery): Promise<ProductAnalyticsSummary> {
    const shopIds = await this.getSellerShopIds(actor)
    const range = this.normalizeDateRange(query)
    const productId = this.normalizeUuid(query.productId, 'productId')
    this.logger.info('ProductAnalyticsService.getSummary', { actorId: actor.id, shopIds, productId, range })

    const metrics = await this.repo.findSummaryMetrics(shopIds, range, productId)
    const [products, variants] = await Promise.all([
      this.repo.findProductsByIds(shopIds, metrics.lowProducts.map((item) => item.id)),
      this.repo.findVariantsByIds(shopIds, metrics.topSkus.map((item) => item.id)),
    ])
    const productsById = new Map(products.map((product) => [product.id, product]))
    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
    const { addToCartQuantity: _quantity, ...totals } = metrics.totals
    return {
      ...totals,
      topSkus: metrics.topSkus.flatMap(({ id, conversionRate: _conversion, currency, ...metric }) => {
        const variant = variantsById.get(id)
        return variant ? [{
          productId: variant.productId, productTitle: variant.product.title, productSlug: variant.product.slug,
          variantId: variant.id, sku: variant.sku, title: variant.title, status: variant.status,
          ...metric, currency: currency ?? variant.currency,
        }] : []
      }),
      lowPerformingProducts: metrics.lowProducts.flatMap(({ id, addToCartQuantity: _quantity, ...metric }) => {
        const product = productsById.get(id)
        return product ? [{
          productId: product.id, title: product.title, slug: product.slug, status: product.status,
          coverImage: product.images[0]?.url ?? null, shop: product.shop, ...metric,
        }] : []
      }),
    }
  }

  async getDaily(actor: ProductAnalyticsActor, query: ProductAnalyticsQuery): Promise<ProductAnalyticsDailyResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    const range = this.normalizeDateRange(query)
    const productId = this.normalizeUuid(query.productId, 'productId')
    const metrics = await this.repo.findDailyMetrics(shopIds, range, productId)
    const byDate = new Map(metrics.map((item) => [item.date, item]))
    return {
      items: this.dateKeys(range).map((date) => {
        const metric = byDate.get(date)
        return {
          date, views: metric?.views ?? 0, addToCart: metric?.addToCart ?? 0,
          orders: metric?.orders ?? 0, unitsSold: metric?.unitsSold ?? 0,
          revenue: metric?.revenue ?? 0n, conversionRate: metric?.conversionRate ?? 0,
        }
      }),
    }
  }

  async getProducts(actor: ProductAnalyticsActor, query: ProductAnalyticsQuery): Promise<ProductAnalyticsProductTableResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    const range = this.normalizeDateRange(query)
    const pagination = this.normalizePagination(query)
    const q = this.normalizeQuery(query.q)
    const sort = this.normalizeSort(query.sort, PRODUCT_SORTS, 'revenue')
    const ranked = await this.repo.findProductRankingPage(shopIds, range, { ...pagination, q, sort })
    const pageIds = ranked.items.map((item) => item.id)
    const products = await this.repo.findProductsByIds(shopIds, pageIds)
    const byId = new Map(products.map((product) => [product.id, product]))
    const items = ranked.items.flatMap(({ id, addToCartQuantity: _quantity, ...metric }) => {
      const product = byId.get(id)
      return product ? [{
        productId: product.id,
        title: product.title,
        slug: product.slug,
        status: product.status,
        coverImage: product.images[0]?.url ?? null,
        shop: product.shop,
        ...metric,
      }] : []
    })
    return {
      items,
      pagination: this.toPagination(ranked.total, pagination.page, pagination.limit),
    }
  }

  async getSkus(actor: ProductAnalyticsActor, query: ProductAnalyticsQuery): Promise<ProductAnalyticsSkuTableResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    const range = this.normalizeDateRange(query)
    const productId = this.normalizeUuid(query.productId, 'productId')
    const pagination = this.normalizePagination(query)
    const sort = this.normalizeSort(query.sort, SKU_SORTS, 'revenue')
    const ranked = await this.repo.findVariantRankingPage(shopIds, range, { ...pagination, productId, sort })
    const pageIds = ranked.items.map((item) => item.id)
    const variants = await this.repo.findVariantsByIds(shopIds, pageIds)
    const byId = new Map(variants.map((variant) => [variant.id, variant]))
    return {
      items: ranked.items.flatMap(({ id, conversionRate: _conversion, currency, ...metric }) => {
        const variant = byId.get(id)
        return variant ? [{
          productId: variant.productId,
          productTitle: variant.product.title,
          productSlug: variant.product.slug,
          variantId: variant.id,
          sku: variant.sku,
          title: variant.title,
          status: variant.status,
          ...metric,
          currency: currency ?? variant.currency,
        }] : []
      }),
      pagination: this.toPagination(ranked.total, pagination.page, pagination.limit),
    }
  }

  private async getSellerShopIds(actor: ProductAnalyticsActor): Promise<string[]> {
    const shops = await this.activeShopResolver.resolveActiveShops(actor.id)
    if (shops.length === 0) {
      throw new ProductAnalyticsServiceError('Active seller shop not found', 403, 'SELLER_SHOP_NOT_ACTIVE')
    }
    return shops.map((shop) => shop.id)
  }

  private normalizeDateRange(query: ProductAnalyticsQuery): AnalyticsDateRange {
    const range = query.range ?? DEFAULT_RANGE
    const now = new Date()
    if (range === 'custom') {
      if (!query.from || !query.to) {
        throw new ProductAnalyticsServiceError('Custom range requires from and to dates', 400, 'ANALYTICS_DATE_RANGE_INVALID')
      }
      const from = this.parseDate(query.from, 'from')
      const to = reportingDayRange(this.parseDate(query.to, 'to')).to
      if (from > to) {
        throw new ProductAnalyticsServiceError('From date must be before to date', 400, 'ANALYTICS_DATE_RANGE_INVALID')
      }
      const calendarDays = (new Date(`${query.to}T00:00:00Z`).getTime() - new Date(`${query.from}T00:00:00Z`).getTime()) / CALENDAR_DAY_MILLISECONDS + 1
      if (calendarDays > MAX_CUSTOM_RANGE_DAYS) {
        throw new ProductAnalyticsServiceError(`Custom range must not exceed ${MAX_CUSTOM_RANGE_DAYS} days`, 400, 'ANALYTICS_DATE_RANGE_INVALID')
      }
      return { from, to }
    }

    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
    const to = reportingDayRange(now).to
    const from = parseReportingDate(shiftCalendarDate(reportingDateKey(now), -(days - 1)))!
    return { from, to }
  }

  private parseDate(value: string, field: string): Date {
    const date = parseReportingDate(value)
    if (!date || value < '0001-01-02' || value > '9999-12-30') {
      throw new ProductAnalyticsServiceError(`${field} must be a valid YYYY-MM-DD calendar date`, 400, 'ANALYTICS_DATE_RANGE_INVALID')
    }
    return date
  }

  private normalizePagination(query: ProductAnalyticsQuery): { page: number; limit: number } {
    const page = query.page ?? 1
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new ProductAnalyticsServiceError('Page must be a positive integer', 400, 'ANALYTICS_PAGINATION_INVALID')
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
      throw new ProductAnalyticsServiceError(`Limit must be between 1 and ${MAX_PAGE_LIMIT}`, 400, 'ANALYTICS_PAGINATION_INVALID')
    }
    if (!Number.isSafeInteger((page - 1) * limit)) {
      throw new ProductAnalyticsServiceError('Page offset must be a safe integer', 400, 'ANALYTICS_PAGINATION_INVALID')
    }
    return { page, limit }
  }

  private normalizeQuery(q: string | undefined): string | undefined {
    const normalized = q?.trim()
    return normalized || undefined
  }

  private normalizeUuid(value: string | undefined, field: string): string | undefined {
    if (!value) return undefined
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new ProductAnalyticsServiceError(`${field} must be a UUID`, 400, 'ANALYTICS_FILTER_INVALID')
    }
    return value
  }

  private normalizeSort(sort: string | undefined, allowed: Set<string>, fallback: string): string {
    if (!sort) return fallback
    const key = sort.startsWith('-') ? sort.slice(1) : sort
    if (!allowed.has(key)) {
      throw new ProductAnalyticsServiceError('Sort is not supported', 400, 'ANALYTICS_SORT_INVALID')
    }
    return sort
  }

  private toPagination(total: number, page: number, limit: number): ProductAnalyticsPagination {
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  }

  private dateKeys(range: AnalyticsDateRange): string[] {
    const keys: string[] = []
    let key = reportingDateKey(range.from)
    const last = reportingDateKey(range.to)
    while (key <= last) {
      keys.push(key)
      key = shiftCalendarDate(key, 1)
    }
    return keys
  }

}
