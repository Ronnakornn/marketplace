import { moneyInteger, moneyMin, moneyMax, moneyNumber } from '#server/lib/money.ts'
import { Prisma, type Category, type Inventory, type PrismaClient, type Product, type ProductImage, type ProductVariant, type Shop } from '#generated/client/client.ts'
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
  variants: Array<Pick<ProductVariant, 'id' | 'price' | 'status' | 'title' | 'sku' | 'currency'> & {
    inventory: Pick<Inventory, 'quantityOnHand' | 'quantityReserved'> | null
  }>
  soldCount: number
  ratingSum: number
  reviewCount: number
  images?: Array<Pick<ProductImage, 'url' | 'sortOrder' | 'isPrimary'>>
}

export type RecommendationSourceProduct = Pick<Product, 'id' | 'categoryId' | 'shopId'> & {
  variants: Array<Pick<ProductVariant, 'price'>>
}

export interface RecommendedCategory {
  id: string
  name: string
  nameTh?: string | null
  nameEn?: string | null
  slug: string
}

export interface IRecommendationRepository {
  findPublicProductById(productId: string): Promise<RecommendationSourceProduct | null>
  findTrendingProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]>
  findNewestProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]>
  findRelatedProducts(query: RelatedRecommendationQuery, source: RecommendationSourceProduct): Promise<RecommendationProductRecord[]>
  findSimilarProducts(query: SimilarRecommendationQuery, source: RecommendationSourceProduct): Promise<RecommendationProductRecord[]>
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
      price: true,
      status: true,
      title: true,
      sku: true,
      currency: true,
      inventory: {
        select: {
          quantityOnHand: true,
          quantityReserved: true,
        },
      },
    },
  },
  images: {
    select: {
      url: true,
      sortOrder: true,
      isPrimary: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductSelect

export class PrismaRecommendationRepository implements IRecommendationRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findPublicProductById(productId: string): Promise<RecommendationSourceProduct | null> {
    this.logger.debug('PrismaRecommendationRepository.findPublicProductById', { productId })
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        ...this.publicProductWhere(),
      },
      select: { id: true, categoryId: true, shopId: true, variants: { where: { status: 'ACTIVE' }, select: { price: true } } },
    })
  }

  findTrendingProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findTrendingProducts', { query })
    return this.withMetrics(this.prisma.product.findMany({
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
    }))
  }

  findNewestProducts(query: RecommendationListQuery): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findNewestProducts', { query })
    return this.withMetrics(this.prisma.product.findMany({
      where: this.publicProductWhere(),
      select: recommendationProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.offset,
      take: query.limit,
    }))
  }

  findRelatedProducts(query: RelatedRecommendationQuery, source: RecommendationSourceProduct): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findRelatedProducts', { query })
    return this.withMetrics(this.prisma.product.findMany({
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
    }))
  }

  findSimilarProducts(query: SimilarRecommendationQuery, source: RecommendationSourceProduct): Promise<RecommendationProductRecord[]> {
    this.logger.debug('PrismaRecommendationRepository.findSimilarProducts', { query })
    const price = source.variants.map((variant) => moneyInteger(variant.price))
    const minPrice = price.length === 0 ? undefined : moneyMin(price)
    const maxPrice = price.length === 0 ? undefined : moneyMax(price)
    const pricePadding = minPrice === undefined || maxPrice === undefined
      ? undefined
      : moneyMax([500n, ((maxPrice - minPrice || minPrice) + 2n) / 4n])

    return this.withMetrics(this.prisma.product.findMany({
      where: {
        ...this.publicProductWhere(),
        id: { not: query.productId },
        ...(source.categoryId ? { categoryId: source.categoryId } : {}),
        ...(minPrice !== undefined && maxPrice !== undefined && pricePadding !== undefined
          ? {
              variants: {
                some: {
                  status: 'ACTIVE',
                  price: {
                    gte: moneyMax([0n, minPrice - pricePadding]),
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
    }))
  }

  private async withMetrics(products: Promise<Prisma.ProductGetPayload<{ select: typeof recommendationProductSelect }>[]>): Promise<RecommendationProductRecord[]> {
    const rows = await products
    if (rows.length === 0) return []
    const [reviews, sales] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: rows.map((product) => product.id) }, status: 'PUBLISHED' },
        _sum: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ productId: string; soldCount: string }>>(Prisma.sql`
        SELECT v."productId"::text AS "productId", SUM(i.quantity::numeric)::text AS "soldCount"
        FROM "OrderItem" i JOIN "ProductVariant" v ON v.id = i."variantId" JOIN "Order" o ON o.id = i."orderId"
        WHERE v."productId" IN (${Prisma.join(rows.map((product) => Prisma.sql`${product.id}::uuid`))})
          AND v.status = 'ACTIVE' AND i."fulfillmentStatus" <> 'CANCELED'
          AND o."paymentStatus" = 'SUCCEEDED' AND o.status <> 'CANCELED'
        GROUP BY v."productId"
      `),
    ])
    const reviewsById = new Map(reviews.map((review) => [review.productId, review]))
    const soldByProduct = new Map(sales.map((sale) => [sale.productId, moneyNumber(sale.soldCount)]))
    return rows.map((product) => ({
      ...product,
      soldCount: soldByProduct.get(product.id) ?? 0,
      ratingSum: reviewsById.get(product.id)?._sum.rating ?? 0,
      reviewCount: reviewsById.get(product.id)?._count._all ?? 0,
    }))
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
