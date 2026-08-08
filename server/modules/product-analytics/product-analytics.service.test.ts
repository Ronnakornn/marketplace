import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import type { IProductAnalyticsRepository } from './product-analytics.repository.ts'
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
    countProducts: vi.fn(),
    findProducts: vi.fn(),
    findProductsByIds: vi.fn(),
    countVariants: vi.fn(),
    findVariants: vi.fn(),
    findVariantsByIds: vi.fn(),
    countProductViews: vi.fn(),
    findProductViewLogs: vi.fn(),
    countProductAddToCart: vi.fn(),
    findProductAddToCartLogs: vi.fn(),
    findPaidOrderItems: vi.fn(),
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

function createOrderItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    shopId: SHOP_ID,
    variantId: VARIANT_ID,
    quantity: 2,
    lineTotal: 2400n,
    currency: 'THB',
    order: { id: 'order-1', createdAt: new Date('2026-06-03T10:00:00.000Z'), currency: 'THB' },
    variant: { id: VARIANT_ID, productId: PRODUCT_ID },
    ...overrides,
  } as any
}

function createActor() {
  return { id: 'seller-1', role: 'USER' as const }
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
    vi.mocked(repo.countProducts).mockResolvedValue(1)
    vi.mocked(repo.findProducts).mockResolvedValue([createProduct()])
    vi.mocked(repo.findProductsByIds).mockResolvedValue([createProduct()])
    vi.mocked(repo.countVariants).mockResolvedValue(1)
    vi.mocked(repo.findVariants).mockResolvedValue([createVariant()])
    vi.mocked(repo.findVariantsByIds).mockResolvedValue([createVariant()])
    vi.mocked(repo.countProductViews).mockResolvedValue([{ productId: PRODUCT_ID, count: 10 }])
    vi.mocked(repo.findProductViewLogs).mockResolvedValue([
      { productId: PRODUCT_ID, createdAt: new Date('2026-06-02T10:00:00.000Z') },
      { productId: PRODUCT_ID, createdAt: new Date('2026-06-03T10:00:00.000Z') },
    ])
    vi.mocked(repo.countProductAddToCart).mockResolvedValue([{ productId: PRODUCT_ID, variantId: VARIANT_ID, count: 3, quantity: 4 }])
    vi.mocked(repo.findProductAddToCartLogs).mockResolvedValue([
      { productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1, createdAt: new Date('2026-06-03T11:00:00.000Z') },
    ])
    vi.mocked(repo.findPaidOrderItems).mockResolvedValue([createOrderItem()])
  })

  it('returns own active shop analytics from trusted order items', async () => {
    const result = await service.getSummary(createActor(), {
      range: 'custom',
      from: '2026-06-01',
      to: '2026-06-07',
    })

    expect(activeShopResolver.resolveActiveShops).toHaveBeenCalledWith('seller-1')
    expect(repo.findPaidOrderItems).toHaveBeenCalledWith([SHOP_ID], expect.any(Object), undefined)
    expect(result).toMatchObject({
      views: 10,
      addToCart: 3,
      orders: 1,
      unitsSold: 2,
      revenue: 2400,
      conversionRate: 0.1,
      currency: 'THB',
    })
    expect(result.topSkus[0]).toMatchObject({ variantId: VARIANT_ID, revenue: 2400, unitsSold: 2 })
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

    expect(repo.findVariants).toHaveBeenCalledWith({ shopIds: [SHOP_ID], productId: PRODUCT_ID, page: 2, limit: 10 })
    expect(repo.countProductAddToCart).toHaveBeenCalledWith([SHOP_ID], expect.objectContaining({
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-07T23:59:59.999Z'),
    }), PRODUCT_ID)
    expect(repo.findPaidOrderItems).toHaveBeenCalledWith([SHOP_ID], expect.any(Object), PRODUCT_ID)
  })

  it('returns zero summary values for empty analytics', async () => {
    vi.mocked(repo.countProductViews).mockResolvedValue([])
    vi.mocked(repo.countProductAddToCart).mockResolvedValue([])
    vi.mocked(repo.findPaidOrderItems).mockResolvedValue([])
    vi.mocked(repo.findProducts).mockResolvedValue([])
    vi.mocked(repo.findVariants).mockResolvedValue([])
    vi.mocked(repo.findProductsByIds).mockResolvedValue([])
    vi.mocked(repo.findVariantsByIds).mockResolvedValue([])

    const result = await service.getSummary(createActor(), { range: '30d' })

    expect(result).toMatchObject({
      views: 0,
      addToCart: 0,
      orders: 0,
      unitsSold: 0,
      revenue: 0,
      conversionRate: 0,
      currency: null,
      topSkus: [],
      lowPerformingProducts: [],
    })
  })

  it('paginates and sorts product table metrics', async () => {
    vi.mocked(repo.countProducts).mockResolvedValue(2)
    vi.mocked(repo.findProducts).mockResolvedValue([
      createProduct({ id: PRODUCT_ID, title: 'Cotton Tee' }),
      createProduct({ id: PRODUCT_2_ID, title: 'Silk Scarf', slug: 'silk-scarf' }),
    ])
    vi.mocked(repo.countProductViews).mockResolvedValue([
      { productId: PRODUCT_ID, count: 20 },
      { productId: PRODUCT_2_ID, count: 5 },
    ])
    vi.mocked(repo.findPaidOrderItems).mockResolvedValue([
      createOrderItem({ lineTotal: 1200n }),
      createOrderItem({
        id: 'item-2',
        variantId: VARIANT_2_ID,
        lineTotal: 5000n,
        variant: { id: VARIANT_2_ID, productId: PRODUCT_2_ID },
      }),
    ])

    const result = await service.getProducts(createActor(), {
      range: 'custom',
      from: '2026-06-01',
      to: '2026-06-07',
      q: 'tee',
      page: 1,
      limit: 2,
      sort: 'revenue',
    })

    expect(repo.countProducts).toHaveBeenCalledWith([SHOP_ID], 'tee')
    expect(result.pagination).toEqual({ page: 1, limit: 2, total: 2, totalPages: 1 })
    expect(result.items[0]!.productId).toBe(PRODUCT_2_ID)
    expect(result.items[0]!.revenue).toBe(5000)
  })

  it('builds daily series from event and order timestamps', async () => {
    const result = await service.getDaily(createActor(), {
      range: 'custom',
      from: '2026-06-02',
      to: '2026-06-03',
    })

    expect(result.items).toEqual([
      expect.objectContaining({ date: '2026-06-02', views: 1, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0 }),
      expect.objectContaining({ date: '2026-06-03', views: 1, addToCart: 1, orders: 1, unitsSold: 2, revenue: 2400 }),
    ])
  })

  it('accepts serialized timestamp strings from the Prisma response adapter', async () => {
    vi.mocked(repo.findProductViewLogs).mockResolvedValue([
      { productId: PRODUCT_ID, createdAt: '2026-06-02T10:00:00.000Z' },
    ])
    vi.mocked(repo.findProductAddToCartLogs).mockResolvedValue([])
    vi.mocked(repo.findPaidOrderItems).mockResolvedValue([])

    const result = await service.getDaily(createActor(), {
      range: 'custom',
      from: '2026-06-02',
      to: '2026-06-02',
    })

    expect(result.items).toEqual([
      expect.objectContaining({ date: '2026-06-02', views: 1 }),
    ])
  })

  it('keeps another seller product data out through active shop scoping', async () => {
    vi.mocked(activeShopResolver.resolveActiveShops).mockResolvedValue([{ id: OTHER_SHOP_ID, ownerId: 'seller-2', status: 'ACTIVE' }])

    await service.getSummary({ id: 'seller-2', role: 'USER' }, { range: '7d' })

    expect(repo.countProductViews).toHaveBeenCalledWith([OTHER_SHOP_ID], expect.any(Object), undefined)
    expect(repo.findPaidOrderItems).toHaveBeenCalledWith([OTHER_SHOP_ID], expect.any(Object), undefined)
  })
})
