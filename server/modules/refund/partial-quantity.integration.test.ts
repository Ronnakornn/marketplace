import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { createPartialFinanceFixture } from '../../../e2e/helpers/finance-fixtures.ts'
import { PrismaReturnRepository } from '#server/modules/return/return.repository.ts'
import { ReturnService } from '#server/modules/return/return.service.ts'
import { PrismaAdminRepository } from '#server/modules/admin/admin.repository.ts'
import { PrismaAffiliateRepository } from '#server/modules/affiliate/affiliate.repository.ts'
import { PrismaOrderRepository } from '#server/modules/order/order.repository.ts'
import { OrderService } from '#server/modules/order/order.service.ts'
import { PrismaRefundRepository } from './refund.repository.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('original partial quantity refunds on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) throw new Error('Use a disposable local marketplace_test_* database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(coins = false) {
    const f = await createPartialFinanceFixture(db, coins)
    const { item, shopOrder } = f
    const returns = new ReturnService(context, new PrismaReturnRepository(context, db))
    const refunds = new PrismaRefundRepository(context, db)
    const request = async () => {
      const returned = await returns.createReturn(f.buyer, { orderId: f.order.id, orderItemId: item.id, quantity: 1, reason: 'Partial original sale return' })
      await returns.approveSellerReturn(f.seller, returned.id)
      const refund = await db.refund.findUniqueOrThrow({ where: { returnRequestId: returned.id } })
      await new PrismaAdminRepository(context, db).updateRefundStatus(refund.id, 'PENDING', { status: 'PROCESSING', processingById: f.admin.id })
      return { returned, refund }
    }
    const complete = (id: string, repository = refunds) => repository.completeRefundSuccess(id, 'PROCESSING', { completedById: f.secondAdmin.id, externalReference: `TEST-${randomUUID()}` })
    return { ...f, item, shopOrder, returns, refunds, request, complete }
  }

  it('returns cash33/33/35 and fee2/3/4, closes each Return and leaves zero seller rights', async () => {
    const f = await fixture()
    const orders = new OrderService(context, new PrismaOrderRepository(context, db))
    expect((await orders.getBuyerOrder(f.buyer, f.order.id)).totals).toMatchObject({ grandTotal: 101n, taxTotal: 0n, includedTaxTotal: 7n, reportedTaxTotal: 7n })
    const cash: bigint[] = []
    const fees: bigint[] = []
    for (let index = 0; index < 3; index++) {
      expect((await orders.getBuyerOrder(f.buyer, f.order.id)).items[0]).toMatchObject({ remainingReturnQuantity: 3 - index, hasActiveReturn: false })
      const { returned, refund } = await f.request()
      expect((await orders.getBuyerOrder(f.buyer, f.order.id)).items[0]).toMatchObject({ remainingReturnQuantity: 0, hasActiveReturn: true })
      expect((await new PrismaAdminRepository(context, db).findRefundById(refund.id))?.itemAllocations?.[0]).toMatchObject({ remainingQuantity: 3 - index, successfulQuantityBefore: index })
      expect(await f.complete(refund.id)).toMatchObject({ status: 'SUCCESS' })
      cash.push((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).amount)
      fees.push((await db.refundShopAllocation.findFirstOrThrow({ where: { refundId: refund.id } })).commissionReversal)
      expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe('COMPLETED')
      expect(await f.complete(refund.id)).toBeNull()
    }
    expect(cash).toEqual([33n, 33n, 35n])
    expect((await orders.getBuyerOrder(f.buyer, f.order.id)).items[0]).toMatchObject({ remainingReturnQuantity: 0, hasActiveReturn: false })
    expect(fees).toEqual([2n, 3n, 4n])
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(0n)
    expect((await db.refundItemAllocation.aggregate({ where: { itemSale: { orderItemId: f.item.id } }, _sum: { quantity: true, buyerTaxRefund: true } }))._sum).toMatchObject({ quantity: 3, buyerTaxRefund: 7n })
    await expect(f.request()).rejects.toMatchObject({ status: 409 })
  })

  it('restores gross coin funding99/100/101 as coin deltas0/1/2 rather than net280 cents', async () => {
    const f = await fixture(true)
    const balances: bigint[] = []
    const gross: bigint[] = []
    for (let index = 0; index < 3; index++) {
      const { refund } = await f.request()
      expect(refund.amount).toBe(0n)
      await f.complete(refund.id)
      const allocation = await db.refundItemAllocation.findFirstOrThrow({ where: { refundId: refund.id } })
      gross.push(allocation.coinFundingReversal + allocation.coinTaxReversal)
      balances.push((await db.buyerCoinWallet.findUniqueOrThrow({ where: { userId: f.buyer.id } })).balance)
    }
    expect(gross).toEqual([99n, 100n, 101n])
    expect(balances).toEqual([0n, 1n, 3n])
    expect((await db.buyerCoinWallet.findUniqueOrThrow({ where: { userId: f.buyer.id } })).lifetimeSpent).toBe(0n)
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(0n)
  })

  it('records merchandise-only affiliate credits2/3/4 from the original nine-cent award', async () => {
    const f = await fixture()
    const affiliate = await db.affiliate.create({ data: { userId: f.secondAdmin.id, status: 'ACTIVE' } })
    const link = await db.affiliateLink.create({ data: { affiliateId: affiliate.id, code: randomUUID(), targetType: 'product', targetId: f.item.variantId } })
    const award = await db.affiliateCommission.create({ data: { affiliateId: affiliate.id, linkId: link.id, orderId: f.order.id, eligiblesubtotal: 94n, commissionBps: 1000, commission: 9n,
      itemBases: { create: { orderItemId: f.item.id, originalQuantity: 3, originalEligibleNet: 94n } } } })
    const credits: bigint[] = []
    for (let index = 0; index < 3; index++) {
      const { refund } = await f.request()
      await f.complete(refund.id)
      credits.push((await db.affiliateRefundReversal.findUniqueOrThrow({ where: { commissionId_refundId: { commissionId: award.id, refundId: refund.id } } })).amount)
    }
    expect(credits).toEqual([2n, 3n, 4n])
    expect((await db.affiliateCommission.findUniqueOrThrow({ where: { id: award.id } })).commission).toBe(9n)
    expect((await new PrismaAffiliateRepository(context, db).getStats(f.secondAdmin.id)).commissionCents).toBe(0n)
  })

  it('confirmed failure cancels its Return and permits a fresh first interval', async () => {
    const f = await fixture()
    const { returned, refund } = await f.request()
    await expect(new PrismaAdminRepository(context, db).updateRefundStatus(refund.id, 'PROCESSING', { status: 'PENDING' })).rejects.toMatchObject({ status: 409 })
    await new PrismaAdminRepository(context, db).updateRefundStatus(refund.id, 'PROCESSING', { status: 'FAILED' })
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe('CANCELLED')
    const retry = await f.request()
    expect(retry.refund.amount).toBe(33n)
    await f.complete(retry.refund.id)
    expect(await f.complete(refund.id)).toBeNull()
  })

  it('reserves exactly one simultaneous same-item direct plan and protects an earlier Return request', async () => {
    const f = await fixture()
    const intent = { items: [{ orderItemId: f.item.id, quantity: 1 }], shipping: [] }
    const results = await Promise.allSettled([f.refunds.createPlannedRefund(f.order.id, intent), f.refunds.createPlannedRefund(f.order.id, intent)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected').map((result) => result.reason)).toEqual([expect.objectContaining({ status: 409 })])
    expect(await db.refund.count({ where: { orderId: f.order.id, status: 'PENDING' } })).toBe(1)
    const other = await fixture()
    await other.returns.createReturn(other.buyer, { orderId: other.order.id, orderItemId: other.item.id, quantity: 1, reason: 'Earlier Return' })
    await expect(other.refunds.createPlannedRefund(other.order.id, { items: [{ orderItemId: other.item.id, quantity: 1 }], shipping: [] })).rejects.toMatchObject({ status: 409 })
    expect(await db.refund.count({ where: { orderId: other.order.id } })).toBe(0)
  })

  it('admin cannot close an unpaid Return, and admin approval creates its pending refund atomically', async () => {
    const f = await fixture()
    const returned = await f.returns.createReturn(f.buyer, { orderId: f.order.id, orderItemId: f.item.id, quantity: 1, reason: 'Admin approval' })
    const admin = new PrismaAdminRepository(context, db)
    await admin.updateReturnStatus(returned.id, 'APPROVED')
    expect(await db.refund.findUniqueOrThrow({ where: { returnRequestId: returned.id } })).toMatchObject({ status: 'PENDING', amount: 33n })
    await expect(admin.updateReturnStatus(returned.id, 'COMPLETED')).rejects.toMatchObject({ status: 409 })
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe('APPROVED')
  })

  it.each(['affiliate', 'return'] as const)('rolls back all posted effects when %s persistence fails, then retries once', async (failure) => {
    const f = await fixture()
    const affiliate = await db.affiliate.create({ data: { userId: f.secondAdmin.id, status: 'ACTIVE' } })
    const link = await db.affiliateLink.create({ data: { affiliateId: affiliate.id, code: randomUUID(), targetType: 'product', targetId: f.item.variantId } })
    await db.affiliateCommission.create({ data: { affiliateId: affiliate.id, linkId: link.id, orderId: f.order.id, eligiblesubtotal: 94n, commissionBps: 1000, commission: 9n,
      itemBases: { create: { orderItemId: f.item.id, originalQuantity: 3, originalEligibleNet: 94n } } } })
    const { returned, refund } = await f.request()
    const before = (await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount
    const failing = db.$extends({ query: {
      affiliateRefundReversal: { async create({ args, query }) {
        if (failure === 'affiliate' && args.data.refundId === refund.id) throw new Error('affiliate persistence unavailable')
        return query(args)
      } },
      returnRequest: { async updateMany({ args, query }) {
        if (failure === 'return' && args.where?.id === returned.id && args.data.status === 'COMPLETED') throw new Error('return persistence unavailable')
        return query(args)
      } },
    } })
    await expect(f.complete(refund.id, new PrismaRefundRepository(context, failing as unknown as PrismaClient))).rejects.toThrow(`${failure} persistence unavailable`)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('PROCESSING')
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: returned.id } })).status).toBe('APPROVED')
    expect((await db.walletLedgerEntry.aggregate({ where: { walletId: f.wallet.id }, _sum: { amount: true } }))._sum.amount).toBe(before)
    expect(await db.affiliateRefundReversal.count({ where: { refundId: refund.id } })).toBe(0)
    expect(await db.walletLedgerEntry.count({ where: { refundId: refund.id } })).toBe(0)
    expect(await f.complete(refund.id)).toMatchObject({ status: 'SUCCESS' })
    expect(await db.affiliateRefundReversal.count({ where: { refundId: refund.id } })).toBe(1)
    expect(await f.complete(refund.id)).toBeNull()
  })
})
