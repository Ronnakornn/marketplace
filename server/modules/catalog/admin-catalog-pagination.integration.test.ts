import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaCatalogRepository } from './catalog.repository.ts'

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('admin catalog bounded pages on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaCatalogRepository
  let fixture: Awaited<ReturnType<typeof numericThresholdFixture>>
  let before: Awaited<ReturnType<PrismaCatalogRepository['countProductStatuses']>>
  beforeAll(async () => {
    db = thresholdDatabase()
    repo = new PrismaCatalogRepository(thresholdContext, db)
    before = await repo.countProductStatuses()
    fixture = await numericThresholdFixture(db)
    for (let index = 0; index < 66; index++) {
      await db.product.create({ data: { shopId: fixture.shop.id, title: `${fixture.tag}-catalog-${String(index).padStart(3, '0')}`, slug: randomUUID(), status: index < 61 ? 'ACTIVE' : index < 63 ? 'DRAFT' : 'ARCHIVED', variants: { create: { title: 'Variant', sku: randomUUID(), price: 9007199254740993n } } } })
    }
    await db.product.create({ data: { shopId: fixture.shop.id, title: 'Deleted draft', slug: randomUUID(), status: 'DRAFT', deletedAt: new Date() } })
  }, 30000)
  afterAll(async () => { await db?.$disconnect() })
  it('reaches products beyond fifty, filters before paging, sorts globally and preserves global counts', async () => {
    const filters = { keyword: `${fixture.tag}-catalog`, status: 'ACTIVE' as const, sort: 'title_asc', limit: 50 }
    const first = await repo.findProducts({ ...filters, page: 1 })
    const second = await repo.findProducts({ ...filters, page: 2 })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(11)
    expect(second.meta.totalCount).toBe(61)
    expect(second.data[0]?.title).toBe(`${fixture.tag}-catalog-050`)
    expect(new Set([...first.data, ...second.data].map(row => row.id)).size).toBe(61)
    expect(second.data[0]?.variants[0]?.price).toBe(9007199254740993n)
    expect((await repo.findProducts({ ...filters, page: 3 })).data).toEqual([])
    expect(await repo.countProductStatuses()).toEqual({ active: before.active + 62, draft: before.draft + 2, archived: before.archived + 3 })
  })
  it('searches shop identity only in the administrative scope', async () => {
    const name = `shop-name-only-${fixture.tag}`
    await db.shop.update({ where: { id: fixture.shop.id }, data: { name } })
    expect((await repo.findProducts({ keyword: name, limit: 10, searchShops: true })).meta.totalCount).toBe(67)
    expect((await repo.findProducts({ keyword: name, limit: 10 })).meta.totalCount).toBe(0)
    expect((await repo.findProducts({ keyword: name, limit: 10, searchShops: true, sort: 'price_asc' })).meta.totalCount).toBe(67)
    for (const sort of ['title_asc', 'price_asc']) {
      expect((await repo.findProducts({ keyword: `${name}%`, limit: 10, searchShops: true, sort })).meta.totalCount).toBe(0)
    }
    const literal = `${fixture.tag}_literal%`
    await db.product.update({ where: { id: fixture.product.id }, data: { title: literal } })
    for (const sort of ['title_asc', 'price_asc']) {
      expect((await repo.findProducts({ keyword: literal, limit: 10, searchShops: true, sort })).data.map(row => row.id)).toEqual([fixture.product.id])
    }
  })
})
