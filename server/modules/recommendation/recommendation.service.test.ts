import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { CacheService } from '#server/modules/cache'
import type {
  IRecommendationRepository,
  RecommendationProductRecord,
  RecommendedCategory,
} from './recommendation.repository.ts'
import { RecommendationService } from './recommendation.service.ts'

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

function createRepoMock(): IRecommendationRepository {
  return {
    findPublicProductById: vi.fn(),
    findTrendingProducts: vi.fn(),
    findNewestProducts: vi.fn(),
    findRelatedProducts: vi.fn(),
    findSimilarProducts: vi.fn(),
    findRecommendedCategories: vi.fn(),
  }
}

function createCacheMock(rememberImpl?: CacheService['remember']): CacheService {
  return {
    keys: {
      productList: vi.fn(),
      productDetail: vi.fn(),
      categoryList: vi.fn(),
      productSearch: vi.fn(),
      aiSearch: vi.fn(),
      sellerDashboard: vi.fn(),
      recommendations: vi.fn((kind: string) => `recommendations:${kind}`),
    },
    ttl: vi.fn(() => ({
      default: 60,
      product: 120,
      search: 60,
      sellerDashboard: 60,
    })),
    remember: vi.fn(rememberImpl ?? ((_key, fetcher) => fetcher())),
  } as unknown as CacheService
}

function product(overrides: Partial<{
  id: string
  title: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  shopStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED'
  categoryId: string | null
  shopId: string
  price: number
  secondPrice: number
  rating: number
  soldCount: number
}> = {}): RecommendationProductRecord {
  const id = overrides.id ?? '11111111-1111-4111-8111-111111111111'
  return {
    id,
    title: overrides.title ?? 'Cotton Tee',
    createdAt: new Date('2026-05-13T00:00:00.000Z'),
    categoryId: overrides.categoryId === undefined ? 'cat-1' : overrides.categoryId,
    shopId: overrides.shopId ?? 'shop-1',
    status: overrides.status ?? 'ACTIVE',
    category: overrides.categoryId === null ? null : {
      id: overrides.categoryId ?? 'cat-1',
      name: 'Fashion',
      slug: 'fashion',
      sortOrder: 1,
    },
    shop: {
      id: overrides.shopId ?? 'shop-1',
      name: 'Shop One',
      status: overrides.shopStatus ?? 'ACTIVE',
    },
    variants: [
      {
        id: `${id}-v1`,
        price: overrides.price ?? 1000,
        status: 'ACTIVE',
        orderItems: [{ quantity: overrides.soldCount ?? 0 }],
      },
      ...(overrides.secondPrice ? [{
        id: `${id}-v2`,
        price: overrides.secondPrice,
        status: 'ACTIVE' as const,
        orderItems: [],
      }] : []),
    ],
    reviews: overrides.rating ? [{
      rating: overrides.rating,
      status: 'PUBLISHED',
    }] : [],
  }
}

let repo: IRecommendationRepository
let service: RecommendationService

