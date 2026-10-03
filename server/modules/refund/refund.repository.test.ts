import { describe, expect, it, vi } from 'vitest'
import { PrismaRefundRepository } from './refund.repository.ts'
import { reverseBuyerCoinsForRefund } from '#server/modules/promotion/buyer-coin.transitions.ts'

vi.mock('#server/modules/promotion/buyer-coin.transitions.ts', () => ({ reverseBuyerCoinsForRefund: vi.fn() }))

function setup(returnShopId: string | null = 'shop-1') {
  const refund = {
    id: 'refund-1', orderId: 'order-1', paymentId: 'payment-1', status: 'PROCESSING', processingById: 'admin-1', amount: 8000n,
    payment: { amount: 10000n, currency: 'THB' }, order: { grandTotal: 10000n, userId: 'buyer-1' },
    returnRequest: returnShopId ? { shopId: returnShopId } : null,
  }
  const tx = {
    $queryRaw: vi.fn(async () => []),
    refund: {
      findUnique: vi.fn(async () => ({ ...refund })),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0n } })),
      updateMany: vi.fn(async () => { refund.status = 'SUCCESS'; return { count: 1 } }),
    },
    shopOrder: { findMany: vi.fn(async () => [{ shopId: 'shop-1', grandTotal: 4000n }, { shopId: 'shop-2', grandTotal: 6000n }]) },
    shopWallet: { upsert: vi.fn(async (input: any) => ({ id: `wallet-${input.where.shopId}`, currency: 'THB' })) },
    walletLedgerEntry: { create: vi.fn(async (_input: any) => ({})) },
    buyerCoinWallet: { findUnique: vi.fn(async () => null) },
  }
  const prisma = { $transaction: vi.fn(async (callback: any) => callback(tx)) }
  const repo = new PrismaRefundRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, prisma as any)
  const complete = () => repo.completeRefundSuccess('refund-1', 'PROCESSING', { completedById: 'admin-2', externalReference: 'REF-1' })
  vi.mocked(reverseBuyerCoinsForRefund).mockReset()
  return { repo, refund, tx, complete }
}

describe('refund completion transaction', () => {
  it('debits only the returned shop once and reverses coins in the same transaction', async () => {
    const { complete, tx } = setup()
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    await expect(complete()).resolves.toBeNull()
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledTimes(1)
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ shopId: 'shop-1', amount: -8000n, refundId: 'refund-1', type: 'refund_adjustment' }) })
    expect(reverseBuyerCoinsForRefund).toHaveBeenCalledWith(tx, expect.objectContaining({ refundId: 'refund-1' }))
  })

  it('allocates an order-wide refund between shop snapshots', async () => {
    const { complete, tx } = setup(null)
    await complete()
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => input.data.amount)).toEqual([-3200n, -4800n])
  })

  it('rejects cumulative refunds above the paid amount', async () => {
    const { complete, tx } = setup()
    tx.refund.aggregate.mockResolvedValue({ _sum: { amount: 3000n } })
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE' })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('does not debit if a concurrent status transition wins', async () => {
    const { complete, tx } = setup()
    tx.refund.updateMany.mockResolvedValue({ count: 0 })
    await expect(complete()).resolves.toBeNull()
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
    expect(reverseBuyerCoinsForRefund).not.toHaveBeenCalled()
  })

  it('propagates a ledger failure so the transaction rolls back', async () => {
    const { complete, tx } = setup()
    tx.walletLedgerEntry.create.mockRejectedValue(new Error('Ledger unavailable'))
    await expect(complete()).rejects.toThrow('Ledger unavailable')
    expect(reverseBuyerCoinsForRefund).not.toHaveBeenCalled()
  })

  it('rejects a same-administrator completion even if called directly', async () => {
    const { repo, tx } = setup()
    await expect(repo.completeRefundSuccess('refund-1', 'PROCESSING', { completedById: 'admin-1', externalReference: 'REF-1' })).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE' })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
  })
})
