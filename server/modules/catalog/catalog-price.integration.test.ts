import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma, type PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaCatalogRepository } from './catalog.repository.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('catalog price pages on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaCatalogRepository
  beforeAll(() => {
    db = thresholdDatabase()
    repo = new PrismaCatalogRepository(thresholdContext, db)
  })
  afterAll(async () => { await db?.$disconnect() })

  it('ranks exact active minima before page hydration, with stable IDs and existing cursor metadata', async () => {
    const f = await numericThresholdFixture(db)
    const tieA = await thresholdProduct(db, f, { price: 9007199254740993n })
    const tieB = await thresholdProduct(db, f, { price: 9007199254740993n })
    const expensive = await thresholdProduct(db, f, { price: 9223372036854775807n })
    await db.productVariant.create({ data: { productId: expensive.product.id, title: 'inactive cheap', sku: randomUUID(), status: 'INACTIVE', price: 1n } })
    await thresholdProduct(db, f, { price: 1n, variantStatus: 'INACTIVE' })
    const ties = [tieA.product.id, tieB.product.id].sort((a, b) => a.localeCompare(b))
    const hydrationCalls: Prisma.ProductFindManyArgs[] = []
    const observed = db.$extends({ query: { product: { findMany({ args, query }) {
      hydrationCalls.push(args)
      return query(args)
    } } } })
    const observedRepo = new PrismaCatalogRepository(thresholdContext, observed as unknown as PrismaClient)
    const filters = { shopId: f.shop.id, status: 'ACTIVE' as const, publicOnly: true, limit: 2 }
    const asc = await observedRepo.findProducts({ ...filters, sort: 'price_asc', page: 1 })
    expect(asc.data.map((p) => p.id)).toEqual([f.product.id, ties[0]])
    expect(asc.meta).toMatchObject({ totalCount: 4, nextCursor: null, page: 1, pageSize: 2, hasNextPage: true })
    expect(hydrationCalls.at(-1)?.where).toEqual({ id: { in: [f.product.id, ties[0]] } })
    const second = await observedRepo.findProducts({ ...filters, sort: 'price_asc', page: 2 })
    expect(second.data.map((p) => p.id)).toEqual([ties[1], expensive.product.id])
    expect(second.data[0]?.variants[0]?.price).toBe(9007199254740993n)
    expect(second.data[1]?.variants.find((v) => v.status === 'ACTIVE')?.price).toBe(9223372036854775807n)
    expect(second.meta).toMatchObject({ totalCount: 4, nextCursor: null, hasNextPage: false })
    const desc = await repo.findProducts({ ...filters, sort: 'price_desc', limit: 4 })
    expect(desc.data.map((p) => p.id)).toEqual([expensive.product.id, ...ties, f.product.id])
    const cursor = await repo.findProducts({ ...filters, sort: 'price_desc', cursor: expensive.product.id, page: 10 })
    expect(cursor.data.map((p) => p.id)).toEqual(ties)
    expect(cursor.meta).toMatchObject({ totalCount: 4, nextCursor: null, page: 10, hasNextPage: true })
    const empty = await repo.findProducts({ ...filters, sort: 'price_desc', page: 99 })
    expect(empty.data).toEqual([])
    expect(empty.meta).toMatchObject({ totalCount: 4, nextCursor: null, hasNextPage: false })
  })

  it('retains all-variant price eligibility while ranking only active variant prices', async () => {
    const f = await numericThresholdFixture(db)
    const selected = await thresholdProduct(db, f, { price: 500n })
    await db.productVariant.create({ data: { productId: selected.product.id, title: 'inactive match', sku: randomUUID(), status: 'INACTIVE', price: 50n } })
    const result = await repo.findProducts({ shopId: f.shop.id, status: 'ACTIVE', publicOnly: true, sort: 'price_asc', minPrice: 50, maxPrice: 50, limit: 1 })
    expect(result.data.map((p) => p.id)).toEqual([selected.product.id])
    expect(result.meta).toMatchObject({ totalCount: 1, hasNextPage: false, query: { minPrice: 50, maxPrice: 50 } })
    expect(result.data[0]?.variants.find((v) => v.status === 'ACTIVE')?.price).toBe(500n)
    const unavailable = await repo.findProducts({ shopId: f.shop.id, sort: 'price_desc', minPrice: 51, maxPrice: 99, limit: 1 })
    expect(unavailable.data).toEqual([])
    expect(unavailable.meta.totalCount).toBe(0)
  })

  it('preserves translated text, category/brand/shop, attributes, soft-delete and public visibility predicates', async () => {
    const f = await numericThresholdFixture(db)
    await db.product.update({ where: { id: f.product.id }, data: { descriptionEn: 'unique translated term', attributes: { create: [{ displayName: 'Color', value: 'RED', attributeKey: 'color', isFilterable: true }, { displayName: 'Hidden', value: 'yes', attributeKey: 'hidden', isFilterable: false }] } } })
    const deleted = await thresholdProduct(db, f, { price: 1n })
    await db.product.update({ where: { id: deleted.product.id }, data: { deletedAt: new Date() } })
    await thresholdProduct(db, f, { price: 10n, status: 'DRAFT' })
    const filters = { shopId: f.shop.id, status: 'ACTIVE' as const, publicOnly: true, sort: 'price_asc', categoryId: f.category.slug, brandId: f.brand.id, keyword: 'translated term', attributeFilters: [{ key: 'color', value: 'red' }], limit: 5 }
    const result = await repo.findProducts(filters)
    expect(result.data.map((p) => p.id)).toEqual([f.product.id])
    expect(result.meta).toMatchObject({ totalCount: 1, query: { q: 'translated term', categoryId: f.category.slug, brandId: f.brand.id, sort: 'price_asc' } })
    expect((await repo.findProducts({ ...filters, excludeProductId: f.product.id })).meta.totalCount).toBe(0)
    expect((await repo.findProducts({ ...filters, attributeFilters: [{ key: 'hidden', value: 'yes' }] })).meta.totalCount).toBe(0)
    await db.category.update({ where: { id: f.category.id }, data: { isActive: false } })
    expect((await repo.findProducts(filters)).meta.totalCount).toBe(0)
    await db.category.update({ where: { id: f.category.id }, data: { isActive: true } })
    await db.shop.update({ where: { id: f.shop.id }, data: { status: 'SUSPENDED' } })
    expect((await repo.findProducts(filters)).meta.totalCount).toBe(0)
    expect((await repo.findProducts({ ...filters, publicOnly: false })).data.map((p) => p.id)).toEqual([f.product.id])
  })
})
