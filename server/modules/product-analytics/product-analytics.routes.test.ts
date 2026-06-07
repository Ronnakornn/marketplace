import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { ProductAnalyticsServiceError } from './product-analytics.errors.ts'
import { createProductAnalyticsRoutes } from './product-analytics.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createContainer() {
  return {
    productAnalyticsService: {
      getSummary: vi.fn(async () => ({ views: 0, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0, conversionRate: 0, currency: null, topSkus: [], lowPerformingProducts: [] })),
      getDaily: vi.fn(async () => ({ items: [] })),
      getProducts: vi.fn(async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
      getSkus: vi.fn(async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createProductAnalyticsRoutes(container))
}

function mockAuthContext() {
  return {
    user: {
      id: 'seller-1',
      email: 'seller@example.test',
      name: 'Seller',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    },
  }
}

describe('product analytics routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication for seller analytics endpoints', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp().handle(new Request('http://localhost/api/seller/analytics/products/summary'))

    expect(response.status).toBe(401)
  })

  it('mounts summary, daily, product, and SKU endpoints', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)
    const app = createApp(container)

    const summary = await app.handle(new Request('http://localhost/api/seller/analytics/products/summary?range=7d'))
    const daily = await app.handle(new Request('http://localhost/api/seller/analytics/products/daily?range=7d'))
    const products = await app.handle(new Request('http://localhost/api/seller/analytics/products?range=7d&page=1&limit=10'))
    const skus = await app.handle(new Request('http://localhost/api/seller/analytics/products/skus?range=7d&page=1&limit=10'))

    expect(summary.status).toBe(200)
    expect(daily.status).toBe(200)
    expect(products.status).toBe(200)
    expect(skus.status).toBe(200)
    expect(container.productAnalyticsService.getSummary).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }), expect.objectContaining({ range: '7d' }))
    expect(container.productAnalyticsService.getDaily).toHaveBeenCalled()
    expect(container.productAnalyticsService.getProducts).toHaveBeenCalled()
    expect(container.productAnalyticsService.getSkus).toHaveBeenCalled()
  })

  it('returns stable product analytics service errors', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)
    vi.mocked(container.productAnalyticsService.getSummary).mockRejectedValueOnce(
      new ProductAnalyticsServiceError('Active seller shop not found', 403, 'SELLER_SHOP_NOT_ACTIVE'),
    )

    const response = await createApp(container).handle(new Request('http://localhost/api/seller/analytics/products/summary'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'SELLER_SHOP_NOT_ACTIVE' } })
  })
})
