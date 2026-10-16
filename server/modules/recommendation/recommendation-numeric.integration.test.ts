import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Elysia } from 'elysia'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaRecommendationRepository } from './recommendation.repository.ts'
import { RecommendationService } from './recommendation.service.ts'
import { createRecommendationRoutes } from './recommendation.routes.ts'
import { PgVectorSearchAdapter } from '#server/modules/ai-search/vector-search.adapter.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('recommendation numeric thresholds on PostgreSQL', () => {
  let db: PrismaClient
  let service: RecommendationService
  let app: Pick<Elysia, 'handle'>
  beforeAll(() => {
    db = thresholdDatabase()
    service = new RecommendationService(thresholdContext, new PrismaRecommendationRepository(thresholdContext, db))
    app = new Elysia().use(createRecommendationRoutes({ recommendationService: service } as unknown as ServiceContainer))
  })
  afterAll(async () => { await db?.$disconnect() })

  it.each([
    { name: 'minimum500 padding', source: [1000n], candidates: [499n, 500n, 1000n, 1500n, 1501n], included: [500n, 1000n, 1500n] },
    { name: '25 percent padding', source: [10000n], candidates: [7499n, 7500n, 10000n, 12500n, 12501n], included: [7500n, 10000n, 12500n] },
    { name: '25 percent half-unit rounds upward', source: [10002n], candidates: [7500n, 7501n, 10002n, 12503n, 12504n], included: [7501n, 10002n, 12503n] },
    { name: 'range padding with zero clamp', source: [1000n, 5000n], candidates: [0n, 3000n, 6000n, 6001n], included: [0n, 3000n, 6000n] },
  ])('applies inclusive edges for $name and stable pages with literal minor units', async ({ source, candidates, included }) => {
    const f = await numericThresholdFixture(db)
    await db.productVariant.update({ where: { id: f.variant.id }, data: { price: source[0]! } })
    if (source.length === 2) await db.productVariant.create({ data: { productId: f.product.id, sku: randomUUID(), title: 'Second source variant', status: 'ACTIVE', price: source[1]! } })
    const rows = []
    for (const [index, price] of candidates.entries()) rows.push(await thresholdProduct(db, f, { price, createdAt: new Date(`2026-10-04T00:00:0${index}.000Z`) }))
    const expected = rows.filter((_, index) => included.includes(candidates[index]!)).reverse()
    const first = await service.getSimilar(f.product.id, { page: 1, limit: 2 })
    const second = await service.getSimilar(f.product.id, { page: 2, limit: 2 })
    expect(first.items.map((item) => ({ id: item.productId, price: item.minPrice }))).toEqual(expected.slice(0, 2).map((row) => ({ id: row.product.id, price: row.variant.price })))
    expect(second.items.map((item) => ({ id: item.productId, price: item.minPrice }))).toEqual(expected.slice(2).map((row) => ({ id: row.product.id, price: row.variant.price })))
    expect(first.pagination).toEqual({ page: 1, limit: 2, hasNextPage: true })
    expect(second.pagination).toEqual({ page: 2, limit: 2, hasNextPage: false })
    expect(new Set([...first.items, ...second.items].map((item) => item.productId)).size).toBe(3)
    const response = await app.handle(new Request(`http://localhost/api/recommendations/similar/${f.product.id}?page=2&limit=2`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [{ productId: expected[2]!.product.id, minPrice: String(included[0]!) }], pagination: { page: 2, limit: 2, hasNextPage: false } })
    expect(await db.productVariant.count({ where: { productId: f.product.id, status: 'ACTIVE' } })).toBe(source.length)
  })

  it('excludes source, wrong category, inactive product/variant/shop and canceled sold lines', async () => {
    const f = await numericThresholdFixture(db)
    await db.productVariant.update({ where: { id: f.variant.id }, data: { price: 1000n } })
    const valid = await thresholdProduct(db, f, { price: 1000n })
    await thresholdProduct(db, f, { price: 1000n, status: 'DRAFT' })
    await thresholdProduct(db, f, { price: 1000n, variantStatus: 'INACTIVE' })
    const category = await db.category.create({ data: { name: randomUUID(), slug: randomUUID(), isActive: true } })
    await thresholdProduct(db, f, { price: 1000n, categoryId: category.id })
    const inactiveShop = await db.shop.create({ data: { ownerId: f.owner.id, sellerProfileId: f.shop.sellerProfileId, name: randomUUID(), slug: randomUUID(), status: 'SUSPENDED', contactEmail: f.owner.email, contactPhone: '0800000000' } })
    await thresholdProduct(db, f, { price: 1000n, shopId: inactiveShop.id })
    await thresholdSale(db, f, { ...valid, quantity: 9, amount: 900n })
    await thresholdSale(db, f, { ...valid, quantity: 100, amount: 10000n, status: 'CANCELED' })
    const itemCanceled = await thresholdSale(db, f, { ...valid, quantity: 100, amount: 10000n })
    await db.orderItem.update({ where: { id: itemCanceled.item.id }, data: { fulfillmentStatus: 'CANCELED' } })
    await thresholdSale(db, f, { ...valid, quantity: 100, amount: 10000n, paymentStatus: 'PENDING', paymentState: 'PENDING' })
    const result = await service.getSimilar(f.product.id, { limit: 20 })
    expect(result.items.map((item) => ({ id: item.productId, price: item.minPrice, sold: item.soldCount, stock: item.stock }))).toEqual([{ id: valid.product.id, price: 1000n, sold: 9, stock: 1 }])
    const response = await app.handle(new Request(`http://localhost/api/recommendations/similar/${f.product.id}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [{ productId: valid.product.id, minPrice: '1000', soldCount: 9, stock: 1 }], pagination: { hasNextPage: false } })
    expect(await db.orderItem.aggregate({ where: { variantId: valid.variant.id, fulfillmentStatus: { not: 'CANCELED' }, order: { paymentStatus: 'SUCCEEDED', status: { not: 'CANCELED' } } }, _sum: { quantity: true } })).toEqual({ _sum: { quantity: 9 } })
  })

  it('aggregates only published reviews and active-variant sales while keeping IEEE rating rounding', async () => {
    const f = await numericThresholdFixture(db)
    const target = await thresholdProduct(db, f, { price: 9223372036854775807n })
    const sale = await thresholdSale(db, f, target)
    const itemIds = [sale.item.id, ...Array.from({ length: 40 }, () => randomUUID())]
    await db.orderItem.createMany({ data: itemIds.slice(1).map((id) => ({ ...sale.item, id })) })
    await db.review.createMany({ data: itemIds.map((orderItemId, index) => ({
      orderItemId, productId: target.product.id, userId: f.buyer.id,
      rating: index < 13 ? 2 : index < 40 ? 3 : 5,
      status: index < 40 ? 'PUBLISHED' : 'PENDING',
    })) })
    const inactive = await db.productVariant.create({ data: { productId: target.product.id, sku: randomUUID(), title: 'Inactive', status: 'INACTIVE', price: 1n } })
    await thresholdSale(db, f, { product: target.product, variant: inactive, quantity: 100, amount: 10000n })
    const related = await service.getRelated(f.product.id, { limit: 20 })
    expect(related.items).toEqual([expect.objectContaining({ productId: target.product.id, minPrice: 9223372036854775807n, rating: 2.67, soldCount: 41 })])
    const repo = new PrismaRecommendationRepository(thresholdContext, db)
    expect(await repo.findPublicProductById(f.product.id)).toEqual({
      id: f.product.id, categoryId: f.category.id, shopId: f.shop.id, variants: [{ price: 100n }],
    })
    const records = await repo.findRelatedProducts({ productId: f.product.id, limit: 20, offset: 0 }, {
      id: f.product.id, categoryId: f.category.id, shopId: f.shop.id, variants: [{ price: 100n }],
    })
    expect(records[0]).toMatchObject({ ratingSum: 107, reviewCount: 40, soldCount: 41 })
    expect(records[0]).not.toHaveProperty('reviews')
    expect(records[0]?.variants[0]).not.toHaveProperty('orderItems')

    const nearest = vi.spyOn(db, '$queryRawUnsafe').mockResolvedValue([{ productId: target.product.id, score: 0.875 }])
    try {
      const adapter = new PgVectorSearchAdapter(thresholdContext, db)
      const matches = await adapter.searchProducts({ embedding: [0.1, 0.2], limit: 1, locale: 'en', model: 'fixture' })
      expect(matches).toEqual([expect.objectContaining({ score: 0.875, product: expect.objectContaining({ id: target.product.id, ratingSum: 107, reviewCount: 40 }) })])
      expect(matches[0]?.product).not.toHaveProperty('reviews')
      expect(matches[0]?.product.variants[0]).not.toHaveProperty('orderItems')
    } finally {
      nearest.mockRestore()
    }
  })
})
