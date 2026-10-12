import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { numericThresholdFixture, thresholdContext, thresholdDatabase, thresholdProduct, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaProductAnalyticsRepository, type AnalyticsRankingMetric } from './product-analytics.repository.ts'
import { ProductAnalyticsService, type ProductAnalyticsProductMetric, type ProductAnalyticsSkuMetric } from './product-analytics.service.ts'

const range = { from: new Date('2026-10-03T17:00:00.000Z'), to: new Date('2026-10-04T16:59:59.999Z') }
const query = { range: 'custom', from: '2026-10-04', to: '2026-10-04' } as const
const productSorts = ['views', 'addToCart', 'orders', 'unitsSold', 'revenue', 'conversionRate', 'title'].flatMap((key) => [key, `-${key}`])
const skuSorts = ['addToCart', 'orders', 'unitsSold', 'revenue', 'sku'].flatMap((key) => [key, `-${key}`])

function compare(a: Record<string, unknown>, b: Record<string, unknown>, sort: string, label: string, id: string) {
  const key = sort.startsWith('-') ? sort.slice(1) : sort
  const av = a[key]
  const bv = b[key]
  const value = typeof av === 'bigint' && typeof bv === 'bigint' ? av < bv ? -1 : av > bv ? 1 : 0
    : typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : Number(av ?? 0) - Number(bv ?? 0)
  return value ? (sort.startsWith('-') || key !== label ? -value : value) : String(a[id]).localeCompare(String(b[id]))
}

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('bounded analytics ranking differential on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaProductAnalyticsRepository
  let service: ProductAnalyticsService
  let fixture: Awaited<ReturnType<typeof numericThresholdFixture>>
  let expectedProducts: ProductAnalyticsProductMetric[]
  let expectedSkus: ProductAnalyticsSkuMetric[]

  beforeAll(async () => {
    db = thresholdDatabase()
    repo = new PrismaProductAnalyticsRepository(thresholdContext, db)
    fixture = await numericThresholdFixture(db)
    service = new ProductAnalyticsService(thresholdContext, repo, { resolveActiveShops: async () => [fixture.shop] } as unknown as ActiveShopResolver)
    const labels = ['A', 'a', 'é', 'e\u0301', 'a\u200b', 'Z', 'กำ', 'ก\u0e4d\u0e32', '零', 'No activity']
    const rows = [{ product: fixture.product, variant: fixture.variant }]
    for (let index = 1; index < labels.length; index += 1) rows.push(await thresholdProduct(db, fixture, { price: 100n, status: index === 9 ? 'DRAFT' : 'ACTIVE', variantStatus: index === 8 ? 'INACTIVE' : 'ACTIVE' }))
    for (const [index, row] of rows.entries()) {
      await db.product.update({ where: { id: row.product.id }, data: { title: labels[index]!, slug: `label-${index}` } })
      await db.productVariant.update({ where: { id: row.variant.id }, data: { sku: labels[index]!, currency: index === 9 ? 'JPY' : 'THB' } })
      if (index < 9) {
        await db.productViewLog.createMany({ data: Array.from({ length: index * 2 }, () => ({ productId: row.product.id, shopId: fixture.shop.id, createdAt: range.from })) })
        await db.productAddToCartLog.createMany({ data: Array.from({ length: index % 4 }, () => ({ productId: row.product.id, variantId: row.variant.id, shopId: fixture.shop.id, quantity: index + 1, createdAt: range.to })) })
      }
    }
    const maximum = 9223372036854775807n
    const first = await thresholdSale(db, fixture, { ...rows[0]!, amount: maximum, createdAt: range.from })
    await thresholdSale(db, fixture, { ...rows[0]!, amount: maximum, createdAt: range.to })
    await thresholdSale(db, fixture, { ...rows[1]!, amount: maximum })
    await thresholdSale(db, fixture, { ...rows[1]!, amount: maximum - 1n })
    await db.payment.create({ data: { orderId: first.order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount: 1n, currency: 'USD' } })
    await db.orderItem.create({ data: { ...first.item, id: randomUUID(), variantId: rows[2]!.variant.id, quantity: 3, unitPrice: 7n, lineTotal: 21n, currency: 'USD' } })
    const extraVariant = await db.productVariant.create({ data: { productId: rows[2]!.product.id, sku: 'Extra', title: 'Extra', price: 100n, currency: 'EUR' } })
    await db.orderItem.create({ data: { ...first.item, id: randomUUID(), variantId: extraVariant.id, quantity: 2, unitPrice: 7n, lineTotal: 14n } })
    await db.orderItem.create({ data: { ...first.item, id: randomUUID(), variantId: rows[2]!.variant.id, quantity: 1, unitPrice: 7n, lineTotal: 7n, currency: 'THB' } })
    const mixed = await thresholdSale(db, fixture, { ...rows[3]! })
    await db.orderItem.update({ where: { id: mixed.item.id }, data: { currency: 'USD' } })
    const canceled = await thresholdSale(db, fixture, { ...rows[3]!, amount: 999n })
    await db.orderItem.update({ where: { id: canceled.item.id }, data: { fulfillmentStatus: 'CANCELED' } })
    for (const status of ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED'] as const) await thresholdSale(db, fixture, { ...rows[4]!, status, amount: 10n })
    const shopCanceled = await thresholdSale(db, fixture, { ...rows[5]! })
    await db.shopOrder.update({ where: { id: shopCanceled.shopOrder.id }, data: { status: 'CANCELED', fulfillmentStatus: 'CANCELED' } })
    await thresholdSale(db, fixture, { ...rows[5]!, status: 'CANCELED', amount: 555n })
    await thresholdSale(db, fixture, { ...rows[5]!, paymentStatus: 'PENDING', amount: 555n })
    await thresholdSale(db, fixture, { ...rows[5]!, paymentState: 'FAILED', amount: 555n })
    await thresholdSale(db, fixture, { ...rows[5]!, amount: 555n, createdAt: new Date(range.from.getTime() - 1) })
    await thresholdSale(db, fixture, { ...rows[5]!, amount: 555n, createdAt: new Date(range.to.getTime() + 1) })
    await db.productViewLog.createMany({ data: [new Date(range.from.getTime() - 1), new Date(range.to.getTime() + 1)].map((createdAt) => ({ shopId: fixture.shop.id, productId: rows[5]!.product.id, createdAt })) })
    const deleted = await thresholdProduct(db, fixture, { price: 100n })
    await thresholdSale(db, fixture, deleted)
    await db.product.update({ where: { id: deleted.product.id }, data: { deletedAt: new Date() } })
    const other = await numericThresholdFixture(db)
    await thresholdSale(db, other)

    const products = await db.product.findMany({ where: { shopId: fixture.shop.id, deletedAt: null }, select: { id: true } })
    const variants = await db.productVariant.findMany({ where: { product: { shopId: fixture.shop.id, deletedAt: null } }, select: { id: true } })
    const [views, carts, sales, details, variantDetails] = await Promise.all([
      repo.countProductViews([fixture.shop.id], range), repo.countProductAddToCart([fixture.shop.id], range), repo.findPaidOrderItems([fixture.shop.id], range),
      repo.findProductsByIds([fixture.shop.id], products.map((product) => product.id)), repo.findVariantsByIds([fixture.shop.id], variants.map((variant) => variant.id)),
    ])
    function totals(id: string, sku: boolean): Omit<AnalyticsRankingMetric, 'id'> {
      const productSales = sales.filter((item) => (sku ? item.variantId : item.variant.productId) === id)
      const productCarts = carts.filter((item) => (sku ? item.variantId : item.productId) === id)
      const currencies = new Set(productSales.map((item) => item.currency))
      const viewCount = sku ? 0 : views.filter((item) => item.productId === id).reduce((sum, item) => sum + item.count, 0)
      const orders = new Set(productSales.map((item) => item.order.id)).size
      return { views: viewCount, addToCart: productCarts.reduce((sum, item) => sum + item.count, 0), addToCartQuantity: productCarts.reduce((sum, item) => sum + item.quantity, 0), orders, unitsSold: productSales.reduce((sum, item) => sum + item.quantity, 0), revenue: productSales.reduce((sum, item) => sum + item.lineTotal, 0n), conversionRate: viewCount ? orders / viewCount : 0, currency: currencies.size === 1 ? [...currencies][0]! : null }
    }
    expectedProducts = details.map((product) => {
      const { addToCartQuantity: _quantity, ...metrics } = totals(product.id, false)
      return { productId: product.id, title: product.title, slug: product.slug, status: product.status, coverImage: product.images[0]?.url ?? null, shop: product.shop, ...metrics }
    })
    expectedSkus = variantDetails.map((variant) => {
      const { conversionRate: _conversion, currency, ...metrics } = totals(variant.id, true)
      return { variantId: variant.id, productId: variant.productId, productTitle: variant.product.title, productSlug: variant.product.slug, sku: variant.sku, title: variant.title, status: variant.status, ...metrics, currency: currency ?? variant.currency }
    })
  }, 30_000)
  afterAll(async () => { await db?.$disconnect() })

  it.each(productSorts)('matches legacy product metrics, locale ties and page/count for %s', async (sort) => {
    const sorted = [...expectedProducts].sort((a, b) => compare(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, sort, 'title', 'productId'))
    for (const page of [1, 2, 4, 5]) {
      const result = await service.getProducts(fixture.owner, { ...query, sort, page, limit: 3 })
      expect(result.items).toEqual(sorted.slice((page - 1) * 3, page * 3))
      expect(result.pagination).toEqual({ page, limit: 3, total: sorted.length, totalPages: Math.ceil(sorted.length / 3) })
    }
  })

  it.each(skuSorts)('matches legacy SKU metrics, currency fallback and page/count for %s', async (sort) => {
    const sorted = [...expectedSkus].sort((a, b) => compare(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, sort, 'sku', 'variantId'))
    for (const page of [1, 2, 4, 5]) {
      const result = await service.getSkus(fixture.owner, { ...query, sort, page, limit: 3 })
      expect(result.items).toEqual(sorted.slice((page - 1) * 3, page * 3))
      expect(result.pagination.total).toBe(sorted.length)
    }
  })

  it('retains exact sums, distinct-order counts, paid evidence, cancellations and zero-activity candidates', async () => {
    const products = await service.getProducts(fixture.owner, { ...query, limit: 100 })
    expect(products.items.filter((item) => item.revenue > 9223372036854775807n).map((item) => item.revenue)).toEqual([18446744073709551614n, 18446744073709551613n])
    expect(products.items.find((item) => item.title === 'é')).toMatchObject({ orders: 1, unitsSold: 6, revenue: 42n, currency: null })
    expect(products.items.find((item) => item.title === 'Z')).toMatchObject({ orders: 1, unitsSold: 1, revenue: 100n, views: 10 })
    expect(products.items.find((item) => item.title === 'No activity')).toMatchObject({ status: 'DRAFT', orders: 0, revenue: 0n, currency: null })
    expect(products.pagination.total).toBe(10)
  })

  it('applies title/slug and product scopes without admitting another seller', async () => {
    expect((await service.getProducts(fixture.owner, { ...query, q: ' LABEL-5 ' })).items).toEqual(expectedProducts.filter((item) => item.slug === 'label-5'))
    const productId = expectedProducts.find((item) => item.title === 'é')!.productId
    const skus = await service.getSkus(fixture.owner, { ...query, productId, limit: 100 })
    expect(skus.items).toEqual(expectedSkus.filter((item) => item.productId === productId).sort((a, b) => compare(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, 'revenue', 'sku', 'variantId')))
    expect((await service.getProducts(fixture.owner, { ...query, q: 'no-such-title' })).pagination.total).toBe(0)
    expect((await service.getSkus(fixture.owner, { ...query, productId: randomUUID() })).pagination.total).toBe(0)
  })

  it('returns bounded metric rows and hydrates only selected IDs with more than 500 candidates', async () => {
    const f = await numericThresholdFixture(db)
    const ids = Array.from({ length: 500 }, () => randomUUID())
    await db.product.createMany({ data: ids.map((id) => ({ id, shopId: f.shop.id, title: 'Zero', slug: id, status: 'ACTIVE' })) })
    const scopedService = new ProductAnalyticsService(thresholdContext, repo, { resolveActiveShops: async () => [f.shop] } as unknown as ActiveShopResolver)
    const rawSpy = vi.spyOn(db, '$queryRaw')
    const detailSpy = vi.spyOn(repo, 'findProductsByIds')
    try {
      const result = await scopedService.getProducts(f.owner, { ...query, sort: 'revenue', limit: 3 })
      expect(result.pagination).toEqual({ page: 1, limit: 3, total: 501, totalPages: 167 })
      expect(result.items).toHaveLength(3)
      expect(detailSpy).toHaveBeenCalledWith([f.shop.id], result.items.map((item) => item.productId))
      expect(rawSpy).toHaveBeenCalledTimes(1)
      const rows = await rawSpy.mock.results[0]!.value
      expect(rows).toHaveLength(3)
      expect(rows[0].total).toBe('501')
    } finally {
      rawSpy.mockRestore()
      detailSpy.mockRestore()
    }
  })
})
