import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import type { AnalyticsRankingMetric, IProductAnalyticsRepository } from './product-analytics.repository.ts'
import { ProductAnalyticsService } from './product-analytics.service.ts'

const SHOP_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_SHOP_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'
const PRODUCT_2_ID = '44444444-4444-4444-8444-444444444444'
const VARIANT_ID = '55555555-5555-4555-8555-555555555555'
const VARIANT_2_ID = '66666666-6666-4666-8666-666666666666'

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

function createRepo(): IProductAnalyticsRepository {
  return {
    findProductRankingPage: vi.fn(),
    findVariantRankingPage: vi.fn(),
    findProductsByIds: vi.fn(),
    findVariantsByIds: vi.fn(),
    findSummaryMetrics: vi.fn(),
    findDailyMetrics: vi.fn(),
  }
}

function createActiveShopResolver(): ActiveShopResolver {
  return {
    resolveActiveShops: vi.fn(async () => [{ id: SHOP_ID, ownerId: 'seller-1', status: 'ACTIVE' }]),
  } as unknown as ActiveShopResolver
}

function createProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    title: 'Cotton Tee',
    slug: 'cotton-tee',
    status: 'ACTIVE',
    images: [{ url: 'https://example.test/tee.jpg', isPrimary: true, sortOrder: 0 }],
    shop: { id: SHOP_ID, name: 'Shop One', slug: 'shop-one' },
    ...overrides,
  } as any
}

function createVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: VARIANT_ID,
    productId: PRODUCT_ID,
    sku: 'TEE-BLK-M',
    title: 'Black / M',
    status: 'ACTIVE',
    currency: 'THB',
    product: { id: PRODUCT_ID, shopId: SHOP_ID, title: 'Cotton Tee', slug: 'cotton-tee' },
    ...overrides,
  } as any
}

function createActor() {
  return { id: 'seller-1', role: 'USER' as const }
}

function createRankingMetric(id: string, overrides: Partial<AnalyticsRankingMetric> = {}): AnalyticsRankingMetric {
  return { id, views: 10, addToCart: 3, addToCartQuantity: 4, orders: 1, unitsSold: 2, revenue: 2400n, conversionRate: 0.1, currency: 'THB', ...overrides }
}

let repo: IProductAnalyticsRepository
let activeShopResolver: ActiveShopResolver
let service: ProductAnalyticsService

