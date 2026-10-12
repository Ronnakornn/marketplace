import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { CacheService, type CacheClient } from '#server/modules/cache'
import type { ISearchRepository, SearchProductRecord } from './search.repository.ts'
import { SearchService } from './search.service.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): ISearchRepository {
  return {
    findSearchPage: vi.fn(),
    findProductFacets: vi.fn(async () => ({
      categories: [],
      brands: [],
      price: { min: null, max: null, currency: 'THB' },
    })),
    findSuggestions: vi.fn(),
  }
}

function createCacheService() {
  const store = new Map<string, string>()
  const client: CacheClient = {
    get: vi.fn(async (key) => store.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys) => {
      keys.forEach((key) => store.delete(key))
      return keys.length
    }),
    scan: vi.fn(async (): Promise<[string, string[]]> => ['0', []]),
  }
  return new CacheService(createAppContext(), {
    enabled: true,
    redisUrl: 'redis://localhost:6379',
    defaultTtlSeconds: 300,
    productTtlSeconds: 120,
    searchTtlSeconds: 60,
    sellerDashboardTtlSeconds: 30,
    keyPrefix: 'v1',
  }, client)
}

const now = new Date('2026-05-13T00:00:00.000Z')

function createProduct(overrides: Partial<{
  id: string
  title: string
  description: string | null
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  shopId: string
  categoryId: string
  categorySlug: string
  price: bigint
  secondPrice: bigint
  rating: number
  reviewCount: number
  soldCount: number
}> = {}): SearchProductRecord {
  const reviewCount = overrides.reviewCount ?? 1
  const rating = overrides.rating ?? 5
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    title: overrides.title ?? 'Cotton Tee',
    slug: (overrides.title ?? 'Cotton Tee').toLowerCase().replace(/\s+/g, '-'),
    description: overrides.description ?? 'Soft cotton shirt',
    status: overrides.status ?? 'ACTIVE',
    createdAt: now,
    category: {
      id: overrides.categoryId ?? 'category-1',
      name: 'Fashion',
      slug: overrides.categorySlug ?? 'fashion',
    },
    shop: {
      id: overrides.shopId ?? 'shop-1',
      name: 'Shop One',
      slug: 'shop-one',
      status: 'ACTIVE',
      addresses: [{ city: 'Bangkok', region: 'Bangkok', country: 'TH' }],
    },
    images: [{ url: '/uploads/products/cotton-tee.webp' }],
    variants: [
      {
        id: 'variant-1',
        sku: 'TEE-1',
        title: 'Default',
        price: overrides.price ? BigInt(overrides.price) : BigInt(1000),
        currency: 'USD',
        optionValues: [],
        inventory: { quantityOnHand: 10, quantityReserved: 2 },
      },
      ...(overrides.secondPrice ? [{
        id: 'variant-2',
        sku: 'TEE-2',
        title: 'Large',
        price: BigInt(overrides.secondPrice), // Convert price to bigint
        currency: 'USD',
        optionValues: [],
        inventory: { quantityOnHand: 0, quantityReserved: 0 },
      }] : []),
    ],
    options: [],
    metrics: { averageRating: rating, totalReviewCount: reviewCount, soldCount: overrides.soldCount ?? 0 },
  }
}

