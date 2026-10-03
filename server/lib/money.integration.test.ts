import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'
import { createWalletRoutes } from '#server/modules/wallet/wallet.routes.ts'
import { PrismaWalletRepository } from '#server/modules/wallet/wallet.repository.ts'
import { WalletService } from '#server/modules/wallet/wallet.service.ts'
import { CommissionService } from '#server/modules/commission/commission.service.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { CacheService } from '#server/modules/cache/cache.service.ts'
import { createRedisCacheClient, getCacheConfigFromEnv } from '#server/modules/cache/cache.client.ts'

const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('#server/modules/auth', async () => {
  const { Elysia } = await import('elysia')
  return { authPlugin: new Elysia().macro({
    withAuth: { resolve: () => ({ authContext: { user: { id: auth.userId, role: 'USER' } } }) },
    withSellerOperational: {},
  }) }
})

const url = process.env.COMMERCE_TEST_DATABASE_URL
const redisUrl = process.env.CACHE_TEST_REDIS_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url || !redisUrl)('exported Prisma, wallet HTTP and Redis exactness', () => {
  let prisma: typeof import('./prisma.ts')['prisma']
  let shopId: string
  let walletId: string
  let productId: string
  let variantId: string
  let cartId: string
  let addressId: string
  const tag = `money-${randomUUID()}`
  const cacheConfig = getCacheConfigFromEnv({ CACHE_ENABLED: 'true', REDIS_URL: redisUrl, CACHE_KEY_PREFIX: tag })
  const client = createRedisCacheClient(cacheConfig)
  let cache: CacheService

  beforeAll(async () => {
    if (!url || !redisUrl) throw new Error('Dedicated test URLs required')
    const database = new URL(url)
    const redis = new URL(redisUrl)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/marketplace_test_')
      || !['localhost', '127.0.0.1'].includes(redis.hostname) || redis.pathname !== '/14') throw new Error('Use local test DB and dedicated Redis DB14')
    process.env.DATABASE_URL = url
    prisma = (await import('./prisma.ts')).prisma
    auth.userId = (await prisma.user.create({ data: { name: tag, email: `${tag}@example.test` } })).id
    const profile = await prisma.sellerProfile.create({ data: { userId: auth.userId } })
    const shop = await prisma.shop.create({ data: { ownerId: auth.userId, sellerProfileId: profile.id, name: tag, slug: tag, contactEmail: `${tag}@example.test`, contactPhone: '0800000000', status: 'ACTIVE', wallet: { create: {} } }, include: { wallet: true } })
    shopId = shop.id
    walletId = shop.wallet!.id
    const product = await prisma.product.create({ data: { shopId, title: tag, slug: tag, status: 'ACTIVE' } })
    productId = product.id
    variantId = (await prisma.productVariant.create({ data: { productId, sku: tag, title: tag, price: 9007199254740993n, inventory: { create: { quantityOnHand: 10 } } } })).id
    cartId = (await prisma.cart.create({ data: { userId: auth.userId, items: { create: { variantId, quantity: 1, unitPrice: 9007199254740993n } } } })).id
    addressId = (await prisma.address.create({ data: { userId: auth.userId, recipientName: tag, line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })).id
    await prisma.walletLedgerEntry.createMany({ data: [9007199254740991n, 9007199254740991n, -1n].map((amount) => ({ walletId, shopId, type: 'manual_adjustment', amount, currency: 'THB' })) })
    cache = new CacheService(context, cacheConfig, client)
  })

  afterAll(async () => {
    if (cache) await cache.deleteByPattern(`${tag}:*`)
    await client?.quit?.()
    if (!prisma || !auth.userId) return
    await prisma.cart.deleteMany({ where: { id: cartId } })
    await prisma.address.deleteMany({ where: { id: addressId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.walletLedgerEntry.deleteMany({ where: { walletId } })
    await prisma.shopWallet.deleteMany({ where: { id: walletId } })
    await prisma.shop.deleteMany({ where: { id: shopId } })
    await prisma.sellerProfile.deleteMany({ where: { userId: auth.userId } })
    await prisma.user.deleteMany({ where: { id: auth.userId } })
    await prisma.$disconnect()
  })

  it('returns exact bigint and Date through exported callback and array transactions', async () => {
    const row = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })
    expect(row.price).toBe(9007199254740993n)
    expect(row.createdAt).toBeInstanceOf(Date)
    const callback = await prisma.$transaction((tx) => tx.productVariant.findUniqueOrThrow({ where: { id: variantId } }))
    expect(callback.price).toBe(9007199254740993n)
    const [array] = await prisma.$transaction([prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })])
    expect(array.price).toBe(9007199254740993n)
    await expect(prisma.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id: variantId }, data: { price: -1n } })
      throw new Error('rollback proof')
    })).rejects.toThrow('rollback proof')
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).price).toBe(9007199254740993n)
  })

  it('keeps the actual wallet aggregate and real route exact beyond MAX_SAFE', async () => {
    const repo = new PrismaWalletRepository(context, prisma)
    expect(await repo.sumLedger(walletId, 'THB')).toBe(18014398509481981n)
    const walletService = new WalletService(context, repo, new CommissionService(context))
    const app = new Elysia().use(createWalletRoutes({ walletService }))
    const result = await treaty(app).api.seller.wallet.get()
    const amount: string = result.data!.availableBalanceCents
    expect(amount).toBe('18014398509481981')
    expect(result.data).toMatchObject({ sellerDebtCents: '0', currency: 'THB' })
    const response = await app.handle(new Request('http://localhost/api/seller/wallet/transactions'))
    expect(response.status).toBe(200)
    expect((await response.json()).items.map((entry: { amount: string }) => entry.amount).sort()).toEqual(['-1', '9007199254740991', '9007199254740991'])
  })

  it('retains bigint and dates on a real Redis cache hit and isolates old keys', async () => {
    const key = cache.keys.productDetail(productId)
    expect(key).toContain(':money-v2:')
    const raw = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })
    await client!.set(`${tag}:legacy`, JSON.stringify({ price: 9007199254740992 }), 'EX', 60)
    const load = vi.fn(async () => raw)
    expect(await cache.remember(key, load)).toEqual(raw)
    const hit = await cache.remember(key, load)
    expect(hit.price).toBe(9007199254740993n)
    expect(hit.createdAt).toBeInstanceOf(Date)
    expect(load).toHaveBeenCalledTimes(1)
    expect(await client!.get(`${tag}:legacy`)).toBe('{"price":9007199254740992}')
  })

  it('rejects an unsafe stored checkout price before order, payment or inventory writes', async () => {
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, prisma), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))))
    await expect(checkout.createCheckout({ id: auth.userId, role: 'USER' }, { cartId, addressId, paymentMethod: 'card' })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED', status: 400 })
    expect(await prisma.order.count({ where: { userId: auth.userId } })).toBe(0)
    expect(await prisma.inventoryReservation.count({ where: { inventory: { variantId } } })).toBe(0)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
  })

  it('preserves a negative lifetime ledger and its exact debt at the real HTTP boundary', async () => {
    await prisma.walletLedgerEntry.create({ data: { walletId, shopId, type: 'manual_adjustment', amount: -18014398509481982n, currency: 'THB' } })
    const repo = new PrismaWalletRepository(context, prisma)
    expect(await repo.sumLedger(walletId, 'THB')).toBe(-1n)
    const walletService = new WalletService(context, repo, new CommissionService(context))
    const result = await treaty(new Elysia().use(createWalletRoutes({ walletService }))).api.seller.wallet.get()
    expect(result.data).toMatchObject({ availableBalanceCents: '-1', sellerDebtCents: '1' })
  })
})
