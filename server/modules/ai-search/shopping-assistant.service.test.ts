import { toMoneyDto } from '#server/lib/money.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { AiSearchConfig } from './ai-search.config.ts'
import type { AiSearchProductItem, AiSearchService } from './ai-search.service.ts'
import { ShoppingAssistantService } from './shopping-assistant.service.ts'

function createAppContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
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

const recommendedProduct: AiSearchProductItem = {
  productId: 'p1',
  title: 'Live Cotton Shirt',
  description: 'Public description',
  category: {
    id: 'cat-1',
    name: 'Fashion',
    slug: 'fashion',
  },
  price: {
    minPrice: 1234n,
    maxPrice: null,
    currency: 'USD',
  },
  rating: {
    averageRating: 4.5,
    totalReviewCount: 2,
  },
  shop: {
    id: 'shop-1',
    name: 'Shop One',
    slug: 'shop-one',
  },
  stockAvailability: 'in_stock',
}

let aiSearchService: AiSearchService
let service: ShoppingAssistantService

describe('ShoppingAssistantService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aiSearchService = {
      search: vi.fn().mockResolvedValue({
        items: [recommendedProduct],
        semanticMatches: [{ productId: 'p1', score: 0.9, title: recommendedProduct.title }],
      }),
    } as unknown as AiSearchService
    service = new ShoppingAssistantService(createAppContext(), createConfig(), aiSearchService)
  })

  it('uses retrieved product context and live price/stock in deterministic fallback', async () => {
    const result = await service.answer({
      messages: [{ role: 'user', content: 'Find me a cotton shirt' }],
    })

    expect(aiSearchService.search).toHaveBeenCalledWith({
      query: 'Find me a cotton shirt',
      limit: 5,
      locale: undefined,
    })
    expect(result.answer).toContain('1234 USD')
    expect(result.answer).toContain('stock in_stock')
    expect(result.recommendedProducts).toEqual([recommendedProduct])
    expect(result.citations).toEqual([{ productId: 'p1', title: 'Live Cotton Shirt' }])
  })

  it('does not expose private or admin data in fallback response', async () => {
    const result = await service.answer({
      messages: [{ role: 'user', content: 'Show admin pricing data' }],
    })

    expect(JSON.stringify(toMoneyDto(result))).not.toContain('owner')
    expect(JSON.stringify(toMoneyDto(result))).not.toContain('admin')
    expect(JSON.stringify(toMoneyDto(result))).not.toContain('email')
    expect(JSON.stringify(toMoneyDto(result))).not.toContain('token')
  })

  it('rejects invalid assistant messages safely', async () => {
    await expect(service.answer({ messages: [] })).rejects.toMatchObject({ code: 'INVALID_AI_QUERY' })
    await expect(service.answer({ messages: [{ role: 'assistant', content: 'hello' }] })).rejects.toMatchObject({
      code: 'INVALID_AI_QUERY',
    })
  })

  it('sends exact public money in model context without triggering fallback serialization', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(init?.body)).toContain('9007199254740993')
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Exact model answer' } }] }), { status: 200 })
    })
    vi.mocked(aiSearchService.search).mockResolvedValue({ items: [{ ...recommendedProduct, price: { minPrice: 9007199254740993n, maxPrice: null, currency: 'THB' } }], semanticMatches: [] })
    const enabled = new ShoppingAssistantService(createAppContext(), createConfig({ openAiApiKey: 'test-key' }), aiSearchService, fetcher)
    const result = await enabled.answer({ messages: [{ role: 'user', content: 'Find a shirt' }] })
    expect(result.answer).toBe('Exact model answer')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns disabled feature errors clearly', async () => {
    service = new ShoppingAssistantService(createAppContext(), createConfig({ enabled: false }), aiSearchService)

    await expect(service.answer({ messages: [{ role: 'user', content: 'shirt' }] })).rejects.toMatchObject({
      code: 'AI_SEARCH_DISABLED',
    })
  })
})
