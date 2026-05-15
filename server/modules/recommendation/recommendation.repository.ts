import type { Category, Prisma, PrismaClient, Product, ProductVariant, Review, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface RecommendationListQuery {
  limit: number
  offset: number
}

export interface RelatedRecommendationQuery extends RecommendationListQuery {
  productId: string
}

export interface SimilarRecommendationQuery extends RecommendationListQuery {
  productId: string
}

export type RecommendationProductRecord = Pick<Product, 'id' | 'title' | 'createdAt' | 'categoryId' | 'shopId' | 'status'> & {
  titleTh?: string | null
  titleEn?: string | null
  category: (Pick<Category, 'id' | 'name' | 'slug' | 'sortOrder'> & { nameTh?: string | null; nameEn?: string | null }) | null
  shop: Pick<Shop, 'id' | 'name' | 'status'>
  variants: Array<Pick<ProductVariant, 'id' | 'priceCents' | 'status'> & {
    orderItems: Array<{ quantity: number }>
  }>
  reviews: Array<Pick<Review, 'rating' | 'status'>>
}

export interface RecommendedCategory {
  id: string
  name: string
  nameTh?: string | null
  nameEn?: string | null
  slug: string
}

export interface IRecommendationRepository {
  findPublicProductById(productId: string): Promise<RecommendationProductRecord | null>
  findTrendingProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]>
  findNewestProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]>
  findRelatedProducts(query: RelatedRecommendationQuery, source: RecommendationProductRecord): Promise<RecommendationProductRecord[]>
  findSimilarProducts(query: SimilarRecommendationQuery, source: RecommendationProductRecord): Promise<RecommendationProductRecord[]>
  findRecommendedCategories(limit: number): Promise<RecommendedCategory[]>
}

const recommendationProductSelect = {
  id: true,
  title: true,
  titleTh: true,
  titleEn: true,
  createdAt: true,
  categoryId: true,
  shopId: true,
  status: true,
  category: {
    select: {
      id: true,
      name: true,
      nameTh: true,
      nameEn: true,
      slug: true,
      sortOrder: true,
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  variants: {
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      priceCents: true,
      status: true,
      orderItems: {
        select: {
          quantity: true,
        },
      },
    },
  },
  reviews: {
    where: { status: 'PUBLISHED' },
    select: {
      rating: true,
      status: true,
    },
  },
} as const

export class PrismaRecommendationRepository implements IRecommendationRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findPublicProductById(productId: string): Promise<RecommendationProductRecord | null> {
    this.logger.debug('PrismaRecommendationRepository.findPublicProductById', { productId })
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        ...this.publicProductWhere(),
      },
      select: recommendationProductSelect,
    })
  }

  findTrendingProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findTrendingProducts', { query })
    return this.prisma.product.findMany({
      where: this.publicProductWhere(),
      select: recommendationProductSelect,
      orderBy: [
        { variants: { _count: 'desc' } },
        { reviews: { _count: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: query.offset,
      take: query.limit,
    })
  }

  findNewestProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findNewestProducts', { query })
    return this.prisma.product.findMany({
      where: this.publicProductWhere(),
      select: recommendationProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
    })
  }

  findRelatedProducts(query: RelatedRecommendationQuery, source: RecommendationProductRecord): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findRelatedProducts', { query })
    return this.prisma.product.findMany({
      where: {
        ...this.publicProductWhere(),
        id: { not: query.productId },
        OR: [
          ...(source.categoryId ? [{ categoryId: source.categoryId }] : []),
          { shopId: source.shopId },
        ],
      },
      select: recommendationProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
    })
  }

  findSimilarProducts(query: SimilarRecommendationQuery, source: RecommendationProductRecord): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findSimilarProducts', { query })
    const prices = source.variants.map((variant) => variant.priceCents)
    const minPrice = prices.length === 0 ? undefined : Math.min(...prices)
    const maxPrice = prices.length === 0 ? undefined : Math.max(...prices)
    const pricePadding = minPrice === undefined || maxPrice === undefined
      ? undefined
      : Math.max(500, Math.round((maxPrice - minPrice || minPrice) * 0.25))

    return this.prisma.product.findMany({
      where: {
        ...this.publicProductWhere(),
        id: { not: query.productId },
        ...(source.categoryId ? { categoryId: source.categoryId } : {}),
        ...(minPrice !== undefined && maxPrice !== undefined && pricePadding !== undefined
          ? {
              variants: {
                some: {
                  status: 'ACTIVE',
                  priceCents: {
                    gte: Math.max(0, minPrice - pricePadding),
                    lte: maxPrice + pricePadding,
                  },
                },
              },
            }
          : {}),
      },
      select: recommendationProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
    })
  }

  findRecommendedCategories(limit: number): Promise<RecommendedCategory[]> {
    this.logger.debug('PrismaRecommendationRepository.findRecommendedCategories', { limit })
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: this.publicProductWhere(),
        },
      },
      select: {
        id: true,
        name: true,
        nameTh: true,
        nameEn: true,
        slug: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
    })
  }

  private publicProductWhere(): Prisma.ProductWhereInput {
    return {
      status: 'ACTIVE',
      shop: { status: 'ACTIVE' },
      variants: { some: { status: 'ACTIVE' } },
      OR: [
        { categoryId: null },
        { category: { isActive: true } },
      ],
    }
  }
}
