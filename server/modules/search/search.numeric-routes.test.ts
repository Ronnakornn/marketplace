import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import { createRecommendationRoutes } from '#server/modules/recommendation/recommendation.routes.ts'
import { ReviewService } from '#server/modules/review/review.service.ts'
import { createReviewRoutes } from '#server/modules/review/review.routes.ts'
import { SearchService } from './search.service.ts'
import { createSearchRoutes } from './search.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn(async () => null) }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: {} }))

const context: AppContext = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const findSearchableProducts = vi.fn(async () => [])
const findProductFacets = vi.fn(async () => ({ categories: [], brands: [], price: { min: null, max: null, currency: 'THB' } }))
const findTrendingProducts = vi.fn(async () => [])
const listProductReviews = vi.fn(async () => ({ items: [], totalCount: 0 }))

function app() {
  return new Elysia()
    .use(createSearchRoutes({ searchService: new SearchService(context, { findSearchableProducts, findProductFacets } as never) } as never))
    .use(createRecommendationRoutes({ recommendationService: new RecommendationService(context, { findTrendingProducts } as never) } as never))
    .use(createReviewRoutes({ reviewService: new ReviewService(context, { findActiveProduct: vi.fn(async () => ({ id, status: 'ACTIVE' })), listProductReviews } as never) } as never))
}

describe('numeric discovery HTTP boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['minPrice', 'maxPrice'])('rejects unsafe or fractional %s before the search repository', async field => {
    for (const value of ['-1', '0.5', '9007199254740993', '9223372036854775807', '1e100']) {
      const response = await app().handle(new Request(`http://localhost/api/search/products?${field}=${value}`))
      expect(response.status, await response.clone().text()).toBe(422)
    }
    expect(findSearchableProducts).not.toHaveBeenCalled()
    expect(findProductFacets).not.toHaveBeenCalled()
  })

  it('accepts zero and maximum-safe integer minor units without rounding', async () => {
    const response = await app().handle(new Request('http://localhost/api/search/products?minPrice=0&maxPrice=9007199254740991'))
    expect(response.status, await response.clone().text()).toBe(200)
    expect((await response.json()).filters).toMatchObject({ minPrice: '0', maxPrice: '9007199254740991' })
    expect(findSearchableProducts).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 0, maxPrice: Number.MAX_SAFE_INTEGER }))
  })

  it.each(['/api/search/products', '/api/recommendations/trending', `/api/products/${id}/reviews`])('bounds page, limit and calculated offset for %s', async path => {
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'page=9007199254740993', 'page=1e100', 'limit=0', 'limit=1.5', 'limit=1e100']) {
      const response = await app().handle(new Request(`http://localhost${path}?${query}`))
      expect(response.status, await response.clone().text()).toBe(422)
    }
    const overflow = await app().handle(new Request(`http://localhost${path}?page=2147483647&limit=20`))
    expect(overflow.status, await overflow.clone().text()).toBe(400)
    expect(findSearchableProducts).not.toHaveBeenCalled()
    expect(findTrendingProducts).not.toHaveBeenCalled()
    expect(listProductReviews).not.toHaveBeenCalled()
  })

  it.each(['/api/search/products', '/api/recommendations/trending', `/api/products/${id}/reviews`])('accepts a supported large offset for %s', async path => {
    const response = await app().handle(new Request(`http://localhost${path}?page=2147483647&limit=1`))
    expect(response.status, await response.clone().text()).toBe(200)
    const result = await response.json()
    expect((result.pagination ?? result.meta).page).toBe(2_147_483_647)
  })
})
