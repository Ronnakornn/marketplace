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
    findSearchableProducts: vi.fn(),
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
    keys: vi.fn(async () => []),
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
  price: number
  secondPrice: number
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
    category: null,
    shop: {
      id: overrides.shopId ?? 'shop-1',
      name: 'Shop One',
      slug: 'shop-one',
      status: 'ACTIVE',
    },
    variants: [
      {
        id: 'variant-1',
        sku: 'TEE-1',
        title: 'Default',
        price: overrides.price ? BigInt(overrides.price) : BigInt(1000),
        currency: 'USD',
        orderItems: [{ quantity: overrides.soldCount ?? 0 }],
        inventory: { quantityOnHand: 10, quantityReserved: 2 },
      },
      ...(overrides.secondPrice ? [{
        id: 'variant-2',
        sku: 'TEE-2',
        title: 'Large',
        price: BigInt(overrides.secondPrice), // Convert price to bigint
        currency: 'USD',
        orderItems: [],
        inventory: { quantityOnHand: 0, quantityReserved: 0 },
      }] : []),
    ],
    reviews: Array.from({ length: reviewCount }, () => ({
      rating,
      status: 'PUBLISHED' as const,
    })),
  }
}

let repo: ISearchRepository
let service: SearchService

describe('SearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new SearchService(createAppContext(), repo)
    vi.mocked(repo.findSearchableProducts).mockResolvedValue([
      createProduct({ id: 'p1', title: 'Cotton Tee', price: 1000, rating: 4, soldCount: 20 }),
      createProduct({ id: 'p2', title: 'Denim Jacket', price: 3000, rating: 5, soldCount: 5 }),
    ])
    vi.mocked(repo.findSuggestions).mockResolvedValue([
      { id: 'p1', title: 'Cotton Tee' },
      { id: 'p3', title: 'Cotton Socks' },
    ])
  })

  it('searches by keyword through the repository', async () => {
    const result = await service.searchProducts({ q: ' cotton ' })

    expect(repo.findSearchableProducts).toHaveBeenCalledWith({
      q: 'cotton',
      categoryId: undefined,
      shopId: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      attributeFilters: undefined,
      brandId: undefined,
      inStock: false,
    })
    expect(result.items[0]).toMatchObject({ productId: 'p1', title: 'Cotton Tee' })
  })

  it('does not expose inactive products because repository is called with public active constraints', async () => {
    await service.searchProducts({})

    expect(repo.findSearchableProducts).toHaveBeenCalledTimes(1)
  })

  it('supports pagination', async () => {
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
    const result = await service.searchProducts({ shopId: 'shop-1', rating: 5 })

    expect(repo.findSearchableProducts).toHaveBeenCalledWith(expect.objectContaining({ shopId: 'shop-1' }))
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.productId).toBe('p2')
  })

  it('supports price range and variant min/max output', async () => {
    vi.mocked(repo.findSearchableProducts).mockResolvedValue([
      createProduct({ id: 'p3', title: 'Sneakers', price: 2500, secondPrice: 3500 }),
    ])

    const result = await service.searchProducts({ minPrice: 2000, maxPrice: 4000 })

    expect(repo.findSearchableProducts).toHaveBeenCalledWith(expect.objectContaining({
      minPrice: 2000,
      maxPrice: 4000,
    }))
    expect(result.items[0]).toMatchObject({ minPrice: 2500, maxPrice: 3500 })
    expect(result.meta.query).toMatchObject({
      minPrice: 2000,
      maxPrice: 4000,
      sort: 'relevance',
    })
  })

  it('supports contract filters for brand, attributes, in-stock, badges, and cursor', async () => {
    const result = await service.searchProducts({
      brandId: 'brand-1',
      attributeFilters: 'Color:Red',
      inStock: true,
      badges: 'in_stock',
      cursor: 'p1',
      limit: 1,
    })

    expect(repo.findSearchableProducts).toHaveBeenCalledWith(expect.objectContaining({
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

    expect(repo.findSearchableProducts).toHaveBeenCalledTimes(1)
  })
})