let repo: ISearchRepository
let service: SearchService

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new SearchService(createAppContext(), repo)
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [
      createProduct({ id: 'p1', title: 'Cotton Tee', price: 1000n, rating: 4, soldCount: 20 }),
      createProduct({ id: 'p2', title: 'Denim Jacket', price: 3000n, rating: 5, soldCount: 5 }),
    ], total: 2, nextCursor: null })
    vi.mocked(repo.findSuggestions).mockResolvedValue([
      { id: 'p1', title: 'Cotton Tee' },
      { id: 'p3', title: 'Cotton Socks' },
    ])
  })

  it('searches by keyword through the repository', async () => {
    const result = await service.searchProducts({ q: ' cotton ' })

    expect(repo.findSearchPage).toHaveBeenCalledWith(expect.objectContaining({
      q: 'cotton',
      categoryId: undefined,
      shopId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      attributeFilters: undefined,
      brandId: undefined,
      inStock: false,
    }))
    expect(result.items[0]).toMatchObject({ productId: 'p1', title: 'Cotton Tee' })
  })

  it('does not expose inactive products because repository is called with public active constraints', async () => {
    await service.searchProducts({})

    expect(repo.findSearchPage).toHaveBeenCalledTimes(1)
  })

  it('supports pagination', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [createProduct({ id: 'p2' })], total: 2, nextCursor: null })
    const result = await service.searchProducts({ page: 2, limit: 1 })

    expect(result.meta).toEqual({
      totalCount: 2,
      page: 2,
      pageSize: 1,
      hasNextPage: false,
      query: {
        sort: 'relevance',
      },
    })
    expect(result.facets).toEqual({
      categories: [],
      brands: [],
      price: { min: null, max: null, currency: 'THB' },
    })
    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.productId).toBe('p2')
  })

  it('supports sorting', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValueOnce({ products: [createProduct({ id: 'p2' }), createProduct({ id: 'p1' })], total: 2, nextCursor: null })
    await expect(service.searchProducts({ sort: 'price_desc' })).resolves.toMatchObject({
      items: [{ productId: 'p2' }, { productId: 'p1' }],
      sort: 'price_desc',
    })

    await expect(service.searchProducts({ sort: 'top_sales' })).resolves.toMatchObject({
      items: [{ productId: 'p1' }, { productId: 'p2' }],
      sort: 'top_sales',
    })

    await expect(service.searchProducts({ sort: 'best_selling' })).resolves.toMatchObject({
      sort: 'top_sales',
    })
  })

  it('supports shop and rating filters', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [createProduct({ id: 'p2', rating: 5 })], total: 1, nextCursor: null })
    const result = await service.searchProducts({ shopId: 'shop-1', rating: 5 })

    expect(repo.findSearchPage).toHaveBeenCalledWith(expect.objectContaining({ shopId: 'shop-1' }))
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.productId).toBe('p2')
  })

  it('supports price range and variant min/max output', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [
      createProduct({ id: 'p3', title: 'Sneakers', price: 2500n, secondPrice: 3500n }),
    ], total: 1, nextCursor: null })

    const result = await service.searchProducts({ minPrice: 2000, maxPrice: 4000 })

    expect(repo.findSearchPage).toHaveBeenCalledWith(expect.objectContaining({
      minPrice: 2000,
      maxPrice: 4000,
    }))
    expect(result.items[0]).toMatchObject({ minPrice: 2500n, maxPrice: 3500n })
    expect(result.meta.query).toMatchObject({
      minPrice: 2000,
      maxPrice: 4000,
      sort: 'relevance',
    })
  })

  it('keeps variant stock and option data for reusable product card quick-add decisions', async () => {
    const result = await service.searchProducts({})

    expect(result.items[0]).toMatchObject({
      productId: 'p1',
      variants: [{
        id: 'variant-1',
        sku: 'TEE-1',
        title: 'Default',
        price: 1000n,
        currency: 'USD',
        stock: 8,
        optionValues: [],
      }],
      options: [],
    })
  })

  it('returns backend product facets and keeps facet failures non-fatal', async () => {
    vi.mocked(repo.findProductFacets).mockResolvedValueOnce({
      categories: [{ id: 'category-1', slug: 'fashion', name: 'Fashion', count: 2, active: true }],
      brands: [{ id: 'brand-1', slug: 'acme', name: 'Acme', count: 2, active: false }],
      price: { min: 1000n, max: 3000n, currency: 'USD' },
    })

    await expect(service.searchProducts({ categoryId: 'fashion' })).resolves.toMatchObject({
      facets: {
        categories: [{ id: 'category-1', slug: 'fashion', name: 'Fashion', count: 2, active: true }],
        brands: [{ id: 'brand-1', slug: 'acme', name: 'Acme', count: 2, active: false }],
        price: { min: 1000n, max: 3000n, currency: 'USD' },
      },
    })
    expect(repo.findProductFacets).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'fashion' }))

    vi.mocked(repo.findProductFacets).mockRejectedValueOnce(new Error('facet query failed'))

    await expect(service.searchProducts({})).resolves.toMatchObject({
      items: [{ productId: 'p1' }, { productId: 'p2' }],
      facets: {
        categories: [],
        brands: [],
        price: { min: null, max: null, currency: 'THB' },
      },
    })
  })

  it('supports contract filters for brand, attributes, in-stock, badges, and cursor', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [createProduct({ id: 'p2' })], total: 2, nextCursor: null })
    const result = await service.searchProducts({
      brandId: 'brand-1',
      attributeFilters: 'Color:Red',
      inStock: true,
      badges: 'in_stock',
      cursor: 'p1',
      limit: 1,
    })

    expect(repo.findSearchPage).toHaveBeenCalledWith(expect.objectContaining({
      brandId: 'brand-1',
      attributeFilters: [{ key: 'color', value: 'Red' }],
      inStock: true,
    }))
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.productId).toBe('p2')
    expect(result.pagination).toMatchObject({ nextCursor: null, hasNextPage: false })
    expect(result.filters).toMatchObject({
      brandId: 'brand-1',
      inStock: true,
      badges: ['in_stock'],
      cursor: 'p1',
    })
  })

  it('rejects invalid sort and invalid filters', async () => {
    await expect(service.searchProducts({ sort: 'weird' })).rejects.toMatchObject({ code: 'INVALID_SORT' })
    await expect(service.searchProducts({ minPrice: 500, maxPrice: 100 })).rejects.toMatchObject({ code: 'INVALID_FILTER' })
    await expect(service.searchProducts({ rating: 6 })).rejects.toMatchObject({ code: 'INVALID_FILTER' })
    await expect(service.searchProducts({ categoryId: 'fashion' })).resolves.toMatchObject({
      filters: { categoryId: 'fashion' },
    })
  })

  it.each(['minPrice', 'maxPrice'] as const)('rejects unsafe or fractional %s before querying', async (field) => {
    for (const value of [-1, 0.5, 9007199254740993, Number('9223372036854775807'), 1e100]) {
      await expect(service.searchProducts({ [field]: value })).rejects.toMatchObject({ status: 400, code: 'INVALID_FILTER' })
    }
    expect(repo.findSearchPage).not.toHaveBeenCalled()
    expect(repo.findProductFacets).not.toHaveBeenCalled()
  })

  it('preserves zero and maximum-safe minor-unit filters exactly', async () => {
    const result = await service.searchProducts({ minPrice: 0, maxPrice: Number.MAX_SAFE_INTEGER })
    expect(result.filters).toMatchObject({ minPrice: 0, maxPrice: Number.MAX_SAFE_INTEGER })
    expect(repo.findSearchPage).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 0, maxPrice: Number.MAX_SAFE_INTEGER }))
  })

  it.each([0, -1, 1.5, 9007199254740993, 1e100, 2_147_483_647])('rejects invalid or overflowing search page %s', async (page) => {
    await expect(service.searchProducts({ page, limit: 50 })).rejects.toMatchObject({ status: 400, code: 'INVALID_FILTER' })
    expect(repo.findSearchPage).not.toHaveBeenCalled()
  })

  it('accepts the largest supported search offset without rounding', async () => {
    vi.mocked(repo.findSearchPage).mockResolvedValue({ products: [], total: 2, nextCursor: null })
    const result = await service.searchProducts({ page: 2_147_483_647, limit: 1 })
    expect(result.pagination).toMatchObject({ page: 2_147_483_647, limit: 1 })
    expect(result.items).toEqual([])
  })

  it('returns search suggestions', async () => {
    const result = await service.getSuggestions({ q: 'cot', limit: 5 })

    expect(repo.findSuggestions).toHaveBeenCalledWith('cot', 5)
    expect(result).toEqual({
      recentKeywords: [],
      productTitles: ['Cotton Tee', 'Cotton Socks'],
    })
  })

  it('caches public search suggestions by query, limit, and locale', async () => {
    service = new SearchService(createAppContext(), repo, createCacheService())

    await service.getSuggestions({ q: 'cot', limit: 5, locale: 'th' })
    await service.getSuggestions({ q: ' cot ', limit: 5, locale: 'th' })
    await service.getSuggestions({ q: 'cot', limit: 8, locale: 'th' })
    await service.getSuggestions({ q: 'cot', limit: 5, locale: 'en' })

    expect(repo.findSuggestions).toHaveBeenCalledTimes(3)
  })

  it('uses one repository query for product search to avoid obvious N+1 patterns', async () => {
    await service.searchProducts({ q: 'tee', sort: 'rating' })

    expect(repo.findSearchPage).toHaveBeenCalledTimes(1)
  })
})
