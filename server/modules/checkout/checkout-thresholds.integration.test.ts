import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { Elysia } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { createPromotionRoutes } from '#server/modules/promotion/promotion.routes.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { CheckoutService } from './checkout.service.ts'
import { PrismaCheckoutRepository } from './checkout.repository.ts'
import { CheckoutQuoteEvaluator } from './checkout-quote.evaluator.ts'

const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }))
vi.mock('#server/lib/prisma.ts', () => ({ get prisma() { return state.db } }))
vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))
const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('checkout numeric thresholds on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) throw new Error('Use a disposable local marketplace_test_* database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
    state.db = db
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(price: number, shipping = 5000) {
    const buyer = await db.user.create({ data: { name: 'Threshold buyer', email: `${randomUUID()}@example.test`, emailVerified: true } })
    const seller = await db.user.create({ data: { name: 'Threshold seller', email: `${randomUUID()}@example.test`, emailVerified: true } })
    const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
    const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: 'Threshold shop', slug: randomUUID(),
      status: 'ACTIVE', contactEmail: seller.email, contactPhone: '0800000000', settings: { create: { shippingFee: shipping } } } })
    const product = await db.product.create({ data: { shopId: shop.id, title: 'Threshold item', slug: randomUUID(), status: 'ACTIVE' } })
    const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: randomUUID(), price,
      inventory: { create: { quantityOnHand: 10 } } } })
    const address = await db.address.create({ data: { userId: buyer.id, recipientName: buyer.name, line1: '1 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const promotion = new PromotionService(context, new PrismaPromotionRepository(context, db))
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, db), new CheckoutQuoteEvaluator(promotion), undefined, { provider: 'mock', mockEnabled: true })
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, db))
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, db), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true })
    const cart = await db.cart.create({ data: { userId: buyer.id, items: { create: { variantId: variant.id, unitPrice: price, quantity: 1 } } } })
    const input = { cartId: cart.id, addressId: address.id, paymentMethod: 'card' }
    const coinsApi = new Elysia().use(createPromotionRoutes({ promotionService: promotion } as ServiceContainer))
    vi.mocked(getAuthContext).mockResolvedValue({ user: buyer, session: { id: `test-session-${buyer.id}` } } as Awaited<ReturnType<typeof getAuthContext>>)
    return { buyer, shop, product, variant, address, cart, input, checkout, payments, coinsApi }
  }

  it.each([[9999, 14999, 0n], [10000, 15000, 1n], [10001, 15001, 1n]] as const)
    ('settles merchandise %s with shipping without shifting cashback threshold', async (price, paidAmount, cashback) => {
      const f = await fixture(price)
      const result = await f.checkout.createCheckout(f.buyer, f.input)
      const body = { provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid' as const,
        orderId: result.orderId, paymentId: result.paymentId, amount: paidAmount }
      expect(await f.payments.handleWebhook(body)).toMatchObject({ code: 'PAYMENT_PAID' })
      expect((await db.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).amount).toBe(BigInt(paidAmount))
      expect((await db.order.findUniqueOrThrow({ where: { id: result.orderId } })).grandTotal).toBe(BigInt(paidAmount))
      const wallet = await db.buyerCoinWallet.findUnique({ where: { userId: f.buyer.id } })
      expect(wallet?.balance ?? 0n).toBe(cashback)
      const ledger = await db.buyerCoinLedger.findMany({ where: { orderId: result.orderId, referenceType: 'ORDER_CASHBACK' } })
      expect(ledger.map(row => row.amount)).toEqual(cashback ? [1n] : [])
      expect(await f.payments.handleWebhook(body)).toMatchObject({ code: 'WEBHOOK_ALREADY_PROCESSED' })
      const response = await f.coinsApi.handle(new Request('http://localhost/api/me/coins'))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ balance: cashback.toString(), debtBalance: '0' })
      expect(await db.buyerCoinLedger.count({ where: { orderId: result.orderId, referenceType: 'ORDER_CASHBACK' } })).toBe(cashback ? 1 : 0)
    })

  it('permits only one checkout to reserve the last flash quota and rolls back the loser', async () => {
    const f = await fixture(10000, 0)
    const other = await db.user.create({ data: { name: 'Other buyer', email: `${randomUUID()}@example.test` } })
    const address = await db.address.create({ data: { userId: other.id, recipientName: other.name, line1: '2 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const cart = await db.cart.create({ data: { userId: other.id, items: { create: { variantId: f.variant.id, unitPrice: 10000, quantity: 1 } } } })
    const sale = await db.flashSale.create({ data: { title: 'Last quota', status: 'ACTIVE', startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 600000),
      items: { create: { shopId: f.shop.id, productId: f.product.id, variantId: f.variant.id, originalPrice: 10000, salePrice: 8000, stockLimit: 1, perUserLimit: 1 } } }, include: { items: true } })
    const outcomes = await Promise.allSettled([
      f.checkout.createCheckout(f.buyer, f.input),
      f.checkout.createCheckout(other, { cartId: cart.id, addressId: address.id, paymentMethod: 'card' }),
    ])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(result => result.status === 'rejected')).toMatchObject([{ reason: { status: 409 } }])
    expect(await db.flashSaleReservation.findMany({ where: { flashSaleItemId: sale.items[0].id } })).toMatchObject([{ quantity: 1, status: 'ACTIVE' }])
    expect(await db.inventory.findUniqueOrThrow({ where: { variantId: f.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 1 })
    const orders = await db.order.findMany({ where: { userId: { in: [f.buyer.id, other.id] } }, include: { payments: true } })
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ grandTotal: 8000n, payments: [{ amount: 8000n }] })
    expect(await db.checkout.count({ where: { userId: { in: [f.buyer.id, other.id] } } })).toBe(1)
    expect(await db.cartItem.count({ where: { cartId: { in: [f.cart.id, cart.id] } } })).toBe(1)
  })
})
