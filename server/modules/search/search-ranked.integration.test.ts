import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma, type PrismaClient } from '#generated/client/client.ts'
import { localeSortKey } from '#server/lib/sql-locale-order.ts'
import { localizedText } from '#server/lib/localization.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaSearchRepository } from './search.repository.ts'
import { SearchService, type SearchSort } from './search.service.ts'

type Fixture = Awaited<ReturnType<typeof numericThresholdFixture>>
type ProductFixture = Pick<Fixture, 'product' | 'variant'>

async function addReviews(db: PrismaClient, f: Fixture, product: ProductFixture, ratings: number[]) {
  const sale = await thresholdSale(db, f, product)
  const items = ratings.map(() => randomUUID())
  const { id: _id, ...item } = sale.item
  await db.orderItem.createMany({ data: items.map((id) => ({ ...item, id })) })
  await db.review.createMany({ data: ratings.map((rating, i) => ({ productId: product.product.id, userId: f.buyer.id, orderItemId: items[i]!, rating, status: 'PUBLISHED' })) })
}

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('ranked search pages on PostgreSQL', () => {
  let db: PrismaClient
  let service: SearchService
  beforeAll(() => {
    db = thresholdDatabase()
    service = new SearchService(thresholdContext, new PrismaSearchRepository(thresholdContext, db))
  })
  afterAll(async () => { await db?.$disconnect() })

  it('matches localeCompare for Unicode equivalents and preserves equal-title input order', async () => {
    const corpus = ['é', 'e\u0301', 'a', 'a\u200b', 'a\u00ad', 'a\ufe0f', 'A', 'ำ', 'ํา', 'e\u200d\u0301', 'สินค้า', 'á', 'ä', '2', '10', '!', 'K', 'K', 'Å', 'Å', 'Ŀ', 'L·', 'ℏ', 'ħ', 'ຳ', 'ໍາ', 'ཷ', 'ྲཱྀ']
    const rows = await db.$queryRaw<Array<{ text: string; index: number }>>(Prisma.sql`
      SELECT text, ordinality::integer AS index FROM unnest(ARRAY[${Prisma.join(corpus)}]::text[]) WITH ORDINALITY AS value(text, ordinality)
      ORDER BY ${localeSortKey(Prisma.sql`text`)}, ordinality
    `)
    expect(rows.map((row) => row.text)).toEqual([...corpus].sort((a, b) => a.localeCompare(b)))
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { status: 'DRAFT' } })
    const older = await thresholdProduct(db, f, { price: 100n, createdAt: new Date('2026-01-01') })
    const newer = await thresholdProduct(db, f, { price: 100n, createdAt: new Date('2026-01-02') })
    await db.product.update({ where: { id: older.product.id }, data: { titleTh: 'e\u0301', titleEn: '\t\ufeff', title: 'ignored fallback' } })
    await db.product.update({ where: { id: newer.product.id }, data: { titleTh: 'é', titleEn: '\t\ufeff', title: 'ignored fallback' } })
    for (const locale of ['th', 'en'] as const) {
      const result = await service.searchProducts({ shopId: f.shop.id, sort: 'price_asc', locale, limit: 1 })
      expect(result.items.map((item) => item.productId)).toEqual([newer.product.id])
      expect(result.pagination).toMatchObject({ total: 2, nextCursor: newer.product.id, hasNextPage: true })
      const next = await service.searchProducts({ shopId: f.shop.id, sort: 'price_asc', locale, cursor: newer.product.id, limit: 1 })
      expect(next.items.map((item) => item.productId)).toEqual([older.product.id])
    }
  })

  it('matches legacy ranking across every sort and locale while hydrating only a page without history arrays', async () => {
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { status: 'DRAFT' } })
    const titles = ['Beta', 'é', 'e\u0301', 'Alpha', 'สินค้า', 'Alpha']
    for (const [index, title] of titles.entries()) {
      const row = await thresholdProduct(db, f, { price: index === 0 ? 9223372036854775807n : BigInt(index % 3 + 1) * 100n, createdAt: new Date(`2026-01-0${index + 1}`) })
      await db.product.update({ where: { id: row.product.id }, data: { title, titleEn: title, titleTh: titles[titles.length - index - 1] } })
      if (index > 0) await addReviews(db, f, row, Array(index).fill(index % 2 ? 4 : 5))
    }
    const products = await db.product.findMany({ where: { shopId: f.shop.id, status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: {
      variants: { where: { status: 'ACTIVE' }, include: { orderItems: { where: { order: { paymentStatus: 'SUCCEEDED', status: { not: 'CANCELED' } }, fulfillmentStatus: { not: 'CANCELED' } } } } },
      reviews: { where: { status: 'PUBLISHED' } },
    } })
    const hydrationCalls: Prisma.ProductFindManyArgs[] = []
    const observed = db.$extends({ query: { product: { findMany({ args, query }) {
      hydrationCalls.push(args)
      return query(args)
    } } } })
    const observedService = new SearchService(thresholdContext, new PrismaSearchRepository(thresholdContext, observed as unknown as PrismaClient))
    for (const locale of ['en', 'th'] as const) for (const sort of ['relevance', 'newest', 'price_asc', 'price_desc', 'top_sales', 'rating'] as SearchSort[]) {
      const legacy = products.map((p) => ({
        id: p.id, title: localizedText(locale, { en: p.titleEn, th: p.titleTh, fallback: p.title }) ?? p.title,
        price: p.variants.reduce((min, variant) => variant.price < min ? variant.price : min, p.variants[0]!.price),
        sold: p.variants.reduce((sum, variant) => sum + variant.orderItems.reduce((n, item) => n + item.quantity, 0), 0),
        rating: p.reviews.length ? Number((p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length).toFixed(2)) : 0,
        count: p.reviews.length,
      })).sort((a, b) => {
        const price = a.price < b.price ? -1 : a.price > b.price ? 1 : 0
        if (sort === 'price_asc') return price || a.title.localeCompare(b.title)
        if (sort === 'price_desc') return -price || a.title.localeCompare(b.title)
        if (sort === 'top_sales') return b.sold - a.sold || a.title.localeCompare(b.title)
        if (sort === 'rating') return b.rating - a.rating || b.count - a.count || a.title.localeCompare(b.title)
        return 0
      })
      const response = await observedService.searchProducts({ shopId: f.shop.id, sort, locale, page: 2, limit: 2 })
      expect(response.items.map((p) => ({ id: p.productId, title: p.title, price: p.minPrice, sold: p.soldCount, rating: p.ratingSummary.averageRating, count: p.ratingSummary.totalReviewCount }))).toEqual(legacy.slice(2, 4))
      expect(response.pagination).toMatchObject({ total: 6, totalPages: 3, nextCursor: legacy[3]!.id, hasNextPage: true })
      const hydration = hydrationCalls.at(-1)
      expect(hydration?.where).toEqual({ id: { in: legacy.slice(2, 4).map((p) => p.id) } })
      expect(hydration?.select).not.toHaveProperty('reviews')
      expect(hydration?.select?.variants).not.toHaveProperty('select.orderItems')
    }
  })

  it('preserves toFixed rounding before filtering, counts and pagination at half-way ratings', async () => {
    const f = await numericThresholdFixture(db)
    await addReviews(db, f, f, [...Array(199).fill(1), 2])
    const second = await thresholdProduct(db, f, { price: 200n })
    await addReviews(db, f, second, [...Array(65).fill(2), ...Array(135).fill(3)])
    const result = await service.searchProducts({ shopId: f.shop.id, sort: 'rating' })
    expect(result.items.map((item) => item.ratingSummary)).toEqual([
      { averageRating: 2.67, totalReviewCount: 200 }, { averageRating: 1, totalReviewCount: 200 },
    ])
    const filtered = await service.searchProducts({ shopId: f.shop.id, rating: 2.675, limit: 1 })
    expect(filtered.pagination).toMatchObject({ total: 0, totalPages: 0, nextCursor: null })
    expect(filtered.facets.categories[0]?.count).toBe(2)
    expect(filtered.facets.price).toEqual({ min: 100n, max: 200n, currency: 'THB' })
  })

  it('retains search payment and cancellation evidence without adding shop or Payment conditions', async () => {
    const f = await numericThresholdFixture(db)
    const canceledItem = await thresholdSale(db, f, { quantity: 1000 })
    await db.orderItem.update({ where: { id: canceledItem.item.id }, data: { fulfillmentStatus: 'CANCELED' } })
    await thresholdSale(db, f, { quantity: 1000, status: 'CANCELED' })
    await thresholdSale(db, f, { quantity: 1000, paymentStatus: 'PENDING' })
    const canceledShop = await thresholdSale(db, f, { quantity: 70 })
    await db.shopOrder.update({ where: { id: canceledShop.shopOrder.id }, data: { status: 'CANCELED' } })
    await thresholdSale(db, f, { quantity: 30, paymentState: 'PENDING' })
    const inactive = await db.productVariant.create({ data: { productId: f.product.id, title: 'inactive', sku: randomUUID(), status: 'INACTIVE', price: 1n } })
    await thresholdSale(db, f, { variant: inactive, quantity: 1000 })
    const result = await service.searchProducts({ shopId: f.shop.id, badges: 'best_seller' })
    expect(result.items.map((p) => ({ sold: p.soldCount, badges: p.badges, minPrice: p.minPrice }))).toEqual([{ sold: 100, badges: ['new', 'best_seller', 'in_stock'], minPrice: 100n }])
  })

  it('keeps price and stock eligibility on the same active variant and preserves translated text, attributes and facet scope', async () => {
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { descriptionTh: 'คำค้น', attributes: { create: [{ displayName: 'Color', value: 'Red', attributeKey: 'color', isFilterable: true }, { displayName: 'Hidden', value: 'yes', attributeKey: 'hidden', isFilterable: false }] } } })
    await db.productVariant.create({ data: { productId: f.product.id, sku: 'match-inactive-sku', title: 'inactive', status: 'INACTIVE', price: 200n } })
    const unavailable = await thresholdProduct(db, f, { price: 100n, reserved: 3 })
    await db.productVariant.create({ data: { productId: unavailable.product.id, sku: randomUUID(), title: 'expensive stock', price: 500n, inventory: { create: { quantityOnHand: 5 } } } })
    const filters = { shopId: f.shop.id, categoryId: f.category.slug, brandId: f.brand.id, minPrice: 100, maxPrice: 100, inStock: true, attributeFilters: 'color:red' }
    for (const q of ['คำค้น', 'match-inactive-sku']) {
      const result = await service.searchProducts({ ...filters, q })
      expect(result.items.map((p) => p.productId)).toEqual([f.product.id])
      expect(result.facets.categories).toEqual([{ id: f.category.id, slug: f.category.slug, name: f.category.name, count: 1, active: true }])
    }
    const unknownBadge = await service.searchProducts({ ...filters, badges: 'unknown_badge' })
    expect(unknownBadge.pagination).toMatchObject({ total: 0, hasNextPage: false })
    expect(unknownBadge.facets.categories[0]?.count).toBe(1)
    const hidden = await service.searchProducts({ shopId: f.shop.id, attributeFilters: 'hidden:yes' })
    expect(hidden.pagination.total).toBe(0)
    await db.category.update({ where: { id: f.category.id }, data: { isActive: false } })
    expect((await service.searchProducts(filters)).pagination.total).toBe(0)
    await db.category.update({ where: { id: f.category.id }, data: { isActive: true } })
    await db.shop.update({ where: { id: f.shop.id }, data: { status: 'SUSPENDED' } })
    expect((await service.searchProducts({ shopId: f.shop.id })).pagination.total).toBe(0)
  })

  it('returns exact large prices and retains missing-cursor fallback, filtered cursors and empty-page totals', async () => {
    const f = await numericThresholdFixture(db)
    await db.productVariant.update({ where: { id: f.variant.id }, data: { price: 9007199254740993n } })
    const high = await thresholdProduct(db, f, { price: 9223372036854775807n })
    const first = await service.searchProducts({ shopId: f.shop.id, sort: 'price_asc', cursor: 'missing', page: 99, limit: 1 })
    expect(first.items[0]?.minPrice).toBe(9007199254740993n)
    expect(first.pagination).toMatchObject({ total: 2, page: 99, nextCursor: f.product.id, hasNextPage: true })
    const next = await service.searchProducts({ shopId: f.shop.id, sort: 'price_asc', cursor: f.product.id, limit: 1 })
    expect(next.items[0]?.minPrice).toBe(9223372036854775807n)
    expect(next.pagination).toMatchObject({ total: 2, hasNextPage: false })
    const last = await service.searchProducts({ shopId: f.shop.id, sort: 'price_asc', cursor: high.product.id, limit: 1 })
    expect(last.pagination).toMatchObject({ total: 2, nextCursor: null, hasNextPage: false })
    expect(last.items).toEqual([])
    const page = await service.searchProducts({ shopId: f.shop.id, page: 100, limit: 1 })
    expect(page.pagination).toMatchObject({ total: 2, nextCursor: null, hasNextPage: false })
  })
})
