import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCartRepository } from './cart.repository.ts'
import { CartService } from './cart.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('buy again on PostgreSQL', () => {
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
    const buyer = await prisma.user.create({ data: { name: 'Repurchase test', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: buyer.id } })
    const shop = await prisma.shop.create({ data: { ownerId: buyer.id, sellerProfileId: profile.id, name: 'Repurchase shop', slug: tag, contactEmail: buyer.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Current product', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price: 2500n, inventory: { create: { quantityOnHand: 10, quantityReserved: 2 } } } })
    const historicalCart = await prisma.cart.create({ data: { userId: buyer.id, status: 'CHECKED_OUT' } })
    const checkout = await prisma.checkout.create({ data: { userId: buyer.id, cartId: historicalCart.id, status: 'COMPLETED', expiresAt: new Date() } })
    const item = {
      shopId: shop.id, variantId: variant.id, productTitle: 'Historical product', productSlug: product.slug,
      variantTitle: 'Historical variant', variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug,
      unitPrice: 1000n, currency: 'THB',
    }
    const order = await prisma.order.create({
      data: { checkoutId: checkout.id, userId: buyer.id, orderNumber: tag, grandTotal: 3000n, status: 'DELIVERED', paymentStatus: 'SUCCEEDED',
        shippingName: 'Repurchase buyer', shippingLine1: '1 Test road', shippingCity: 'Bangkok', shippingPostalCode: '10100', shippingCountry: 'TH',
        items: { create: [{ ...item, quantity: 1, lineTotal: 1000n }, { ...item, quantity: 2, lineTotal: 2000n }] } },
      include: { items: true },
    })
    const service = new CartService(context, new PrismaCartRepository(context, prisma))
    return { buyer, shop, product, variant, order, item, service }
  }

  it('concurrent and retried requests aggregate historical SKUs without duplicate additions or stock/order changes', async () => {
    const f = await fixture()
    const results = await Promise.all(Array.from({ length: 5 }, () => f.service.buyAgain(f.buyer, f.order.id)))
    expect(results.flatMap(result => result.items).reduce((sum, item) => sum + item.addedQuantity, 0)).toBe(3)
    expect(results.map(result => result.items[0].finalQuantity)).toEqual([3, 3, 3, 3, 3])
    expect((await f.service.buyAgain(f.buyer, f.order.id)).items[0]).toMatchObject({ kind: 'already_in_cart', addedQuantity: 0, finalQuantity: 3 })
    const cart = await prisma.cart.findFirstOrThrow({ where: { userId: f.buyer.id, status: 'ACTIVE' }, include: { items: true } })
    expect(cart.items.map(item => [item.variantId, item.quantity, item.unitPrice, item.currency])).toEqual([[f.variant.id, 3, 2500n, 'THB']])
    expect(await prisma.cart.count({ where: { userId: f.buyer.id, status: 'ACTIVE' } })).toBe(1)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 2 })
    expect(await prisma.order.findUniqueOrThrow({ where: { id: f.order.id }, include: { items: true } })).toEqual(f.order)
    expect(await prisma.inventoryReservation.count({ where: { orderId: f.order.id } })).toBe(0)
    expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0)
  })

  it('preserves above-stock cart quantity, refreshes current money and skips unavailable variants in a partial batch', async () => {
    const f = await fixture()
    const cart = await prisma.cart.create({ data: { userId: f.buyer.id, items: { create: { variantId: f.variant.id, quantity: 4, unitPrice: 1000n, currency: 'USD' } } } })
    await prisma.inventory.update({ where: { variantId: f.variant.id }, data: { quantityOnHand: 3, quantityReserved: 1 } })
    const other = await prisma.productVariant.create({ data: { productId: f.product.id, sku: randomUUID(), title: 'Partial', price: 3000n, inventory: { create: { quantityOnHand: 4, quantityReserved: 3 } } } })
    const inactive = await prisma.productVariant.create({ data: { productId: f.product.id, sku: randomUUID(), title: 'Inactive', status: 'INACTIVE', price: 3500n, inventory: { create: { quantityOnHand: 10 } } } })
    await prisma.orderItem.createMany({ data: [
      { ...f.item, orderId: f.order.id, variantId: other.id, quantity: 2, lineTotal: 2000n },
      { ...f.item, orderId: f.order.id, variantId: inactive.id, quantity: 1, lineTotal: 1000n },
    ] })
    const result = await f.service.buyAgain(f.buyer, f.order.id)
    expect(result.items.find(item => item.variantId === f.variant.id)).toMatchObject({ kind: 'skipped', reason: 'EXISTING_QUANTITY_EXCEEDS_STOCK', finalQuantity: 4, addedQuantity: 0, unitPrice: 2500n, currency: 'THB' })
    expect(result.items.find(item => item.variantId === other.id)).toMatchObject({ kind: 'partial', reason: 'STOCK_LIMIT', finalQuantity: 1, addedQuantity: 1 })
    expect(result.items.find(item => item.variantId === inactive.id)).toMatchObject({ kind: 'skipped', reason: 'VARIANT_UNAVAILABLE', finalQuantity: 0 })
    expect(await prisma.cartItem.findUniqueOrThrow({ where: { cartId_variantId: { cartId: cart.id, variantId: f.variant.id } } })).toMatchObject({ quantity: 4, unitPrice: 2500n, currency: 'THB' })
    expect(await prisma.cartItem.findMany({ where: { cartId: cart.id, variantId: inactive.id } })).toEqual([])
  })

  it('rolls back an earlier real CartItem write when a later database operation fails', async () => {
    const f = await fixture()
    const other = await prisma.productVariant.create({ data: { productId: f.product.id, sku: randomUUID(), title: 'Second', price: 3000n, inventory: { create: { quantityOnHand: 10 } } } })
    await prisma.orderItem.create({ data: { ...f.item, orderId: f.order.id, variantId: other.id, quantity: 1, lineTotal: 1000n } })
    const ordered = await prisma.orderItem.findMany({ where: { orderId: f.order.id }, orderBy: { id: 'asc' } })
    const firstVariantId = ordered[0].variantId
    const failVariantId = ordered.find(item => item.variantId !== firstVariantId)!.variantId
    let successfulWrites = 0
    const instrumented = prisma.$extends({ query: { cartItem: { async create({ args, query }) {
      if (args.data.variantId === failVariantId) throw new Error('Injected second database write failure')
      const result = await query(args)
      successfulWrites++
      return result
    } } } })
    const service = new CartService(context, new PrismaCartRepository(context, instrumented as unknown as PrismaClient))
    await expect(service.buyAgain(f.buyer, f.order.id)).rejects.toThrow('Injected second database write failure')
    expect(successfulWrites).toBe(1)
    expect(await prisma.cartItem.findMany({ where: { cart: { userId: f.buyer.id, status: 'ACTIVE' } } })).toEqual([])
    expect(await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({ status: 'DELIVERED', paymentStatus: 'SUCCEEDED', grandTotal: 3000n })
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 2 })
  })

  it('rejects foreign orders before creating or changing the requester cart', async () => {
    const f = await fixture()
    const stranger = await prisma.user.create({ data: { name: 'Other buyer', email: `${randomUUID()}@example.test` } })
    await expect(f.service.buyAgain(stranger, f.order.id)).rejects.toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' })
    expect(await prisma.cart.count({ where: { userId: stranger.id } })).toBe(0)
  })
})
