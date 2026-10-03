import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Elysia } from 'elysia'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaReviewRepository } from './review.repository.ts'
import { ReviewService } from './review.service.ts'
import { createReviewRoutes } from './review.routes.ts'
import { PrismaShopReviewRepository } from '#server/modules/shop-review/shop-review.repository.ts'
import { ShopReviewService } from '#server/modules/shop-review/shop-review.service.ts'
import { createShopReviewRoutes } from '#server/modules/shop-review/shop-review.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('review numeric aggregates on PostgreSQL', () => {
  let db: PrismaClient
  let review: ReviewService
  let shopReview: ShopReviewService
  let app: Pick<Elysia, 'handle'>
  beforeAll(() => {
    db = thresholdDatabase()
    review = new ReviewService(thresholdContext, new PrismaReviewRepository(thresholdContext, db))
    shopReview = new ShopReviewService(thresholdContext, new PrismaShopReviewRepository(thresholdContext, db))
    app = new Elysia().use(createReviewRoutes({ reviewService: review } as unknown as ServiceContainer)).use(createShopReviewRoutes({ shopReviewService: shopReview } as unknown as ServiceContainer))
  })
  afterAll(async () => { await db?.$disconnect() })

  it('returns zero averages, counts and all five buckets before publication', async () => {
    const f = await numericThresholdFixture(db)
    const expected = { averageRating: 0, totalReviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    expect(await review.getRatingSummary(f.product.id)).toEqual(expected)
    expect(await shopReview.getShopRatingSummary(f.shop.id)).toEqual(expected)
    for (const url of [`/api/products/${f.product.id}/rating-summary`, `/api/shops/${f.shop.id}/rating-summary`]) {
      const response = await app.handle(new Request(`http://localhost${url}`))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
  })

  it('aggregates only published 5,5,3 product ratings independently of paginated rows', async () => {
    const f = await numericThresholdFixture(db)
    for (const [rating, status] of [[5, 'PUBLISHED'], [5, 'PUBLISHED'], [3, 'PUBLISHED'], [5, 'PENDING'], [5, 'REJECTED'], [5, 'HIDDEN']] as const) {
      const sale = await thresholdSale(db, f)
      const created = await review.createReview({ id: f.buyer.id, role: 'USER' }, { orderItemId: sale.item.id, rating })
      await db.review.update({ where: { id: created.id }, data: { status } })
    }
    const expected = { averageRating: 4.33, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 } }
    expect(await review.getRatingSummary(f.product.id)).toEqual(expected)
    expect(await db.review.aggregate({ where: { productId: f.product.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })).toEqual({ _count: 3, _sum: { rating: 13 } })
    const summary = await app.handle(new Request(`http://localhost/api/products/${f.product.id}/rating-summary`))
    expect(summary.status).toBe(200)
    expect(await summary.json()).toEqual(expected)
    const first = await review.listProductReviews(f.product.id, { page: 1, limit: 2 })
    const second = await review.listProductReviews(f.product.id, { page: 2, limit: 2 })
    expect(first.items).toHaveLength(2)
    expect(first.meta).toEqual({ page: 1, limit: 2, totalCount: 3, hasNextPage: true })
    expect(second.items).toHaveLength(1)
    expect(second.meta).toEqual({ page: 2, limit: 2, totalCount: 3, hasNextPage: false })
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3)
    const response = await app.handle(new Request(`http://localhost/api/products/${f.product.id}/reviews?page=1&limit=2`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: first.items.map(({ id, rating }) => ({ id, rating })), meta: first.meta })
  })

  it('keeps moderated 5,5,4 shop summary and stored cache at4.67 while feed page contains two', async () => {
    const f = await numericThresholdFixture(db)
    const admin = await db.user.update({ where: { id: f.owner.id }, data: { role: 'ADMIN' } })
    for (const [rating, decision] of [[5, 'APPROVE'], [5, 'APPROVE'], [4, 'APPROVE'], [5, null], [5, 'REJECT'], [5, 'HIDE']] as const) {
      const sale = await thresholdSale(db, f)
      await db.shopOrder.update({ where: { id: sale.shopOrder.id }, data: { status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' } })
      const created = await shopReview.createShopReview({ id: f.buyer.id, role: 'USER' }, { shopOrderId: sale.shopOrder.id, rating })
      if (decision) await shopReview.moderateShopReview(admin, created.id, { decision, moderationReason: 'Numeric fixture moderation' })
    }
    const expected = { averageRating: 4.67, totalReviewCount: 3, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 } }
    expect(await shopReview.getShopRatingSummary(f.shop.id)).toEqual(expected)
    expect(await db.shopRating.aggregate({ where: { shopId: f.shop.id, status: 'PUBLISHED' }, _count: true, _sum: { rating: true } })).toEqual({ _count: 3, _sum: { rating: 14 } })
    const stored = await db.shop.findUniqueOrThrow({ where: { id: f.shop.id } })
    expect(stored.ratingAverage.toString()).toBe('4.67')
    expect(stored.ratingCount).toBe(3)
    const summary = await app.handle(new Request(`http://localhost/api/shops/${f.shop.id}/rating-summary`))
    expect(summary.status).toBe(200)
    expect(await summary.json()).toEqual(expected)
    const first = await shopReview.listShopReviewFeed(f.shop.id, 1, 2)
    const second = await shopReview.listShopReviewFeed(f.shop.id, 2, 2)
    expect(first.items).toHaveLength(2)
    expect(first.meta).toEqual({ page: 1, pageSize: 2, totalCount: 3, hasNextPage: true })
    expect(second.items).toHaveLength(1)
    expect(second.meta).toEqual({ page: 2, pageSize: 2, totalCount: 3, hasNextPage: false })
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3)
    const response = await app.handle(new Request(`http://localhost/api/shops/${f.shop.id}/reviews/feed?page=1&limit=2`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: first.items.map(({ id, rating }) => ({ id, rating })), meta: first.meta })
  })
})

