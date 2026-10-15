import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCartRepository } from './cart.repository.ts'
import { CartService } from './cart.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('active cart creation on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })
  async function fixture() {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Commerce test', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Test shop', slug: tag, contactEmail: user.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Test item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price: 1000n, inventory: { create: { quantityOnHand: 10 } } } })
    return { user, variant }
  }
  it('concurrent first visits share one cart and later reads retain items added to it', async () => {
    const { user, variant } = await fixture()
    const visits = 6
    let reads = 0
    let release!: () => void
    const initialReads = new Promise<void>((resolve) => { release = resolve })
    // Force the actual empty SELECTs to overlap; retain all real query results.
    // The post-lock recheck is deliberately outside this first-read barrier.
    const synchronized = prisma.$extends({ query: { cart: { async findFirst({ args, query }) {
      const result = await query(args)
      if (args.where?.userId === user.id && reads < visits) {
        reads += 1
        if (reads === visits) release()
        await initialReads
      }
      return result
    } } } }) as unknown as PrismaClient
    const repo = new PrismaCartRepository(context, synchronized)
    const carts = await Promise.all(Array.from({ length: visits }, () => repo.findOrCreateActiveCart(user.id)))
    expect(new Set(carts.map((cart) => cart.id)).size).toBe(1)
    expect(await prisma.cart.count({ where: { userId: user.id, status: 'ACTIVE' } })).toBe(1)
    await repo.createItem({ cartId: carts[0]!.id, variantId: variant.id, quantity: 2, unitPrice: 1000n, currency: 'THB' })
    const followingRead = await repo.findOrCreateActiveCart(user.id)
    expect(followingRead.id).toBe(carts[0]!.id)
    expect(followingRead.items).toEqual([expect.objectContaining({ variantId: variant.id, quantity: 2 })])
  })

  it.each([0, 1])('preserves both concurrent additions with initial variant quantity %i', async initialQuantity => {
    const { user, variant } = await fixture()
    if (initialQuantity > 0) await prisma.cart.create({ data: {
      userId: user.id, items: { create: { variantId: variant.id, quantity: 1, unitPrice: 1000n } },
    } })
    let firstRead!: () => void
    let secondRead!: () => void
    let release!: () => void
    const firstSeen = new Promise<void>(resolve => { firstRead = resolve })
    const secondSeen = new Promise<void>(resolve => { secondRead = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    let reads = 0
    const instrumented = prisma.$extends({ query: { productVariant: { async findUnique({ args, query }) {
      const value = await query(args)
      if (args.where.id === variant.id) {
        reads++
        if (reads === 1) firstRead()
        else secondRead()
        await hold
      }
      return value
    } } } })
    const cartService = new CartService(context, new PrismaCartRepository(context, instrumented as unknown as PrismaClient))
    const first = cartService.addItem(user, { variantId: variant.id, quantity: 1 })
    await firstSeen
    const second = cartService.addItem(user, { variantId: variant.id, quantity: 1 })
    const pending = Promise.allSettled([first, second])
    await Promise.race([secondSeen, new Promise(resolve => setTimeout(resolve, 200))])
    release()
    expect((await pending).map(result => result.status)).toEqual(['fulfilled', 'fulfilled'])
    const cart = await prisma.cart.findFirstOrThrow({ where: { userId: user.id, status: 'ACTIVE' } })
    expect(await prisma.cartItem.count({ where: { cartId: cart.id, variantId: variant.id } })).toBe(1)
    expect(await prisma.cartItem.findUniqueOrThrow({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } } }))
      .toMatchObject({ quantity: initialQuantity === 0 ? 2 : 3 })
    expect((await cartService.getCart(user)).subtotal).toBe(initialQuantity === 0 ? 2000n : 3000n)
  })

  it('rejects the second concurrent addition when combined quantity exceeds stock', async () => {
    const { user, variant } = await fixture()
    await prisma.inventory.update({ where: { variantId: variant.id }, data: { quantityOnHand: 1 } })
    const service = new CartService(context, new PrismaCartRepository(context, prisma))
    const results = await Promise.allSettled([
      service.addItem(user, { variantId: variant.id, quantity: 1 }),
      service.addItem(user, { variantId: variant.id, quantity: 1 }),
    ])
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    const rejected = results.find(result => result.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toMatchObject({ code: 'CART_STOCK_UNAVAILABLE' })
    expect((await service.getCart(user)).subtotal).toBe(1000n)
  })

  it('acknowledges only the stock allowance across concurrent partial guest merges', async () => {
    const { user, variant } = await fixture()
    const service = new CartService(context, new PrismaCartRepository(context, prisma))
    await service.addItem(user, { variantId: variant.id, quantity: 2 })

    const results = await Promise.all([
      service.mergeGuestItem(user, { userId: user.id, variantId: variant.id, quantity: 6 }),
      service.mergeGuestItem(user, { userId: user.id, variantId: variant.id, quantity: 6 }),
    ])

    expect(results.map(result => result.addedQuantity).sort((left, right) => left - right)).toEqual([2, 6])
    const cart = await service.getCart(user)
    expect(cart.shops[0]!.items).toEqual([expect.objectContaining({ quantity: 10, unitPrice: 1000n })])
    expect(cart.subtotal).toBe(10000n)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } }))
      .toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
  })

  it('rejects an addition when its previously active cart checks out while waiting for the lock', async () => {
    const { user, variant } = await fixture()
    const cart = await prisma.cart.create({ data: { userId: user.id, items: { create: { variantId: variant.id, quantity: 1, unitPrice: 1000n } } } })
    let locked!: () => void
    let release!: () => void
    let read!: () => void
    const lockHeld = new Promise<void>(resolve => { locked = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    const initialRead = new Promise<void>(resolve => { read = resolve })
    const instrumented = prisma.$extends({ query: { cart: { async findFirst({ args, query }) {
      const result = await query(args)
      if (args.where?.userId === user.id) read()
      return result
    } } } })
    const checkoutWrite = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cart.id} FOR UPDATE`
      await tx.$queryRaw`SELECT "id" FROM "CartItem" WHERE "cartId" = ${cart.id} ORDER BY "id" FOR UPDATE`
      await tx.cart.update({ where: { id: cart.id }, data: { status: 'CHECKED_OUT' } })
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      locked()
      await hold
    })
    await lockHeld
    const service = new CartService(context, new PrismaCartRepository(context, instrumented as unknown as PrismaClient))
    const mutation = service.addItem(user, { variantId: variant.id, quantity: 1 }).then(value => ({ value }), error => ({ error }))
    await initialRead
    release()
    await checkoutWrite
    expect(await mutation).toMatchObject({ error: { status: 409, code: 'CART_STATE_CONFLICT' } })
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } })).toMatchObject({ status: 'CHECKED_OUT' })
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
  })

  it.each(['update', 'delete', 'clear'] as const)('%s waits for checkout locks and observes consumed cart items', async operation => {
    const { user, variant } = await fixture()
    const cart = await prisma.cart.create({ data: { userId: user.id, items: { create: { variantId: variant.id, quantity: 1, unitPrice: 1000n } } }, include: { items: true } })
    const item = cart.items[0]!
    let locked!: () => void
    let release!: () => void
    const lockHeld = new Promise<void>(resolve => { locked = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    const checkoutWrite = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cart.id} FOR UPDATE`
      await tx.$queryRaw`SELECT "id" FROM "CartItem" WHERE "cartId" = ${cart.id} ORDER BY "id" FOR UPDATE`
      locked()
      await hold
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    })
    await lockHeld
    const service = new CartService(context, new PrismaCartRepository(context, prisma))
    const mutation = operation === 'update' ? service.updateItem(user, item.id, { quantity: 2 })
      : operation === 'delete' ? service.deleteItem(user, item.id) : service.clearCart(user)
    let finished = false
    const observed = mutation.then(value => ({ value }), error => ({ error })).finally(() => { finished = true })
    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(finished).toBe(false)
    } finally { release() }
    await checkoutWrite
    const result = await observed
    if (operation === 'clear') expect(result).toMatchObject({ value: { subtotal: 0n } })
    else expect(result).toMatchObject({ error: { code: 'CART_ITEM_NOT_FOUND', status: 404 } })
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0)
  })
})
