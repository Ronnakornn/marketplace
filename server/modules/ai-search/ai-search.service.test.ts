import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { SearchService } from '#server/modules/search/search.service.ts'
import type { AiSearchConfig } from './ai-search.config.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'
import { AiSearchService } from './ai-search.service.ts'
import type { IEmbeddingService } from './embedding.service.ts'
import type { AiSearchProductRecord, IVectorSearchAdapter } from './vector-search.adapter.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createConfig(overrides: Partial<AiSearchConfig> = {}): AiSearchConfig {
  return {
    enabled: true,
    openAiApiKey: null,
    embeddingModel: 'text-embedding-3-small',
    assistantModel: 'gpt-4o-mini',
    vectorDbUrl: null,
    ...overrides,
  }
}

function product(overrides: Partial<{
  id: string
  title: string
  titleTh: string
  titleEn: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  shopStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED'
  price: number | undefined
  quantityOnHand: number
  quantityReserved: number
}> = {}): AiSearchProductRecord {
  return {
    id: overrides.id ?? 'p1',
    title: overrides.title ?? 'Cotton Shirt',
    titleTh: overrides.titleTh ?? 'เสื้อคอตตอน',
    titleEn: overrides.titleEn ?? 'Cotton Shirt',
    slug: 'cotton-shirt',
    description: 'Soft everyday shirt',
    descriptionTh: 'เสื้อนุ่มใส่ทุกวัน',
    descriptionEn: 'Soft everyday shirt',
    status: overrides.status ?? 'ACTIVE',
    createdAt: new Date('2026-05-13T00:00:00.000Z'),
    category: {
      id: 'cat-1',
      name: 'Fashion',
      nameTh: 'แฟชั่น',
      nameEn: 'Fashion',
      slug: 'fashion',
    },
    shop: {
      id: 'shop-1',
      name: 'Shop One',
      slug: 'shop-one',
      status: overrides.shopStatus ?? 'ACTIVE',
    },
    variants: [{
      id: 'variant-1',
      sku: 'TEE-1',
      title: 'Default',
      price: overrides.price ? BigInt(`${overrides.price}`) : BigInt(1200),
      currency: 'USD',
      inventory: {
        quantityOnHand: overrides.quantityOnHand ?? 5,
        quantityReserved: overrides.quantityReserved ?? 1,
      },
      orderItems: [],
    }],
    reviews: [{
      rating: 5,
      status: 'PUBLISHED',
    }],
  }
}

function createSearchServiceMock(): SearchService {
  return {
    searchProducts: vi.fn().mockResolvedValue({
      items: [{
        productId: 'fallback-1',
        title: 'Fallback Product',
        coverImage: null,
        minPrice: 999,
        maxPrice: null,
        ratingSummary: {
          averageRating: 0,
          totalReviewCount: 0,
        },
        soldCount: 0,
        shop: {
          id: 'shop-1',
          name: 'Shop One',
          slug: 'shop-one',
        },
        badges: [],
      }],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
      filters: {},
      sort: 'newest',
    }),
  } as unknown as SearchService
}

let embeddingService: IEmbeddingService
let vectorSearch: IVectorSearchAdapter
let searchService: SearchService
let service: AiSearchService

describe('AiSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embeddingService = {
      embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    }
    vectorSearch = {
      searchProducts: vi.fn().mockResolvedValue([{ product: product(), score: 0.91 }]),
    }
    searchService = createSearchServiceMock()
    service = new AiSearchService(createAppContext(), createConfig(), embeddingService, vectorSearch, searchService)
  })

  it('returns semantic search matches for active product records', async () => {
    const result = await service.search({ query: 'cotton shirt', limit: 5, locale: 'en' })

    expect(embeddingService.embedText).toHaveBeenCalledWith('cotton shirt')
    expect(vectorSearch.searchProducts).toHaveBeenCalledWith({
      embedding: [0.1, 0.2, 0.3],
      limit: 5,
      locale: 'en',
      model: 'text-embedding-3-small',
    })
    expect(result.items[0]).toMatchObject({
      productId: 'p1',
      title: 'Cotton Shirt',
      price: {
        minPrice: 1200,
        maxPrice: null,
        currency: 'USD',
      },
      stockAvailability: 'in_stock',
    })
    expect(result.semanticMatches).toEqual([{ productId: 'p1', score: 0.91, title: 'Cotton Shirt' }])
  })

  it('supports multilingual localized results', async () => {
    const result = await service.search({ query: 'เสื้อ', locale: 'th' })

    expect(vectorSearch.searchProducts).toHaveBeenCalledWith(expect.objectContaining({ locale: 'th' }))
    expect(result.items[0]).toMatchObject({
      title: 'เสื้อคอตตอน',
      description: 'เสื้อนุ่มใส่ทุกวัน',
      category: expect.objectContaining({ name: 'แฟชั่น' }),
    })
  })

  it('falls back to normal search when vector search is unavailable', async () => {
    vi.mocked(vectorSearch.searchProducts).mockRejectedValue(
      new AiSearchServiceError('Vector unavailable', 503, 'VECTOR_SEARCH_UNAVAILABLE'),
    )

    const result = await service.search({ query: 'cotton' })

    expect(searchService.searchProducts).toHaveBeenCalledWith({
      q: 'cotton',
      limit: 10,
      locale: 'th',
    })
    expect(result.items).toMatchObject([{ productId: 'fallback-1' }])
    expect(result.semanticMatches).toEqual([])
  })

  it('rejects invalid queries safely', async () => {
    await expect(service.search({ query: '' })).rejects.toMatchObject({ code: 'INVALID_AI_QUERY' })
    await expect(service.search({ query: 'x', limit: 99 })).rejects.toMatchObject({ code: 'INVALID_AI_QUERY' })
  })

  it('returns a clear disabled feature error', async () => {
    service = new AiSearchService(createAppContext(), createConfig({ enabled: false }), embeddingService, vectorSearch, searchService)

    await expect(service.search({ query: 'cotton' })).rejects.toMatchObject({ code: 'AI_SEARCH_DISABLED' })
  })
})
