import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import { SearchServiceError } from './search.errors.ts'
import type { ISearchRepository, SearchProductRecord } from './search.repository.ts'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const SUPPORTED_SORTS = ['newest', 'price_asc', 'price_desc', 'best_selling', 'rating'] as const

export type SearchSort = typeof SUPPORTED_SORTS[number]

export interface ProductSearchInput {
  q?: string
  categoryId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  rating?: number
  sort?: string
  page?: number
  limit?: number
}

export interface ProductSearchItem {
  productId: string
  title: string
  coverImage: string | null
  minPrice: number
  maxPrice: number | null
  ratingSummary: {
    averageRating: number
    totalReviewCount: number
  }
  soldCount: number
  shop: {
    id: string
    name: string
    slug: string
  }
  badges: string[]
}

export interface ProductSearchResponse {
  items: ProductSearchItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    q?: string
    categoryId?: string
    shopId?: string
    minPrice?: number
    maxPrice?: number
    rating?: number
  }
  sort: SearchSort
}

export interface SearchSuggestionsResponse {
  recentKeywords: string[]
  productTitles: string[]
}

export class SearchService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ISearchRepository,
    private cache?: CacheService,
  ) {
    this.logger = appContext.logger
  }

  async searchProducts(input: ProductSearchInput): Promise<ProductSearchResponse> {
    const filters = this.normalizeInput(input)
    this.logger.debug('SearchService.searchProducts', { filters })
    if (this.cache) {
      return this.cache.remember(
        this.cache.keys.productSearch(filters),
        () => this.searchProductsFromRepository(filters),
        { ttlSeconds: this.cache.ttl().search },
      )
    }

    return this.searchProductsFromRepository(filters)
  }

  private async searchProductsFromRepository(filters: ReturnType<SearchService['normalizeInput']>): Promise<ProductSearchResponse> {
    const products = await this.repo.findSearchableProducts({
      q: filters.q,
      categoryId: filters.categoryId,
      shopId: filters.shopId,
      minPriceCents: filters.minPrice,
      maxPriceCents: filters.maxPrice,
    })

    const items = products
      .map((product) => this.toSearchItem(product))
      .filter((item) => filters.rating === undefined || item.ratingSummary.averageRating >= filters.rating)

    const sorted = this.sortItems(items, filters.sort)
    const total = sorted.length
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit)
    const start = (filters.page - 1) * filters.limit

    return {
      items: sorted.slice(start, start + filters.limit),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
      filters: this.responseFilters(filters),
      sort: filters.sort,
    }
  }

  async getSuggestions(input: Pick<ProductSearchInput, 'q' | 'limit'>): Promise<SearchSuggestionsResponse> {
    const q = this.normalizeQuery(input.q)
    if (!q) return { recentKeywords: [], productTitles: [] }
    const limit = this.normalizeLimit(input.limit ?? 10)
    const rows = await this.repo.findSuggestions(q, limit)
    return {
      recentKeywords: [],
      productTitles: [...new Set(rows.map((row) => row.title))],
    }
  }

  private normalizeInput(input: ProductSearchInput) {
    const q = this.normalizeQuery(input.q)
    const sort = this.normalizeSort(input.sort)
    const page = this.normalizePage(input.page)
    const limit = this.normalizeLimit(input.limit)
    const minPrice = this.normalizeOptionalNonNegativeInteger(input.minPrice, 'minPrice')
    const maxPrice = this.normalizeOptionalNonNegativeInteger(input.maxPrice, 'maxPrice')
    const rating = this.normalizeRating(input.rating)

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new SearchServiceError('Minimum price cannot exceed maximum price', 400, 'INVALID_FILTER')
    }

    return {
      q,
      categoryId: input.categoryId?.trim() || undefined,
      shopId: input.shopId?.trim() || undefined,
      minPrice,
      maxPrice,
      rating,
      sort,
      page,
      limit,
    }
  }

  private normalizeQuery(q: string | undefined): string | undefined {
    const normalized = q?.trim()
    if (normalized && normalized.length > 100) {
      throw new SearchServiceError('Search query is too long', 400, 'INVALID_SEARCH_QUERY')
    }
    return normalized || undefined
  }

  private normalizeSort(sort: string | undefined): SearchSort {
    const normalized = sort?.trim() || 'newest'
    if (!SUPPORTED_SORTS.includes(normalized as SearchSort)) {
      throw new SearchServiceError('Unsupported search sort', 400, 'INVALID_SORT')
    }
    return normalized as SearchSort
  }

  private normalizePage(page: number | undefined): number {
    const value = page ?? DEFAULT_PAGE
    if (!Number.isInteger(value) || value < 1) {
      throw new SearchServiceError('Page must be a positive integer', 400, 'INVALID_FILTER')
    }
    return value
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
      throw new SearchServiceError(`Limit must be between 1 and ${MAX_LIMIT}`, 400, 'INVALID_FILTER')
    }
    return value
  }

  private normalizeOptionalNonNegativeInteger(value: number | undefined, field: string): number | undefined {
    if (value === undefined) return undefined
    if (!Number.isInteger(value) || value < 0) {
      throw new SearchServiceError(`${field} must be a non-negative integer`, 400, 'INVALID_FILTER')
    }
    return value
  }

  private normalizeRating(value: number | undefined): number | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'number' || value < 1 || value > 5) {
      throw new SearchServiceError('Rating filter must be between 1 and 5', 400, 'INVALID_FILTER')
    }
    return value
  }

  private toSearchItem(product: SearchProductRecord): ProductSearchItem {
    const prices = product.variants.map((variant) => variant.priceCents)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0)
    const totalReviewCount = product.reviews.length
    const averageRating = totalReviewCount === 0 ? 0 : Number((totalRating / totalReviewCount).toFixed(2))
    const soldCount = product.variants.reduce(
      (sum, variant) => sum + variant.orderItems.reduce((variantSum, item) => variantSum + item.quantity, 0),
      0,
    )

    return {
      productId: product.id,
      title: product.title,
      coverImage: null,
      minPrice,
      maxPrice: maxPrice === minPrice ? null : maxPrice,
      ratingSummary: {
        averageRating,
        totalReviewCount,
      },
      soldCount,
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
      },
      badges: this.buildBadges(product, soldCount),
    }
  }

  private buildBadges(product: SearchProductRecord, soldCount: number): string[] {
    const badges: string[] = []
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (product.createdAt.getTime() >= sevenDaysAgo) badges.push('new')
    if (soldCount >= 100) badges.push('best_seller')
    return badges
  }

  private sortItems(items: ProductSearchItem[], sort: SearchSort): ProductSearchItem[] {
    const sorted = [...items]
    switch (sort) {
      case 'price_asc':
        return sorted.sort((a, b) => a.minPrice - b.minPrice || a.title.localeCompare(b.title))
      case 'price_desc':
        return sorted.sort((a, b) => b.minPrice - a.minPrice || a.title.localeCompare(b.title))
      case 'best_selling':
        return sorted.sort((a, b) => b.soldCount - a.soldCount || a.title.localeCompare(b.title))
      case 'rating':
        return sorted.sort((a, b) =>
          b.ratingSummary.averageRating - a.ratingSummary.averageRating ||
          b.ratingSummary.totalReviewCount - a.ratingSummary.totalReviewCount ||
          a.title.localeCompare(b.title))
      case 'newest':
      default:
        return sorted
    }
  }

  private responseFilters(filters: ReturnType<SearchService['normalizeInput']>): ProductSearchResponse['filters'] {
    return {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.rating !== undefined ? { rating: filters.rating } : {}),
    }
  }
}
