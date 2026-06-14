import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheService } from '#server/modules/cache'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import { SearchServiceError } from './search.errors.ts'
import type { ISearchRepository, SearchProductFacets, SearchProductRecord } from './search.repository.ts'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const SUPPORTED_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'top_sales', 'rating'] as const

export type SearchSort = typeof SUPPORTED_SORTS[number]

export interface ProductSearchInput {
  q?: string
  categoryId?: string
  brandId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  attributeFilters?: string
  inStock?: boolean
  badges?: string
  rating?: number
  sort?: string
  cursor?: string
  page?: number
  limit?: number
  locale?: string
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
  variants: Array<{
    id: string
    sku: string
    title: string
    titleTh?: string | null
    titleEn?: string | null
    price: number
    currency: string
    stock: number
    optionValues: Array<{
      id: string
      value: string
      valueTh?: string | null
      valueEn?: string | null
      option: {
        id: string
        name: string
        nameTh?: string | null
        nameEn?: string | null
      }
    }>
  }>
  options: Array<{
    id: string
    name: string
    nameTh?: string | null
    nameEn?: string | null
    values: Array<{
      id: string
      value: string
      valueTh?: string | null
      valueEn?: string | null
    }>
  }>
  badges: string[]
}

export interface ProductSearchResponse {
  items: ProductSearchItem[]
  meta: {
    totalCount: number
    page: number
    pageSize: number
    hasNextPage: boolean
    query: {
      q?: string
      categoryId?: string
      brandId?: string
      minPrice?: number
      maxPrice?: number
      sort?: string
    }
  }
  facets: SearchProductFacets
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    nextCursor: string | null
    hasNextPage: boolean
  }
  filters: {
    q?: string
    categoryId?: string
    brandId?: string
    shopId?: string
    minPrice?: number
    maxPrice?: number
    rating?: number
    inStock?: boolean
    badges?: string[]
    cursor?: string
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
      brandId: filters.brandId,
      shopId: filters.shopId,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      attributeFilters: filters.attributeFilters,
      inStock: filters.inStock,
    })
    const facets = await this.loadProductFacets(filters)

    const items = products
      .map((product) => this.toSearchItem(product, filters.locale))
      .filter((item) => filters.rating === undefined || item.ratingSummary.averageRating >= filters.rating)
      .filter((item) => filters.badges.length === 0 || filters.badges.every((badge) => item.badges.includes(badge)))

    const sorted = this.sortItems(items, filters.sort)
    const total = sorted.length
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit)
    const start = this.resolveStartOffset(sorted, filters)
    const pageItems = sorted.slice(start, start + filters.limit)
    const nextCursor = start + filters.limit < sorted.length ? pageItems.at(-1)?.productId ?? null : null

    return {
      items: pageItems,
      meta: {
        totalCount: total,
        page: filters.page,
        pageSize: filters.limit,
        hasNextPage: nextCursor !== null,
        query: this.responseQuery(filters),
      },
      facets,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
        nextCursor,
        hasNextPage: nextCursor !== null,
      },
      filters: this.responseFilters(filters),
      sort: filters.sort,
    }
  }

  async getSuggestions(input: Pick<ProductSearchInput, 'q' | 'limit' | 'locale'>): Promise<SearchSuggestionsResponse> {
    const q = this.normalizeQuery(input.q)
    if (!q) return { recentKeywords: [], productTitles: [] }
    const limit = this.normalizeLimit(input.limit ?? 10)
    const locale = resolveContentLocale(input.locale)
    const cacheKeyInput = { q, limit, locale }
    if (this.cache) {
      return this.cache.remember(
        this.cache.keys.searchSuggestions(cacheKeyInput),
        () => this.getSuggestionsFromRepository(q, limit, locale),
        { ttlSeconds: this.cache.ttl().search },
      )
    }

    return this.getSuggestionsFromRepository(q, limit, locale)
  }

  private async getSuggestionsFromRepository(q: string, limit: number, locale: ContentLocale): Promise<SearchSuggestionsResponse> {
    const rows = await this.repo.findSuggestions(q, limit)
    return {
      recentKeywords: [],
      productTitles: [...new Set(rows.map((row) =>
        localizedText(locale, { th: row.titleTh, en: row.titleEn, fallback: row.title }) ?? row.title))],
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
    const inStock = input.inStock === true
    const badges = this.normalizeBadges(input.badges)
    const cursor = input.cursor?.trim() || undefined

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new SearchServiceError('Minimum price cannot exceed maximum price', 400, 'INVALID_FILTER')
    }

    return {
      q,
      locale: resolveContentLocale(input.locale),
      categoryId: input.categoryId?.trim() || undefined,
      brandId: input.brandId?.trim() || undefined,
      shopId: input.shopId?.trim() || undefined,
      attributeFilters: this.normalizeAttributeFilters(input.attributeFilters),
      minPrice,
      maxPrice,
      rating,
      inStock,
      badges,
      cursor,
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
    const raw = sort?.trim() || 'relevance'
    const normalized = raw === 'best_selling' ? 'top_sales' : raw
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

  private normalizeBadges(input: string | undefined): string[] {
    if (!input?.trim()) return []
    return [...new Set(input.split(',').map((badge) => badge.trim()).filter(Boolean))]
  }

  private toSearchItem(product: SearchProductRecord, locale: ContentLocale): ProductSearchItem {
    const price = product.variants.map((variant) => Number(variant.price))
    const minPrice = Math.min(...price)
    const maxPrice = Math.max(...price)
    const totalRating = product.reviews.reduce((sum, review) => sum + review.rating, 0)
    const totalReviewCount = product.reviews.length
    const averageRating = totalReviewCount === 0 ? 0 : Number((totalRating / totalReviewCount).toFixed(2))
    const soldCount = product.variants.reduce(
      (sum, variant) => sum + variant.orderItems.reduce((variantSum, item) => variantSum + item.quantity, 0),
      0,
    )
    const hasStock = product.variants.some((variant) =>
      variant.inventory ? variant.inventory.quantityOnHand - variant.inventory.quantityReserved > 0 : false)

    return {
      productId: product.id,
      title: localizedText(locale, { th: product.titleTh, en: product.titleEn, fallback: product.title }) ?? product.title,
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
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        title: localizedText(locale, { th: variant.titleTh, en: variant.titleEn, fallback: variant.title }) ?? variant.title,
        titleTh: variant.titleTh,
        titleEn: variant.titleEn,
        price: Number(variant.price),
        currency: variant.currency,
        stock: variant.inventory ? Math.max(0, variant.inventory.quantityOnHand - variant.inventory.quantityReserved) : 0,
        optionValues: variant.optionValues.map(({ optionValue }) => ({
          id: optionValue.id,
          value: localizedText(locale, { th: optionValue.valueTh, en: optionValue.valueEn, fallback: optionValue.value }) ?? optionValue.value,
          valueTh: optionValue.valueTh,
          valueEn: optionValue.valueEn,
          option: {
            id: optionValue.option.id,
            name: localizedText(locale, {
              th: optionValue.option.nameTh,
              en: optionValue.option.nameEn,
              fallback: optionValue.option.name,
            }) ?? optionValue.option.name,
            nameTh: optionValue.option.nameTh,
            nameEn: optionValue.option.nameEn,
          },
        })),
      })),
      options: product.options.map((option) => ({
        id: option.id,
        name: localizedText(locale, { th: option.nameTh, en: option.nameEn, fallback: option.name }) ?? option.name,
        nameTh: option.nameTh,
        nameEn: option.nameEn,
        values: option.values.map((value) => ({
          id: value.id,
          value: localizedText(locale, { th: value.valueTh, en: value.valueEn, fallback: value.value }) ?? value.value,
          valueTh: value.valueTh,
          valueEn: value.valueEn,
        })),
      })),
      badges: this.buildBadges(product, soldCount, hasStock),
    }
  }

  private buildBadges(product: SearchProductRecord, soldCount: number, hasStock: boolean): string[] {
    const badges: string[] = []
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const createdAtTime = product.createdAt instanceof Date ? product.createdAt.getTime() : new Date(product.createdAt).getTime()
    if (createdAtTime >= sevenDaysAgo) badges.push('new')
    if (soldCount >= 100) badges.push('best_seller')
    if (hasStock) badges.push('in_stock')
    return badges
  }

  private async loadProductFacets(filters: ReturnType<SearchService['normalizeInput']>): Promise<SearchProductFacets> {
    try {
      return await this.repo.findProductFacets({
        q: filters.q,
        categoryId: filters.categoryId,
        brandId: filters.brandId,
        shopId: filters.shopId,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        attributeFilters: filters.attributeFilters,
        inStock: filters.inStock,
      })
    } catch (error) {
      this.logger.warn('SearchService.loadProductFacets failed', { error })
      return this.emptyProductFacets()
    }
  }

  private emptyProductFacets(): SearchProductFacets {
    return {
      categories: [],
      brands: [],
      price: {
        min: null,
        max: null,
        currency: 'THB',
      },
    }
  }

  private sortItems(items: ProductSearchItem[], sort: SearchSort): ProductSearchItem[] {
    const sorted = [...items]
    switch (sort) {
      case 'price_asc':
        return sorted.sort((a, b) => a.minPrice - b.minPrice || a.title.localeCompare(b.title))
      case 'price_desc':
        return sorted.sort((a, b) => b.minPrice - a.minPrice || a.title.localeCompare(b.title))
      case 'top_sales':
        return sorted.sort((a, b) => b.soldCount - a.soldCount || a.title.localeCompare(b.title))
      case 'rating':
        return sorted.sort((a, b) =>
          b.ratingSummary.averageRating - a.ratingSummary.averageRating ||
          b.ratingSummary.totalReviewCount - a.ratingSummary.totalReviewCount ||
          a.title.localeCompare(b.title))
      case 'relevance':
      case 'newest':
      default:
        return sorted
    }
  }

  private resolveStartOffset(items: ProductSearchItem[], filters: ReturnType<SearchService['normalizeInput']>): number {
    if (!filters.cursor) return (filters.page - 1) * filters.limit
    const cursorIndex = items.findIndex((item) => item.productId === filters.cursor)
    return cursorIndex >= 0 ? cursorIndex + 1 : 0
  }

  private responseFilters(filters: ReturnType<SearchService['normalizeInput']>): ProductSearchResponse['filters'] {
    return {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.rating !== undefined ? { rating: filters.rating } : {}),
      ...(filters.inStock ? { inStock: true } : {}),
      ...(filters.badges.length > 0 ? { badges: filters.badges } : {}),
      ...(filters.cursor ? { cursor: filters.cursor } : {}),
    }
  }

  private responseQuery(filters: ReturnType<SearchService['normalizeInput']>): ProductSearchResponse['meta']['query'] {
    return {
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.sort ? { sort: filters.sort } : {}),
    }
  }

  private normalizeAttributeFilters(input: string | undefined): Array<{ key: string; value: string }> | undefined {
    if (!input?.trim()) return undefined
    const filters = input
      .split(',')
      .map((part) => {
        const [key, ...valueParts] = part.split(':')
        return {
          key: this.normalizeAttributeKey(key ?? ''),
          value: valueParts.join(':').trim(),
        }
      })
      .filter((pair) => pair.key && pair.value)
    return filters.length > 0 ? filters : undefined
  }

  private normalizeAttributeKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }
}
