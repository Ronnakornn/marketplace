import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { PrismaSellerDashboardRepository } from '#server/modules/seller/seller-dashboard.repository.ts'
import { SellerDashboardService } from '#server/modules/seller/seller-dashboard.service.ts'
import { PrismaProductAnalyticsRepository } from './product-analytics.repository.ts'
import { ProductAnalyticsService } from './product-analytics.service.ts'

const url = process.env['COMMERCE_TEST_DATABASE_URL']
const originalTimezone = process.env['TZ']
const context: AppContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe.skipIf(!url)('Bangkok reporting boundaries on PostgreSQL', () => {
  let db: PrismaClient
  let analytics: ProductAnalyticsService
  let dashboard: SellerDashboardService
  let actor: { id: string; role: 'USER' }
  let shopId: string

  beforeAll(async () => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const tag = randomUUID()
    const user = await db.user.create({ data: { name: 'Timezone seller', email: `${tag}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: user.id } })
    const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: tag, slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
    shopId = shop.id
    const product = await db.product.create({ data: { shopId, title: tag, slug: tag, status: 'ACTIVE' } })
    const variant = await db.productVariant.create({ data: { productId: product.id, sku: tag, title: tag, price: 1n, status: 'ACTIVE' } })
    const instants = [
      ['2026-09-30T16:59:59.999Z', 1n],
      ['2026-09-30T17:00:00.000Z', 2n],
      ['2026-10-01T16:59:59.999Z', 4n],
      ['2026-10-01T17:00:00.000Z', 8n],
      ['2026-10-31T17:00:00.000Z', 16n],
    ] as const
    for (const [instant, amount] of instants) {
      const createdAt = new Date(instant)
      const cart = await db.cart.create({ data: { userId: user.id, status: 'CHECKED_OUT' } })
      const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: user.id, status: 'COMPLETED', subtotal: amount, grandTotal: amount, expiresAt: createdAt } })
      const order = await db.order.create({ data: {
        checkoutId: checkout.id, userId: user.id, orderNumber: randomUUID(), status: 'PAID', paymentStatus: 'SUCCEEDED', subtotal: amount, grandTotal: amount, createdAt,
        shippingName: 'Timezone buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
      } })
      await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount, currency: 'THB' } })
      await db.orderItem.create({ data: { orderId: order.id, shopId, variantId: variant.id, quantity: 1, unitPrice: amount, lineTotal: amount, productTitle: tag, productSlug: tag, variantTitle: tag, variantSku: tag, shopName: tag, shopSlug: tag } })
      await db.productViewLog.create({ data: { productId: product.id, shopId, createdAt } })
      await db.productAddToCartLog.create({ data: { productId: product.id, variantId: variant.id, shopId, quantity: 3, createdAt } })
    }
    actor = { id: user.id, role: 'USER' }
    const resolver = { resolveActiveShops: async () => [shop] } as unknown as ActiveShopResolver
    analytics = new ProductAnalyticsService(context, new PrismaProductAnalyticsRepository(context, db), resolver)
    dashboard = new SellerDashboardService(context, new PrismaSellerDashboardRepository(context, db), undefined, resolver)
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalTimezone === undefined) delete process.env['TZ']
    else process.env['TZ'] = originalTimezone
  })
  afterAll(async () => { await db?.$disconnect() })

  it.each(['UTC', 'America/New_York', 'Asia/Bangkok'])('keeps daily/month totals independent of process TZ=%s', async (timezone) => {
    process.env['TZ'] = timezone
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'))
    const daily = await analytics.getDaily(actor, { range: 'custom', from: '2026-09-30', to: '2026-10-02' })
    expect(daily.items.map((item) => ({ ...item, revenue: String(item.revenue) }))).toEqual([
      { date: '2026-09-30', views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: '1', conversionRate: 1 },
      { date: '2026-10-01', views: 2, addToCart: 2, orders: 2, unitsSold: 2, revenue: '6', conversionRate: 1 },
      { date: '2026-10-02', views: 1, addToCart: 1, orders: 1, unitsSold: 1, revenue: '8', conversionRate: 1 },
    ])
    const result = await dashboard.getSalesSummary(actor)
    expect(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value)]))).toEqual({ todaySalesCents: '6', thisMonthSalesCents: '14', totalSalesCents: '31' })
    expect(await db.orderItem.count({ where: { shopId } })).toBe(5)
    expect((await db.orderItem.aggregate({ where: { shopId }, _sum: { lineTotal: true } }))._sum.lineTotal).toBe(31n)
  })

  it('starts presets on the Bangkok calendar date at exactly 17:00 UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-30T17:00:00.000Z'))
    const daily = await analytics.getDaily(actor, { range: '7d' })
    expect(daily.items.map((item) => item.date)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'])
    expect(daily.items.at(-1)).toMatchObject({ views: 2, orders: 2 })
    const result = await dashboard.getSalesSummary(actor)
    expect(String(result.todaySalesCents)).toBe('6')
    expect(String(result.thisMonthSalesCents)).toBe('14')
  })

  it.each([
    ['2026-02-30', '2026-03-01'], ['2026-02-29', '2026-03-01'],
    ['2026-10-01T00:00:00Z', '2026-10-02'], ['2026-10-01', '2026-09-30'],
    ['2026-01-01', '2027-01-02'],
    ['0000-01-01', '0000-01-01'], ['9999-12-31', '9999-12-31'],
  ])('rejects invalid or unbounded calendar range %s..%s', async (from, to) => {
    await expect(analytics.getDaily(actor, { range: 'custom', from, to })).rejects.toMatchObject({ status: 400, code: 'ANALYTICS_DATE_RANGE_INVALID' })
  })

  it('accepts a leap day and exactly 366 calendar days', async () => {
    expect((await analytics.getDaily(actor, { range: 'custom', from: '2024-01-01', to: '2024-12-31' })).items).toHaveLength(366)
    expect((await analytics.getDaily(actor, { range: 'custom', from: '2024-02-29', to: '2024-02-29' })).items[0]?.date).toBe('2024-02-29')
  })

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER, Infinity, 1.5])('rejects unsafe pagination page=%s', async (page) => {
    await expect(analytics.getProducts(actor, { range: '7d', page, limit: 100 })).rejects.toMatchObject({ status: 400, code: 'ANALYTICS_PAGINATION_INVALID' })
    await expect(analytics.getSkus(actor, { range: '7d', page, limit: 100 })).rejects.toMatchObject({ status: 400, code: 'ANALYTICS_PAGINATION_INVALID' })
  })
})
