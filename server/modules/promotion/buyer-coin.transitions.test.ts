import { describe, expect, it, vi } from 'vitest'
import { reverseBuyerCoinsForRefund } from './buyer-coin.transitions.ts'

describe('reverseBuyerCoinsForRefund', () => {
  it('restores spent coins and reverses cashback proportionally once', async () => {
    const buyerCoinLedger = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn()
        .mockResolvedValueOnce([{ walletId: 'wallet-1', amount: 200n }])
        .mockResolvedValueOnce([{ walletId: 'wallet-1', amount: 50n }]),
      aggregate: vi.fn()
        .mockResolvedValueOnce({ _sum: { amount: 0n } })
        .mockResolvedValueOnce({ _sum: { amount: 0n } }),
      create: vi.fn().mockResolvedValue({}),
    }
    const buyerCoinWallet = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 1000n }),
      update: vi.fn()
        .mockResolvedValueOnce({ balance: 1100n })
        .mockResolvedValueOnce({ balance: 1075n }),
    }
    const refund = { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 500n } }) }

    await reverseBuyerCoinsForRefund({ buyerCoinLedger, buyerCoinWallet, refund } as never, {
      refundId: 'refund-1',
      orderId: 'order-1',
      refundAmount: 500n,
      orderGrandTotal: 1000n,
      userId: 'user-1',
    })

    expect(buyerCoinWallet.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ balance: { increment: 100n }, lifetimeSpent: { decrement: 100n } }),
    }))
    expect(buyerCoinWallet.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ balance: { decrement: 25n }, lifetimeEarned: { decrement: 25n } }),
    }))
    expect(buyerCoinLedger.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ type: 'REFUNDED', amount: 100n, referenceType: 'REFUND_COIN_RESTORE' }),
    }))
    expect(buyerCoinLedger.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ type: 'ADJUSTMENT', amount: -25n, referenceType: 'REFUND_CASHBACK_REVERSAL' }),
    }))
  })

  it('uses cumulative targets with number-shaped Prisma values and records cashback debt', async () => {
    const buyerCoinLedger = {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValueOnce([{ walletId: 'wallet-1', amount: 3 }]).mockResolvedValueOnce([{ walletId: 'wallet-1', amount: 3 }]),
      aggregate: vi.fn().mockResolvedValueOnce({ _sum: { amount: 1 } }).mockResolvedValueOnce({ _sum: { amount: -1 } }),
      create: vi.fn().mockResolvedValue({}),
    }
    const buyerCoinWallet = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 0 }),
      update: vi.fn().mockResolvedValue({ balance: 0 }),
    }
    const refund = { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 667 } }) }

    await reverseBuyerCoinsForRefund({ buyerCoinLedger, buyerCoinWallet, refund } as never, {
      refundId: 'refund-2', orderId: 'order-1', refundAmount: 334, orderGrandTotal: 1000, userId: 'user-1',
    })

    expect(buyerCoinWallet.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ balance: { increment: 1n } }),
    }))
    expect(buyerCoinWallet.update).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ balance: { decrement: 0n }, debtBalance: { increment: 1n } }),
    }))
  })

  it('does nothing when the refund was already reconciled', async () => {
    const client = {
      buyerCoinLedger: { findFirst: vi.fn().mockResolvedValue({ id: 'entry-1' }), findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
      buyerCoinWallet: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
      refund: { aggregate: vi.fn() },
    }
    await reverseBuyerCoinsForRefund(client as never, {
      refundId: 'refund-1', orderId: 'order-1', refundAmount: 100n, orderGrandTotal: 1000n, userId: 'user-1',
    })
    expect(client.buyerCoinLedger.findMany).not.toHaveBeenCalled()
    expect(client.buyerCoinWallet.update).not.toHaveBeenCalled()
  })
})
