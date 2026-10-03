import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { PrismaCheckoutRepository, type CheckoutCommitmentInput } from '#server/modules/checkout/checkout.repository.ts'
import { JobService } from './job.service.ts'
import { PrismaJobRepository } from './job.repository.ts'
import { createJobWorker, ensureRecurringJobSchedulers } from './job.registry.ts'
import { OptionalQueueProducer } from '#server/modules/queue/queue.producer.ts'
import type { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'

// Dedicated local Redis instance only: the production queue name is deliberately
// retained so the application's scheduler and worker factories are exercised.
const url = process.env.QUEUE_TEST_DATABASE_URL
const redisUrl = process.env.QUEUE_TEST_REDIS_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url || !redisUrl)('expiry scheduler with real Redis and PostgreSQL', () => {
  let prisma: PrismaClient
  let queue: Queue | undefined
  let worker: Worker | undefined
  let admin: Redis | undefined
  beforeAll(async () => {
    const database = new URL(url!)
    const redis = new URL(redisUrl!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    if (!['localhost', '127.0.0.1'].includes(redis.hostname) || !redis.port || redis.port === '6379' || !/^\/[1-9]\d*$/.test(redis.pathname)) {
      throw new Error('Use a dedicated local Redis instance on a nonstandard port and explicit nonzero database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    admin = new Redis(redisUrl!, { maxRetriesPerRequest: 1 })
    // Refuse to join or consume somebody else's existing queue. Never FLUSHDB.
    expect(await admin.keys('bull:marketplace-jobs:*')).toEqual([])
  })
  afterAll(async () => {
    if (worker) {
      await worker.close()
      ;(await worker.client).disconnect()
    }
    if (queue) {
      await queue.removeJobScheduler('release-expired-payment-stock')
      await queue.removeJobScheduler('cleanup-abandoned-carts')
      await queue.obliterate({ force: true })
      await queue.close()
      ;(await queue.client).disconnect()
    }
    admin?.disconnect()
    await prisma?.$disconnect()
  })
  async function fixture() {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Commerce test', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Test shop', slug: tag, contactEmail: user.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Test item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price: 1000, inventory: { create: { quantityOnHand: 10 } } } })
    const cart = await prisma.cart.create({ data: { userId: user.id, items: { create: { variantId: variant.id, quantity: 6, unitPrice: 1000 } } } })
    const address = await prisma.address.create({ data: { userId: user.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const repo = new PrismaCheckoutRepository(context, prisma)
    const snapshot = (await repo.findCartForCheckout(cart.id))!
    const input: CheckoutCommitmentInput = {
      cartId: cart.id, userId: user.id, orderNumber: tag, checkoutExpiresAt: new Date(Date.now() + 60000), address,
      paymentProvider: 'mock', acceptedQuote: {
        items: snapshot.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
        totals: { subtotal: 6000, discountTotal: 0, shippingTotal: 0, taxTotal: 0, grandTotal: 6000, currency: 'THB' },
        couponDiscount: 0, couponShopId: null, coinDiscount: 0, freeShippingShopIds: [],
      },
    }
    return { user, shop, variant, cart, repo, input }
  }

  it('scheduled worker expires checkout and every shop order, then repeats without releasing stock twice', async () => {
    const { repo, input, variant } = await fixture()
    const result = await repo.transaction((tx) => tx.commitCheckout(input))
    await prisma.checkout.update({ where: { id: result.checkoutId }, data: { expiresAt: new Date(0) } })
    const config = { redisUrl: redisUrl!, concurrency: 1, attempts: 1, skipRedisVersionCheck: process.env.QUEUE_TEST_ALLOW_OLD_REDIS === 'true' }
    const jobService = new JobService(context, new PrismaJobRepository(context, prisma), new OptionalQueueProducer(null))
    // Worker only consumes these two container members; both are real dependencies
    // except the logger. Unrelated HTTP/domain services are intentionally absent.
    const container = { appContext: context, jobService } satisfies Pick<ServiceContainer, 'appContext' | 'jobService'>
    worker = createJobWorker(container as unknown as ServiceContainer, config)
    await worker.waitUntilReady()
    queue = await ensureRecurringJobSchedulers(config)
    await expect.poll(async () => (await prisma.order.findUniqueOrThrow({ where: { id: result.order.id } })).status, { timeout: 70000, interval: 200 }).toBe('CANCELED')
    const shopOrders = await prisma.shopOrder.findMany({ where: { orderId: result.order.id } })
    expect(shopOrders).toHaveLength(1)
    expect(shopOrders.every((order) => order.status === 'CANCELED')).toBe(true)
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.payment.id } })).toMatchObject({ status: 'CANCELED' })
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    const repeat = await queue.add('release_expired_payment_stock', {})
    await expect.poll(() => repeat.getState(), { timeout: 10000, interval: 100 }).toBe('completed')
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect(await repeat.getState()).toBe('completed')
  }, 85000)
})


