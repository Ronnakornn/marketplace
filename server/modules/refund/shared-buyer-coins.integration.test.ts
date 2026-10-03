import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { createFinanceFixture } from '../../../e2e/helpers/finance-fixtures.ts'
import { PrismaRefundRepository } from './refund.repository.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('separate refunds sharing a buyer wallet on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a disposable local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(balance: bigint) {
    const first = await createFinanceFixture(db, true)
    const second = await createFinanceFixture(db, true)
    await db.order.update({ where: { id: second.order.id }, data: { userId: first.buyer.id } })
    await db.checkout.update({ where: { id: second.order.checkoutId }, data: { user: { connect: { id: first.buyer.id } }, cart: { update: { userId: first.buyer.id } } } })
    const wallet = await db.buyerCoinWallet.create({ data: { userId: first.buyer.id, balance, lifetimeEarned: 16n, lifetimeSpent: 10n } })
    const repository = new PrismaRefundRepository(context, db)
    const refunds = []
    for (const sale of [first, second]) {
      await db.order.update({ where: { id: sale.order.id }, data: { discountTotal: 2500n, grandTotal: 8000n } })
      await db.payment.updateMany({ where: { orderId: sale.order.id }, data: { amount: 8000n } })
      await db.shopOrder.updateMany({ where: { orderId: sale.order.id }, data: { discountTotal: 2500n, grandTotal: 8000n } })
      await db.itemSaleSnapshot.update({ where: { orderItemId: sale.items[0].id }, data: { coinDiscount: 200n, buyerMerchandise: 3000n } })
      await db.itemSaleSnapshot.update({ where: { orderItemId: sale.items[1].id }, data: { coinDiscount: 300n, buyerMerchandise: 4500n } })
      await db.buyerCoinLedger.createMany({ data: [
        { walletId: wallet.id, userId: first.buyer.id, orderId: sale.order.id, type: 'SPENT', status: 'USED', amount: 5n },
        { walletId: wallet.id, userId: first.buyer.id, orderId: sale.order.id, type: 'EARNED', status: 'AVAILABLE', amount: 8n, referenceType: 'ORDER_CASHBACK' },
      ] })
      const refund = await repository.createPlannedRefund(sale.order.id, { items: sale.items.map(item => ({ orderItemId: item.id, quantity: 1 })), shipping: [] })
      expect(refund.amount).toBe(7500n)
      await db.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSING', processingById: first.admin.id } })
      refunds.push(refund)
    }
    const complete = (repository: PrismaRefundRepository, refundId: string) => repository.completeRefundSuccess(refundId, 'PROCESSING', {
      completedById: first.secondAdmin.id, externalReference: `TEST-${randomUUID()}`,
    })
    return { first, second, wallet, refunds, repository, complete }
  }

  it.each([0n, 16n])('serializes separate orders with initial available coins %s', async balance => {
    const f = await fixture(balance)
    let arrivals = 0
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const instrumented = db.$extends({ query: { buyerCoinWallet: { async findUnique({ args, query }) {
      const result = await query(args)
      if (args.where.userId === f.first.buyer.id && arrivals < 2) {
        arrivals++
        if (arrivals === 2) release()
        await barrier
      }
      return result
    } } } })
    const repository = new PrismaRefundRepository(context, instrumented as unknown as PrismaClient)
    const results = await Promise.all(f.refunds.map(refund => f.complete(repository, refund.id)))
    expect(results).toMatchObject([{ status: 'SUCCESS' }, { status: 'SUCCESS' }])
    expect(arrivals).toBe(2)
    expect(await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })).toMatchObject({
      balance: balance === 0n ? 0n : 10n, debtBalance: balance === 0n ? 6n : 0n, lifetimeSpent: 0n, lifetimeEarned: 0n, version: 5,
    })
    const ledger = await db.buyerCoinLedger.findMany({ where: { referenceId: { in: f.refunds.map(refund => refund.id) } } })
    expect(ledger).toHaveLength(4)
    expect(ledger.filter(row => row.referenceType === 'REFUND_COIN_RESTORE').map(row => row.amount)).toEqual([5n, 5n])
    expect(ledger.filter(row => row.referenceType === 'REFUND_CASHBACK_REVERSAL').map(row => row.amount)).toEqual([-8n, -8n])
    const before = await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })
    expect(await Promise.all(f.refunds.map(refund => f.complete(f.repository, refund.id)))).toEqual([null, null])
    expect(await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })).toEqual(before)
  })

  it('rolls back the buyer and seller balances when coin ledger persistence fails, then retries once', async () => {
    const f = await fixture(16n)
    const before = await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })
    const refundId = f.refunds[0].id
    const instrumented = db.$extends({ query: { buyerCoinLedger: { async create({ args, query }) {
      if (args.data.referenceId === refundId) throw new Error('coin ledger unavailable')
      return query(args)
    } } } })
    await expect(f.complete(new PrismaRefundRepository(context, instrumented as unknown as PrismaClient), refundId)).rejects.toThrow('coin ledger unavailable')
    expect(await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })).toEqual(before)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).status).toBe('PROCESSING')
    expect(await db.walletLedgerEntry.count({ where: { refundId } })).toBe(0)
    expect(await db.buyerCoinLedger.count({ where: { referenceId: refundId } })).toBe(0)
    expect(await f.complete(f.repository, refundId)).toMatchObject({ status: 'SUCCESS' })
    expect(await db.buyerCoinWallet.findUniqueOrThrow({ where: { id: f.wallet.id } })).toMatchObject({ balance: 13n, debtBalance: 0n, lifetimeSpent: 5n, lifetimeEarned: 8n, version: 3 })
    expect(await db.walletLedgerEntry.findMany({ where: { refundId }, orderBy: { amount: 'asc' } })).toMatchObject([{ amount: -8000n }, { amount: 800n }])
    expect(await f.complete(f.repository, refundId)).toBeNull()
  })
})
