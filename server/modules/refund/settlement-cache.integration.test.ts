import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { CacheInvalidation, CacheService } from '#server/modules/cache'
import { createRedisCacheClient } from '#server/modules/cache/cache.client.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import { PrismaRecommendationRepository } from '#server/modules/recommendation/recommendation.repository.ts'
import { SearchService } from '#server/modules/search/search.service.ts'
import { PrismaSearchRepository } from '#server/modules/search/search.repository.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { PrismaRefundRepository } from './refund.repository.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const redisUrl = process.env.CACHE_TEST_REDIS_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl || !redisUrl)('settlement cancellation cache on PostgreSQL and Redis', () => {
  let prisma: PrismaClient
  let client: NonNullable<ReturnType<typeof createRedisCacheClient>>
  let cache: CacheService
  const prefix = `settlement-cache-test-${randomUUID()}`
  beforeAll(() => {
    if (!databaseUrl || !redisUrl) throw new Error('Test database and Redis URLs are required')
    const database = new URL(databaseUrl)
    const redis = new URL(redisUrl)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/marketplace_test_')
      || !['localhost', '127.0.0.1'].includes(redis.hostname) || !redis.port || redis.port === '6379' || !/^\/[1-9]\d*$/.test(redis.pathname)) {
      throw new Error('Use disposable local PostgreSQL and nonstandard-port Redis with a nonzero DB')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
    const config = { enabled: true, redisUrl, keyPrefix: prefix, defaultTtlSeconds: 300, productTtlSeconds: 300, searchTtlSeconds: 300, sellerDashboardTtlSeconds: 300 }
    const redisClient = createRedisCacheClient(config)
    if (!redisClient) throw new Error('Redis cache client is required')
    client = redisClient
    cache = new CacheService(context, config, client)
  })
  afterAll(async () => {
    await cache?.deleteByPattern(`${prefix}:*`)
    if (client) expect(await client.keys(`${prefix}:*`)).toEqual([])
    await client?.quit?.()
    await prisma?.$disconnect()
  })

  async function warmEntry(pattern: string) {
    const keys = await client.keys(pattern)
    expect(keys).toHaveLength(1)
    const key = keys[0]
    if (!key) throw new Error(`Expected one warmed cache key for ${pattern}`)
    const value = await client.get(key)
    if (value === null) throw new Error(`Cache was not physically warmed: ${key}`)
    return { key, value }
  }

  it('refreshes warmed detail, discovery, search and affected seller caches on completion and replay', async () => {
    const tag = randomUUID()
    const buyer = await prisma.user.create({ data: { name: 'Cache buyer', email: `${tag}@example.test` } })
    const category = await prisma.category.create({ data: { name: 'Settlement cache', slug: tag } })
    const products = []
    for (let index = 0; index < 2; index++) {
      const owner = await prisma.user.create({ data: { name: 'Cache seller', email: `${randomUUID()}@example.test` } })
      const profile = await prisma.sellerProfile.create({ data: { userId: owner.id } })
      const shop = await prisma.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: 'Cache shop', slug: `${tag}-${index}`,
        status: 'ACTIVE', contactEmail: owner.email, contactPhone: '0800000000', settings: { create: { shippingFee: 500 } } } })
      const product = await prisma.product.create({ data: { shopId: shop.id, categoryId: category.id, title: `${tag} product ${index}`, slug: `${tag}-${index}`, status: 'ACTIVE' } })
      const variant = await prisma.productVariant.create({ data: { productId: product.id, title: 'Default', sku: `${tag}-${index}`, price: 10000n, inventory: { create: { quantityOnHand: 10 } } } })
      products.push({ shop, product, variant })
    }
    const canceled = products[0]
    const retained = products[1]
    if (!canceled || !retained) throw new Error('Both shop fixtures are required')
    const cart = await prisma.cart.create({ data: { userId: buyer.id, items: { create: products.map(({ variant }) => ({ variantId: variant.id, quantity: 1, unitPrice: 10000n })) } } })
    const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, prisma), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))), undefined, { provider: 'mock', mockEnabled: true })
    const order = await checkout.createCheckout(buyer, { cartId: cart.id, addressId: address.id, paymentMethod: 'card' })
    expect(order.totalCents).toBe(21000)
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma))
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true })
    await payments.handleWebhook({ provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid', orderId: order.orderId, paymentId: order.paymentId, amount: 21000 })
    const catalog = new CatalogService(context, new PrismaCatalogRepository(context, prisma), cache)
    const recommendations = new RecommendationService(context, new PrismaRecommendationRepository(context, prisma), cache)
    const search = new SearchService(context, new PrismaSearchRepository(context, prisma), cache)
    const readProducts = async () => ({ detail: await catalog.getPublicProductDetail(canceled.product.slug, 'en'),
      recommendations: await recommendations.getRelated(retained.product.id, { limit: 20 }), search: await search.searchProducts({ q: tag, limit: 20 }) })
    const before = await readProducts()
    expect(before.detail.variants[0]?.inventory).toMatchObject({ quantityOnHand: 9, quantityReserved: 0 })
    expect(before.detail.soldCount).toBe(1)
    expect(before.recommendations.items.find((item) => item.productId === canceled.product.id)).toMatchObject({ soldCount: 1, stock: 9 })
    expect(before.search.items.find((item) => item.productId === canceled.product.id)).toMatchObject({ soldCount: 1, variants: [expect.objectContaining({ stock: 9 })] })
    const detailEntry = await warmEntry(cache.keys.productDetail(canceled.product.id, 'en'))
    const recommendationEntry = await warmEntry(`${prefix}:money-v2:recommendations:*`)
    const searchEntry = await warmEntry(`${prefix}:money-v2:search:products:*`)
    const dashboardKey = cache.keys.sellerDashboard(canceled.shop.id)
    const insightsKey = cache.keys.sellerDashboardInsights(canceled.shop.id, { range: '7d' })
    const retainedDashboardKey = cache.keys.sellerDashboard(retained.shop.id)
    const unrelatedKey = `${prefix}:unrelated`
    for (const key of [dashboardKey, insightsKey, retainedDashboardKey, unrelatedKey]) {
      await cache.set(key, { marker: 'owned-test-cache' })
      expect(await cache.get(key)).toEqual({ marker: 'owned-test-cache' })
    }

    const processingAdmin = await prisma.user.create({ data: { name: 'Cache processor', role: 'ADMIN', email: `${randomUUID()}@example.test` } })
    const completingAdmin = await prisma.user.create({ data: { name: 'Cache completer', role: 'ADMIN', email: `${randomUUID()}@example.test` } })
    const admin = new AdminService(context, new PrismaAdminRepository(context, prisma), undefined, new PrismaRefundRepository(context, prisma), undefined, undefined, new CacheInvalidation(cache))
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId, shopId: canceled.shop.id } })
    const shopOrder = await prisma.shopOrder.findUniqueOrThrow({ where: { orderId_shopId: { orderId: order.orderId, shopId: canceled.shop.id } } })
    const refund = await admin.createSettlementRefund(processingAdmin, order.orderId, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [{ shopOrderId: shopOrder.id, cause: 'PRE_SHIPMENT_CANCEL' }] })
    expect(refund.amount).toBe(10500n)
    await admin.updateRefundStatus(processingAdmin, refund.id, { status: 'PROCESSING' })
    await admin.updateRefundStatus(completingAdmin, refund.id, { status: 'SUCCESS', externalReference: `CACHE-${refund.id}` })
    for (const key of [detailEntry.key, recommendationEntry.key, searchEntry.key, dashboardKey, insightsKey]) expect(await client.get(key)).toBeNull()
    expect(await cache.get(retainedDashboardKey)).toEqual({ marker: 'owned-test-cache' })
    expect(await cache.get(unrelatedKey)).toEqual({ marker: 'owned-test-cache' })

    const after = await readProducts()
    expect(after.detail.variants[0]?.inventory).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect(after.detail.soldCount).toBe(0)
    expect(after.recommendations.items.find((item) => item.productId === canceled.product.id)).toMatchObject({ soldCount: 0, stock: 10 })
    expect(after.search.items.find((item) => item.productId === canceled.product.id)).toMatchObject({ soldCount: 0, variants: [expect.objectContaining({ stock: 10 })] })
    expect(after.search.items.find((item) => item.productId === retained.product.id)).toMatchObject({ soldCount: 1, variants: [expect.objectContaining({ stock: 9 })] })

    for (const { key, value } of [detailEntry, recommendationEntry, searchEntry]) await client.set(key, value, 'EX', 300)
    await cache.set(dashboardKey, { marker: 'owned-test-cache' })
    await admin.updateRefundStatus(completingAdmin, refund.id, { status: 'SUCCESS', externalReference: `CACHE-${refund.id}` })
    for (const key of [detailEntry.key, recommendationEntry.key, searchEntry.key, dashboardKey]) expect(await client.get(key)).toBeNull()
    const replayed = await readProducts()
    expect(replayed.detail.variants[0]?.inventory?.quantityOnHand).toBe(10)
    expect(replayed.recommendations.items.find((item) => item.productId === canceled.product.id)?.soldCount).toBe(0)
    expect(replayed.search.items.find((item) => item.productId === canceled.product.id)?.soldCount).toBe(0)
    expect(await prisma.inventoryMovement.count({ where: { variantId: canceled.variant.id, type: 'RETURN_RESTOCK' } })).toBe(1)
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })).toMatchObject({ status: 'PAID', paymentStatus: 'SUCCEEDED' })
  })
})
