import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { CheckoutService } from '#server/modules/checkout/checkout.service.ts'
import { PrismaCheckoutRepository } from '#server/modules/checkout/checkout.repository.ts'
import { CheckoutQuoteEvaluator } from '#server/modules/checkout/checkout-quote.evaluator.ts'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { PrismaPromotionRepository } from '#server/modules/promotion/promotion.repository.ts'
import { CommissionService } from '#server/modules/commission/commission.service.ts'
import { WalletService } from '#server/modules/wallet/wallet.service.ts'
import { PrismaWalletRepository } from '#server/modules/wallet/wallet.repository.ts'
import { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { PaymentService } from '#server/modules/payment/payment.service.ts'
import { PrismaPaymentRepository } from '#server/modules/payment/payment.repository.ts'
import { PaymentSettlement } from '#server/modules/payment/payment.settlement.ts'
import { PrismaRefundRepository } from './refund.repository.ts'
import { AdminService } from '#server/modules/admin/admin.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

function barrier() {
  let release: () => void = () => { throw new Error('Barrier is not initialized') }
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

describe.skipIf(!url)('snapshotted refund races on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) throw new Error('Use a local disposable marketplace_test_* database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })

  async function sale(itemCount = 1, splitShops = false, coins = 0) {
    const tag = randomUUID()
    const buyer = await prisma.user.create({ data: { name: 'Refund race buyer', email: `${tag}@example.test` } })
    const owner = await prisma.user.create({ data: { name: 'Refund race seller', email: `${randomUUID()}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: owner.id } })
    const shop = await prisma.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: 'Refund race shop', slug: tag,
      contactEmail: owner.email, contactPhone: '0800000000', status: 'ACTIVE', settings: { create: { shippingFee: 500 } } } })
    const shopOwners = [{ shop, owner }]
    const variantIds: string[] = []
    for (let index = 0; index < itemCount; index++) {
      let itemShop = shop
      if (splitShops && index > 0) {
        const otherOwner = await prisma.user.create({ data: { name: 'Refund race second seller', email: `${randomUUID()}@example.test` } })
        const otherProfile = await prisma.sellerProfile.create({ data: { userId: otherOwner.id } })
        itemShop = await prisma.shop.create({ data: { ownerId: otherOwner.id, sellerProfileId: otherProfile.id, name: 'Refund race second shop', slug: `${tag}-${index}`,
          contactEmail: otherOwner.email, contactPhone: '0800000000', status: 'ACTIVE', settings: { create: { shippingFee: 500 } } } })
        shopOwners.push({ shop: itemShop, owner: otherOwner })
      }
      const product = await prisma.product.create({ data: { shopId: itemShop.id, title: 'Refund race item', slug: `${tag}-${index}`, status: 'ACTIVE' } })
      const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: `${tag}-${index}`, title: 'Default', price: 10000, inventory: { create: { quantityOnHand: 10 } } } })
      variantIds.push(variant.id)
    }
    const cart = await prisma.cart.create({ data: { userId: buyer.id, items: { create: variantIds.map((variantId) => ({ variantId, quantity: 1, unitPrice: 10000 })) } } })
    const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: 'Buyer', line1: '1 Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const coupon = await prisma.coupon.create({ data: { code: tag.toUpperCase(), discountType: 'FIXED_AMOUNT', discountValue: 2000, isActive: true } })
    if (coins) await prisma.buyerCoinWallet.create({ data: { userId: buyer.id, balance: coins } })
    const checkout = new CheckoutService(context, new PrismaCheckoutRepository(context, prisma), new CheckoutQuoteEvaluator(new PromotionService(context, new PrismaPromotionRepository(context, prisma))), undefined, { provider: 'mock', mockEnabled: true })
    const result = await checkout.createCheckout(buyer, { cartId: cart.id, addressId: address.id, couponCode: coupon.code, coinsToUse: coins, paymentMethod: 'card' })
    const wallets = new WalletService(context, new PrismaWalletRepository(context, prisma), new CommissionService(context, 1000))
    const shipments = new ShipmentService(context, new PrismaShipmentRepository(context, prisma), wallets)
    const payments = new PaymentService(context, new PrismaPaymentRepository(context, prisma), new PaymentSettlement(shipments), undefined, undefined, { provider: 'mock', mockEnabled: true })
    await payments.handleWebhook({ provider: 'mock', providerRef: randomUUID(), eventType: 'payment.paid', orderId: result.orderId, paymentId: result.paymentId, amount: result.totalCents })
    const admin = await prisma.user.create({ data: { name: 'Processing admin', role: 'ADMIN', email: `${randomUUID()}@example.test` } })
    const completer = await prisma.user.create({ data: { name: 'Completing admin', role: 'ADMIN', email: `${randomUUID()}@example.test` } })
    const refunds = new PrismaRefundRepository(context, prisma)
    const items = await prisma.orderItem.findMany({ where: { orderId: result.orderId }, orderBy: { id: 'asc' } })
    const shopOrder = await prisma.shopOrder.findUniqueOrThrow({ where: { orderId_shopId: { orderId: result.orderId, shopId: shop.id } } })
    const deliver = async () => {
      const shipment = await prisma.shipment.findFirstOrThrow({ where: { orderId: result.orderId, shopId: shop.id } })
      await shipments.packSellerShipment(owner, shipment.id)
      await shipments.shipSellerShipment(owner, shipment.id, { carrier: 'Test carrier', trackingNo: randomUUID() })
      await shipments.deliverAdminShipment(admin, shipment.id, { evidenceReference: randomUUID() })
    }
    const processing = async (refundId: string) => prisma.refund.update({ where: { id: refundId }, data: { status: 'PROCESSING', processingById: admin.id } })
    const complete = (refundId: string, repository = refunds) => repository.completeRefundSuccess(refundId, 'PROCESSING', { completedById: completer.id, externalReference: `RACE-${refundId}` })
    const intent = { items: items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })), shipping: [] }
    return { buyer, owner, result, wallets, refunds, items, shopOrder, shopOwners, admin, completer, deliver, processing, complete, intent }
  }

  it('commits a concurrent completion replay exactly once', async () => {
    const data = await sale()
    await data.deliver()
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    expect(refund.amount).toBe(8000n)
    await data.processing(refund.id)
    const outcomes = await Promise.all([data.complete(refund.id), data.complete(refund.id)])
    expect(outcomes.filter(Boolean)).toHaveLength(1)
    const entries = await prisma.walletLedgerEntry.findMany({ where: { refundId: refund.id }, orderBy: { amount: 'asc' } })
    expect(entries.map((entry) => entry.amount)).toEqual([-10000n, 1000n])
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(500)
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 1000n, walletPostedAt: expect.any(Date) })
  })

  it('conserves the remaining shipping entitlement when refund and recognition race', async () => {
    const data = await sale()
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    await data.processing(refund.id)
    await prisma.order.update({ where: { id: data.result.orderId }, data: { status: 'DELIVERED' } })
    await Promise.all([data.complete(refund.id), data.wallets.createEarningsForCompletedOrder(data.result.orderId)])
    await data.wallets.createEarningsForCompletedOrder(data.result.orderId)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(500)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId, type: 'order_earning' } })).toBe(1)
    expect(await prisma.shopSaleSnapshot.findUniqueOrThrow({ where: { shopOrderId: data.shopOrder.id } })).toMatchObject({ recognizedAt: expect.any(Date) })
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: 'SUCCESS' })
  })

  it('serializes overlapping plan reservations and releases a failed plan', async () => {
    const data = await sale()
    const results = await Promise.allSettled([data.refunds.createPlannedRefund(data.result.orderId, data.intent), data.refunds.createPlannedRefund(data.result.orderId, data.intent)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const reserved = await prisma.refund.findFirstOrThrow({ where: { orderId: data.result.orderId, status: 'PENDING' } })
    expect(reserved.amount).toBe(8000n)
    await prisma.refund.update({ where: { id: reserved.id }, data: { status: 'FAILED' } })
    const replacement = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    expect(replacement.amount).toBe(8000n)
    expect(await prisma.refundItemAllocation.count({ where: { refundId: replacement.id } })).toBe(1)
  })

  it('rolls back status, commission, and wallet postings after a late coin failure', async () => {
    const data = await sale()
    await data.deliver()
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    await data.processing(refund.id)
    const failing = prisma.$extends({ query: { buyerCoinLedger: { findFirst: async () => { throw new Error('Injected late reward failure') } } } })
    const repository = new PrismaRefundRepository(context, failing as unknown as PrismaClient)
    await expect(data.complete(refund.id, repository)).rejects.toThrow('Injected late reward failure')
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: 'PROCESSING' })
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 0n, walletPostedAt: null })
    expect(await prisma.walletLedgerEntry.count({ where: { refundId: refund.id } })).toBe(0)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(9500)
    await data.complete(refund.id)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(500)
  })

  it('refunds seller-fault shipping once across two full item plans', async () => {
    const data = await sale(2)
    await data.deliver()
    const first = await data.refunds.createPlannedRefund(data.result.orderId, { items: [{ orderItemId: data.items[0]!.id, quantity: 1 }], shipping: [{ shopOrderId: data.shopOrder.id, cause: 'SELLER_FAULT' }] })
    const second = await data.refunds.createPlannedRefund(data.result.orderId, { items: [{ orderItemId: data.items[1]!.id, quantity: 1 }], shipping: [{ shopOrderId: data.shopOrder.id, cause: 'SELLER_FAULT' }] })
    expect([first.amount, second.amount]).toEqual([9500n, 9000n])
    await data.processing(first.id); await data.processing(second.id)
    await Promise.all([data.complete(first.id), data.complete(second.id)])
    expect(await prisma.refundShopAllocation.aggregate({ where: { refundId: { in: [first.id, second.id] } }, _sum: { buyerShippingRefund: true, commissionReversal: true } })).toMatchObject({ _sum: { buyerShippingRefund: 500n, commissionReversal: 2000n } })
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(0)
  })

  it('preserves a frozen plan when processing wins the plan-write CAS race', async () => {
    const data = await sale()
    await data.deliver()
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    const originalAllocation = await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })
    const reached = barrier()
    const resume = barrier()
    const gated = prisma.$extends({ query: { refund: { updateMany: async ({ args, query }) => {
      if (args.where?.status === 'PENDING' && args.data.amount !== undefined) { reached.release(); await resume.promise }
      return query(args)
    } } } })
    const repository = new PrismaRefundRepository(context, gated as unknown as PrismaClient)
    const prepared = repository.prepareRefundPlan(refund.id, { ...data.intent, shipping: [{ shopOrderId: data.shopOrder.id, cause: 'SELLER_FAULT' }] })
    const outcome = prepared.then(() => null, (error: unknown) => error)
    await reached.promise
    await data.processing(refund.id)
    resume.release()
    expect(await outcome).toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: 'PROCESSING', amount: 8000n })
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ id: originalAllocation.id, shippingCause: 'NONE', buyerShippingRefund: 0n })
    await data.complete(refund.id)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(500)
  })

  it('credits the delivered shop after the real admin flow cancels its pending sibling', async () => {
    const data = await sale(2, true)
    await data.deliver()
    expect(await prisma.order.findUniqueOrThrow({ where: { id: data.result.orderId } })).toMatchObject({ status: 'PARTIALLY_FULFILLED' })
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId } })).toBe(0)
    const canceled = data.shopOwners[1]!
    const item = data.items.find((item) => item.shopId === canceled.shop.id)!
    const shopOrder = await prisma.shopOrder.findUniqueOrThrow({ where: { orderId_shopId: { orderId: data.result.orderId, shopId: canceled.shop.id } } })
    const adminService = new AdminService(context, new PrismaAdminRepository(context, prisma), undefined, data.refunds, undefined, data.wallets)
    const refund = await adminService.createSettlementRefund(data.admin, data.result.orderId, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [{ shopOrderId: shopOrder.id, cause: 'PRE_SHIPMENT_CANCEL' }] })
    expect(refund.amount).toBe(9500n)
    await adminService.updateRefundStatus(data.admin, refund.id, { status: 'PROCESSING' })
    await adminService.updateRefundStatus(data.completer, refund.id, { status: 'SUCCESS', externalReference: `ADMIN-CANCEL-${refund.id}` })
    await adminService.updateRefundStatus(data.completer, refund.id, { status: 'SUCCESS', externalReference: `ADMIN-CANCEL-${refund.id}` })
    expect(await prisma.order.findUniqueOrThrow({ where: { id: data.result.orderId } })).toMatchObject({ status: 'DELIVERED', paymentStatus: 'SUCCEEDED' })
    expect(await prisma.shipment.findFirstOrThrow({ where: { orderId: data.result.orderId, shopId: canceled.shop.id } })).toMatchObject({ status: 'CANCELED' })
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId: item.variantId } })).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 })
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(9500)
    expect((await data.wallets.getSellerWallet(canceled.owner)).availableBalanceCents).toBe(0)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId, shopId: data.shopOrder.shopId, type: 'order_earning' } })).toBe(1)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: data.result.orderId, shopId: canceled.shop.id, type: 'order_earning' } })).toBe(1)
    expect(await prisma.walletLedgerEntry.findFirstOrThrow({ where: { orderId: data.result.orderId, shopId: canceled.shop.id, type: 'order_earning' } })).toMatchObject({ amount: 0n })
  })

  it.each(['missing', 'insufficient', 'excess-restores', 'wrong-wallet'] as const)('rolls back the entire refund when original coin spend proof is %s', async (corruption) => {
    const data = await sale(1, false, 20)
    await data.deliver()
    const refund = await data.refunds.createPlannedRefund(data.result.orderId, data.intent)
    expect(refund.amount).toBe(6000n)
    await data.processing(refund.id)
    if (corruption === 'missing') {
      await prisma.buyerCoinLedger.deleteMany({ where: { orderId: data.result.orderId, type: 'SPENT' } })
    } else if (corruption === 'insufficient') {
      await prisma.buyerCoinLedger.updateMany({ where: { orderId: data.result.orderId, type: 'SPENT' }, data: { amount: 19 } })
    } else if (corruption === 'wrong-wallet') {
      const otherBuyer = await prisma.user.create({ data: { name: 'Unrelated coin wallet owner', email: `${randomUUID()}@example.test` } })
      const otherWallet = await prisma.buyerCoinWallet.create({ data: { userId: otherBuyer.id, balance: 7 } })
      await prisma.buyerCoinLedger.updateMany({ where: { orderId: data.result.orderId, type: 'SPENT' }, data: { walletId: otherWallet.id } })
    } else {
      const wallet = await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })
      await prisma.buyerCoinLedger.create({ data: { walletId: wallet.id, userId: data.buyer.id, orderId: data.result.orderId, type: 'REFUNDED', status: 'AVAILABLE', amount: 21, balanceAfter: 0,
        referenceType: 'REFUND_COIN_RESTORE', referenceId: randomUUID(), reason: 'Isolated corrupt history fixture' } })
    }
    await expect(data.complete(refund.id)).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: 'PROCESSING' })
    expect(await prisma.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).toMatchObject({ commissionReversal: 0n, walletPostedAt: null })
    expect(await prisma.walletLedgerEntry.count({ where: { refundId: refund.id } })).toBe(0)
    expect((await data.wallets.getSellerWallet(data.owner)).availableBalanceCents).toBe(9500)
    expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { userId: data.buyer.id } })).toMatchObject({ balance: 0n, lifetimeSpent: 20n })
    if (corruption === 'wrong-wallet') {
      const spend = await prisma.buyerCoinLedger.findFirstOrThrow({ where: { orderId: data.result.orderId, type: 'SPENT' } })
      expect(await prisma.buyerCoinWallet.findUniqueOrThrow({ where: { id: spend.walletId } })).toMatchObject({ balance: 7n, lifetimeSpent: 0n })
    }
  })
})
