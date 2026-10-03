import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { createFinanceFixture, createPartialFinanceFixture } from '../../../e2e/helpers/finance-fixtures.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { AffiliateService } from '#server/modules/affiliate/affiliate.service.ts'
import { PrismaAffiliateRepository } from '#server/modules/affiliate/affiliate.repository.ts'
import { PrismaRefundRepository } from './refund.repository.ts'

const databaseUrl = process.env['COMMERCE_TEST_DATABASE_URL']
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('independent W7 NET/TAX conservation review on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/marketplace_test_completion') throw new Error('Use the local marketplace_test_completion database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function processing(f: Awaited<ReturnType<typeof createFinanceFixture>>, intent: Parameters<PrismaRefundRepository['createPlannedRefund']>[1]) {
    const repo = new PrismaRefundRepository(context, db)
    const refund = await repo.createPlannedRefund(f.order.id, intent)
    await new PrismaAdminRepository(context, db).updateRefundStatus(refund.id, 'PENDING', { status: 'PROCESSING', processingById: f.admin.id })
    return { refund, complete: () => repo.completeRefundSuccess(refund.id, 'PROCESSING', { completedById: f.secondAdmin.id, externalReference: `REVIEW-${randomUUID()}` }) }
  }

  async function affiliate(f: Awaited<ReturnType<typeof createFinanceFixture>>) {
    const account = await db.affiliate.create({ data: { userId: f.secondAdmin.id } })
    const link = await db.affiliateLink.create({ data: { affiliateId: account.id, code: randomUUID(), targetType: 'product', targetId: f.items[0]!.variantId } })
    return { account, link }
  }

  it('rejects a v2 affiliate award with missing buyer NET instead of using inclusive gross as legacy basis', async () => {
    const f = await createPartialFinanceFixture(db)
    const { account, link } = await affiliate(f)
    await db.affiliateClick.create({ data: { affiliateId: account.id, linkId: link.id, buyerUserId: f.buyer.id, expiresAt: new Date(Date.now() + 60000) } })
    await db.itemSaleSnapshot.update({ where: { orderItemId: f.item.id }, data: { buyerMerchandiseNet: null } })
    const service = new AffiliateService(context, new PrismaAffiliateRepository(context, db), { enabled: true, commissionBps: 1000, attributionWindowDays: 30, blockSelfReferral: true })
    await expect(service.createCommissionForPaidOrder({ orderId: f.order.id })).rejects.toMatchObject({ status: 409 })
    expect(await db.affiliateCommission.count({ where: { orderId: f.order.id } })).toBe(0)
  })

  it.each([1, 2, 3])('uses the explicitly frozen affiliate version or rejects unsupported version %s', async (version) => {
    const f = version === 1 ? await createFinanceFixture(db, true) : await createPartialFinanceFixture(db)
    const { account, link } = await affiliate(f)
    await db.affiliateClick.create({ data: { affiliateId: account.id, linkId: link.id, buyerUserId: f.buyer.id, expiresAt: new Date(Date.now() + 60000) } })
    if (version === 3) await db.shopSaleSnapshot.updateMany({ where: { shopOrder: { orderId: f.order.id } }, data: { policyVersion: 3 } })
    const service = new AffiliateService(context, new PrismaAffiliateRepository(context, db), { enabled: true, commissionBps: 1000, attributionWindowDays: 30, blockSelfReferral: true })
    if (version === 3) {
      await expect(service.createCommissionForPaidOrder({ orderId: f.order.id })).rejects.toMatchObject({ status: 409 })
      expect(await db.affiliateCommission.count({ where: { orderId: f.order.id } })).toBe(0)
    } else {
      expect(await service.createCommissionForPaidOrder({ orderId: f.order.id })).toMatchObject({ eligiblesubtotal: version === 1 ? 8000n : 94n, commission: version === 1 ? 800n : 9n })
      const bases = await db.affiliateCommissionItem.findMany({ where: { commission: { orderId: f.order.id } } })
      expect(bases.reduce((sum, basis) => sum + basis.originalEligibleNet, 0n)).toBe(version === 1 ? 8000n : 94n)
    }
  })

  it('labels v2 wallet debit and fee reversal with the original settlement policy version', async () => {
    const f = await createPartialFinanceFixture(db)
    const plan = await processing(f, { items: [{ orderItemId: f.item.id, quantity: 1 }], shipping: [] })
    await plan.complete()
    const entries = await db.walletLedgerEntry.findMany({ where: { refundId: plan.refund.id } })
    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.metadata)).toEqual([expect.objectContaining({ policyVersion: 2 }), expect.objectContaining({ policyVersion: 2 })])
  })

  it('fails closed on a historical funded affiliate award with no original item basis and rolls back refund effects', async () => {
    const f = await createFinanceFixture(db, true)
    const { account, link } = await affiliate(f)
    await db.affiliateCommission.create({ data: { affiliateId: account.id, linkId: link.id, orderId: f.order.id, eligiblesubtotal: 8000n, commissionBps: 1000, commission: 800n } })
    const plan = await processing(f, { items: [{ orderItemId: f.items[0]!.id, quantity: 1 }], shipping: [] })
    await expect(plan.complete()).rejects.toMatchObject({ status: 409 })
    expect((await db.refund.findUniqueOrThrow({ where: { id: plan.refund.id } })).status).toBe('PROCESSING')
    expect(await db.walletLedgerEntry.count({ where: { refundId: plan.refund.id } })).toBe(0)
    expect(await db.affiliateRefundReversal.count({ where: { refundId: plan.refund.id } })).toBe(0)
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(7700n)
  })

  it('completes different-item plans concurrently and conserves the original one-cent seller and affiliate fees', async () => {
    const f = await createFinanceFixture(db, true)
    const totals = { subtotal: 12n, discountTotal: 0n, shippingTotal: 0n, taxTotal: 0n, includedTaxTotal: 1n, reportedTaxTotal: 1n, grandTotal: 12n }
    await db.checkout.update({ where: { id: f.order.checkoutId }, data: totals })
    await db.order.update({ where: { id: f.order.id }, data: totals })
    await db.shopOrder.updateMany({ where: { orderId: f.order.id }, data: totals })
    await db.payment.updateMany({ where: { orderId: f.order.id }, data: { amount: 12n } })
    const shop = await db.shopOrder.findFirstOrThrow({ where: { orderId: f.order.id } })
    await db.shopSaleSnapshot.update({ where: { shopOrderId: shop.id }, data: { policyVersion: 2, commissionBase: 11n, originalCommission: 1n, originalShipping: 0n, buyerShipping: 0n,
      taxRatePpm: 70000, taxMode: 'INCLUSIVE', taxFundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false, taxShippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', taxRounding: 'LINE_HALF_UP', taxCustodian: 'SELLER', taxExclusiveFunding: 'BUYER', taxPolicyRevision: 'review-two-items',
      sellerGrossMerchandise: 12n, sellerGrossShipping: 0n, buyerShippingNet: 0n, buyerShippingTax: 0n, platformShippingNet: 0n, platformShippingTax: 0n, includedTaxTotal: 1n, addedTaxTotal: 0n, reportedTaxTotal: 1n } })
    for (const [index, item] of f.items.entries()) {
      const gross = index === 0 ? 4n : 8n
      const net = index === 0 ? 4n : 7n
      const tax = index === 0 ? 0n : 1n
      await db.orderItem.update({ where: { id: item.id }, data: { unitPrice: gross, lineTotal: gross } })
      await db.itemSaleSnapshot.update({ where: { orderItemId: item.id }, data: { grossMerchandise: gross, sellerCouponDiscount: 0n, buyerMerchandise: gross, buyerMerchandiseNet: net, buyerMerchandiseTax: tax, platformCouponNet: 0n, platformCouponTax: 0n, coinFundingNet: 0n, coinFundingTax: 0n, originalCashbackEligibleNet: net, originalAffiliateEligibleNet: net } })
    }
    await db.walletLedgerEntry.updateMany({ where: { walletId: f.wallet.id, type: 'order_earning' }, data: { amount: 12n } })
    await db.walletLedgerEntry.updateMany({ where: { walletId: f.wallet.id, type: 'commission_fee' }, data: { amount: -1n } })
    const { account, link } = await affiliate(f)
    const award = await db.affiliateCommission.create({ data: { affiliateId: account.id, linkId: link.id, orderId: f.order.id, eligiblesubtotal: 11n, commissionBps: 1000, commission: 1n,
      itemBases: { create: f.items.map((item, index) => ({ orderItemId: item.id, originalQuantity: 1, originalEligibleNet: index === 0 ? 4n : 7n })) } } })
    const plans = await Promise.all(f.items.map((item) => processing(f, { items: [{ orderItemId: item.id, quantity: 1 }], shipping: [] })))
    expect(await db.refundShopAllocation.aggregate({ where: { refundId: { in: plans.map((plan) => plan.refund.id) } }, _sum: { commissionReversal: true } })).toMatchObject({ _sum: { commissionReversal: 0n } })
    const results = await Promise.all(plans.map((plan) => plan.complete()))
    expect(results.map((result) => result?.status)).toEqual(['SUCCESS', 'SUCCESS'])
    expect((await db.refundShopAllocation.aggregate({ where: { refundId: { in: plans.map((plan) => plan.refund.id) } }, _sum: { commissionReversal: true } }))._sum.commissionReversal).toBe(1n)
    expect((await db.affiliateRefundReversal.aggregate({ where: { commissionId: award.id }, _sum: { amount: true, eligibleNetReversed: true } }))._sum).toEqual({ amount: 1n, eligibleNetReversed: 11n })
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(0n)
    expect((await db.refundItemAllocation.aggregate({ where: { itemSale: { shopOrderId: shop.id } }, _sum: { cashMerchandise: true, buyerTaxRefund: true } }))._sum).toEqual({ cashMerchandise: 11n, buyerTaxRefund: 1n })
  })

  it.each([false, true])('seller-fault shipping refund preserves incurred platform NET/TAX subsidy: platform=%s', async (platform) => {
    const f = await createPartialFinanceFixture(db)
    const shippingCash = platform ? 0n : 107n
    const totals = { shippingTotal: shippingCash, grandTotal: 101n + shippingCash, includedTaxTotal: 14n, reportedTaxTotal: 14n }
    await db.checkout.update({ where: { id: f.order.checkoutId }, data: totals })
    await db.order.update({ where: { id: f.order.id }, data: totals })
    await db.shopOrder.update({ where: { id: f.shopOrder.id }, data: totals })
    await db.payment.updateMany({ where: { orderId: f.order.id }, data: { amount: 101n + shippingCash } })
    await db.shopSaleSnapshot.update({ where: { shopOrderId: f.shopOrder.id }, data: { taxableShipping: true, originalShipping: 107n, buyerShipping: shippingCash,
      buyerShippingNet: platform ? 0n : 100n, buyerShippingTax: platform ? 0n : 7n, platformShippingSubsidy: platform ? 107n : 0n, platformShippingNet: platform ? 100n : 0n, platformShippingTax: platform ? 7n : 0n,
      sellerGrossShipping: 107n, includedTaxTotal: 14n, reportedTaxTotal: 14n } })
    await db.walletLedgerEntry.updateMany({ where: { walletId: f.wallet.id, type: 'order_earning' }, data: { amount: 208n } })
    const shipping = await processing(f, { items: [], shipping: [{ shopOrderId: f.shopOrder.id, cause: 'SELLER_FAULT' }] })
    expect(shipping.refund.amount).toBe(platform ? 0n : 107n)
    await shipping.complete()
    expect(await db.refundShopAllocation.findFirstOrThrow({ where: { refundId: shipping.refund.id } })).toMatchObject({ buyerShippingRefund: platform ? 0n : 100n, buyerShippingTaxRefund: platform ? 0n : 7n, platformShippingReversal: 0n, platformShippingTaxReversal: 0n, commissionReversal: 0n })
    const merchandise = await processing(f, { items: [{ orderItemId: f.item.id, quantity: 3 }], shipping: [] })
    await merchandise.complete()
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(platform ? 107n : 0n)
  })
})
