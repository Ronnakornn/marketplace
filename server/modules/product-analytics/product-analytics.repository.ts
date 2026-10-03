import type {
  Order,
  OrderItem,
  PrismaClient,
  Product,
  ProductImage,
  ProductVariant,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const RANKING_BATCH_SIZE = 500

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

export type AnalyticsProductRankingCandidate = Pick<Product, 'id' | 'title'>
export type AnalyticsVariantRankingCandidate = Pick<ProductVariant, 'id' | 'sku'>

export interface AnalyticsCountRow {
  productId: string
  count: number
}

export interface AnalyticsViewLogRow {
  productId: string
  createdAt: Date | string
}

export interface AnalyticsAddToCartRow {
  productId: string
  variantId: string
  count: number
  quantity: number
}

export interface AnalyticsAddToCartLogRow {
  productId: string
  variantId: string
  quantity: number
  createdAt: Date | string
}

export type AnalyticsOrderItem = Pick<OrderItem, 'id' | 'shopId' | 'variantId' | 'quantity' | 'lineTotal' | 'currency'> & {
  order: Omit<Pick<Order, 'id' | 'createdAt' | 'currency'>, 'createdAt'> & { createdAt: Date | string }
  variant: Pick<ProductVariant, 'id' | 'productId'>
}

export interface IProductAnalyticsRepository {
  findProductRankingCandidates(shopIds: string[], q?: string): Promise<AnalyticsProductRankingCandidate[]>
  findVariantRankingCandidates(shopIds: string[], productId?: string): Promise<AnalyticsVariantRankingCandidate[]>
  findProductsByIds(shopIds: string[], productIds: string[]): Promise<AnalyticsProduct[]>
  findVariantsByIds(shopIds: string[], variantIds: string[]): Promise<AnalyticsVariant[]>
  countProductViews(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsCountRow[]>
  findProductViewLogs(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsViewLogRow[]>
  countProductAddToCart(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsAddToCartRow[]>
  findProductAddToCartLogs(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsAddToCartLogRow[]>
  findPaidOrderItems(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsOrderItem[]>
}

export class PrismaProductAnalyticsRepository implements IProductAnalyticsRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findProductRankingCandidates(shopIds: string[], q?: string): Promise<AnalyticsProductRankingCandidate[]> {
    if (shopIds.length === 0) return []
    const candidates: AnalyticsProductRankingCandidate[] = []
    let cursor: string | undefined
    while (true) {
      const batch = await this.prisma.product.findMany({
        where: this.productWhere(shopIds, q),
        select: { id: true, title: true },
        orderBy: { id: 'asc' },
        take: RANKING_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      candidates.push(...batch)
      if (batch.length < RANKING_BATCH_SIZE) return candidates
      cursor = batch.at(-1)?.id
    }
  }

  async findVariantRankingCandidates(shopIds: string[], productId?: string): Promise<AnalyticsVariantRankingCandidate[]> {
    if (shopIds.length === 0) return []
    const candidates: AnalyticsVariantRankingCandidate[] = []
    let cursor: string | undefined
    while (true) {
      const batch = await this.prisma.productVariant.findMany({
        where: this.variantWhere(shopIds, productId),
        select: { id: true, sku: true },
        orderBy: { id: 'asc' },
        take: RANKING_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      candidates.push(...batch)
      if (batch.length < RANKING_BATCH_SIZE) return candidates
      cursor = batch.at(-1)?.id
    }
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

  async countProductViews(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsCountRow[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.countProductViews', { shopIds, productId, range })
    if (shopIds.length === 0) return []
    const rows = await this.prisma.productViewLog.groupBy({
      by: ['productId'],
      where: {
        shopId: { in: shopIds },
        ...(productId ? { productId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
    })
    return rows.map((row) => ({ productId: row.productId, count: row._count._all }))
  }

  findProductViewLogs(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsViewLogRow[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.findProductViewLogs', { shopIds, productId, range })
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.productViewLog.findMany({
      where: {
        shopId: { in: shopIds },
        ...(productId ? { productId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        productId: true,
        createdAt: true,
      },
    })
  }

  async countProductAddToCart(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsAddToCartRow[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.countProductAddToCart', { shopIds, productId, range })
    if (shopIds.length === 0) return []
    const rows = await this.prisma.productAddToCartLog.groupBy({
      by: ['productId', 'variantId'],
      where: {
        shopId: { in: shopIds },
        ...(productId ? { productId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: { _all: true },
      _sum: { quantity: true },
    })
    return rows.map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      count: row._count._all,
      quantity: row._sum.quantity ?? 0,
    }))
  }

  findProductAddToCartLogs(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsAddToCartLogRow[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.findProductAddToCartLogs', { shopIds, productId, range })
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.productAddToCartLog.findMany({
      where: {
        shopId: { in: shopIds },
        ...(productId ? { productId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        productId: true,
        variantId: true,
        quantity: true,
        createdAt: true,
      },
    })
  }

  findPaidOrderItems(shopIds: string[], range: AnalyticsDateRange, productId?: string): Promise<AnalyticsOrderItem[]> {
    this.logger.debug('PrismaProductAnalyticsRepository.findPaidOrderItems', { shopIds, productId, range })
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.orderItem.findMany({
      where: {
        shopId: { in: shopIds },
        order: {
          paymentStatus: 'SUCCEEDED',
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED'] },
          createdAt: { gte: range.from, lte: range.to },
          payments: { some: { status: 'SUCCEEDED' } },
        },
        ...(productId ? { variant: { productId } } : {}),
      },
      select: {
        id: true,
        shopId: true,
        variantId: true,
        quantity: true,
        lineTotal: true,
        currency: true,
        order: {
          select: {
            id: true,
            createdAt: true,
            currency: true,
          },
        },
        variant: {
          select: {
            id: true,
            productId: true,
          },
        },
      },
    })
  }

  private productWhere(shopIds: string[], q?: string) {
    return {
      shopId: { in: shopIds },
      deletedAt: null,
      ...(q ? {
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
    }
  }

  private variantWhere(shopIds: string[], productId?: string) {
    return {
      ...(productId ? { productId } : {}),
      product: {
        shopId: { in: shopIds },
        deletedAt: null,
      },
    }
  }
}
