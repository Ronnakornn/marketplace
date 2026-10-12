import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { Elysia } from 'elysia'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import type { AppContext, ServiceContainer } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { CacheInvalidation, CacheService } from '#server/modules/cache'
import type { CacheClient } from '#server/modules/cache/cache.types.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { createCatalogRoutes } from '#server/modules/catalog/catalog.routes.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { ActiveShopResolver, PrismaOwnershipGuardRepository } from '#server/modules/security'
import { permissionsForStaffRole } from '#server/modules/seller-shop/shop-staff.permissions.ts'
import { InventoryService } from './inventory.service.ts'
import { PrismaInventoryRepository } from './inventory.repository.ts'
import { createInventoryRoutes } from './inventory.routes.ts'

const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }))
vi.mock('#server/lib/prisma.ts', () => ({ get prisma() { return state.db } }))
vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context: AppContext = {
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

function memoryCache() {
  const store = new Map<string, string>()
  const client: CacheClient = {
    get: async key => store.get(key) ?? null,
    set: async (key, value) => { store.set(key, value); return 'OK' },
    del: async (...keys) => keys.filter(key => store.delete(key)).length,
    scan: async (_cursor, pattern) => {
      const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`)
      return ['0', [...store.keys()].filter(key => regex.test(key))]
    },
  }
  const cache = new CacheService(context, { enabled: true, redisUrl: 'memory-test', keyPrefix: randomUUID(),
    defaultTtlSeconds: 300, productTtlSeconds: 300, searchTtlSeconds: 300, sellerDashboardTtlSeconds: 300 }, client)
  return { cache, invalidation: new CacheInvalidation(cache) }
}

describe.skipIf(!databaseUrl)('composed inventory boundary on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a disposable local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
    state.db = db
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(reserved = 6) {
    const tag = randomUUID()
    const user = await db.user.create({ data: { name: 'Inventory owner', email: `${tag}@example.test`, emailVerified: true } })
    const profile = await db.sellerProfile.create({ data: { userId: user.id } })
    const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Inventory boundary',
      slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
    const product = await db.product.create({ data: { shopId: shop.id, title: 'Inventory boundary', slug: tag } })
    const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: tag, price: 1000,
      inventory: { create: { quantityOnHand: 10, quantityReserved: reserved } } } })
    const inventory = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })
    const cache = memoryCache()
    const resolver = new ActiveShopResolver(new PrismaOwnershipGuardRepository(context, db))
    const inventoryService = new InventoryService(context, new PrismaInventoryRepository(context, db), resolver, cache.invalidation)
    const catalogService = new CatalogService(context, new PrismaCatalogRepository(context, db), cache.cache, cache.invalidation,
      undefined, resolver)
    const container = { inventoryService, catalogService } as ServiceContainer
    const app = new Elysia().use(createCatalogRoutes(container)).use(createInventoryRoutes(container))
    vi.mocked(getAuthContext).mockResolvedValue({ user, session: { id: `test-session-${user.id}` } } as Awaited<ReturnType<typeof getAuthContext>>)
    const patch = (body: object) => app.handle(new Request(`http://localhost/api/seller/variants/${variant.id}/inventory`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }))
    return { user, shop, product, variant, inventory, ...cache, resolver, inventoryService, catalogService, patch, app }
  }

  async function unchanged(inventoryId: string, reserved = 6) {
    expect(await db.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).toMatchObject({
      quantityOnHand: 10, quantityReserved: reserved, version: 1,
    })
    expect(await db.inventoryMovement.count({ where: { inventoryId } })).toBe(0)
  }

  it('rejects reductions below held stock through the composed route', async () => {
    const data = await fixture()
    const response = await data.patch({ quantityOnHand: 5, reason: 'count' })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'INSUFFICIENT_STOCK' } })
    await unchanged(data.inventory.id)
  })

  it('sets stock exactly to held quantity and records one audited version', async () => {
    const data = await fixture()
    const response = await data.patch({ quantityOnHand: 6, quantityReserved: 99, reason: 'count' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ quantityOnHand: 6, quantityReserved: 6, availableStock: 0 })
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: 6, quantityReserved: 6, version: 2,
    })
    expect(await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })).toMatchObject([{
      type: 'ADJUSTMENT', quantityDelta: -4, quantityOnHandBefore: 10, quantityOnHandAfter: 6,
      quantityReservedBefore: 6, quantityReservedAfter: 6, actorUserId: data.user.id, reason: 'count',
      referenceType: 'SELLER_INVENTORY_UPDATE', referenceId: data.variant.id,
    }])
  })

  it('records metadata-only edits without changing physical stock', async () => {
    const data = await fixture()
    expect((await data.patch({ reorderLevel: 4, reason: 'threshold' })).status).toBe(200)
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: 10, quantityReserved: 6, reorderLevel: 4, version: 2,
    })
    expect(await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })).toMatchObject([{
      quantityDelta: 0, quantityOnHandBefore: 10, quantityOnHandAfter: 10,
    }])
  })

  it('accepts the largest stored stock without losing integer precision', async () => {
    const data = await fixture()
    const response = await data.patch({ quantityOnHand: 2_147_483_647, reason: 'maximum count' })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ quantityOnHand: 2_147_483_647, quantityReserved: 6, availableStock: 2_147_483_641 })
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: 2_147_483_647, quantityReserved: 6, version: 2,
    })
    expect(await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })).toMatchObject([{
      quantityDelta: 2_147_483_637, quantityOnHandBefore: 10, quantityOnHandAfter: 2_147_483_647,
    }])
  })

  it.each([{}, { quantityOnHand: 11 }, { quantityOnHand: -1, reason: 'count' },
    { quantityOnHand: 1.5, reason: 'count' }, { quantityOnHand: 2_147_483_648, reason: 'count' },
    { reorderLevel: 2_147_483_648, reason: 'count' }])('rejects invalid input before writes %j', async body => {
    const data = await fixture()
    const response = await data.patch(body)
    expect([400, 422]).toContain(response.status)
    await unchanged(data.inventory.id)
  })

  it('rejects an outsider with another active shop', async () => {
    const target = await fixture()
    await fixture()
    expect((await target.patch({ quantityOnHand: 12, reason: 'count' })).status).toBe(403)
    await unchanged(target.inventory.id)
  })

  it('enforces readiness before reading the target variant', async () => {
    const target = await fixture()
    const outsider = await db.user.create({ data: { name: 'No onboarding', email: `${randomUUID()}@example.test`, emailVerified: true } })
    vi.mocked(getAuthContext).mockResolvedValue({ user: outsider, session: { id: `test-session-${outsider.id}` } } as Awaited<ReturnType<typeof getAuthContext>>)
    const response = await target.patch({ quantityOnHand: 12, reason: 'count' })
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: { code: 'SELLER_ONBOARDING_REQUIRED' } })
    await unchanged(target.inventory.id)
  })

  it('rejects edits to a suspended shop', async () => {
    const target = await fixture()
    await db.shop.update({ where: { id: target.shop.id }, data: { status: 'SUSPENDED' } })
    const response = await target.patch({ quantityOnHand: 12, reason: 'count' })
    expect(response.status).toBe(403)
    await unchanged(target.inventory.id)
  })

  it.each(['MANAGER', 'WAREHOUSE', 'SUPPORT'] as const)('uses the accepted %s inventory permission', async role => {
    const target = await fixture()
    const user = await db.user.create({ data: { name: role, email: `${randomUUID()}@example.test`, emailVerified: true } })
    await db.shopStaff.create({ data: { shopId: target.shop.id, userId: user.id, role, status: 'ACTIVE',
      permissions: { create: permissionsForStaffRole(role).map(permission => ({ permission })) } } })
    vi.mocked(getAuthContext).mockResolvedValue({ user, session: { id: `test-session-${user.id}` } } as Awaited<ReturnType<typeof getAuthContext>>)
    const response = await target.patch({ quantityOnHand: 12, reason: 'count' })
    expect(response.status).toBe(role === 'SUPPORT' ? 403 : 200)
    if (role === 'SUPPORT') await unchanged(target.inventory.id)
    else {
      expect(await response.json()).toMatchObject({ quantityOnHand: 12, quantityReserved: 6, availableStock: 6 })
      expect(await db.inventoryMovement.findMany({ where: { inventoryId: target.inventory.id } })).toMatchObject([{
        quantityDelta: 2, actorUserId: user.id,
      }])
      const list = await target.app.handle(new Request('http://localhost/api/seller/inventory'))
      expect(list.status).toBe(200)
      expect(await list.json()).toMatchObject([{ variantId: target.variant.id, quantityOnHand: 12 }])
    }
  })

  it('rolls back stock and version when movement persistence fails', async () => {
    const data = await fixture()
    const key = data.cache.keys.productDetail(data.product.id)
    await data.cache.set(key, 'warm before failed edit')
    const instrumented = db.$extends({ query: { inventoryMovement: { async create() { throw new Error('movement unavailable') } } } })
    const service = new InventoryService(context, new PrismaInventoryRepository(context, instrumented as unknown as PrismaClient),
      data.resolver, data.invalidation)
    await expect(service.updateSellerInventory(data.user, data.variant.id, { quantityOnHand: 12, reason: 'count' }))
      .rejects.toThrow('movement unavailable')
    await unchanged(data.inventory.id)
    expect(await data.cache.get(key)).toBe('warm before failed edit')
  })

  it('validates direct service callers against the storage boundary', async () => {
    const data = await fixture()
    await expect(data.inventoryService.updateSellerInventory(data.user, data.variant.id,
      { quantityOnHand: 2_147_483_648, reason: 'count' }))
      .rejects.toMatchObject({ status: 400, code: 'INVENTORY_VALIDATION_FAILED' })
    await unchanged(data.inventory.id)
  })

  it('invalidates only affected detail and dashboard after a successful commit', async () => {
    const data = await fixture()
    const affected = [data.cache.keys.productDetail(data.product.id), data.cache.keys.sellerDashboard(data.shop.id)]
    const unrelated = [data.cache.keys.productDetail(randomUUID()), data.cache.keys.sellerDashboard(randomUUID())]
    for (const key of [...affected, ...unrelated]) await data.cache.set(key, 'warm')
    expect((await data.patch({ quantityOnHand: 5, reason: 'invalid' })).status).toBe(409)
    for (const key of affected) expect(await data.cache.get(key)).toBe('warm')
    expect((await data.patch({ quantityOnHand: 12, reason: 'count' })).status).toBe(200)
    for (const key of affected) expect(await data.cache.get(key)).toBeNull()
    for (const key of unrelated) expect(await data.cache.get(key)).toBe('warm')
  })

  function heldRead(inventoryId: string) {
    let release!: () => void
    let signal!: () => void
    const seen = new Promise<void>(resolve => { signal = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    let held = false
    const prisma = db.$extends({ query: { inventory: { async findUniqueOrThrow({ args, query }) {
      const result = await query(args)
      if (result?.id === inventoryId && !held) {
        held = true
        signal()
        await hold
      }
      return result
    } } } })
    return { prisma, seen, release }
  }

  it.each(['reservation', 'seller'] as const)('serializes held-stock edits when %s acquires the lock first', async first => {
    const data = await fixture(0)
    const cart = await db.cart.create({ data: { userId: data.user.id } })
    const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: data.user.id,
      expiresAt: new Date(Date.now() + 60_000) } })
    const barrier = heldRead(data.inventory.id)
    const heldService = new InventoryService(context, new PrismaInventoryRepository(context, barrier.prisma as unknown as PrismaClient),
      data.resolver, data.invalidation)
    const reserve = (service: InventoryService) => service.reserveStock({ variantId: data.variant.id, quantity: 6,
      checkoutId: checkout.id, expiresAt: checkout.expiresAt })
    const edit = (service: InventoryService) => service.updateSellerInventory(data.user, data.variant.id,
      { quantityOnHand: 5, reason: 'count' })
    const winner = first === 'reservation' ? reserve(heldService) : edit(heldService)
    await barrier.seen
    const loser = first === 'reservation' ? edit(data.inventoryService) : reserve(data.inventoryService)
    const pending = Promise.allSettled([winner, loser])
    barrier.release()
    const outcomes = await pending
    expect(outcomes[0].status).toBe('fulfilled')
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { status: 409, code: 'INSUFFICIENT_STOCK' } })
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: first === 'reservation' ? 10 : 5, quantityReserved: first === 'reservation' ? 6 : 0, version: 2,
    })
    expect(await db.inventoryReservation.count({ where: { checkoutId: checkout.id } })).toBe(first === 'reservation' ? 1 : 0)
    expect(await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })).toMatchObject([{
      type: first === 'reservation' ? 'RESERVATION_CREATED' : 'ADJUSTMENT',
      quantityDelta: first === 'reservation' ? 6 : -5,
      quantityOnHandBefore: 10, quantityOnHandAfter: first === 'reservation' ? 10 : 5,
      quantityReservedBefore: 0, quantityReservedAfter: first === 'reservation' ? 6 : 0,
    }])
  })

  it('records a complete stock and version chain under concurrent seller edits', async () => {
    const data = await fixture()
    const barrier = heldRead(data.inventory.id)
    const heldService = new InventoryService(context, new PrismaInventoryRepository(context, barrier.prisma as unknown as PrismaClient),
      data.resolver, data.invalidation)
    const first = heldService.updateSellerInventory(data.user, data.variant.id, { quantityOnHand: 12, reason: 'restock' })
    await barrier.seen
    const second = data.inventoryService.updateSellerInventory(data.user, data.variant.id, { quantityOnHand: 8, reason: 'count' })
    const pending = Promise.all([first, second])
    barrier.release()
    await pending
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: 8, quantityReserved: 6, version: 3,
    })
    expect(await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id }, orderBy: { createdAt: 'asc' } }))
      .toMatchObject([{ quantityDelta: 2, quantityOnHandBefore: 10, quantityOnHandAfter: 12 },
        { quantityDelta: -4, quantityOnHandBefore: 12, quantityOnHandAfter: 8 }])
  })

  it.each(['checkout', 'seller'] as const)('protects stock when real %s obtains the inventory lock first', async first => {
    const data = await fixture(0)
    await db.product.update({ where: { id: data.product.id }, data: { status: 'ACTIVE' } })
    const cart = await db.cart.create({ data: { userId: data.user.id,
      items: { create: { variantId: data.variant.id, quantity: 6, unitPrice: 1000 } } } })
    const address = await db.address.create({ data: { userId: data.user.id, recipientName: 'Buyer', line1: '1 Test Road',
      city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    let releaseCheckout!: () => void
    let signalReserved!: () => void
    let signalRead!: () => void
    const reserved = new Promise<void>(resolve => { signalReserved = resolve })
    const snapshotRead = new Promise<void>(resolve => { signalRead = resolve })
    const holdCheckout = new Promise<void>(resolve => { releaseCheckout = resolve })
    const checkoutClient = db.$extends({ query: {
      cart: { async findUnique({ args, query }) {
        const result = await query(args)
        if (args.where.id === cart.id) signalRead()
        return result
      } },
      inventoryReservation: { async create({ args, query }) {
        const result = await query(args)
        if (first === 'checkout') { signalReserved(); await holdCheckout }
        return result
      } },
    } })
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, checkoutClient as unknown as PrismaClient),
      new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, db))), undefined,
      { provider: 'mock', mockEnabled: true })
    const create = () => checkout.createCheckout(data.user, { cartId: cart.id, addressId: address.id, paymentMethod: 'card' })
    const sellerBarrier = heldRead(data.inventory.id)
    const seller = first === 'seller'
      ? new InventoryService(context, new PrismaInventoryRepository(context, sellerBarrier.prisma as unknown as PrismaClient),
        data.resolver, data.invalidation)
      : data.inventoryService
    const edit = () => seller.updateSellerInventory(data.user, data.variant.id, { quantityOnHand: 5, reason: 'count' })
    const winner = first === 'checkout' ? create() : edit()
    await (first === 'checkout' ? reserved : sellerBarrier.seen)
    const loser = first === 'checkout' ? edit() : create()
    const pending = Promise.allSettled([winner, loser])
    if (first === 'seller') await snapshotRead
    if (first === 'checkout') releaseCheckout()
    else sellerBarrier.release()
    const outcomes = await pending
    expect(outcomes[0].status).toBe('fulfilled')
    expect(outcomes[1]).toMatchObject({ status: 'rejected', reason: { status: 409, code: 'INSUFFICIENT_STOCK' } })
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: first === 'checkout' ? 10 : 5, quantityReserved: first === 'checkout' ? 6 : 0, version: 2,
    })
    const orders = await db.order.findMany({ where: { userId: data.user.id }, include: { payments: true } })
    expect(orders).toHaveLength(first === 'checkout' ? 1 : 0)
    if (first === 'checkout') expect(orders[0]).toMatchObject({ grandTotal: 6000n, payments: [{ amount: 6000n, status: 'PENDING' }] })
    expect(await db.inventoryReservation.count({ where: { inventoryId: data.inventory.id } })).toBe(first === 'checkout' ? 1 : 0)
    const movements = await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })
    expect(movements).toHaveLength(first === 'checkout' ? 0 : 1)
    if (first === 'seller') expect(movements[0]).toMatchObject({ quantityDelta: -5, quantityOnHandBefore: 10, quantityOnHandAfter: 5 })
  })
})
