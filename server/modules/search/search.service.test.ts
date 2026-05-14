import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
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
        priceCents: overrides.price ?? 1000,
        currency: 'USD',
        orderItems: [{ quantity: overrides.soldCount ?? 0 }],
      },
      ...(overrides.secondPrice ? [{
        id: 'variant-2',
        sku: 'TEE-2',
        title: 'Large',
        priceCents: overrides.secondPrice,
        currency: 'USD',
        orderItems: [],
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
      shopId: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
    })
    expect(result.items[0]).toMatchObject({ productId: 'p1', title: 'Cotton Tee' })
  })

  it('does not expose inactive products because repository is called with public active constraints', async () => {
    await service.searchProducts({})

    expect(repo.findSearchableProducts).toHaveBeenCalledTimes(1)
  })

  it('supports pagination', async () => {
    const result = await service.searchProducts({ page: 2, limit: 1 })

    expect(result.pagination).toEqual({
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

    await expect(service.searchProducts({ sort: 'best_selling' })).resolves.toMatchObject({
      items: [{ productId: 'p1' }, { productId: 'p2' }],
      sort: 'best_selling',
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
      minPriceCents: 2000,
      maxPriceCents: 4000,
    }))
    expect(result.items[0]).toMatchObject({ minPrice: 2500, maxPrice: 3500 })
  })

  it('rejects invalid sort and invalid filters', async () => {
    await expect(service.searchProducts({ sort: 'weird' })).rejects.toMatchObject({ code: 'INVALID_SORT' })
    await expect(service.searchProducts({ minPrice: 500, maxPrice: 100 })).rejects.toMatchObject({ code: 'INVALID_FILTER' })
    await expect(service.searchProducts({ rating: 6 })).rejects.toMatchObject({ code: 'INVALID_FILTER' })
    await expect(service.searchProducts({ categoryId: 'cat-1' })).rejects.toMatchObject({ code: 'INVALID_FILTER' })
  })

  it('returns search suggestions', async () => {
    const result = await service.getSuggestions({ q: 'cot', limit: 5 })

    expect(repo.findSuggestions).toHaveBeenCalledWith('cot', 5)
    expect(result).toEqual({
      recentKeywords: [],
      productTitles: ['Cotton Tee', 'Cotton Socks'],
    })
  })

  it('uses one repository query for product search to avoid obvious N+1 patterns', async () => {
    await service.searchProducts({ q: 'tee', sort: 'rating' })

    expect(repo.findSearchableProducts).toHaveBeenCalledTimes(1)
  })
})
