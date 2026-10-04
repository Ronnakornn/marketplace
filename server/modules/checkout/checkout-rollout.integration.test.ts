import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository } from './checkout.repository.ts'
import { CheckoutService } from './checkout.service.ts'
import { CheckoutQuoteEvaluator } from './checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { CommissionService } from '#server/modules/commission/commission.service.ts'
import { PrismaWalletRepository } from '#server/modules/wallet/wallet.repository.ts'
import { WalletService } from '#server/modules/wallet/wallet.service.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { AuditLogService } from '#server/modules/audit-log/audit-log.service.ts'
import { PrismaAuditLogRepository } from '#server/modules/audit-log/audit-log.repository.ts'
import { TaxPolicyService } from './tax-policy.service.ts'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'

const url = process.env['ROLLOUT_TEST_DATABASE_URL']
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
const originalFlag = process.env['CHECKOUT_V2_SETTLEMENT_ENABLED']
const originalCommission = process.env['PLATFORM_COMMISSION_BPS']

describe.skipIf(!url)('checkout rollback and mixed original versions on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !/^\/marketplace_test_[a-z_]+$/.test(parsed.pathname)) throw new Error('Use an exclusive local marketplace_test_* rollout database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterEach(async () => {
    await prisma.systemSetting.deleteMany({ where: { key: 'checkout.tax' } })
    if (originalFlag === undefined) delete process.env['CHECKOUT_V2_SETTLEMENT_ENABLED']
    else process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = originalFlag
    if (originalCommission === undefined) delete process.env['PLATFORM_COMMISSION_BPS']
    else process.env['PLATFORM_COMMISSION_BPS'] = originalCommission
  })
  afterAll(async () => { await prisma?.$disconnect() })

  function checkoutInstance() {
    return new CheckoutService(context, new PrismaCheckoutRepository(context, prisma), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))), undefined, { provider: 'mock', mockEnabled: true })
  }

  function services() {
    const wallet = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 2000))
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma), wallet)
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true })
    const admin = new AdminService(context, new PrismaAdminRepository(context, prisma), new AuditLogService(context, new PrismaAuditLogRepository(context, prisma)), new PrismaRefundRepository(context, prisma), undefined, wallet)
    return { wallet, shipments, payments, admin, policy: new TaxPolicyService(admin), checkout: checkoutInstance() }
  }

  async function fixture(price = 10700, quantity = 1, coins = 0) {
    const tag = randomUUID()
    const buyer = await prisma.user.create({ data: { name: 'Rollout buyer', email: `${tag}@example.test` } })
    const owner = await prisma.user.create({ data: { name: 'Rollout seller', email: `${randomUUID()}@example.test` } })
    const admin = await prisma.user.create({ data: { name: 'Rollout processor', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const completer = await prisma.user.create({ data: { name: 'Rollout completer', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const profile = await prisma.sellerProfile.create({ data: { userId: owner.id } })
    const shop = await prisma.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: 'Rollout shop', slug: tag, contactEmail: owner.email, contactPhone: '0800000000', status: 'ACTIVE', settings: { create: { shippingFee: 0 } } } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Rollout item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price, inventory: { create: { quantityOnHand: 10 } } } })
    const cart = await prisma.cart.create({ data: { userId: buyer.id, items: { create: { variantId: variant.id, quantity, unitPrice: price } } } })
    const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    await prisma.buyerCoinWallet.create({ data: { userId: buyer.id, balance: coins } })
    return { buyer, owner, admin, completer, shop, variant, cart, input: { cartId: cart.id, addressId: address.id, paymentMethod: 'card' } }
  }

  async function policy(instance: ReturnType<typeof services>, actor: Awaited<ReturnType<typeof fixture>>['admin'], ratePpm = 70000) {
    return instance.policy.put(actor, { version: 2, revision: randomUUID(), ratePpm, mode: 'INCLUSIVE', fundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false, shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', rounding: 'LINE_HALF_UP', exclusiveTaxFunding: 'BUYER', custodian: 'SELLER' })
  }

  async function accept(instance: ReturnType<typeof services>, data: Awaited<ReturnType<typeof fixture>>) {
    const quote = await instance.checkout.quoteCheckout(data.buyer, data.input)
    return instance.checkout.createCheckout(data.buyer, { ...data.input, acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision })
  }

  async function deliver(instance: ReturnType<typeof services>, data: Awaited<ReturnType<typeof fixture>>, orderId: string) {
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId } })
    await instance.shipments.packSellerShipment(data.owner, shipment.id)
    await instance.shipments.shipSellerShipment(data.owner, shipment.id, { carrier: 'Internal test', trackingNo: randomUUID() })
    await instance.shipments.deliverAdminShipment(data.admin, shipment.id, { evidenceReference: randomUUID() })
  }

  async function assertUnwritten(data: Awaited<ReturnType<typeof fixture>>, couponId: string) {
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: data.cart.id } })).toMatchObject({ status: 'ACTIVE' })
    expect(await prisma.cartItem.findFirstOrThrow({ where: { cartId: data.cart.id } })).toMatchObject({ quantity: 1, unitPrice: 10700n })
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 5n, pendingBalance: 0n, debtBalance: 0n })
    expect(await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).toMatchObject({ discountValue: 100n, usageLimit: 1, isActive: true })
    expect(await prisma.couponRedemption.count({ where: { couponId } })).toBe(0)
    expect(await prisma.buyerCoinLedger.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.checkout.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.order.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.payment.count({ where: { order: { userId: data.buyer.id } } })).toBe(0)
    expect(await prisma.inventoryReservation.count({ where: { inventory: { variantId: data.variant.id } } })).toBe(0)
    expect(await prisma.itemSaleSnapshot.count({ where: { orderItem: { order: { userId: data.buyer.id } } } })).toBe(0)
    expect(await prisma.shopSaleSnapshot.count({ where: { shopOrder: { order: { userId: data.buyer.id } } } })).toBe(0)
  }

  it('reports the same captured capability as checkout until a new instance is constructed', async () => {
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'true'
    const running = services()
    const data = await fixture()
    expect(await policy(running, data.admin)).toMatchObject({ settlementEnabled: true })
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'false'
    expect(await running.checkout.quoteCheckout(data.buyer, data.input)).toMatchObject({ grandTotal: 10700, reportedTaxTotal: 700 })
    expect(await running.policy.get(data.admin)).toMatchObject({ settlementEnabled: true })
    expect(await policy(running, data.admin)).toMatchObject({ settlementEnabled: true })
    const restarted = services()
    expect(await restarted.policy.get(data.admin)).toMatchObject({ settlementEnabled: false })
    await expect(restarted.checkout.quoteCheckout(data.buyer, data.input)).rejects.toMatchObject({ code: 'TAX_SETTLEMENT_UNAVAILABLE', status: 503 })
  })

  it.each(['BEFORE_DELIVERY', 'AFTER_DELIVERY'] as const)('processes frozen v2 NET/TAX and replays safely after flag-off instance replacement: %s', async (timing) => {
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'true'
    process.env['PLATFORM_COMMISSION_BPS'] = '1000'
    const data = await fixture(10700, 2)
    const enabled = services()
    await policy(enabled, data.admin)
    const sale = await accept(enabled, data)
    expect(sale.totalCents).toBe(21400)
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: sale.orderId } })
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: sale.orderId } } })).toMatchObject({ policyVersion: 2, commissionBase: 20000n, originalCommission: 2000n })
    expect(await prisma.itemSaleSnapshot.findUniqueOrThrow({ where: { orderItemId: item.id } })).toMatchObject({ buyerMerchandiseNet: 20000n, buyerMerchandiseTax: 1400n })
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'false'
    process.env['PLATFORM_COMMISSION_BPS'] = '2000'
    const restarted = services()
    await policy(restarted, data.admin, 0)
    const webhook = { provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid' as const, orderId: sale.orderId, paymentId: sale.paymentId, amount: 21400 }
    expect(await restarted.payments.handleWebhook(webhook)).toMatchObject({ ok: true })
    if (timing === 'AFTER_DELIVERY') {
      await deliver(restarted, data, sale.orderId)
      expect(await restarted.wallet.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: 19400n })
    }
    const refund = await restarted.admin.createSettlementRefund(data.admin, sale.orderId, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [] })
    expect(refund.amount).toBe(10700n)
    await restarted.admin.updateRefundStatus(data.admin, refund.id, { status: 'PROCESSING' })
    await restarted.admin.updateRefundStatus(data.completer, refund.id, { status: 'SUCCESS', externalReference: `INTERNAL-ROLLOUT-${refund.id}` })
    expect(await prisma.refundItemAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ quantity: 1, successfulQuantityBefore: 0, cashMerchandise: 10000n, buyerTaxRefund: 700n })
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 1000n })
    if (timing === 'BEFORE_DELIVERY') {
      expect(await prisma.walletLedgerEntry.count({ where: { orderId: sale.orderId } })).toBe(0)
      await deliver(restarted, data, sale.orderId)
    }
    expect(await restarted.wallet.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: 9700n })
    const entries = await prisma.walletLedgerEntry.findMany({ where: { orderId: sale.orderId }, orderBy: { id: 'asc' } })
    expect(entries.filter((entry) => entry.type === 'order_earning').map((entry) => entry.amount)).toEqual([timing === 'BEFORE_DELIVERY' ? 10700n : 21400n])
    expect(entries.filter((entry) => entry.type === 'commission_fee').map((entry) => entry.amount).sort((a, b) => a < b ? -1 : a > b ? 1 : 0)).toEqual(timing === 'BEFORE_DELIVERY' ? [-1000n] : [-2000n, 1000n])
    expect(entries.filter((entry) => entry.type === 'refund_adjustment').map((entry) => entry.amount)).toEqual(timing === 'BEFORE_DELIVERY' ? [] : [-10700n])
    const coinEntries = await prisma.buyerCoinLedger.findMany({ where: { orderId: sale.orderId }, orderBy: { id: 'asc' } })
    expect(coinEntries.filter((entry) => entry.referenceType === 'ORDER_CASHBACK').map((entry) => entry.amount)).toEqual([2n])
    expect(coinEntries.filter((entry) => entry.referenceType === 'REFUND_CASHBACK_REVERSAL').map((entry) => entry.amount)).toEqual([-1n])
    expect(await restarted.payments.handleWebhook(webhook)).toEqual({ ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' })
    await restarted.admin.updateRefundStatus(data.completer, refund.id, { status: 'SUCCESS', externalReference: `INTERNAL-ROLLOUT-${refund.id}` })
    await restarted.wallet.createEarningsForCompletedOrder(sale.orderId)
    expect(await prisma.walletLedgerEntry.findMany({ where: { orderId: sale.orderId }, orderBy: { id: 'asc' } })).toEqual(entries)
    expect(await prisma.buyerCoinLedger.findMany({ where: { orderId: sale.orderId }, orderBy: { id: 'asc' } })).toEqual(coinEntries)
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 1n, lifetimeEarned: 1n, pendingBalance: 0n, debtBalance: 0n })
  })

  it.each(['BEFORE_RESTART', 'AFTER_RESTART'] as const)('settles a v1 sale created %s without v2 acceptance and refunds its original commission', async (timing) => {
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'true'
    process.env['PLATFORM_COMMISSION_BPS'] = '1000'
    const enabled = services()
    const data = await fixture(10000)
    await policy(enabled, data.admin, 0)
    const original = timing === 'BEFORE_RESTART' ? await enabled.checkout.createCheckout(data.buyer, data.input) : null
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'false'
    const restarted = services()
    const sale = original ?? await restarted.checkout.createCheckout(data.buyer, data.input)
    expect(sale.totalCents).toBe(10000)
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: sale.orderId } })
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: sale.orderId } } })).toMatchObject({ policyVersion: 1, commissionBase: 10000n, originalCommission: 1000n })
    await restarted.payments.handleWebhook({ provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid', orderId: sale.orderId, paymentId: sale.paymentId, amount: 10000 })
    await deliver(restarted, data, sale.orderId)
    expect(await restarted.wallet.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: 9000n })
    const refund = await restarted.admin.createSettlementRefund(data.admin, sale.orderId, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [] })
    expect(refund.amount).toBe(10000n)
    await restarted.admin.updateRefundStatus(data.admin, refund.id, { status: 'PROCESSING' })
    await restarted.admin.updateRefundStatus(data.completer, refund.id, { status: 'SUCCESS', externalReference: `INTERNAL-ROLLOUT-${refund.id}` })
    expect(await restarted.wallet.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: 0n })
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 1000n })
  })

  it('rejects an accepted v2 quote after flag-off restart, then rejects the policy downgrade before every commitment', async () => {
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'true'
    const enabled = services()
    const data = await fixture(10700, 1, 5)
    await policy(enabled, data.admin)
    const coupon = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 100, usageLimit: 1, isActive: true } })
    const input = { ...data.input, couponCode: coupon.code, coinsToUse: 1 }
    const quote = await enabled.checkout.quoteCheckout(data.buyer, input)
    expect(quote).toMatchObject({ grandTotal: 10500, coinsApplied: 1, reportedTaxTotal: 700 })
    const accepted = { ...input, acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision }
    process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] = 'false'
    const restarted = services()
    await expect(restarted.checkout.createCheckout(data.buyer, accepted)).rejects.toMatchObject({ code: 'TAX_SETTLEMENT_UNAVAILABLE' })
    await assertUnwritten(data, coupon.id)
    await policy(restarted, data.admin, 0)
    await expect(restarted.checkout.quoteCheckout(data.buyer, { ...data.input, platformCouponCode: coupon.code })).rejects.toMatchObject({ code: 'TAX_SETTLEMENT_UNAVAILABLE', status: 503 })
    await expect(restarted.checkout.createCheckout(data.buyer, accepted)).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    await assertUnwritten(data, coupon.id)
    const refreshed = await restarted.checkout.quoteCheckout(data.buyer, input)
    expect(refreshed).toMatchObject({ grandTotal: 10500, reportedTaxTotal: 0, coinsApplied: 1 })
    expect(refreshed.quoteFingerprint).not.toBe(quote.quoteFingerprint)
    const result = await restarted.checkout.createCheckout(data.buyer, { ...input, acceptedQuoteFingerprint: refreshed.quoteFingerprint, acceptedTaxPolicyRevision: refreshed.taxPolicyRevision })
    expect(result.totalCents).toBe(10500)
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } })).toMatchObject({ policyVersion: 1 })
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 1 })
    expect(await prisma.couponRedemption.count({ where: { orderId: result.orderId, status: 'RESERVED' } })).toBe(1)
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 4n, pendingBalance: 1n })
  })
})