describe('ProductAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepo()
    activeShopResolver = createActiveShopResolver()
    service = new ProductAnalyticsService(createAppContext(), repo, activeShopResolver)
    vi.mocked(repo.findProductRankingPage).mockResolvedValue({ items: [createRankingMetric(PRODUCT_ID)], total: 1 })
    vi.mocked(repo.findVariantRankingPage).mockResolvedValue({ items: [createRankingMetric(VARIANT_ID, { views: 0, conversionRate: 0 })], total: 1 })
    vi.mocked(repo.findProductsByIds).mockResolvedValue([createProduct()])
    vi.mocked(repo.findVariantsByIds).mockResolvedValue([createVariant()])
    const { id: _id, ...summary } = createRankingMetric('summary')
    vi.mocked(repo.findSummaryMetrics).mockResolvedValue({
      totals: summary,
      topSkus: [createRankingMetric(VARIANT_ID, { views: 0, conversionRate: 0 })],
      lowProducts: [],
    })
    vi.mocked(repo.findDailyMetrics).mockResolvedValue([
      { ...createRankingMetric('day1', { views: 1, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0n, conversionRate: 0 }), date: '2026-06-02' },
      { ...createRankingMetric('day2', { views: 1, addToCart: 1, conversionRate: 1 }), date: '2026-06-03' },
    ])
  })

  it('returns own active shop analytics from trusted order items', async () => {
    const result = await service.getSummary(createActor(), {
      range: 'custom',
      from: '2026-06-01',
      to: '2026-06-07',
    })

    expect(activeShopResolver.resolveActiveShops).toHaveBeenCalledWith('seller-1')
    expect(repo.findSummaryMetrics).toHaveBeenCalledWith([SHOP_ID], expect.any(Object), undefined)
    expect(result).toMatchObject({
      views: 10,
      addToCart: 3,
      orders: 1,
      unitsSold: 2,
      revenue: 2400n,
      conversionRate: 0.1,
      currency: 'THB',
    })
    expect(result.topSkus[0]).toMatchObject({ variantId: VARIANT_ID, revenue: 2400n, unitsSold: 2 })
  })

  it('rejects users without an active seller shop', async () => {
    vi.mocked(activeShopResolver.resolveActiveShops).mockResolvedValue([])

    await expect(service.getSummary(createActor(), { range: '7d' })).rejects.toMatchObject({
      code: 'SELLER_SHOP_NOT_ACTIVE',
      status: 403,
    })
  })

  it('applies date range and product filters to all metric reads', async () => {
    await service.getSkus(createActor(), {
      range: 'custom',
      from: '2026-06-01',
      to: '2026-06-07',
      productId: PRODUCT_ID,
      page: 2,
      limit: 10,
      sort: 'unitsSold',
    })

    expect(repo.findVariantRankingPage).toHaveBeenCalledWith([SHOP_ID], expect.objectContaining({
      from: new Date('2026-05-31T17:00:00.000Z'),
      to: new Date('2026-06-07T16:59:59.999Z'),
    }), { productId: PRODUCT_ID, page: 2, limit: 10, sort: 'unitsSold' })
    expect(repo.findSummaryMetrics).not.toHaveBeenCalled()
  })

  it('returns zero summary values for empty analytics', async () => {
    const { id: _id, ...summary } = createRankingMetric('summary', { views: 0, addToCart: 0, addToCartQuantity: 0, orders: 0, unitsSold: 0, revenue: 0n, conversionRate: 0, currency: null })
    vi.mocked(repo.findSummaryMetrics).mockResolvedValue({
      totals: summary,
      topSkus: [], lowProducts: [],
    })
    vi.mocked(repo.findProductsByIds).mockResolvedValue([])
    vi.mocked(repo.findVariantsByIds).mockResolvedValue([])

    const result = await service.getSummary(createActor(), { range: '30d' })

    expect(result).toMatchObject({
      views: 0,
      addToCart: 0,
      orders: 0,
      unitsSold: 0,
      revenue: 0n,
      conversionRate: 0,
      currency: null,
      topSkus: [],
      lowPerformingProducts: [],
    })
  })

  it('returns the database page order and exact metrics while hydrating only its IDs', async () => {
    vi.mocked(repo.findProductRankingPage).mockResolvedValue({
      items: [createRankingMetric(PRODUCT_2_ID, { revenue: 18446744073709551615n }), createRankingMetric(PRODUCT_ID)], total: 501,
    })
    vi.mocked(repo.findProductsByIds).mockResolvedValue([
      createProduct(), createProduct({ id: PRODUCT_2_ID, title: 'Silk Scarf', slug: 'silk-scarf' }),
    ])
    const result = await service.getProducts(createActor(), {
      range: 'custom', from: '2026-06-01', to: '2026-06-07', q: ' tee ', page: 2, limit: 2, sort: 'revenue',
    })
    expect(repo.findProductRankingPage).toHaveBeenCalledWith([SHOP_ID], expect.any(Object), { q: 'tee', page: 2, limit: 2, sort: 'revenue' })
    expect(repo.findProductsByIds).toHaveBeenCalledWith([SHOP_ID], [PRODUCT_2_ID, PRODUCT_ID])
    expect(result.items.map((item) => [item.productId, item.revenue])).toEqual([[PRODUCT_2_ID, 18446744073709551615n], [PRODUCT_ID, 2400n]])
    expect(result.pagination).toEqual({ page: 2, limit: 2, total: 501, totalPages: 251 })
    expect(result.items[0]).not.toHaveProperty('addToCartQuantity')
    expect(repo.findSummaryMetrics).not.toHaveBeenCalled()
  })

  it('returns an empty out-of-range page with the database total', async () => {
    vi.mocked(repo.findProductRankingPage).mockResolvedValue({ items: [], total: 501 })
    vi.mocked(repo.findProductsByIds).mockResolvedValue([])
    const result = await service.getProducts(createActor(), { page: 30, limit: 20 })
    expect(result).toEqual({ items: [], pagination: { page: 30, limit: 20, total: 501, totalPages: 26 } })
    expect(repo.findProductsByIds).toHaveBeenCalledWith([SHOP_ID], [])
  })

  it('hydrates ranked SKUs and retains the variant currency fallback for empty or mixed sales', async () => {
    vi.mocked(repo.findVariantRankingPage).mockResolvedValue({
      items: [createRankingMetric(VARIANT_2_ID, { views: 0, currency: null }), createRankingMetric(VARIANT_ID, { views: 0, currency: 'USD' })], total: 2,
    })
    vi.mocked(repo.findVariantsByIds).mockResolvedValue([createVariant(), createVariant({ id: VARIANT_2_ID, currency: 'JPY' })])
    const result = await service.getSkus(createActor(), { page: 1, limit: 2, sort: '-sku' })
    expect(repo.findVariantsByIds).toHaveBeenCalledWith([SHOP_ID], [VARIANT_2_ID, VARIANT_ID])
    expect(result.items.map((item) => [item.variantId, item.currency])).toEqual([[VARIANT_2_ID, 'JPY'], [VARIANT_ID, 'USD']])
    expect(result.items[0]).not.toHaveProperty('conversionRate')
    expect(repo.findSummaryMetrics).not.toHaveBeenCalled()
  })
  it('builds daily series from event and order timestamps', async () => {
    const result = await service.getDaily(createActor(), {
      range: 'custom',
      from: '2026-06-02',
      to: '2026-06-03',
    })

    expect(result.items).toEqual([
      expect.objectContaining({ date: '2026-06-02', views: 1, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0n }),
      expect.objectContaining({ date: '2026-06-03', views: 1, addToCart: 1, orders: 1, unitsSold: 2, revenue: 2400n }),
    ])
  })

  it('fills missing calendar days without requesting raw histories', async () => {
    vi.mocked(repo.findDailyMetrics).mockResolvedValue([])
    const result = await service.getDaily(createActor(), {
      range: 'custom', from: '2026-06-02', to: '2026-06-02', productId: PRODUCT_ID,
    })
    expect(result.items).toEqual([{
      date: '2026-06-02', views: 0, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0n, conversionRate: 0,
    }])
    expect(repo.findDailyMetrics).toHaveBeenCalledWith([SHOP_ID], {
      from: new Date('2026-06-01T17:00:00.000Z'), to: new Date('2026-06-02T16:59:59.999Z'),
    }, PRODUCT_ID)
  })

  it('keeps another seller product data out through active shop scoping', async () => {
    vi.mocked(activeShopResolver.resolveActiveShops).mockResolvedValue([{ id: OTHER_SHOP_ID, ownerId: 'seller-2', status: 'ACTIVE' }])

    await service.getSummary({ id: 'seller-2', role: 'USER' }, { range: '7d' })

    expect(repo.findSummaryMetrics).toHaveBeenCalledWith([OTHER_SHOP_ID], expect.any(Object), undefined)
  })
})
