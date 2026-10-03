import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Elysia } from 'elysia'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { ActiveShopResolver, PrismaOwnershipGuardRepository } from '#server/modules/security'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaProductAnalyticsRepository } from './product-analytics.repository.ts'
import { ProductAnalyticsService } from './product-analytics.service.ts'
import { createProductAnalyticsRoutes } from './product-analytics.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('analytics conversion thresholds on PostgreSQL', () => {
  let db: PrismaClient
  let service: ProductAnalyticsService
  beforeAll(() => {
    db = thresholdDatabase()
    const ownership = new PrismaOwnershipGuardRepository(thresholdContext, db)
    service = new ProductAnalyticsService(thresholdContext, new PrismaProductAnalyticsRepository(thresholdContext, db), new ActiveShopResolver(ownership))
  })
  afterAll(async () => { await db?.$disconnect() })

  it('uses minimum10 views and strictly below1% conversion; zero views remain finite', async () => {
    const f = await numericThresholdFixture(db)
    const rows = [{ product: f.product, variant: f.variant }]
    for (let index = 0; index < 5; index += 1) rows.push(await thresholdProduct(db, f, { price: 100n }))
    const inputs = [{ views: 9, orders: 0 }, { views: 10, orders: 0 }, { views: 100, orders: 1 }, { views: 101, orders: 1 }, { views: 0, orders: 0 }, { views: 0, orders: 1 }]
    for (const [index, input] of inputs.entries()) {
      const row = rows[index]!
      if (input.views > 0) await db.productViewLog.createMany({ data: Array.from({ length: input.views }, () => ({ productId: row.product.id, shopId: f.shop.id, createdAt: new Date('2026-10-04T00:00:00.000Z') })) })
      if (input.orders > 0) await thresholdSale(db, f, row)
    }
    const query = { range: 'custom', from: '2026-10-04', to: '2026-10-04', limit: 100 } as const
    const summary = await service.getSummary(f.owner, query)
    expect(summary).toMatchObject({ views: 220, orders: 3, unitsSold: 3, revenue: 300n })
    expect(summary.lowPerformingProducts.map((item) => ({ id: item.productId, views: item.views, orders: item.orders }))).toEqual([
      { id: rows[3]!.product.id, views: 101, orders: 1 },
      { id: rows[1]!.product.id, views: 10, orders: 0 },
    ])
    const table = await service.getProducts(f.owner, query)
    const byId = new Map(table.items.map((item) => [item.productId, item]))
    expect(byId.get(rows[0]!.product.id)).toMatchObject({ views: 9, orders: 0, conversionRate: 0 })
    expect(byId.get(rows[1]!.product.id)).toMatchObject({ views: 10, orders: 0, conversionRate: 0 })
    expect(byId.get(rows[2]!.product.id)).toMatchObject({ views: 100, orders: 1, conversionRate: 0.01 })
    expect(byId.get(rows[3]!.product.id)!.conversionRate).toBeCloseTo(0.009900990099009901, 15)
    for (const index of [4, 5]) {
      expect(byId.get(rows[index]!.product.id)).toMatchObject({ views: 0, orders: index === 4 ? 0 : 1, conversionRate: 0 })
      expect(Number.isFinite(byId.get(rows[index]!.product.id)!.conversionRate)).toBe(true)
    }
    expect(table.pagination).toEqual({ page: 1, limit: 100, total: 6, totalPages: 1 })
    expect(await db.productViewLog.count({ where: { shopId: f.shop.id } })).toBe(220)
    expect(await db.orderItem.aggregate({ where: { shopId: f.shop.id }, _sum: { quantity: true, lineTotal: true } })).toEqual({ _sum: { quantity: 3, lineTotal: 300n } })
    const verifiedOwner = await db.user.update({ where: { id: f.owner.id }, data: { emailVerified: true } })
    vi.mocked(getAuthContext).mockResolvedValue({ user: verifiedOwner })
    const app = new Elysia().use(createProductAnalyticsRoutes({ productAnalyticsService: service } as unknown as ServiceContainer))
    const response = await app.handle(new Request('http://localhost/api/seller/analytics/products/summary?range=custom&from=2026-10-04&to=2026-10-04'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ views: 220, orders: 3, unitsSold: 3, revenue: '300', lowPerformingProducts: [{ productId: rows[3]!.product.id, views: 101, orders: 1, revenue: '100' }, { productId: rows[1]!.product.id, views: 10, orders: 0, revenue: '0' }] })
    const listResponse = await app.handle(new Request('http://localhost/api/seller/analytics/products?range=custom&from=2026-10-04&to=2026-10-04&limit=100'))
    expect(listResponse.status).toBe(200)
    const listBody = await listResponse.json()
    expect(listBody).toMatchObject({ pagination: table.pagination, items: table.items.map((item) => ({ productId: item.productId, views: item.views, orders: item.orders, conversionRate: item.conversionRate, revenue: String(item.revenue) })) })
  })

  it('caps low-performing recommendations at five after descending view ranking', async () => {
    const f = await numericThresholdFixture(db)
    const rows = [{ product: f.product, variant: f.variant }]
    for (let index = 0; index < 6; index += 1) rows.push(await thresholdProduct(db, f, { price: 100n }))
    for (const [index, views] of [100, 90, 80, 70, 60, 50, 40].entries()) {
      await db.productViewLog.createMany({ data: Array.from({ length: views }, () => ({ productId: rows[index]!.product.id, shopId: f.shop.id, createdAt: new Date('2026-10-04T00:00:00.000Z') })) })
    }
    const summary = await service.getSummary(f.owner, { range: 'custom', from: '2026-10-04', to: '2026-10-04' })
    expect(summary).toMatchObject({ views: 490, orders: 0, revenue: 0n, conversionRate: 0 })
    expect(summary.lowPerformingProducts.map((item) => ({ id: item.productId, views: item.views, conversionRate: item.conversionRate }))).toEqual([
      { id: rows[0]!.product.id, views: 100, conversionRate: 0 },
      { id: rows[1]!.product.id, views: 90, conversionRate: 0 },
      { id: rows[2]!.product.id, views: 80, conversionRate: 0 },
      { id: rows[3]!.product.id, views: 70, conversionRate: 0 },
      { id: rows[4]!.product.id, views: 60, conversionRate: 0 },
    ])
    expect(await db.productViewLog.count({ where: { shopId: f.shop.id } })).toBe(490)
  })
})
