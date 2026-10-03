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

const url = process.env['TAX_TEST_DATABASE_URL']
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('original tax sale facts on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || parsed.pathname !== '/marketplace_test_tax') throw new Error('Use the dedicated local marketplace_test_tax database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterEach(async () => { await prisma.systemSetting.deleteMany({ where: { key: 'checkout.tax' } }) })
  afterAll(async () => { await prisma?.$disconnect() })

  async function policy(mode: 'INCLUSIVE' | 'EXCLUSIVE', revision = randomUUID(), ratePpm = 70000, taxableShipping = false) {
    const value = { version: 2, revision, ratePpm, mode, fundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping,
      shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', rounding: 'LINE_HALF_UP', exclusiveTaxFunding: 'BUYER', custodian: 'SELLER' }
    await prisma.systemSetting.upsert({ where: { key: 'checkout.tax' }, create: { key: 'checkout.tax', valueType: 'JSON', value }, update: { value, valueType: 'JSON' } })
    return value
  }

  async function fixture(price = 10000, shipping = 0, coins = 0, quantity = 1) {
    const tag = randomUUID()
    const buyer = await prisma.user.create({ data: { name: 'Tax buyer', email: `${tag}@example.test` } })
    const owner = await prisma.user.create({ data: { name: 'Tax seller', email: `${randomUUID()}@example.test` } })
    const admin = await prisma.user.create({ data: { name: 'Tax admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const profile = await prisma.sellerProfile.create({ data: { userId: owner.id } })
    const shop = await prisma.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: 'Tax shop', slug: tag,
      contactEmail: owner.email, contactPhone: '0800000000', status: 'ACTIVE', settings: { create: { shippingFee: shipping } } } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Tax item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price, inventory: { create: { quantityOnHand: 10 } } } })
    const cart = await prisma.cart.create({ data: { userId: buyer.id, items: { create: { variantId: variant.id, quantity, unitPrice: price } } } })
    const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    await prisma.buyerCoinWallet.create({ data: { userId: buyer.id, balance: coins } })
    const checkout = service(new PrismaCheckoutRepository(context, prisma))
    const input = { cartId: cart.id, addressId: address.id, paymentMethod: 'card' }
    return { buyer, owner, admin, shop, variant, cart, address, checkout, input }
  }

  function service(repo: PrismaCheckoutRepository, enabled = true) {
    return new CheckoutService(context, repo, new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma)), enabled), undefined, { provider: 'mock', mockEnabled: true })
  }

  async function accept(data: Awaited<ReturnType<typeof fixture>>, extra: { shopCouponCode?: string; platformCouponCode?: string; coinsToUse?: number } = {}) {
    const input = { ...data.input, ...extra }
    const quote = await data.checkout.quoteCheckout(data.buyer, input)
    const result = await data.checkout.createCheckout(data.buyer, { ...input, acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision })
    return { quote, result }
  }

  async function settle(data: Awaited<ReturnType<typeof fixture>>, result: Awaited<ReturnType<CheckoutService['createCheckout']>>, beforeDelivery?: () => Promise<void>) {
    const wallet = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 2000))
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma), wallet)
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true })
    const webhook = { provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid' as const, orderId: result.orderId, paymentId: result.paymentId, amount: result.totalCents }
    await payments.handleWebhook(webhook)
    await payments.handleWebhook(webhook)
    await beforeDelivery?.()
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: result.orderId } })
    await shipments.packSellerShipment(data.owner, shipment.id)
    await shipments.shipSellerShipment(data.owner, shipment.id, { carrier: 'Test', trackingNo: randomUUID() })
    await shipments.deliverAdminShipment(data.admin, shipment.id, { evidenceReference: randomUUID() })
    await wallet.createEarningsForCompletedOrder(result.orderId)
    return wallet.getSellerWallet(data.owner)
  }

  it.each(['INCLUSIVE', 'EXCLUSIVE'] as const)('freezes %s tax, charges once, and recognizes gross receipts with the original NET commission', async (mode) => {
    await policy(mode)
    const data = await fixture(mode === 'INCLUSIVE' ? 10700 : 10000)
    const { quote, result } = await accept(data)
    expect(quote).toMatchObject({ grandTotal: 10700, taxTotal: mode === 'EXCLUSIVE' ? 700 : 0, includedTaxTotal: mode === 'INCLUSIVE' ? 700 : 0, reportedTaxTotal: 700 })
    expect(result.totalCents).toBe(10700)
    expect(await prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } })).toMatchObject({ amount: 10700n })
    const item = await prisma.itemSaleSnapshot.findFirstOrThrow({ where: { orderItem: { orderId: result.orderId } } })
    expect(item).toMatchObject({ buyerMerchandise: 10700n, buyerMerchandiseNet: 10000n, buyerMerchandiseTax: 700n, originalCashbackEligibleNet: 10000n, originalAffiliateEligibleNet: 10000n })
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } })).toMatchObject({ policyVersion: 2, commissionBase: 10000n, originalCommission: 1000n, sellerGrossMerchandise: 10700n })
    await policy(mode, randomUUID(), 100000)
    expect(await settle(data, result)).toMatchObject({ availableBalanceCents: 9700n })
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: result.orderId } })).toBe(2)
    expect(await prisma.buyerCoinLedger.count({ where: { orderId: result.orderId, referenceType: 'ORDER_CASHBACK' } })).toBe(1)
  })

  it('uses original buyer NET at the cashback threshold instead of included tax', async () => {
    await policy('INCLUSIVE')
    const data = await fixture(10699)
    const { result } = await accept(data)
    expect(await prisma.itemSaleSnapshot.findFirstOrThrow({ where: { orderItem: { orderId: result.orderId } } })).toMatchObject({ buyerMerchandiseNet: 9999n, buyerMerchandiseTax: 700n })
    await settle(data, result)
    expect(await prisma.buyerCoinLedger.count({ where: { orderId: result.orderId, referenceType: 'ORDER_CASHBACK' } })).toBe(0)
  })

  it.each(['INCLUSIVE', 'EXCLUSIVE'] as const)('freezes %s tax on platform-funded shipping and recognizes seller gross including that tax', async (mode) => {
    await policy(mode, randomUUID(), 70000, true)
    const data = await fixture(mode === 'INCLUSIVE' ? 10700 : 10000, mode === 'INCLUSIVE' ? 1070 : 1000)
    const coupon = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FREE_SHIPPING', isActive: true } })
    const { quote, result } = await accept(data, { platformCouponCode: coupon.code })
    expect(quote).toMatchObject({ shippingTotal: 0, grandTotal: mode === 'INCLUSIVE' ? 10700 : 10770, reportedTaxTotal: 770 })
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } })).toMatchObject({
      buyerShippingNet: 0n, buyerShippingTax: mode === 'INCLUSIVE' ? 0n : 70n,
      platformShippingNet: 1000n, platformShippingTax: mode === 'INCLUSIVE' ? 70n : 0n,
      sellerGrossShipping: 1070n, commissionBase: 10000n, originalCommission: 1000n,
    })
    expect(await settle(data, result)).toMatchObject({ availableBalanceCents: 10770n })
  })

  it('recognizes only remaining NET/TAX rights after a successful partial refund before delivery', async () => {
    await policy('INCLUSIVE')
    const data = await fixture(10700, 0, 0, 2)
    const { result } = await accept(data)
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } })
    const completer = await prisma.user.create({ data: { name: 'Tax completer', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const wallet = await settle(data, result, async () => {
      const refunds = new PrismaRefundRepository(context, prisma)
      const refund = await refunds.createPlannedRefund(result.orderId, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [] })
      expect(refund.amount).toBe(10700n)
      await prisma.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSING', processingById: data.admin.id } })
      await refunds.completeRefundSuccess(refund.id, 'PROCESSING', { completedById: completer.id, externalReference: `TAX-${refund.id}` })
      expect(await prisma.walletLedgerEntry.count({ where: { orderId: result.orderId } })).toBe(0)
      expect(await prisma.refundItemAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ successfulQuantityBefore: 0, quantity: 1, cashMerchandise: 10000n, buyerTaxRefund: 700n })
      expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 1000n, walletPostedAt: null })
    })
    expect(wallet).toMatchObject({ availableBalanceCents: 9700n })
    const entries = await prisma.walletLedgerEntry.findMany({ where: { orderId: result.orderId } })
    expect(entries.filter((entry) => entry.type === 'order_earning').map((entry) => entry.amount)).toEqual([10700n])
    expect(entries.filter((entry) => entry.type === 'commission_fee').map((entry) => entry.amount)).toEqual([-1000n])
  })

  it.each(['MISSING_BUYER_NET', 'NEGATIVE_SHIPPING', 'NEGATIVE_WAIVER', 'NEGATIVE_COUPON'] as const)('refuses original earning when frozen v2 facts are corrupt: %s', async (corruption) => {
    await policy('INCLUSIVE')
    const data = await fixture(10700)
    const { result } = await accept(data)
    await expect(settle(data, result, async () => {
      if (corruption === 'MISSING_BUYER_NET') await prisma.itemSaleSnapshot.updateMany({ where: { orderItem: { orderId: result.orderId } }, data: { buyerMerchandiseNet: null } })
      if (corruption === 'NEGATIVE_SHIPPING') await prisma.shopSaleSnapshot.updateMany({ where: { shopOrder: { orderId: result.orderId } }, data: { originalShipping: -1n } })
      if (corruption === 'NEGATIVE_WAIVER') await prisma.shopSaleSnapshot.updateMany({ where: { shopOrder: { orderId: result.orderId } }, data: { sellerShippingWaiver: -1n } })
      if (corruption === 'NEGATIVE_COUPON') await prisma.itemSaleSnapshot.updateMany({ where: { orderItem: { orderId: result.orderId } }, data: { sellerCouponDiscount: -1n } })
    })).rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: result.orderId } })).toBe(0)
    expect(await prisma.shopSaleSnapshot.findFirstOrThrow({ where: { shopOrder: { orderId: result.orderId } } })).toMatchObject({ recognizedAt: null })
  })

  it('uses stable cart item order for allocation ties and preserves those facts under new order item IDs', async () => {
    await policy('EXCLUSIVE', randomUUID(), 0)
    const data = await fixture(3)
    const original = await prisma.cartItem.findFirstOrThrow({ where: { cartId: data.cart.id } })
    const secondVariant = await prisma.productVariant.create({ data: { productId: data.variant.productId, sku: randomUUID(), title: 'Second', price: 3, inventory: { create: { quantityOnHand: 10 } } } })
    const second = await prisma.cartItem.create({ data: { cartId: data.cart.id, variantId: secondVariant.id, quantity: 1, unitPrice: 3 } })
    const coupon = await prisma.coupon.create({ data: { shopId: data.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 1, isActive: true } })
    const input = { ...data.input, shopCouponCode: coupon.code }
    const quote = await data.checkout.quoteCheckout(data.buyer, { ...input, cartItemIds: [original.id, second.id] })
    const reversed = await data.checkout.quoteCheckout(data.buyer, { ...input, cartItemIds: [second.id, original.id] })
    expect(reversed.quoteFingerprint).toBe(quote.quoteFingerprint)
    expect(quote.grandTotal).toBe(5)
    const result = await data.checkout.createCheckout(data.buyer, { ...input, cartItemIds: [second.id, original.id], acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision })
    const items = await prisma.orderItem.findMany({ where: { orderId: result.orderId }, include: { saleSnapshot: true } })
    const stable = [original, second].sort((a, b) => a.id.localeCompare(b.id))
    expect(stable.map((cartItem) => items.find((item) => item.variantId === cartItem.variantId)?.saleSnapshot?.sellerCouponDiscount)).toEqual([0n, 1n])
    expect(items.every((item) => ![original.id, second.id].includes(item.id))).toBe(true)
  })

  it('applies shop coupon before platform percentage and coins, then reserves both original coupon facts', async () => {
    await policy('EXCLUSIVE', randomUUID(), 0)
    const data = await fixture(10000, 400, 5)
    const shop = await prisma.coupon.create({ data: { shopId: data.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 1000, isActive: true } })
    const platform = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'PERCENT', discountPercentBps: 1000, isActive: true } })
    const { quote, result } = await accept(data, { shopCouponCode: shop.code, platformCouponCode: platform.code, coinsToUse: 5 })
    expect(quote).toMatchObject({ subtotal: 10000, discountTotal: 2400, shippingTotal: 400, grandTotal: 8000, coinsApplied: 5 })
    expect(quote.couponOutcomes).toEqual([{ code: shop.code, applied: true }, { code: platform.code, applied: true }])
    expect(await prisma.itemSaleSnapshot.findFirstOrThrow({ where: { orderItem: { orderId: result.orderId } } })).toMatchObject({ sellerCouponDiscount: 1000n, platformCouponDiscount: 900n, coinDiscount: 500n, buyerMerchandiseNet: 7600n, shopCouponId: shop.id, platformCouponId: platform.id })
    expect(await prisma.couponRedemption.count({ where: { orderId: result.orderId } })).toBe(2)
    expect(await prisma.couponRedemption.count({ where: { couponId: { in: [shop.id, platform.id] }, status: 'RESERVED' } })).toBe(2)
    expect(await settle(data, result)).toMatchObject({ availableBalanceCents: 8500n })
    expect(await prisma.couponRedemption.count({ where: { orderId: result.orderId, status: 'REDEEMED' } })).toBe(2)
  })

  it('rejects a changed policy or price before any order, payment, stock or coin writes', async () => {
    await policy('EXCLUSIVE')
    const data = await fixture(10000, 0, 1)
    const quote = await data.checkout.quoteCheckout(data.buyer, { ...data.input, coinsToUse: 1 })
    await policy('EXCLUSIVE')
    const accepted = { ...data.input, coinsToUse: 1, acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision }
    await expect(data.checkout.createCheckout(data.buyer, accepted)).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    const refreshed = await data.checkout.quoteCheckout(data.buyer, { ...data.input, coinsToUse: 1 })
    await prisma.productVariant.update({ where: { id: data.variant.id }, data: { price: 11000 } })
    await expect(data.checkout.createCheckout(data.buyer, { ...accepted, acceptedQuoteFingerprint: refreshed.quoteFingerprint, acceptedTaxPolicyRevision: refreshed.taxPolicyRevision })).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    expect(await prisma.order.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.payment.count({ where: { order: { userId: data.buyer.id } } })).toBe(0)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 1n })
    expect(await prisma.cartItem.count({ where: { cartId: data.cart.id } })).toBe(1)
  })

  it('requires explicit acceptance and fails closed while v2 settlement is disabled', async () => {
    await policy('EXCLUSIVE')
    const data = await fixture()
    await expect(data.checkout.createCheckout(data.buyer, data.input)).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    const quote = await data.checkout.quoteCheckout(data.buyer, data.input)
    await expect(data.checkout.createCheckout(data.buyer, { ...data.input, acceptedQuoteFingerprint: quote.quoteFingerprint })).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    await expect(service(new PrismaCheckoutRepository(context, prisma), false).quoteCheckout(data.buyer, data.input)).rejects.toMatchObject({ code: 'TAX_SETTLEMENT_UNAVAILABLE' })
    expect(await prisma.order.count({ where: { userId: data.buyer.id } })).toBe(0)
  })

  it('rolls back the first reservation, counters, stock, coins and order when the second coupon write fails', async () => {
    await policy('EXCLUSIVE', randomUUID(), 0)
    const data = await fixture(10000, 0, 1)
    const shop = await prisma.coupon.create({ data: { shopId: data.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 100, isActive: true } })
    const platform = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 100, isActive: true } })
    let writes = 0
    const fault = prisma.$extends({ query: { couponRedemption: { async create({ args, query }) {
      if (++writes === 2) throw new Error('Injected second coupon failure')
      return query(args)
    } } } })
    // Prisma query extensions preserve transaction behavior but omit $on from the generated client type.
    const checkout = service(new PrismaCheckoutRepository(context, fault as unknown as PrismaClient))
    const input = { ...data.input, shopCouponCode: shop.code, platformCouponCode: platform.code, coinsToUse: 1 }
    const quote = await checkout.quoteCheckout(data.buyer, input)
    await expect(checkout.createCheckout(data.buyer, { ...input, acceptedQuoteFingerprint: quote.quoteFingerprint, acceptedTaxPolicyRevision: quote.taxPolicyRevision })).rejects.toThrow()
    expect(writes).toBe(2)
    expect(await prisma.order.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.couponRedemption.count({ where: { couponId: { in: [shop.id, platform.id] } } })).toBe(0)
    expect(await prisma.couponRedemption.count({ where: { couponId: { in: [shop.id, platform.id] }, status: 'RESERVED' } })).toBe(0)
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: data.variant.id } })).toMatchObject({ quantityReserved: 0 })
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 1n })
    expect(await prisma.buyerCoinLedger.count({ where: { userId: data.buyer.id } })).toBe(0)
    expect(await prisma.cartItem.count({ where: { cartId: data.cart.id } })).toBe(1)
  })

  it('serializes two checkouts for the last platform coupon right and rolls back the losing shop reservation', async () => {
    await policy('EXCLUSIVE', randomUUID(), 0)
    const first = await fixture(10000)
    const second = await fixture(10000)
    const shops = await Promise.all([first, second].map((data) => prisma.coupon.create({ data: { shopId: data.shop.id, code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 100, isActive: true } })))
    const platform = await prisma.coupon.create({ data: { code: randomUUID().toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 100, usageLimit: 1, isActive: true } })
    const inputs = [first, second].map((data, index) => ({ ...data.input, shopCouponCode: shops[index]!.code, platformCouponCode: platform.code }))
    const quotes = await Promise.all([first, second].map((data, index) => data.checkout.quoteCheckout(data.buyer, inputs[index]!)))
    const results = await Promise.allSettled([first, second].map((data, index) => data.checkout.createCheckout(data.buyer, { ...inputs[index]!, acceptedQuoteFingerprint: quotes[index]!.quoteFingerprint, acceptedTaxPolicyRevision: quotes[index]!.taxPolicyRevision })))
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await prisma.order.count({ where: { userId: { in: [first.buyer.id, second.buyer.id] } } })).toBe(1)
    expect(await prisma.couponRedemption.count({ where: { couponId: platform.id, status: 'RESERVED' } })).toBe(1)
    expect(await prisma.couponRedemption.count({ where: { couponId: { in: shops.map((coupon) => coupon.id) } } })).toBe(1)
    const stocks = await prisma.inventory.findMany({ where: { variantId: { in: [first.variant.id, second.variant.id] } } })
    expect(stocks.map((stock) => stock.quantityReserved).sort()).toEqual([0, 1])
  })

  it('validates the generic config path, rotates revisions, and audits complete before/after policies', async () => {
    const data = await fixture()
    const admin = new AdminService(context, new PrismaAdminRepository(context, prisma), new AuditLogService(context, new PrismaAuditLogRepository(context, prisma)))
    await expect(admin.upsertSystemSetting(data.admin, 'checkout.tax', { value: { ratePpm: 70000 }, valueType: 'JSON' })).rejects.toMatchObject({ code: 'INVALID_ADMIN_INPUT' })
    await expect(admin.upsertSystemSetting(data.admin, 'checkout.tax', { value: '0', valueType: 'STRING' })).rejects.toMatchObject({ code: 'INVALID_ADMIN_INPUT' })
    expect(await prisma.systemSetting.count({ where: { key: 'checkout.tax' } })).toBe(0)
    const settings = new TaxPolicyService(admin)
    await expect(settings.get(data.buyer)).rejects.toMatchObject({ status: 403 })
    const zero = await settings.put(data.admin, { ratePpm: 0 })
    const configured = await settings.put(data.admin, { ratePpm: 70000, mode: 'INCLUSIVE', fundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false,
      shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', rounding: 'LINE_HALF_UP', custodian: 'SELLER', exclusiveTaxFunding: 'BUYER' })
    expect(configured.policy.revision).not.toBe(zero.policy.revision)
    expect(configured.policy).toMatchObject({ ratePpm: 70000, mode: 'INCLUSIVE', custodian: 'SELLER' })
    expect((await settings.get(data.admin)).policy).toEqual(configured.policy)
    const audits = await prisma.auditLog.findMany({ where: { actorUserId: data.admin.id, action: 'ADMIN_CONFIG_CHANGED', entityType: 'SystemSetting' }, orderBy: { createdAt: 'asc' } })
    expect(audits).toHaveLength(2)
    expect(audits[1]).toMatchObject({ before: { value: zero.policy }, after: { value: configured.policy } })
  })
})
