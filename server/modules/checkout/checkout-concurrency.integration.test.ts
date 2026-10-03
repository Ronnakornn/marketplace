import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository } from './checkout.repository.ts'
import { CheckoutService } from './checkout.service.ts'
import { CheckoutQuoteEvaluator } from './checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
describe.skipIf(!url)('checkout creation concurrency on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) throw new Error('Use a local disposable marketplace_test_* database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })
  function service(client = prisma) {
    return new CheckoutService(context, new PrismaCheckoutRepository(context, client), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))), undefined,
      { provider: 'mock', mockEnabled: true })
  }
  async function fixture() {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Checkout race', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Race shop', slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Race product', slug: tag, status: 'ACTIVE' } })
    const variants = await Promise.all([1, 2].map(i => prisma.productVariant.create({ data: { productId: product.id, title: `Variant ${i}`, sku: `${tag}-${i}`, price: 10000, inventory: { create: { quantityOnHand: 10 } } } })))
    const cart = await prisma.cart.create({ data: { userId: user.id, items: { create: variants.map(variant => ({ variantId: variant.id, quantity: 2, unitPrice: 10000 })) } }, include: { items: { orderBy: { createdAt: 'asc' } } } })
    const address = await prisma.address.create({ data: { userId: user.id, recipientName: user.name, line1: '1 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    return { user, cart, variants, input: { cartId: cart.id, cartItemIds: [cart.items[0]!.id], addressId: address.id, paymentMethod: 'card' } }
  }
  it('creates one order and payment for simultaneous checkout of the same selected cart items', async () => {
    const fixtureData = await fixture()
    let firstRead!: () => void
    let secondRead!: () => void
    let release!: () => void
    const firstSeen = new Promise<void>(resolve => { firstRead = resolve })
    const secondSeen = new Promise<void>(resolve => { secondRead = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    let reads = 0
    const instrumented = prisma.$extends({ query: { cart: { async findUnique({ args, query }) {
      const cart = await query(args)
      if (args.where.id === fixtureData.cart.id) {
        reads++
        if (reads === 1) { firstRead(); await hold }
        else secondRead()
      }
      return cart
    } } } })
    const checkout = service(instrumented as unknown as PrismaClient)
    const first = checkout.createCheckout(fixtureData.user, fixtureData.input)
    await firstSeen
    const second = checkout.createCheckout(fixtureData.user, fixtureData.input)
    const resultPromise = Promise.allSettled([first, second])
    // Old code reaches a second real SELECT while the first snapshot is paused.
    // Correct code blocks before reading. Bounded wait avoids a post-lock barrier.
    await Promise.race([secondSeen, new Promise(resolve => setTimeout(resolve, 200))])
    release()
    const results = await resultPromise
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { status: 404 } })
    const orders = await prisma.order.findMany({ where: { userId: fixtureData.user.id }, include: { payments: true, items: true } })
    expect(orders).toHaveLength(1)
    expect(orders[0]!.payments).toHaveLength(1)
    expect(orders[0]!.items).toHaveLength(1)
    expect(orders[0]!.items[0]!.quantity).toBe(2)
    expect((await prisma.inventory.findUniqueOrThrow({ where: { variantId: fixtureData.cart.items[0]!.variantId } })).quantityReserved).toBe(2)
    expect(await prisma.cartItem.count({ where: { cartId: fixtureData.cart.id } })).toBe(1)
  })
  it('allows separate selected items in one cart to be purchased concurrently', async () => {
    const data = await fixture()
    const checkout = service()
    const results = await Promise.all(data.cart.items.map(item => checkout.createCheckout(data.user, { ...data.input, cartItemIds: [item.id] })))
    expect(new Set(results.map(result => result.orderId)).size).toBe(2)
    expect(await prisma.cartItem.count({ where: { cartId: data.cart.id } })).toBe(0)
    expect((await prisma.cart.findUniqueOrThrow({ where: { id: data.cart.id } })).status).toBe('ACTIVE')
    // The active cart remains usable after checkout empties the selected items.
    await prisma.cartItem.create({ data: { cartId: data.cart.id, variantId: data.variants[0]!.id, quantity: 1, unitPrice: 10000 } })
    expect((await checkout.quoteCheckout(data.user, { cartId: data.cart.id })).grandTotal).toBe(10000)
  })

  it('serializes cart inserts and quantity edits while preserving unselected items', async () => {
    const data = await fixture()
    const newVariant = await prisma.productVariant.create({ data: { productId: data.variants[0]!.productId, title: 'Later addition', sku: randomUUID(), price: 10000 } })
    let read!: () => void
    let release!: () => void
    const readSeen = new Promise<void>(resolve => { read = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    const instrumented = prisma.$extends({ query: { cart: { async findUnique({ args, query }) {
      const cart = await query(args)
      if (args.where.id === data.cart.id) { read(); await hold }
      return cart
    } } } })
    const pendingCheckout = service(instrumented as unknown as PrismaClient).createCheckout(data.user, data.input)
    await readSeen
    let edited = false
    let inserted = false
    const pendingEdit = prisma.cartItem.update({ where: { id: data.cart.items[1]!.id }, data: { quantity: 3 } }).then(value => { edited = true; return value })
    const pendingInsert = prisma.cartItem.create({ data: { cartId: data.cart.id, variantId: newVariant.id, quantity: 1, unitPrice: 10000 } }).then(value => { inserted = true; return value })
    const allResults = Promise.allSettled([pendingCheckout, pendingEdit, pendingInsert])
    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(edited).toBe(false)
      expect(inserted).toBe(false)
    } finally { release() }
    expect((await allResults).every(result => result.status === 'fulfilled')).toBe(true)
    const [order, , added] = await Promise.all([pendingCheckout, pendingEdit, pendingInsert])
    expect((await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.orderId } })).quantity).toBe(2)
    expect((await prisma.cartItem.findUniqueOrThrow({ where: { id: data.cart.items[1]!.id } })).quantity).toBe(3)
    expect((await prisma.cartItem.findUniqueOrThrow({ where: { id: added.id } })).quantity).toBe(1)
  })
})
