import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import { RecommendationServiceError } from './recommendation.errors.ts'
import type { IRecommendationRepository, RecommendationProductRecord, RecommendedCategory } from './recommendation.repository.ts'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const DEFAULT_PAGE = 1

export interface RecommendationQueryInput {
  page?: number
  limit?: number
  locale?: string
}

export interface RecommendationProductCard {
  productId: string
  title: string
  coverImage?: string
  minPrice: number
  maxPrice?: number
  rating?: number
  soldCount?: number
  shop?: {
    id: string
    name: string
  }
}

export interface RecommendationListResponse {
  items: RecommendationProductCard[]
  pagination: {
    page: number
    limit: number
    hasNextPage: boolean
  }
}

export interface HomeFeedResponse {
  sections: {
    trending: RecommendationProductCard[]
    newest: RecommendationProductCard[]
    recommendedCategories: RecommendedCategory[]
  }
  pagination: {
    page: number
    limit: number
  }
}

type NormalizedQuery = {
  page: number
  limit: number
  offset: number
  locale: ContentLocale
}

export class RecommendationService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IRecommendationRepository,
    private cache?: CacheService,
  ) {
    this.logger = appContext.logger
  }

  getTrending(input: RecommendationQueryInput): Promise<RecommendationListResponse> {
    const query = this.normalizeQuery(input)
    this.logger.debug('RecommendationService.getTrending', { query })
    return this.remember('trending', query, () => this.listWithPagination(query, (fetchQuery) =>
      this.repo.findTrendingProducts(fetchQuery)))
  }

  async getRelated(productId: string, input: RecommendationQueryInput): Promise<RecommendationListResponse> {
    const query = this.normalizeQuery(input)
    this.logger.debug('RecommendationService.getRelated', { productId, query })
    return this.remember('related', { productId, ...query }, async () => {
      const source = await this.getSourceProduct(productId)
      return this.listWithPagination(query, (fetchQuery) =>
        this.repo.findRelatedProducts({ productId, ...fetchQuery }, source))
    })
  }

  async getSimilar(productId: string, input: RecommendationQueryInput): Promise<RecommendationListResponse> {
    const query = this.normalizeQuery(input)
    this.logger.debug('RecommendationService.getSimilar', { productId, query })
    return this.remember('similar', { productId, ...query }, async () => {
      const source = await this.getSourceProduct(productId)
      return this.listWithPagination(query, (fetchQuery) =>
        this.repo.findSimilarProducts({ productId, ...fetchQuery }, source))
    })
  }

  getHomeFeed(input: RecommendationQueryInput): Promise<HomeFeedResponse> {
    const query = this.normalizeQuery(input)
    this.logger.debug('RecommendationService.getHomeFeed', { query })
    return this.remember('home-feed', query, async () => {
      const [trending, newest, recommendedCategories] = await Promise.all([
        this.repo.findTrendingProducts({ limit: query.limit, offset: query.offset }),
        this.repo.findNewestProducts({ limit: query.limit, offset: query.offset }),
        this.repo.findRecommendedCategories(Math.min(10, query.limit)),
      ])

      return {
        sections: {
          trending: trending.map((product) => this.toProductCard(product, query.locale)),
          newest: newest.map((product) => this.toProductCard(product, query.locale)),
          recommendedCategories: recommendedCategories.map((category) => ({
            ...category,
            name: localizedText(query.locale, { th: category.nameTh, en: category.nameEn, fallback: category.name }) ?? category.name,
          })),
        },
        pagination: {
          page: query.page,
          limit: query.limit,
        },
      }
    })
  }

  private async listWithPagination(
    query: NormalizedQuery,
    fetcher: (query: { limit: number; offset: number }) => Promise<RecommendationProductRecord[]>,
  ): Promise<RecommendationListResponse> {
    const rows = await fetcher({ limit: query.limit + 1, offset: query.offset })
    const hasNextPage = rows.length > query.limit
    const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows

    return {
      items: pageRows.map((product) => this.toProductCard(product, query.locale)),
      pagination: {
        page: query.page,
        limit: query.limit,
        hasNextPage,
      },
    }
  }

  private async getSourceProduct(productId: string): Promise<RecommendationProductRecord> {
    const product = await this.repo.findPublicProductById(productId)
    if (!product) throw new RecommendationServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    return product
  }

  private normalizeQuery(input: RecommendationQueryInput): NormalizedQuery {
    const page = input.page ?? DEFAULT_PAGE
    const limit = input.limit ?? DEFAULT_LIMIT

    if (!Number.isInteger(page) || page < 1) {
      throw new RecommendationServiceError('Page must be a positive integer', 400, 'INVALID_RECOMMENDATION_QUERY')
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new RecommendationServiceError(`Limit must be between 1 and ${MAX_LIMIT}`, 400, 'INVALID_RECOMMENDATION_QUERY')
    }

    return {
      page,
      limit,
      offset: (page - 1) * limit,
      locale: resolveContentLocale(input.locale),
    }
  }

  private toProductCard(product: RecommendationProductRecord, locale: ContentLocale): RecommendationProductCard {
    const prices = product.variants.map((variant) => variant.prices)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const soldCount = product.variants.reduce(
      (sum, variant) => sum + variant.orderItems.reduce((variantSum, item) => variantSum + item.quantity, 0),
      0,
    )
    const rating = product.reviews.length === 0
      ? undefined
      : Number((product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length).toFixed(2))

    return {
      productId: product.id,
      title: localizedText(locale, { th: product.titleTh, en: product.titleEn, fallback: product.title }) ?? product.title,
      minPrice,
      ...(maxPrice !== minPrice ? { maxPrice } : {}),
      ...(rating !== undefined ? { rating } : {}),
      soldCount,
      shop: {
        id: product.shop.id,
        name: product.shop.name,
      },
    }
  }

  private remember<T>(kind: string, query: unknown, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cache) return fetcher()
    return this.cache.remember(
      this.cache.keys.recommendations(kind, query),
      fetcher,
      { ttlSeconds: this.cache.ttl().product },
    )
  }
}
