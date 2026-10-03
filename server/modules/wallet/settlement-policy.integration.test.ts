import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { CommissionService } from '#server/modules/commission/commission.service.ts'
import { PrismaWalletRepository } from './wallet.repository.ts'
import { WalletService } from './wallet.service.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { PrismaRefundRepository } from '#server/modules/refund/refund.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { PayoutService } from '#server/modules/payout/payout.service.ts'
import { PrismaPayoutRepository } from '#server/modules/payout/payout.repository.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('accepted settlement policy on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })

  async function sale(options: { platform?: boolean; freeShipping?: boolean; price?: number; discount?: number; coins?: number } = {}) {
    const tag = randomUUID()
    const buyer = await prisma.user.create({ data: { name: 'Settlement buyer', email: `${tag}@example.test` } })
    const owner = await prisma.user.create({ data: { name: 'Settlement seller', email: `${randomUUID()}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: owner.id } })
    const shop = await prisma.shop.create({ data: {
      ownerId: owner.id, sellerProfileId: profile.id, name: 'Settlement shop', slug: tag,
      contactEmail: owner.email, contactPhone: '0800000000', status: 'ACTIVE', settings: { create: { shippingFee: 4000 } },
    } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Settlement item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: {
      productId: product.id, sku: tag, title: 'Default', price: options.price ?? 100000, inventory: { create: { quantityOnHand: 10 } },
    } })
    const cart = await prisma.cart.create({ data: { userId: buyer.id, items: { create: { variantId: variant.id, quantity: 1, unitPrice: 100000 } } } })
    const address = await prisma.address.create({ data: {
      userId: buyer.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH',
    } })
    const coupon = await prisma.coupon.create({ data: {
      shopId: options.platform ? null : shop.id, code: tag.toUpperCase(),
      discountType: options.freeShipping ? 'FREE_SHIPPING' : 'FIXED_AMOUNT', discountValue: options.discount ?? 10000, isActive: true,
    } })
    await prisma.buyerCoinWallet.create({ data: { userId: buyer.id, balance: options.coins ?? 20 } })
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, prisma),
      new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))),
      undefined, { provider: 'mock', mockEnabled: true })
    const input = { cartId: cart.id, addressId: address.id, couponCode: coupon.code, coinsToUse: options.coins ?? 20, paymentMethod: 'card' }
    const quote = await checkout.quoteCheckout(buyer, input)
    const result = await checkout.createCheckout(buyer, input)
    const wallets = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 2000))
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma), wallets)
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments),
      undefined, undefined, { provider: 'mock', mockEnabled: true })
    const webhook = { provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid' as const,
      orderId: result.orderId, paymentId: result.paymentId, amount: result.totalCents }
    await payments.handleWebhook(webhook)
    await payments.handleWebhook(webhook)
    const admin = await prisma.user.create({ data: { name: 'Settlement admin', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const completer = await prisma.user.create({ data: { name: 'Settlement completer', email: `${randomUUID()}@example.test`, role: 'ADMIN' } })
    const refunds = new PrismaRefundRepository(context, prisma)
    const returns = new ReturnService(context, new PrismaReturnRepository(context, prisma))
    const payouts = new PayoutService(context, new PrismaPayoutRepository(context, prisma))
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: result.orderId } })
    const shopOrder = await prisma.shopOrder.findFirstOrThrow({ where: { orderId: result.orderId } })
    const complete = async (refundId: string) => {
      await prisma.refund.updateMany({ where: { id: refundId, status: 'PENDING' }, data: { status: 'PROCESSING', processingById: admin.id } })
      return refunds.completeRefundSuccess(refundId, 'PROCESSING', { completedById: completer.id, externalReference: `SETTLEMENT-${refundId}` })
    }
    const deliver = async () => {
      const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: result.orderId } })
      await shipments.packSellerShipment(owner, shipment.id)
      await shipments.shipSellerShipment(owner, shipment.id, { carrier: 'Test carrier', trackingNo: randomUUID() })
      await shipments.deliverAdminShipment(admin, shipment.id, { evidenceReference: randomUUID() })
    }
    const returnMerchandise = async () => {
      const request = await returns.createReturn(buyer, { orderId: result.orderId, orderItemId: item.id, reason: 'Change of mind' })
      await returns.approveSellerReturn(owner, request.id)
      return prisma.refund.findUniqueOrThrow({ where: { returnRequestId: request.id } })
    }
    return { buyer, owner, shop, coupon, quote, result, wallets, refunds, shipments, payouts, item, shopOrder, admin, completer, complete, deliver, returnMerchandise, checkout, payments, variant, address }
  }

  it('credits shipping and seller-funded net merchandise using the purchase fee after the live rate changes', async () => {
    const data = await sale()
    expect(data.quote.grandTotal).toBe(92000)
    expect(data.result.totalCents).toBe(92000)
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: data.result.paymentId } })).amount).toBe(92000n)
    await data.deliver()
    const entries = await prisma.walletLedgerEntry.findMany({ where: { orderId: data.result.orderId } })
    expect(entries.filter((entry) => entry.type === 'order_earning').map((entry) => entry.amount)).toEqual([94000n])
    expect(entries.filter((entry) => entry.type === 'commission_fee').map((entry) => entry.amount)).toEqual([-9000n])
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(85000)
    await data.wallets.createEarningsForCompletedOrder(data.result.orderId)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId } })).toBe(2)
  })

  it('keeps platform coupon and coins out of the commission base and preserves snapshots after promotion edits', async () => {
    const data = await sale({ platform: true, discount: 5000 })
    expect(data.result.totalCents).toBe(97000)
    const item = await prisma.itemSaleSnapshot.findUniqueOrThrow({ where: { orderItemId: data.item.id } })
    expect(item).toMatchObject({ sellerCouponDiscount: 0n, platformCouponDiscount: 5000n, coinDiscount: 2000n, buyerMerchandise: 93000n })
    await prisma.coupon.update({ where: { id: data.coupon.id }, data: { discountValue: 99999, shopId: data.shop.id } })
    await data.deliver()
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(94000)
  })

  it('returns full merchandise once, restores every spent coin, reverses the original fee and retains shipping', async () => {
    const data = await sale()
    await data.deliver()
    const refund = await data.returnMerchandise()
    expect(refund.amount).toBe(88000n)
    await expect(data.complete(refund.id)).resolves.toMatchObject({ status: 'SUCCESS' })
    await expect(data.complete(refund.id)).resolves.toBeNull()
    const entries = await prisma.walletLedgerEntry.findMany({ where: { refundId: refund.id } })
    expect(entries.filter((row) => row.type === 'refund_adjustment').map((row) => row.amount)).toEqual([-90000n])
    expect(entries.filter((row) => row.type === 'commission_fee').map((row) => row.amount)).toEqual([9000n])
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(4000)
    expect(await prisma.buyerCoinLedger.aggregate({ where: { orderId: data.result.orderId, referenceType: 'REFUND_COIN_RESTORE' }, _sum: { amount: true } })).toMatchObject({ _sum: { amount: 20n } })
  })

  it('records a pre-earning cancellation and never creates debt or later earning on returned rights', async () => {
    const data = await sale()
    const intent = { items: [{ orderItemId: data.item.id, quantity: 1 }], shipping: [{ shopOrderId: data.shopOrder.id, cause: 'PRE_SHIPMENT_CANCEL' as const }] }
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, intent)
    expect(refund.amount).toBe(92000n)
    await data.complete(refund.id)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId } })).toBe(0)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(0)
    expect(await prisma.shipment.findFirstOrThrow({ where: { orderId: data.result.orderId } })).toMatchObject({ status: 'CANCELED' })
    expect(await prisma.inventory.findFirstOrThrow({ where: { variantId: data.item.variantId } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    await expect(data.deliver()).rejects.toMatchObject({ code: 'INVALID_SHIPMENT_STATE' })
    // A stale eligibility update cannot recreate rights already reversed by the refund.
    await prisma.order.update({ where: { id: data.result.orderId }, data: { status: 'DELIVERED', paymentStatus: 'SUCCEEDED' } })
    await data.wallets.createEarningsForCompletedOrder(data.result.orderId)
    const wallet = await data.wallets.getSellerWallet(data.owner)
    expect(wallet.availableBalanceCents).toBe(0)
    expect(wallet.sellerDebtCents).toBe(0)
    await data.wallets.createEarningsForCompletedOrder(data.result.orderId)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId, type: 'order_earning' } })).toBe(1)
  })

  it('distinguishes marketplace and shop free-shipping funding', async () => {
    const platform = await sale({ platform: true, freeShipping: true, coins: 0 })
    const seller = await sale({ freeShipping: true, coins: 0 })
    expect(platform.result.totalCents).toBe(100000)
    expect(seller.result.totalCents).toBe(100000)
    await platform.deliver()
    await seller.deliver()
    expect((await platform.wallets.getSellerWallet(platform.owner)).availableBalanceCents).toBe(94000)
    expect((await seller.wallets.getSellerWallet(seller.owner)).availableBalanceCents).toBe(90000)
    expect(await prisma.shopSaleSnapshot.findUniqueOrThrow({ where: { shopOrderId: platform.shopOrder.id } })).toMatchObject({ originalShipping: 4000n, buyerShipping: 0n, platformShippingSubsidy: 4000n, sellerShippingWaiver: 0n })
    expect(await prisma.shopSaleSnapshot.findUniqueOrThrow({ where: { shopOrderId: seller.shopOrder.id } })).toMatchObject({ originalShipping: 4000n, buyerShipping: 0n, platformShippingSubsidy: 0n, sellerShippingWaiver: 4000n })
  })

  it('reverses zero-cash subsidized merchandise without charging unearned seller funds', async () => {
    const data = await sale({ platform: true, price: 10000, discount: 10000, coins: 0 })
    expect(data.result.totalCents).toBe(4000)
    await data.deliver()
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(13000)
    const refund = await data.returnMerchandise()
    expect(refund.amount).toBe(0n)
    await data.complete(refund.id)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(4000)
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 1000n })
  })

  it('blocks an unfunded outstanding payout after a refund and releases its reservation without inventing debt', async () => {
    const data = await sale()
    await data.deliver()
    const payout = await data.payouts.createSellerPayout(data.owner, { amount: 85000 })
    const refund = await data.returnMerchandise()
    await data.complete(refund.id)
    await expect(data.payouts.approveAdminPayout(data.admin, payout.id)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
    const reserved = await data.wallets.getSellerWallet(data.owner)
    expect(reserved.availableBalanceCents).toBe(-81000)
    expect(reserved.sellerDebtCents).toBe(0)
    await data.payouts.rejectAdminPayout(data.admin, payout.id, { reason: 'Refund consumed reserved entitlement' })
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(4000)
  })

  it('shows debt after a paid payout and uses future earnings to offset it', async () => {
    const data = await sale()
    await data.deliver()
    const payout = await data.payouts.createSellerPayout(data.owner, { amount: 85000 })
    await data.payouts.approveAdminPayout(data.admin, payout.id)
    await data.payouts.markAdminPayoutPaid(data.completer, payout.id, { externalReference: 'TEST-MANUAL-RECEIPT' })
    const refund = await data.returnMerchandise()
    await data.complete(refund.id)
    expect(await data.wallets.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: -81000, sellerDebtCents: 81000 })
    await expect(data.payouts.createSellerPayout(data.owner, { amount: 1 })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
    const cart = await prisma.cart.create({ data: { userId: data.buyer.id, items: { create: { variantId: data.variant.id, quantity: 1, unitPrice: 100000 } } } })
    const next = await data.checkout.createCheckout(data.buyer, { cartId: cart.id, addressId: data.address.id, paymentMethod: 'card' })
    await data.payments.handleWebhook({ provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid', orderId: next.orderId, paymentId: next.paymentId, amount: next.totalCents })
    const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: next.orderId } })
    await data.shipments.packSellerShipment(data.owner, shipment.id)
    await data.shipments.shipSellerShipment(data.owner, shipment.id, { carrier: 'Test carrier', trackingNo: randomUUID() })
    await data.shipments.deliverAdminShipment(data.admin, shipment.id, { evidenceReference: randomUUID() })
    expect(await data.wallets.getSellerWallet(data.owner)).toMatchObject({ availableBalanceCents: 13000, sellerDebtCents: 0 })
  })
})
