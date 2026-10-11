import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { CheckoutService } from './checkout.service.ts'
import { PrismaCheckoutRepository } from './checkout.repository.ts'
import { CheckoutQuoteEvaluator } from './checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { JobService } from '#server/modules/jobs/job.service.ts'
import { PrismaJobRepository } from '#server/modules/jobs/job.repository.ts'
import { OptionalQueueProducer } from '#server/modules/queue/queue.producer.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('flash quota expiry on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) throw new Error('Use a local disposable marketplace_test_* database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(stockLimit = 1, perUserLimit = 1) {
    const tag = randomUUID()
    const buyer = await db.user.create({ data: { name: 'Flash buyer', email: `${tag}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: buyer.id } })
    const shop = await db.shop.create({ data: { ownerId: buyer.id, sellerProfileId: profile.id, name: tag, slug: tag, contactEmail: buyer.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await db.product.create({ data: { shopId: shop.id, title: tag, slug: tag, status: 'ACTIVE' } })
    const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: tag, price: 10000, inventory: { create: { quantityOnHand: 10 } } } })
    const sale = await db.flashSale.create({ data: { title: tag, status: 'ACTIVE', startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 600000), items: { create: { shopId: shop.id, productId: product.id, variantId: variant.id, originalPrice: 10000, salePrice: 8000, stockLimit, perUserLimit } } }, include: { items: true } })
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, db), new PaymentSettlement(new ShipmentService(context, new PrismaShipmentRepository(context, db))), undefined, undefined, { provider: 'mock', mockEnabled: true })
    const jobs = new JobService(context, new PrismaJobRepository(context, db), new OptionalQueueProducer(null))
    const purchase = async (actor = buyer, client = db) => {
      const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, client), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, db))), undefined, { provider: 'mock', mockEnabled: true })
      const address = await db.address.create({ data: { userId: actor.id, recipientName: actor.name, line1: '1 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
      const cart = await db.cart.create({ data: { userId: actor.id, items: { create: { variantId: variant.id, unitPrice: 10000, quantity: 1 } } } })
      return checkout.createCheckout(actor, { cartId: cart.id, addressId: address.id, paymentMethod: 'card' })
    }
    const first = await purchase()
    const order = await db.order.findUniqueOrThrow({ where: { id: first.orderId } })
    await db.checkout.update({ where: { id: order.checkoutId }, data: { expiresAt: new Date(0) } })
    await db.flashSaleReservation.updateMany({ where: { checkoutId: order.checkoutId }, data: { expiresAt: new Date(0) } })
    await db.inventoryReservation.updateMany({ where: { checkoutId: order.checkoutId }, data: { expiresAt: new Date(0) } })
    const paid = (result = first) => ({ provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid' as const, orderId: result.orderId, paymentId: result.paymentId, amount: result.totalCents })
    return { buyer, variant, sale, item: sale.items[0]!, order, first, purchase, payments, jobs, paid }
  }

  it.each([
    { stockLimit: 1, perUserLimit: 1, otherBuyer: false },
    { stockLimit: 1, perUserLimit: 2, otherBuyer: true },
    { stockLimit: 2, perUserLimit: 1, otherBuyer: false },
  ])('retains expired ACTIVE quota with $stockLimit global and $perUserLimit buyer limit', async ({ stockLimit, perUserLimit, otherBuyer }) => {
    const data = await fixture(stockLimit, perUserLimit)
    const actor = otherBuyer ? await db.user.create({ data: { name: 'Other buyer', email: `${randomUUID()}@example.test` } }) : data.buyer
    await expect(data.purchase(actor)).rejects.toMatchObject({ status: 409, code: 'CHECKOUT_FAILED' })
    expect(await db.flashSaleReservation.findMany({ where: { flashSaleItemId: data.item.id } })).toEqual([expect.objectContaining({ status: 'ACTIVE', quantity: 1 })])
    const event = data.paid()
    const responses = await Promise.all([data.payments.handleWebhook(event), data.payments.handleWebhook(event)])
    expect(responses.map(response => response.code).sort()).toEqual(['PAYMENT_PAID', 'WEBHOOK_ALREADY_PROCESSED'])
    await data.payments.handleWebhook(data.paid())
    await data.jobs.process('release_expired_payment_stock', {})
    expect(await db.flashSaleItem.findUniqueOrThrow({ where: { id: data.item.id } })).toMatchObject({ soldCount: 1 })
    expect(await db.flashSaleReservation.findMany({ where: { flashSaleItemId: data.item.id } })).toEqual([expect.objectContaining({ status: 'COMMITTED', quantity: 1 })])
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 9, quantityReserved: 0 })
    expect(await db.payment.findUniqueOrThrow({ where: { id: data.first.paymentId } })).toMatchObject({ status: 'SUCCEEDED', amount: 8000n })
    await expect(data.purchase(actor)).rejects.toMatchObject({ status: 409, code: 'CHECKOUT_FAILED' })
  })

  it('returns explicitly expired quota once and admits only one concurrent replacement buyer', async () => {
    const data = await fixture()
    await expect(data.purchase()).rejects.toMatchObject({ status: 409, code: 'CHECKOUT_FAILED' })
    await data.jobs.process('release_expired_payment_stock', {})
    await data.jobs.process('release_expired_payment_stock', {})
    expect(await db.flashSaleReservation.findMany({ where: { flashSaleItemId: data.item.id } })).toEqual([expect.objectContaining({ status: 'EXPIRED', quantity: 1 })])
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    const otherBuyer = await db.user.create({ data: { name: 'Replacement buyer', email: `${randomUUID()}@example.test` } })
    const results = await Promise.allSettled([data.purchase(), data.purchase(otherBuyer)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { status: 409, code: 'CHECKOUT_FAILED' } })
    const winner = results.find(result => result.status === 'fulfilled')
    if (!winner || winner.status !== 'fulfilled') throw new Error('Expected one replacement checkout')
    await data.payments.handleWebhook(data.paid(winner.value))
    await expect(data.payments.handleWebhook(data.paid())).rejects.toMatchObject({ status: 409, code: 'PAYMENT_STATE_CONFLICT' })
    expect(await db.flashSaleItem.findUniqueOrThrow({ where: { id: data.item.id } })).toMatchObject({ soldCount: 1 })
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 9, quantityReserved: 0 })
    expect(await db.flashSaleReservation.count({ where: { flashSaleItemId: data.item.id, status: 'COMMITTED' } })).toBe(1)
  })

  it('protects expired ACTIVE holds when a campaign is rescheduled for management', async () => {
    const data = await fixture()
    const promotion = new PromotionService(context, new PrismaPromotionRepository(context, db))
    const admin = { id: data.buyer.id, role: 'ADMIN' as const }
    await db.flashSale.update({ where: { id: data.sale.id }, data: { status: 'SCHEDULED', startsAt: new Date(Date.now() + 60000) } })
    await expect(promotion.updateFlashSaleItem(admin, data.item.id, { stockLimit: 0 })).rejects.toMatchObject({ code: 'FLASH_SALE_QUOTA_INVALID' })
    await expect(promotion.deleteFlashSaleItem(admin, data.item.id)).rejects.toMatchObject({ code: 'FLASH_SALE_ITEM_LOCKED' })
    await data.jobs.process('release_expired_payment_stock', {})
    await expect(promotion.updateFlashSaleItem(admin, data.item.id, { stockLimit: 0 })).resolves.toMatchObject({ stockLimit: 0 })
    await expect(promotion.deleteFlashSaleItem(admin, data.item.id)).resolves.toEqual({ ok: true })
  })

  it('rechecks quota edits and deletion after a concurrent checkout invalidates management reads', async () => {
    const data = await fixture(2, 2)
    const repo = new PrismaPromotionRepository(context, db)
    expect((await repo.findFlashSaleItemById(data.item.id))!.soldCount).toBe(0)
    await data.purchase()
    await expect(repo.updateFlashSaleItem(data.item.id, { stockLimit: 1 })).rejects.toMatchObject({ code: 'FLASH_SALE_QUOTA_INVALID' })
    await expect(repo.deleteFlashSaleItem(data.item.id)).rejects.toMatchObject({ code: 'FLASH_SALE_ITEM_LOCKED' })
    await data.payments.handleWebhook(data.paid())
    await expect(repo.updateFlashSaleItem(data.item.id, { stockLimit: 1 })).rejects.toMatchObject({ code: 'FLASH_SALE_QUOTA_INVALID' })
    expect(await db.flashSaleItem.findUniqueOrThrow({ where: { id: data.item.id } })).toMatchObject({ stockLimit: 2, soldCount: 1 })
  })

  it('waits for an in-flight checkout before checking a quota reduction', async () => {
    const data = await fixture(2, 2)
    let reservationCreated!: () => void
    let release!: () => void
    const created = new Promise<void>(resolve => { reservationCreated = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    const instrumented = db.$extends({ query: { flashSaleReservation: { async create({ args, query }) {
      const result = await query(args)
      reservationCreated()
      await hold
      return result
    } } } })
    const checkout = data.purchase(data.buyer, instrumented as unknown as PrismaClient)
    await created
    const repo = new PrismaPromotionRepository(context, db)
    const edit = repo.updateFlashSaleItem(data.item.id, { stockLimit: 1 })
    const result = Promise.allSettled([edit])
    try {
      expect(await Promise.race([result.then(() => 'finished'), new Promise(resolve => setTimeout(() => resolve('waiting'), 100))])).toBe('waiting')
    } finally {
      release()
    }
    await checkout
    expect(await result).toEqual([expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ code: 'FLASH_SALE_QUOTA_INVALID' }) })])
    expect(await db.flashSaleItem.findUniqueOrThrow({ where: { id: data.item.id } })).toMatchObject({ stockLimit: 2 })
  })
})
