import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Product, type ProductVariant } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { PrismaRecommendationRepository } from '#server/modules/recommendation/recommendation.repository.ts'
import { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import { PrismaSearchRepository } from '#server/modules/search/search.repository.ts'
import { SearchService } from '#server/modules/search/search.service.ts'
import { PrismaProductAnalyticsRepository } from './product-analytics.repository.ts'
import { ProductAnalyticsService } from './product-analytics.service.ts'

const url = process.env['COMMERCE_TEST_DATABASE_URL']
const context: AppContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe.skipIf(!url)('numeric analytics and sold counts on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture() {
    const tag = randomUUID()
    const user = await db.user.create({ data: { name: 'Numeric seller', email: `${tag}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: user.id } })
    const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: tag, slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
    const products: Array<{ product: Product; variant: ProductVariant }> = []
    for (const [label, quantity] of [['A', 1], ['B', 2], ['C', 9]] as const) {
      const product = await db.product.create({ data: { shopId: shop.id, title: `${tag} ${label}`, slug: `${tag}-${label}`, status: 'ACTIVE', createdAt: new Date(`2026-10-0${4 - products.length}T00:00:00Z`) } })
      const variant = await db.productVariant.create({ data: { productId: product.id, sku: `${tag}-${label}`, title: label, price: 100n, status: 'ACTIVE' } })
      products.push({ product, variant })
      const cart = await db.cart.create({ data: { userId: user.id, status: 'CHECKED_OUT' } })
      const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: user.id, status: 'COMPLETED', subtotal: BigInt(quantity * 100), grandTotal: BigInt(quantity * 100), expiresAt: new Date('2026-10-04T01:00:00Z') } })
      const order = await db.order.create({ data: {
        checkoutId: checkout.id, userId: user.id, orderNumber: `${tag}-${label}`, status: 'PAID', paymentStatus: 'SUCCEEDED',
        subtotal: BigInt(quantity * 100), grandTotal: BigInt(quantity * 100), createdAt: new Date('2026-10-04T00:00:00Z'),
        shippingName: 'Numeric buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
      } })
      await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: `${tag}-${label}`, status: 'SUCCEEDED', amount: BigInt(quantity * 100), currency: 'THB' } })
      await db.orderItem.create({ data: {
        orderId: order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug,
        variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug,
        quantity, unitPrice: 100n, lineTotal: BigInt(quantity * 100), currency: 'THB',
      } })
    }
    return { tag, user, shop, products }
  }

  it('ranks paid revenue across pages independently of product creation order', async () => {
    const f = await fixture()
    const resolver = { resolveActiveShops: async () => [f.shop] } as unknown as ActiveShopResolver
    const service = new ProductAnalyticsService(context, new PrismaProductAnalyticsRepository(context, db), resolver)
    const actor = { id: f.user.id, role: 'USER' as const }
    const query = { range: 'custom' as const, from: '2026-10-04', to: '2026-10-04', page: 1, limit: 2, sort: 'revenue' }

    const products = await service.getProducts(actor, query)
    const nextProducts = await service.getProducts(actor, { ...query, page: 2 })
    const skus = await service.getSkus(actor, query)

    expect(products.items.map((item) => [item.productId, item.revenue])).toEqual([[f.products[2]!.product.id, 900], [f.products[1]!.product.id, 200]])
    expect(nextProducts.items.map((item) => [item.productId, item.revenue])).toEqual([[f.products[0]!.product.id, 100]])
    expect(skus.items.map((item) => [item.variantId, item.revenue])).toEqual([[f.products[2]!.variant.id, 900], [f.products[1]!.variant.id, 200]])
    expect(products.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 })
  })

  it('keeps recommendations and search sold counts equal when unpaid order items exist', async () => {
    const f = await fixture()
    const target = f.products[2]!
    for (const [status, quantity] of [['PENDING_PAYMENT', 5], ['CANCELED', 4]] as const) {
      const cart = await db.cart.create({ data: { userId: f.user.id, status: 'CHECKED_OUT' } })
      const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: f.user.id, expiresAt: new Date('2026-10-04T01:00:00Z') } })
      const order = await db.order.create({ data: { checkoutId: checkout.id, userId: f.user.id, orderNumber: `${f.tag}-${status}`, status, paymentStatus: 'PENDING', grandTotal: BigInt(quantity * 100), shippingName: 'Buyer', shippingLine1: 'Test', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
      await db.orderItem.create({ data: { orderId: order.id, shopId: f.shop.id, variantId: target.variant.id, productTitle: target.product.title, productSlug: target.product.slug, variantTitle: target.variant.title, variantSku: target.variant.sku, shopName: f.shop.name, shopSlug: f.shop.slug, quantity, unitPrice: 100n, lineTotal: BigInt(quantity * 100) } })
    }
    const recommendations = new RecommendationService(context, new PrismaRecommendationRepository(context, db))
    const search = new SearchService(context, new PrismaSearchRepository(context, db))

    const recommended = await recommendations.getRelated(f.products[0]!.product.id, { limit: 20 })
    const searched = await search.searchProducts({ q: f.tag, limit: 20 })

    expect(recommended.items.find((item) => item.productId === target.product.id)?.soldCount).toBe(9)
    expect(searched.items.find((item) => item.productId === target.product.id)?.soldCount).toBe(9)
    expect(await db.orderItem.count({ where: { variantId: target.variant.id } })).toBe(3)
  })
})