describe('RecommendationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new RecommendationService(createAppContext(), repo)
  })

  it('returns trending product cards from active public repository results only', async () => {
    vi.mocked(repo.findTrendingProducts).mockResolvedValue([product({ id: 'p1', rating: 4, soldCount: 12 })])

    const result = await service.getTrending({ limit: 10 })

    expect(repo.findTrendingProducts).toHaveBeenCalledWith({ limit: 11, offset: 0 })
    expect(result.items).toEqual([{
      productId: 'p1',
      title: 'Cotton Tee',
      minPrice: 1000,
      rating: 4,
      soldCount: 12,
      shop: {
        id: 'shop-1',
        name: 'Shop One',
      },
    }])
  })

  it('related products exclude current product through repository query', async () => {
    const source = product({ id: 'source', categoryId: 'cat-1', shopId: 'shop-1' })
    vi.mocked(repo.findPublicProductById).mockResolvedValue(source)
    vi.mocked(repo.findRelatedProducts).mockResolvedValue([product({ id: 'related' })])

    const result = await service.getRelated('source', { limit: 5 })

    expect(repo.findRelatedProducts).toHaveBeenCalledWith(
      { productId: 'source', limit: 6, offset: 0 },
      source,
    )
    expect(result.items.map((item) => item.productId)).toEqual(['related'])
  })

  it('similar products exclude inactive products through public repository constraints', async () => {
    const source = product({ id: 'source', categoryId: 'cat-1', price: 2000 })
    vi.mocked(repo.findPublicProductById).mockResolvedValue(source)
    vi.mocked(repo.findSimilarProducts).mockResolvedValue([product({ id: 'similar' })])

    await service.getSimilar('source', { limit: 5 })

    expect(repo.findSimilarProducts).toHaveBeenCalledWith(
      { productId: 'source', limit: 6, offset: 0 },
      source,
    )
  })

  it('home feed returns grouped sections', async () => {
    const categories: RecommendedCategory[] = [{ id: 'cat-1', name: 'Fashion', slug: 'fashion' }]
    vi.mocked(repo.findTrendingProducts).mockResolvedValue([product({ id: 'trend' })])
    vi.mocked(repo.findNewestProducts).mockResolvedValue([product({ id: 'new' })])
    vi.mocked(repo.findRecommendedCategories).mockResolvedValue(categories)

    const result = await service.getHomeFeed({ limit: 3 })

    expect(result.sections.trending).toMatchObject([{ productId: 'trend' }])
    expect(result.sections.newest).toMatchObject([{ productId: 'new' }])
    expect(result.sections.recommendedCategories).toEqual(categories)
  })

  it('pagination works', async () => {
    vi.mocked(repo.findTrendingProducts).mockResolvedValue([
      product({ id: 'p1' }),
      product({ id: 'p2' }),
      product({ id: 'p3' }),
    ])

    const result = await service.getTrending({ page: 2, limit: 2 })

    expect(repo.findTrendingProducts).toHaveBeenCalledWith({ limit: 3, offset: 2 })
    expect(result.items.map((item) => item.productId)).toEqual(['p1', 'p2'])
    expect(result.pagination).toEqual({ page: 2, limit: 2, hasNextPage: true })
  })

  it('cache fallback works if Redis is down', async () => {
    const cache = createCacheMock(async (_key, fetcher) => fetcher())
    service = new RecommendationService(createAppContext(), repo, cache)
    vi.mocked(repo.findTrendingProducts).mockResolvedValue([product({ id: 'p1' })])

    const result = await service.getTrending({ limit: 1 })

    expect(cache.remember).toHaveBeenCalled()
    expect(result.items).toHaveLength(1)
  })

  it('does not expose private user data', async () => {
    vi.mocked(repo.findTrendingProducts).mockResolvedValue([product({ id: 'p1', secondPrice: 1500 })])

    const result = await service.getTrending({})

    expect(result.items[0]).toEqual({
      productId: 'p1',
      title: 'Cotton Tee',
      minPrice: 1000,
      maxPrice: 1500,
      soldCount: 0,
      shop: {
        id: 'shop-1',
        name: 'Shop One',
      },
    })
    expect(JSON.stringify(result)).not.toContain('owner')
    expect(JSON.stringify(result)).not.toContain('user')
  })

  it('returns PRODUCT_NOT_FOUND for missing related source product', async () => {
    vi.mocked(repo.findPublicProductById).mockResolvedValue(null)

    await expect(service.getRelated('missing', {})).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
  })

  it('rejects invalid recommendation query', async () => {
    expect(() => service.getTrending({ page: 0 })).toThrowError(expect.objectContaining({
      code: 'INVALID_RECOMMENDATION_QUERY',
    }))
    expect(() => service.getTrending({ limit: 51 })).toThrowError(expect.objectContaining({
      code: 'INVALID_RECOMMENDATION_QUERY',
    }))
  })
})
