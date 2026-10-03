import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository, type CheckoutCommitmentInput } from '#server/modules/checkout/checkout.repository.ts'
import { PrismaRefundRepository } from './refund.repository.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { WalletService } from '#server/modules/wallet/wallet.service.ts'
import { PrismaWalletRepository } from '#server/modules/wallet/wallet.repository.ts'
import { CommissionService } from '#server/modules/commission/commission.service.ts'
import { OrderService } from '#server/modules/order/order.service.ts'
import { PrismaOrderRepository } from '#server/modules/order/order.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { PayoutService } from '#server/modules/payout/payout.service.ts'
import { PrismaPayoutRepository } from '#server/modules/payout/payout.repository.ts'
import { JobService } from '#server/modules/jobs/job.service.ts'
import { PrismaJobRepository } from '#server/modules/jobs/job.repository.ts'
import { OptionalQueueProducer } from '#server/modules/queue/queue.producer.ts'
import { ActiveShopResolver } from '#server/modules/security/active-shop.ts'
import { PrismaOwnershipGuardRepository } from '#server/modules/security/security.repository.ts'
import { InventoryService } from '#server/modules/inventory/inventory.service.ts'
import { PrismaInventoryRepository } from '#server/modules/inventory/inventory.repository.ts'

// Explicit opt-in only; migrations must already be applied to a disposable database.
const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('commerce transactions on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })

  function services() {
    const access = new ActiveShopResolver(new PrismaOwnershipGuardRepository(context, prisma))
    const wallets = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 1000), access)
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma), wallets, undefined, undefined, access)
    return {
      checkout: new CheckoutService(context, new PrismaCheckoutRepository(context, prisma), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))), undefined, { provider: 'mock', mockEnabled: true }),
      payments: new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true }),
      shipments, wallets,
      orders: new OrderService(context, new PrismaOrderRepository(context, prisma), access),
      returns: new ReturnService(context, new PrismaReturnRepository(context, prisma), access),
      payouts: new PayoutService(context, new PrismaPayoutRepository(context, prisma), undefined, access),
      jobs: new JobService(context, new PrismaJobRepository(context, prisma), new OptionalQueueProducer(null)),
      inventory: new InventoryService(context, new PrismaInventoryRepository(context, prisma), access),
    }
  }

  const event = (order: { orderId: string; paymentId: string; totalCents: number }, eventType: 'payment.paid' | 'payment.failed' | 'payment.expired' = 'payment.paid') => ({
    provider: 'mock', providerRef: randomUUID(), eventType, orderId: order.orderId, paymentId: order.paymentId, amount: order.totalCents,
  })

  async function startCheckout() {
    const data = await fixture()
    const modules = services()
    const result = await modules.checkout.createCheckout(data.user, { cartId: data.cart.id, addressId: data.input.address.id, paymentMethod: 'card' })
    return { ...data, ...modules, result }
  }

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

  it('rejects stale stock after another transaction changes on-hand and reservations', async () => {
    const { repo, input, variant, cart } = await fixture()
    // Represents payment commitment plus another checkout after the cart was read.
    await prisma.inventory.update({ where: { variantId: variant.id }, data: { quantityOnHand: 6, quantityReserved: 2 } })
    await expect(repo.transaction((tx) => tx.commitCheckout(input))).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect(await prisma.checkout.count({ where: { cartId: cart.id } })).toBe(0)
    expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 6, quantityReserved: 2 })
  })

  it('allows only one of two simultaneous six-unit reservations against ten units', async () => {
    const { repo, input, variant } = await fixture()
    const results = await Promise.allSettled([
      repo.transaction((tx) => tx.commitCheckout(input)),
      repo.transaction((tx) => tx.commitCheckout({ ...input, orderNumber: randomUUID() })),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 6 })
  })

  it('concurrent refund completion debits the seller exactly once', async () => {
    const { repo, input, user, shop } = await fixture()
    const { order, payment } = await repo.transaction((tx) => tx.commitCheckout(input))
    const secondAdmin = await prisma.user.create({ data: { name: 'Second admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const refund = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, status: 'PROCESSING', processingById: user.id, amount: 2000 } })
    const refunds = new PrismaRefundRepository(context, prisma)
    const complete = () => refunds.completeRefundSuccess(refund.id, 'PROCESSING', { completedById: secondAdmin.id, externalReference: 'REF-TEST', completedAt: new Date() })
    const results = await Promise.all([complete(), complete()])
    expect(results.filter(Boolean)).toHaveLength(1)
    const entries = await prisma.walletLedgerEntry.findMany({ where: { refundId: refund.id } })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ shopId: shop.id, amount: -2000n })
  })

  it('preserves each shop allocation when an order-wide refund is split into separate cents', async () => {
    const first = await fixture()
    const second = await fixture()
    await prisma.productVariant.updateMany({ where: { id: { in: [first.variant.id, second.variant.id] } }, data: { price: 1 } })
    await prisma.cartItem.updateMany({ where: { cartId: first.cart.id }, data: { quantity: 1, unitPrice: 1 } })
    await prisma.cartItem.create({ data: { cartId: first.cart.id, variantId: second.variant.id, quantity: 1, unitPrice: 1 } })
    const modules = services()
    const result = await modules.checkout.createCheckout(first.user, { cartId: first.cart.id, addressId: first.input.address.id, paymentMethod: 'card' })
    expect(result.totalCents).toBe(2)
    await modules.payments.handleWebhook(event(result))
    const admin = await prisma.user.create({ data: { name: 'Refund admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const completingAdmin = await prisma.user.create({ data: { name: 'Completing admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const refunds = new PrismaRefundRepository(context, prisma)
    const records = await Promise.all([1, 2].map(() => prisma.refund.create({ data: {
      orderId: result.orderId, paymentId: result.paymentId, status: 'PROCESSING', processingById: admin.id, amount: 1,
    } })))
    for (const refund of records) {
      await expect(refunds.completeRefundSuccess(refund.id, 'PROCESSING', {
        completedById: completingAdmin.id, externalReference: `REF-${refund.id}`,
      })).resolves.toMatchObject({ status: 'SUCCESS', amount: 1n })
    }
    const shops = await prisma.shopOrder.findMany({ where: { orderId: result.orderId }, orderBy: { shopId: 'asc' } })
    const amounts = await Promise.all(shops.map(async (shop) => {
      const entries = await prisma.walletLedgerEntry.aggregate({
        where: { orderId: result.orderId, shopId: shop.shopId, type: 'refund_adjustment' }, _sum: { amount: true },
      })
      return entries._sum.amount ?? 0n
    }))
    expect(amounts).toEqual([-1n, -1n])
  })

  it('rolls back refund status and ledger entries when coin settlement fails', async () => {
    const { repo, input, user } = await fixture()
    const { order, payment } = await repo.transaction((tx) => tx.commitCheckout(input))
    const secondAdmin = await prisma.user.create({ data: { name: 'Second admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const refund = await prisma.refund.create({ data: { orderId: order.id, paymentId: payment.id, status: 'PROCESSING', processingById: user.id, amount: 2000 } })
    const failingClient = prisma.$extends({ query: { buyerCoinLedger: { findFirst: async () => { throw new Error('Coin settlement unavailable') } } } })
    const refunds = new PrismaRefundRepository(context, failingClient as unknown as PrismaClient)
    await expect(refunds.completeRefundSuccess(refund.id, 'PROCESSING', { completedById: secondAdmin.id, externalReference: 'REF-TEST' })).rejects.toThrow('Coin settlement unavailable')
    expect(await prisma.refund.findUnique({ where: { id: refund.id } })).toMatchObject({ status: 'PROCESSING' })
    expect(await prisma.walletLedgerEntry.count({ where: { refundId: refund.id } })).toBe(0)
  })

  it('prices a multi-shop checkout from trusted variants and creates isolated shipments', async () => {
    const first = await fixture()
    const second = await fixture()
    const modules = services()
    await prisma.cartItem.updateMany({ where: { cartId: first.cart.id }, data: { unitPrice: 1 } })
    await prisma.cartItem.create({ data: { cartId: first.cart.id, variantId: second.variant.id, quantity: 2, unitPrice: 1 } })
    await prisma.shopSetting.create({ data: { shopId: first.shop.id, shippingFee: 100 } })
    await prisma.shopSetting.create({ data: { shopId: second.shop.id, shippingFee: 200 } })
    const coupon = await prisma.coupon.create({ data: { shopId: first.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 1000 } })
    const result = await modules.checkout.createCheckout(first.user, { cartId: first.cart.id, addressId: first.input.address.id, paymentMethod: 'card', couponCode: coupon.code })
    expect(result.totalCents).toBe(7300)
    await modules.payments.handleWebhook(event(result))
    const shipments = await prisma.shipment.findMany({ where: { orderId: result.orderId } })
    expect(shipments).toHaveLength(2)
    const sellerView = await modules.orders.getSellerOrder(second.user, result.orderId)
    expect(sellerView.items).toHaveLength(1)
    expect(sellerView.items[0]!.shopId).toBe(second.shop.id)
    const firstShipment = shipments.find((shipment) => shipment.shopId === first.shop.id)!
    await expect(modules.shipments.packSellerShipment(second.user, firstShipment.id)).rejects.toMatchObject({ code: 'SHIPMENT_NOT_FOUND' })
    await expect(modules.orders.getBuyerOrder(second.user, result.orderId)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
    await expect(modules.checkout.quoteCheckout(second.user, { cartId: first.cart.id })).rejects.toMatchObject({ code: 'CART_NOT_FOUND' })
  })

  it('rejects a mismatched payment amount and handles concurrent duplicate events once', async () => {
    const { result, payments, variant } = await startCheckout()
    await expect(payments.handleWebhook({ ...event(result), amount: 1 })).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' })
    expect(await prisma.paymentEvent.count({ where: { paymentId: result.paymentId } })).toBe(0)
    const paid = event(result)
    await Promise.all([payments.handleWebhook(paid), payments.handleWebhook(paid)])
    expect(await prisma.paymentEvent.count({ where: { paymentId: result.paymentId } })).toBe(1)
    expect(await prisma.shipment.count({ where: { orderId: result.orderId } })).toBe(1)
    expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 4, quantityReserved: 0 })
  })

  it('restores reserved stock, coupons and coins on failed payment without double release', async () => {
    const data = await fixture()
    const modules = services()
    const wallet = await prisma.buyerCoinWallet.create({ data: { userId: data.user.id, balance: 10 } })
    const coupon = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 500 } })
    const result = await modules.checkout.createCheckout(data.user, { cartId: data.cart.id, addressId: data.input.address.id, paymentMethod: 'card', coinsToUse: 5, couponCode: coupon.code })
    expect(await prisma.buyerCoinWallet.findUnique({ where: { id: wallet.id } })).toMatchObject({ balance: 5n, pendingBalance: 5n })
    const failed = event(result, 'payment.failed')
    await modules.payments.handleWebhook(failed)
    await modules.payments.handleWebhook(failed)
    expect(await prisma.buyerCoinWallet.findUnique({ where: { id: wallet.id } })).toMatchObject({ balance: 10n, pendingBalance: 0n })
    expect(await prisma.inventory.findUnique({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect(await prisma.couponRedemption.findFirst({ where: { orderId: result.orderId } })).toMatchObject({ status: 'RELEASED' })
  })

  it('expires both the buyer order and shop orders through the background job', async () => {
    const first = await fixture()
    const second = await fixture()
    const { checkout, jobs } = services()
    await prisma.cartItem.create({ data: { cartId: first.cart.id, variantId: second.variant.id, quantity: 2, unitPrice: 1000 } })
    const result = await checkout.createCheckout(first.user, { cartId: first.cart.id, addressId: first.input.address.id, paymentMethod: 'card' })
    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId } })
    await prisma.checkout.update({ where: { id: order.checkoutId }, data: { expiresAt: new Date(0) } })
    await jobs.process('release_expired_payment_stock', {})
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ status: 'CANCELED', paymentStatus: 'CANCELED' })
    const canceledShopOrders = await prisma.shopOrder.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })
    expect(canceledShopOrders).toHaveLength(2)
    for (const shopOrder of canceledShopOrders) expect(shopOrder).toMatchObject({ status: 'CANCELED', version: 2 })
    await jobs.process('release_expired_payment_stock', {})
    expect(await prisma.shopOrder.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })).toEqual(canceledShopOrders)
    for (const { variant } of [first, second]) {
      expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    }
  })

  it('keeps money and inventory consistent when payment races buyer cancellation', async () => {
    const { result, user, payments, variant } = await startCheckout()
    await Promise.allSettled([payments.handleWebhook(event(result)), payments.cancelBuyerOrder(user, result.orderId)])
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })
    const succeeded = payment.status === 'SUCCEEDED'
    expect(['SUCCEEDED', 'CANCELED']).toContain(payment.status)
    expect(inventory).toMatchObject({ quantityOnHand: succeeded ? 4 : 10, quantityReserved: 0 })
    expect(await prisma.shipment.count({ where: { orderId: result.orderId } })).toBe(succeeded ? 1 : 0)
  })

  it('does not consume released stock for a late success event after expiry', async () => {
    const { result, payments, variant } = await startCheckout()
    await payments.handleWebhook(event(result, 'payment.expired'))
    await expect(payments.handleWebhook(event(result))).rejects.toMatchObject({ code: 'PAYMENT_STATE_CONFLICT' })
    expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
  })

  it('fulfills, returns and refunds an order while preventing withdrawal of refunded earnings', async () => {
    const { result, user, shop, payments, shipments, returns, payouts } = await startCheckout()
    await payments.handleWebhook(event(result))
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: result.orderId } })
    await expect(shipments.shipSellerShipment(user, shipment.id, { carrier: 'Test carrier', trackingNo: 'TRACK-1' })).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_STATE' })
    await shipments.packSellerShipment(user, shipment.id)
    await shipments.shipSellerShipment(user, shipment.id, { carrier: 'Test carrier', trackingNo: 'TRACK-1' })
    const admin = await prisma.user.create({ data: { name: 'Admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    await shipments.deliverAdminShipment(admin, shipment.id, { evidenceReference: 'DELIVERY-1' })
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } })
    const request = await returns.createReturn(user, { orderId: result.orderId, orderItemId: orderItem.id, reason: 'Damaged' })
    await returns.approveSellerReturn(user, request.id)
    const refund = await prisma.refund.findUniqueOrThrow({ where: { returnRequestId: request.id } })
    expect(refund.amount).toBe(6000n)
    const secondAdmin = await prisma.user.create({ data: { name: 'Second admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSING', processingById: admin.id } })
    await new PrismaRefundRepository(context, prisma).completeRefundSuccess(refund.id, 'PROCESSING', { completedById: secondAdmin.id, externalReference: 'REFUND-1' })
    const debit = await prisma.walletLedgerEntry.findFirstOrThrow({ where: { refundId: refund.id } })
    expect(debit).toMatchObject({ shopId: shop.id, amount: -6000n })
    await expect(payouts.createSellerPayout(user, { amount: 1 })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('allows only one simultaneous withdrawal against the same available balance', async () => {
    const { user, shop } = await fixture()
    const wallet = await prisma.shopWallet.create({ data: { shopId: shop.id } })
    await prisma.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: shop.id, type: 'order_earning', amount: 10000 } })
    const payouts = services().payouts
    const outcomes = await Promise.allSettled([payouts.createSellerPayout(user, { amount: 6000 }), payouts.createSellerPayout(user, { amount: 6000 })])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.sellerPayout.count({ where: { walletId: wallet.id } })).toBe(1)
    expect((await prisma.walletLedgerEntry.aggregate({ where: { walletId: wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(4000n)
  })

  it('blocks seller stock updates below active reservations and other-shop stock changes', async () => {
    const { user, variant, inventory } = await startCheckout()
    await expect(inventory.updateSellerInventory(user, variant.id, { quantityOnHand: 5, reason: 'Stock count' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    const other = await fixture()
    await expect(inventory.updateSellerInventory(other.user, variant.id, { quantityOnHand: 10, reason: 'Stock count' })).rejects.toMatchObject({ status: 403 })
    expect(await prisma.inventory.findUnique({ where: { variantId: variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 6 })
  })
})
