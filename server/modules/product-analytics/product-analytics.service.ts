import { moneyInteger } from '#server/lib/money.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { CALENDAR_DAY_MILLISECONDS, parseReportingDate, reportingDateKey, reportingDayRange, shiftCalendarDate } from '#server/lib/reporting-calendar.ts'
import { ProductAnalyticsServiceError } from './product-analytics.errors.ts'
import type {
  AnalyticsAddToCartRow,
  AnalyticsAddToCartLogRow,
  AnalyticsDateRange,
  AnalyticsOrderItem,
  AnalyticsProduct,
  AnalyticsViewLogRow,
  AnalyticsVariant,
  IProductAnalyticsRepository,
} from './product-analytics.repository.ts'

const DEFAULT_RANGE = '30d'
const MAX_PAGE_LIMIT = 100
const DEFAULT_PAGE_LIMIT = 20
const LOW_PERFORMING_LIMIT = 5
const TOP_SKU_LIMIT = 5
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

interface MetricBucket {
  views: number
  addToCart: number
  addToCartQuantity: number
  orderIds: Set<string>
  unitsSold: number
  revenue: bigint
  currencies: Set<string>
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

    const [views, addToCart, orderItems] = await Promise.all([
      this.repo.countProductViews(shopIds, range, productId),
      this.repo.countProductAddToCart(shopIds, range, productId),
      this.repo.findPaidOrderItems(shopIds, range, productId),
    ])

    const productIds = this.metricProductIds(views, addToCart, orderItems, productId)
    const variantIds = this.metricVariantIds(addToCart, orderItems)
    const [products, variants] = await Promise.all([
      this.repo.findProductsByIds(shopIds, productIds),
      this.repo.findVariantsByIds(shopIds, variantIds),
    ])
    const productMetrics = this.buildProductMetrics(products, views, addToCart, orderItems)
    const skuMetrics = this.buildSkuMetrics(variants, addToCart, orderItems)
    const summary = this.totalMetrics(views, addToCart, orderItems)

