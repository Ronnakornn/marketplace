import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import type { SearchService, ProductSearchItem } from '#server/modules/search/search.service.ts'
import type { AiSearchConfig } from './ai-search.config.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'
import type { IEmbeddingService } from './embedding.service.ts'
import type { AiSearchProductRecord, IVectorSearchAdapter, VectorSearchMatch } from './vector-search.adapter.ts'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20
const MAX_QUERY_LENGTH = 200

export interface AiSearchInput {
  query: string
  limit?: number
  locale?: string
}

export interface AiSearchProductItem {
  productId: string
  title: string
  description: string | null
  category: {
    id: string
    name: string
    slug: string
  } | null
  price: {
    minPrice: number
    maxPrice: number | null
    currency: string
  }
  rating: {
    averageRating: number
    totalReviewCount: number
  }
  shop: {
    id: string
    name: string
    slug: string
  }
  stockAvailability: 'in_stock' | 'out_of_stock' | 'unknown'
}

export interface AiSearchSemanticMatch {
  productId: string
  score: number
  title: string
}

export interface AiSearchResponse {
  items: AiSearchProductItem[]
  semanticMatches: AiSearchSemanticMatch[]
  relatedQueries?: string[]
}

interface NormalizedAiSearchInput {
  query: string
  limit: number
  locale: ContentLocale
}

export class AiSearchService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private config: AiSearchConfig,
    private embeddingService: IEmbeddingService,
    private vectorSearch: IVectorSearchAdapter,
    private searchService: SearchService,
    private cache?: CacheService,
  ) {
    this.logger = appContext.logger
  }

  async search(input: AiSearchInput): Promise<AiSearchResponse> {
    this.assertEnabled()
    const normalized = this.normalizeInput(input)
    const cacheKeyInput = {
      query: normalized.query,
      limit: normalized.limit,
      locale: normalized.locale,
      embeddingModel: this.config.embeddingModel,
    }

    if (this.cache) {
      return this.cache.remember(
        this.cache.keys.aiSearch(cacheKeyInput),
        () => this.searchUncached(normalized),
        { ttlSeconds: this.cache.ttl().search },
      )
    }

    return this.searchUncached(normalized)
  }

  private async searchUncached(input: NormalizedAiSearchInput): Promise<AiSearchResponse> {
    try {
      const embedding = await this.embeddingService.embedText(input.query)
      const matches = await this.vectorSearch.searchProducts({
        embedding,
        limit: input.limit,
        locale: input.locale,
        model: this.config.embeddingModel,
      })

      return {
        items: matches.map((match) => this.toProductItem(match.product, input.locale)),
        semanticMatches: matches.map((match) => this.toSemanticMatch(match, input.locale)),
        relatedQueries: this.relatedQueries(input.query),
      }
    } catch (error) {
      if (error instanceof AiSearchServiceError && error.code === 'VECTOR_SEARCH_UNAVAILABLE') {
        this.logger.warn('AiSearchService falling back to lexical search', {
          code: error.code,
          query: input.query,
        })
        return this.fallbackSearch(input)
      }
      throw error
    }
  }

  private async fallbackSearch(input: NormalizedAiSearchInput): Promise<AiSearchResponse> {
    const result = await this.searchService.searchProducts({
      q: input.query,
      limit: input.limit,
      locale: input.locale,
    })

    return {
      items: result.items.map((item) => this.fromSearchItem(item)),
      semanticMatches: [],
      relatedQueries: this.relatedQueries(input.query),
    }
  }

  private assertEnabled(): void {
    if (!this.config.enabled) {
      throw new AiSearchServiceError('AI search is disabled', 403, 'AI_SEARCH_DISABLED')
    }
  }

  private normalizeInput(input: AiSearchInput): NormalizedAiSearchInput {
    const query = typeof input.query === 'string' ? input.query.trim() : ''
    if (!query) throw new AiSearchServiceError('AI search query is required', 400, 'INVALID_AI_QUERY')
    if (query.length > MAX_QUERY_LENGTH) {
      throw new AiSearchServiceError('AI search query is too long', 400, 'INVALID_AI_QUERY')
    }

    const limit = input.limit ?? DEFAULT_LIMIT
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new AiSearchServiceError(`Limit must be between 1 and ${MAX_LIMIT}`, 400, 'INVALID_AI_QUERY')
    }

    return {
      query,
      limit,
      locale: resolveContentLocale(input.locale),
    }
  }

  private toProductItem(product: AiSearchProductRecord, locale: ContentLocale): AiSearchProductItem {
    const price = product.variants.map((variant) => variant.price)
    const minPrice = Math.min(...price.map((price: string | bigint) => Number(price)));
    const maxPrice = Math.max(...price.map((price: string | bigint) => Number(price)));
    const currency = product.variants[0]?.currency ?? 'USD'
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0)
    const totalReviewCount = product.reviews.length
    const averageRating = totalReviewCount === 0 ? 0 : Number((totalRating / totalReviewCount).toFixed(2))

    return {
      productId: product.id,
      title: localizedText(locale, { th: product.titleTh, en: product.titleEn, fallback: product.title }) ?? product.title,
      description: localizedText(locale, {
        th: product.descriptionTh,
        en: product.descriptionEn,
        fallback: product.description,
      }),
      category: product.category
        ? {
            id: product.category.id,
            name: localizedText(locale, {
              th: product.category.nameTh,
              en: product.category.nameEn,
              fallback: product.category.name,
            }) ?? product.category.name,
            slug: product.category.slug,
          }
        : null,
      price: {
        minPrice,
        maxPrice: maxPrice === minPrice ? null : maxPrice,
        currency,
      },
      rating: {
        averageRating,
        totalReviewCount,
      },
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
      },
      stockAvailability: this.stockAvailability(product),
    }
  }

  private toSemanticMatch(match: VectorSearchMatch, locale: ContentLocale): AiSearchSemanticMatch {
    return {
      productId: match.product.id,
      score: Number(match.score.toFixed(4)),
      title: localizedText(locale, {
        th: match.product.titleTh,
        en: match.product.titleEn,
        fallback: match.product.title,
      }) ?? match.product.title,
    }
  }

  private fromSearchItem(item: ProductSearchItem): AiSearchProductItem {
    return {
      productId: item.productId,
      title: item.title,
      description: null,
      category: null,
      price: {
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
        currency: 'USD',
      },
      rating: item.ratingSummary,
      shop: item.shop,
      stockAvailability: 'unknown',
    }
  }

  private stockAvailability(product: AiSearchProductRecord): AiSearchProductItem['stockAvailability'] {
    const inventories = product.variants
      .map((variant) => variant.inventory)
      .filter((inventory): inventory is NonNullable<typeof inventory> => inventory !== null)
    if (inventories.length === 0) return 'unknown'
    return inventories.some((inventory) => inventory.quantityOnHand - inventory.quantityReserved > 0)
      ? 'in_stock'
      : 'out_of_stock'
  }

  private relatedQueries(query: string): string[] {
    const normalized = query.trim()
    return normalized ? [`${normalized} deals`, `${normalized} best rated`] : []
  }
}
