import type {
  PrismaClient,
  Product,
  ProductImage,
  ProductVariant,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { decodeRankingPage, productRankingQuery, variantRankingQuery, type RawAnalyticsRankingRow } from './product-analytics-ranking.sql.ts'
import { moneyInteger, moneyNumber } from '#server/lib/money.ts'
import { analyticsDailyQuery } from './product-analytics-facts.sql.ts'
import { analyticsSummaryQuery } from './product-analytics-summary.sql.ts'

export interface AnalyticsDateRange {
  from: Date
  to: Date
}

export type AnalyticsProduct = Pick<Product, 'id' | 'shopId' | 'title' | 'slug' | 'status'> & {
  images: Array<Pick<ProductImage, 'url' | 'isPrimary' | 'sortOrder'>>
  shop: Pick<Shop, 'id' | 'name' | 'slug'>
}

export type AnalyticsVariant = Pick<ProductVariant, 'id' | 'productId' | 'sku' | 'title' | 'status' | 'currency'> & {
  product: Pick<Product, 'id' | 'shopId' | 'title' | 'slug'>
}

export interface AnalyticsRankingMetric {
  id: string
  views: number
  addToCart: number
  addToCartQuantity: number
  orders: number
  unitsSold: number
  revenue: bigint
  conversionRate: number
  currency: string | null
}

export interface AnalyticsRankingPage {
  items: AnalyticsRankingMetric[]
  total: number
}

export interface AnalyticsRankingOptions {
  sort: string
  page: number
  limit: number
}

export type AnalyticsTotals = Omit<AnalyticsRankingMetric, 'id'>

export interface AnalyticsSummaryMetrics {
  totals: AnalyticsTotals
  topSkus: AnalyticsRankingMetric[]
  lowProducts: AnalyticsRankingMetric[]
}

export type AnalyticsDailyMetric = AnalyticsTotals & { date: string }

type RawAnalyticsTotals = {
  views: string
  addToCart: string
  addToCartQuantity: string
  orders: string
  unitsSold: string
  revenue: string
  conversionRate: number
  currency: string | null
}

function decodeTotals(row: RawAnalyticsTotals): AnalyticsTotals {
  return {
    views: moneyNumber(row.views), addToCart: moneyNumber(row.addToCart),
    addToCartQuantity: moneyNumber(row.addToCartQuantity), orders: moneyNumber(row.orders),
    unitsSold: moneyNumber(row.unitsSold), revenue: moneyInteger(row.revenue),
    conversionRate: row.conversionRate, currency: row.currency,
  }
}

function emptyTotals(): AnalyticsTotals {
  return { views: 0, addToCart: 0, addToCartQuantity: 0, orders: 0, unitsSold: 0, revenue: 0n, conversionRate: 0, currency: null }
}

export interface IProductAnalyticsRepository {
  findProductRankingPage(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { q?: string }): Promise<AnalyticsRankingPage>
  findVariantRankingPage(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { productId?: string }): Promise<AnalyticsRankingPage>
  findProductsByIds(shopIds: string[], productIds: string[]): Promise<AnalyticsProduct[]>
  findVariantsByIds(shopIds: string[], variantIds: string[]): Promise<AnalyticsVariant[]>
  findSummaryMetrics(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsSummaryMetrics>
  findDailyMetrics(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsDailyMetric[]>
}

export class PrismaProductAnalyticsRepository implements IProductAnalyticsRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findProductRankingPage(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { q?: string }): Promise<AnalyticsRankingPage> {
    if (shopIds.length === 0) return { items: [], total: 0 }
    const rows = await this.prisma.$queryRaw<RawAnalyticsRankingRow[]>(productRankingQuery(shopIds, range, options))
    return decodeRankingPage(rows)
  }

  async findVariantRankingPage(shopIds: string[], range: AnalyticsDateRange, options: AnalyticsRankingOptions & { productId?: string }): Promise<AnalyticsRankingPage> {
    if (shopIds.length === 0) return { items: [], total: 0 }
    const rows = await this.prisma.$queryRaw<RawAnalyticsRankingRow[]>(variantRankingQuery(shopIds, range, options))
    return decodeRankingPage(rows)
  }

  findProductsByIds(shopIds: string[], productIds: string[]): Promise<AnalyticsProduct[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.findProductsByIds', { shopIds, productIds })
    if (shopIds.length === 0 || productIds.length === 0) return Promise.resolve([])
    return this.prisma.product.findMany({
      where: {
        ...this.productWhere(shopIds),
        id: { in: productIds },
      },
      select: {
        id: true,
        shopId: true,
        title: true,
        slug: true,
        status: true,
        images: {
          select: { url: true, isPrimary: true, sortOrder: true },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
        },
        shop: {
          select: { id: true, name: true, slug: true },
        },
      },
    })
  }

  findVariantsByIds(shopIds: string[], variantIds: string[]): Promise<AnalyticsVariant[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.findVariantsByIds', { shopIds, variantIds })
    if (shopIds.length === 0 || variantIds.length === 0) return Promise.resolve([])
    return this.prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        product: {
          shopId: { in: shopIds },
          deletedAt: null,
        },
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        title: true,
        status: true,
        currency: true,
        product: {
          select: {
            id: true,
            shopId: true,
            title: true,
            slug: true,
          },
        },
      },
    })
  }

  async findSummaryMetrics(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsSummaryMetrics> {
    const result: AnalyticsSummaryMetrics = { totals: emptyTotals(), topSkus: [], lowProducts: [] }
    if (shopIds.length === 0) return result
    const rows = await this.prisma.$queryRaw<Array<RawAnalyticsTotals & { kind: 'summary' | 'product' | 'sku'; id: string | null }>>(analyticsSummaryQuery(shopIds, range, productId))
    for (const row of rows) {
      const metric = decodeTotals(row)
      if (row.kind === 'summary') result.totals = metric
      else if (row.id !== null) {
        const items = row.kind === 'product' ? result.lowProducts : result.topSkus
        items.push({ id: row.id, ...metric })
      }
    }
    return result
  }

  async findDailyMetrics(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsDailyMetric[]> {
    if (shopIds.length === 0) return []
    const rows = await this.prisma.$queryRaw<Array<RawAnalyticsTotals & { date: string }>>(analyticsDailyQuery(shopIds, range, productId))
    return rows.map((row) => ({ date: row.date, ...decodeTotals(row) }))
  }

  private productWhere(shopIds: string[]) {
    return {
      shopId: { in: shopIds },
      deletedAt: null,
    }
  }
}
