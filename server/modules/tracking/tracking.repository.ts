import type { Prisma, PrismaClient, Product, ProductImage, ProductVariant, Shop } from '#generated/client/client.ts'
import type { ShopViewEventType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type TrackingProductRecord = Pick<Product, 'id' | 'title' | 'slug'> & {
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  images: Array<Pick<ProductImage, 'url' | 'altText' | 'isPrimary' | 'sortOrder'>>
  variants: Array<Pick<ProductVariant, 'id' | 'price' | 'currency' | 'status'>>
}

export interface ProductViewLogInput {
  productId: string
  shopId: string
  userId?: string
  sessionId?: string
  source?: string
  referrer?: string
  metadata?: Prisma.InputJsonValue
}

export interface ProductAddToCartLogInput {
  productId: string
  variantId: string
  shopId: string
  userId?: string
  sessionId?: string
  quantity: number
  source?: string
  metadata?: Prisma.InputJsonValue
}

export interface SearchQueryLogInput {
  userId?: string
  sessionId?: string
  query: string
  normalizedQuery: string
  resultCount?: number
  clickedEntityType?: 'PRODUCT' | 'SHOP' | 'CATEGORY' | 'SEARCH'
  clickedEntityId?: string
  metadata?: Prisma.InputJsonValue
}

export interface RecentlyViewedInput {
  userId?: string
  sessionId?: string
  limit: number
}

export interface ShopEventLogInput {
  shopId: string
  userId?: string
  sessionId?: string
  source?: string
  eventType: ShopViewEventType
}

export interface ITrackingRepository {
  findActiveProduct(productId: string): Promise<Pick<Product, 'id' | 'shopId'> | null>
  createProductViewLog(input: ProductViewLogInput): Promise<void>
  createProductAddToCartLog(input: ProductAddToCartLogInput): Promise<void>
  createSearchQueryLog(input: SearchQueryLogInput): Promise<void>
  findRecentlyViewedProducts(input: RecentlyViewedInput): Promise<TrackingProductRecord[]>
  hasRecentShopEvent(input: ShopEventLogInput & { since: Date }): Promise<boolean>
  createShopEventLog(input: ShopEventLogInput): Promise<void>
}

export class PrismaTrackingRepository implements ITrackingRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findActiveProduct(productId: string): Promise<Pick<Product, 'id' | 'shopId'> | null> {
    this.logger.debug('PrismaTrackingRepository.findActiveProduct', { productId })
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        status: 'ACTIVE',
        deletedAt: null,
        shop: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        shopId: true,
      },
    })
  }

  async createProductViewLog(input: ProductViewLogInput): Promise<void> {
    this.logger.debug('PrismaTrackingRepository.createProductViewLog', {
      productId: input.productId,
      shopId: input.shopId,
      userId: input.userId,
      sessionId: input.sessionId,
      source: input.source,
    })
    await this.prisma.productViewLog.create({
      data: {
        productId: input.productId,
        shopId: input.shopId,
        userId: input.userId,
        sessionId: input.sessionId,
        source: input.source,
        referrer: input.referrer,
        metadata: input.metadata,
      },
    })
  }

  async createProductAddToCartLog(input: ProductAddToCartLogInput): Promise<void> {
    this.logger.debug('PrismaTrackingRepository.createProductAddToCartLog', {
      productId: input.productId,
      variantId: input.variantId,
      shopId: input.shopId,
      userId: input.userId,
      sessionId: input.sessionId,
      quantity: input.quantity,
      source: input.source,
    })
    await this.prisma.productAddToCartLog.create({
      data: {
        productId: input.productId,
        variantId: input.variantId,
        shopId: input.shopId,
        userId: input.userId,
        sessionId: input.sessionId,
        quantity: input.quantity,
        source: input.source,
        metadata: input.metadata,
      },
    })
  }

  async createSearchQueryLog(input: SearchQueryLogInput): Promise<void> {
    this.logger.debug('PrismaTrackingRepository.createSearchQueryLog', {
      normalizedQuery: input.normalizedQuery,
      userId: input.userId,
      sessionId: input.sessionId,
    })
    await this.prisma.searchQueryLog.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        query: input.query,
        normalizedQuery: input.normalizedQuery,
        resultCount: input.resultCount ?? 0,
        clickedEntityType: input.clickedEntityType,
        clickedEntityId: input.clickedEntityId,
        metadata: input.metadata,
      },
    })
  }

  async hasRecentShopEvent(input: ShopEventLogInput & { since: Date }): Promise<boolean> {
    return Boolean(await this.prisma.shopViewLog.findFirst({
      where: {
        shopId: input.shopId,
        eventType: input.eventType,
        createdAt: { gte: input.since },
        ...(input.userId ? { userId: input.userId } : { sessionId: input.sessionId }),
      },
      select: { id: true },
    }))
  }

  async createShopEventLog(input: ShopEventLogInput): Promise<void> {
    await this.prisma.shopViewLog.create({ data: input })
  }

  async findRecentlyViewedProducts(input: RecentlyViewedInput): Promise<TrackingProductRecord[]> {
    this.logger.debug('PrismaTrackingRepository.findRecentlyViewedProducts', {
      userId: input.userId,
      sessionId: input.sessionId,
      limit: input.limit,
    })
    const logs = await this.prisma.productViewLog.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : { sessionId: input.sessionId }),
        product: { status: 'ACTIVE', deletedAt: null, shop: { status: 'ACTIVE' } },
      },
      select: {
        productId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            shop: {
              select: { id: true, name: true, slug: true, status: true },
            },
            images: {
              select: { url: true, altText: true, isPrimary: true, sortOrder: true },
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
              take: 1,
            },
            variants: {
              where: { status: 'ACTIVE' },
              select: { id: true, price: true, currency: true, status: true },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: input.limit * 4,
    })

    const seen = new Set<string>()
    const products: TrackingProductRecord[] = []
    for (const log of logs) {
      if (seen.has(log.productId)) continue
      seen.add(log.productId)
      products.push(log.product)
      if (products.length >= input.limit) break
    }
    return products
  }
}
