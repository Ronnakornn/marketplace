import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Elysia } from 'elysia'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaSearchRepository } from './search.repository.ts'
import { SearchService } from './search.service.ts'
import { createSearchRoutes } from './search.routes.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('search numeric thresholds on PostgreSQL', () => {
  let db: PrismaClient
  let service: SearchService
  let app: Pick<Elysia, 'handle'>
  beforeAll(() => {
    db = thresholdDatabase()
    service = new SearchService(thresholdContext, new PrismaSearchRepository(thresholdContext, db))
    app = new Elysia().use(createSearchRoutes({ searchService: service } as unknown as ServiceContainer))
  })
  afterEach(() => { vi.useRealTimers() })
  afterAll(async () => { await db?.$disconnect() })

  it('excludes fully reserved stock from both results and category/brand/price facets', async () => {
    const f = await numericThresholdFixture(db)
    await db.productVariant.update({ where: { id: f.variant.id }, data: { price: 1000n } })
    await db.inventory.update({ where: { variantId: f.variant.id }, data: { quantityReserved: 3 } })
    const available = await thresholdProduct(db, f, { price: 2000n, onHand: 3, reserved: 2 })
    const result = await service.searchProducts({ shopId: f.shop.id, inStock: true })
    expect(result.items.map((item) => item.productId)).toEqual([available.product.id])
    expect(result.items[0]!.variants[0]!.stock).toBe(1)
    expect(result.meta.totalCount).toBe(1)
    expect(result.facets.categories).toEqual([{ id: f.category.id, name: f.category.name, slug: f.category.slug, count: 1, active: false }])
    expect(result.facets.brands).toEqual([{ id: f.brand.id, name: f.brand.name, slug: f.brand.slug, count: 1, active: false }])
    expect(result.facets.price).toEqual({ min: 2000n, max: 2000n, currency: 'THB' })
    const response = await app.handle(new Request(`http://localhost/api/search/products?shopId=${f.shop.id}&inStock=true`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [{ productId: available.product.id, minPrice: '2000', variants: [{ stock: 1, price: '2000' }] }], facets: { categories: [{ count: 1 }], brands: [{ count: 1 }], price: { min: '2000', max: '2000', currency: 'THB' } }, meta: { totalCount: 1 } })
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } })).toMatchObject({ quantityOnHand: 3, quantityReserved: 3 })
  })

  it('uses inclusive price/rating bounds and paginates after derived rating filters', async () => {
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { status: 'DRAFT' } })
    const fixtures = []
    for (const [price, rating] of [[999n, 5], [1000n, 4], [1500n, 3], [2000n, 5], [2001n, 5]] as const) {
      const row = await thresholdProduct(db, f, { price })
      const sale = await thresholdSale(db, f, row)
      await db.review.create({ data: { userId: f.buyer.id, productId: row.product.id, orderItemId: sale.item.id, rating, status: 'PUBLISHED' } })
      fixtures.push(row)
    }
    const query = { shopId: f.shop.id, minPrice: 1000, maxPrice: 2000, rating: 4, sort: 'price_asc', limit: 1 }
    const first = await service.searchProducts({ ...query, page: 1 })
    const second = await service.searchProducts({ ...query, page: 2 })
    expect(first.items.map((item) => item.productId)).toEqual([fixtures[1]!.product.id])
    expect(second.items.map((item) => item.productId)).toEqual([fixtures[3]!.product.id])
    expect(first.meta).toMatchObject({ totalCount: 2, pageSize: 1, hasNextPage: true })
    expect(second.meta).toMatchObject({ totalCount: 2, pageSize: 1, hasNextPage: false })
    expect(first.items[0]!.ratingSummary).toEqual({ averageRating: 4, totalReviewCount: 1 })
    expect(second.items[0]!.ratingSummary).toEqual({ averageRating: 5, totalReviewCount: 1 })
    const response = await app.handle(new Request(`http://localhost/api/search/products?shopId=${f.shop.id}&minPrice=1000&maxPrice=2000&rating=4&sort=price_asc&limit=1&page=2`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [{ productId: fixtures[3]!.product.id, minPrice: '2000', ratingSummary: { averageRating: 5, totalReviewCount: 1 } }], meta: { totalCount: 2, hasNextPage: false } })
    expect(await db.review.count({ where: { product: { shopId: f.shop.id }, status: 'PUBLISHED' } })).toBe(5)
  })

  it('sets best_seller at100 paid units and new at the exact seven-day instant', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-04T00:00:00.000Z'))
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { createdAt: new Date('2026-09-26T23:59:59.999Z') } })
    const equal = await thresholdProduct(db, f, { price: 100n, createdAt: new Date('2026-09-27T00:00:00.000Z') })
    await thresholdSale(db, f, { quantity: 99, amount: 9900n })
    await thresholdSale(db, f, { ...equal, quantity: 100, amount: 10000n })
    await thresholdSale(db, f, { quantity: 1000, amount: 100000n, status: 'CANCELED' })
    await thresholdSale(db, f, { quantity: 1000, amount: 100000n, paymentStatus: 'PENDING', paymentState: 'PENDING' })
    const result = await service.searchProducts({ shopId: f.shop.id, sort: 'top_sales' })
    expect(result.items.map((item) => ({ id: item.productId, sold: item.soldCount, badges: item.badges }))).toEqual([
      { id: equal.product.id, sold: 100, badges: ['new', 'best_seller', 'in_stock'] },
      { id: f.product.id, sold: 99, badges: ['in_stock'] },
    ])
    const filtered = await service.searchProducts({ shopId: f.shop.id, badges: 'best_seller,new' })
    expect(filtered.items.map((item) => item.productId)).toEqual([equal.product.id])
    const response = await app.handle(new Request(`http://localhost/api/search/products?shopId=${f.shop.id}&sort=top_sales`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: result.items.map((item) => ({ productId: item.productId, soldCount: item.soldCount, badges: item.badges, minPrice: '100' })) })
    expect(await db.orderItem.aggregate({ where: { variantId: f.variant.id, order: { paymentStatus: 'SUCCEEDED', status: { not: 'CANCELED' } } }, _sum: { quantity: true } })).toEqual({ _sum: { quantity: 99 } })
  })
})