    return {
      ...summary,
      topSkus: this.sortSkuMetrics(skuMetrics, 'revenue').slice(0, TOP_SKU_LIMIT),
      lowPerformingProducts: this.lowPerformingProducts(productMetrics),
    }
  }

  async getDaily(actor: ProductAnalyticsActor, query: ProductAnalyticsQuery): Promise<ProductAnalyticsDailyResponse> {
    const shopIds = await this.getSellerShopIds(actor)
    const range = this.normalizeDateRange(query)
    const productId = this.normalizeUuid(query.productId, 'productId')
    const [views, addToCart, orderItems] = await Promise.all([
      this.repo.findProductViewLogs(shopIds, range, productId),
      this.repo.findProductAddToCartLogs(shopIds, range, productId),
      this.repo.findPaidOrderItems(shopIds, range, productId),
    ])

    const items = this.dateKeys(range).map((date) => ({
      date,
      views: 0,
      addToCart: 0,
      orders: 0,
      unitsSold: 0,
      revenue: 0n,
      conversionRate: 0,
    }))
    const byDate = new Map(items.map((item) => [item.date, item]))

    this.fillDailyFromRawLogs(byDate, views, addToCart, orderItems)
    for (const item of items) item.conversionRate = this.conversionRate(item.orders, item.views)
    return { items }
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

  private buildProductMetrics(
    products: AnalyticsProduct[],
    views: Array<{ productId: string; count: number }>,
    addToCart: AnalyticsAddToCartRow[],
    orderItems: AnalyticsOrderItem[],
  ): ProductAnalyticsProductMetric[] {
    const buckets = this.buildProductBuckets(views, addToCart, orderItems)
    return products.map((product) => ({
      productId: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      coverImage: product.images[0]?.url ?? null,
      shop: product.shop,
      ...this.productMetricTotals(this.bucket(buckets, product.id)),
    }))
  }

  private productMetricTotals(bucket: MetricBucket) {
    return {
      views: bucket.views,
      addToCart: bucket.addToCart,
      orders: bucket.orderIds.size,
      unitsSold: bucket.unitsSold,
      revenue: bucket.revenue,
      conversionRate: this.conversionRate(bucket.orderIds.size, bucket.views),
      currency: this.currency(bucket.currencies),
    }
  }

  private buildProductBuckets(
    views: Array<{ productId: string; count: number }>,
    addToCart: AnalyticsAddToCartRow[],
    orderItems: AnalyticsOrderItem[],
  ): Map<string, MetricBucket> {
    const buckets = new Map<string, MetricBucket>()
    for (const row of views) this.bucket(buckets, row.productId).views += row.count
    for (const row of addToCart) {
      const bucket = this.bucket(buckets, row.productId)
      bucket.addToCart += row.count
      bucket.addToCartQuantity += row.quantity
    }
    for (const item of orderItems) {
      const bucket = this.bucket(buckets, item.variant.productId)
      bucket.orderIds.add(item.order.id)
      bucket.unitsSold += item.quantity
      bucket.revenue += moneyInteger(item.lineTotal)
      bucket.currencies.add(item.currency)
    }

    return buckets
  }

  private buildSkuMetrics(
    variants: AnalyticsVariant[],
    addToCart: AnalyticsAddToCartRow[],
    orderItems: AnalyticsOrderItem[],
  ): ProductAnalyticsSkuMetric[] {
    const buckets = this.buildSkuBuckets(addToCart, orderItems)

    return variants.map((variant) => {
      const bucket = this.bucket(buckets, variant.id)
      return {
        productId: variant.productId,
        productTitle: variant.product.title,
        productSlug: variant.product.slug,
        variantId: variant.id,
        sku: variant.sku,
        title: variant.title,
        status: variant.status,
        views: 0,
        addToCart: bucket.addToCart,
        addToCartQuantity: bucket.addToCartQuantity,
        orders: bucket.orderIds.size,
        unitsSold: bucket.unitsSold,
        revenue: bucket.revenue,
        currency: this.currency(bucket.currencies) ?? variant.currency,
      }
    })
  }

  private buildSkuBuckets(addToCart: AnalyticsAddToCartRow[], orderItems: AnalyticsOrderItem[]): Map<string, MetricBucket> {
    const buckets = new Map<string, MetricBucket>()
    for (const row of addToCart) {
      const bucket = this.bucket(buckets, row.variantId)
      bucket.addToCart += row.count
      bucket.addToCartQuantity += row.quantity
    }
    for (const item of orderItems) {
      const bucket = this.bucket(buckets, item.variantId)
      bucket.orderIds.add(item.order.id)
      bucket.unitsSold += item.quantity
      bucket.revenue += moneyInteger(item.lineTotal)
      bucket.currencies.add(item.currency)
    }
    return buckets
  }

  private totalMetrics(
    views: Array<{ productId: string; count: number }>,
    addToCart: AnalyticsAddToCartRow[],
    orderItems: AnalyticsOrderItem[],
  ): Omit<ProductAnalyticsSummary, 'topSkus' | 'lowPerformingProducts'> {
    const orderIds = new Set<string>()
    const currencies = new Set<string>()
    let unitsSold = 0
    let revenue = 0n
    for (const item of orderItems) {
      orderIds.add(item.order.id)
      unitsSold += item.quantity
      revenue += moneyInteger(item.lineTotal)
      currencies.add(item.currency)
    }
    const viewCount = views.reduce((total, row) => total + row.count, 0)
    return {
      views: viewCount,
      addToCart: addToCart.reduce((total, row) => total + row.count, 0),
      orders: orderIds.size,
      unitsSold,
      revenue,
      conversionRate: this.conversionRate(orderIds.size, viewCount),
      currency: this.currency(currencies),
    }
  }

  private metricProductIds(
    views: Array<{ productId: string; count: number }>,
    addToCart: AnalyticsAddToCartRow[],
    orderItems: AnalyticsOrderItem[],
    productId?: string,
  ): string[] {
    const ids = new Set<string>()
    if (productId) ids.add(productId)
    for (const row of views) ids.add(row.productId)
    for (const row of addToCart) ids.add(row.productId)
    for (const item of orderItems) ids.add(item.variant.productId)
    return [...ids]
  }

  private metricVariantIds(addToCart: AnalyticsAddToCartRow[], orderItems: AnalyticsOrderItem[]): string[] {
    const ids = new Set<string>()
    for (const row of addToCart) ids.add(row.variantId)
    for (const item of orderItems) ids.add(item.variantId)
    return [...ids]
  }

  private lowPerformingProducts(items: ProductAnalyticsProductMetric[]): ProductAnalyticsProductMetric[] {
    return items
      .filter((item) => item.views >= 10 && item.conversionRate < 0.01)
      .sort((a, b) => b.views - a.views || a.conversionRate - b.conversionRate || a.title.localeCompare(b.title))
      .slice(0, LOW_PERFORMING_LIMIT)
  }

  private sortSkuMetrics<T extends object>(items: T[], sort: string): T[] {
    const descending = sort.startsWith('-') || sort !== 'sku'
    const key = sort.startsWith('-') ? sort.slice(1) : sort
    return [...items].sort((a, b) => this.compare(a, b, key, descending))
  }

  private compare(a: object, b: object, key: string, descending: boolean): number {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    const result = typeof av === 'bigint' && typeof bv === 'bigint' ? av < bv ? -1 : av > bv ? 1 : 0 : typeof av === 'string' && typeof bv === 'string'
      ? av.localeCompare(bv)
      : Number(av ?? 0) - Number(bv ?? 0)
    if (result !== 0) return descending ? -result : result
    const aId = 'variantId' in a ? a.variantId : 'productId' in a ? a.productId : ''
    const bId = 'variantId' in b ? b.variantId : 'productId' in b ? b.productId : ''
    return String(aId).localeCompare(String(bId))
  }

  private bucket(map: Map<string, MetricBucket>, key: string): MetricBucket {
    let bucket = map.get(key)
    if (!bucket) {
      bucket = { views: 0, addToCart: 0, addToCartQuantity: 0, orderIds: new Set(), unitsSold: 0, revenue: 0n, currencies: new Set() }
      map.set(key, bucket)
    }
    return bucket
  }

  private conversionRate(orders: number, views: number): number {
    if (views <= 0) return 0
    return orders / views
  }

  private currency(currencies: Set<string>): string | null {
    return currencies.size === 1 ? [...currencies][0]! : null
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

  private dateKeyFromDate(value: Date | string): string {
    return reportingDateKey(value)
  }

  private fillDailyFromRawLogs(
    byDate: Map<string, ProductAnalyticsDailyItem>,
    views: AnalyticsViewLogRow[],
    addToCart: AnalyticsAddToCartLogRow[],
    orderItems: AnalyticsOrderItem[],
  ): void {
    for (const row of views) {
      const bucket = byDate.get(this.dateKeyFromDate(row.createdAt))
      if (bucket) bucket.views += 1
    }
    for (const row of addToCart) {
      const bucket = byDate.get(this.dateKeyFromDate(row.createdAt))
      if (bucket) bucket.addToCart += 1
    }
    const orderIds = new Set<string>()
    for (const item of orderItems) {
      const key = this.dateKeyFromDate(item.order.createdAt)
      const bucket = byDate.get(key)
      if (!bucket) continue
      bucket.unitsSold += item.quantity
      bucket.revenue += moneyInteger(item.lineTotal)
      orderIds.add(`${key}:${item.order.id}`)
    }
    for (const key of orderIds) {
      const [date] = key.split(':')
      const bucket = byDate.get(date!)
      if (bucket) bucket.orders += 1
    }
  }
}
