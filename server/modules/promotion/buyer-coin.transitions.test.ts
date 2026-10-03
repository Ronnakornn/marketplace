import { describe, expect, it, vi } from 'vitest'
import { reverseBuyerCoinsForRefund } from './buyer-coin.transitions.ts'

describe('reverseBuyerCoinsForRefund', () => {
  it('restores explicitly reversed coin funding when the cash refund is zero', async () => {
    const buyerCoinLedger = {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn().mockResolvedValueOnce([{ walletId: 'wallet', amount: 3n }]).mockResolvedValueOnce([]),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0n } })),
      create: vi.fn(async () => ({})),
    }
    const buyerCoinWallet = { update: vi.fn(async () => ({ balance: 3n })), findUniqueOrThrow: vi.fn(), findUnique: vi.fn(async () => ({ id: 'wallet' })) }
    const refund = { aggregate: vi.fn(async () => ({ _sum: { amount: 0n } })) }
    await reverseBuyerCoinsForRefund({ buyerCoinLedger, buyerCoinWallet, refund } as never, {
      refundId: 'zero-cash', orderId: 'order', userId: 'buyer', refundAmount: 0n, orderGrandTotal: 500n,
      coinFundingTargetCents: 300n, coinFundingTotalCents: 300n, merchandiseCashTarget: 0n, merchandiseCashTotal: 0n,
    })
    expect(buyerCoinWallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ balance: { increment: 3n }, lifetimeSpent: { decrement: 3n } }) }))
    expect(buyerCoinLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 3n, referenceId: 'zero-cash' }) }))
  })

  it('reverses all merchandise cashback while shipping cash remains retained', async () => {
    const buyerCoinLedger = {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ walletId: 'wallet', amount: 7n }]),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0n } })),
      create: vi.fn(async () => ({})),
    }
    const buyerCoinWallet = { update: vi.fn(async () => ({ balance: 0n })), findUniqueOrThrow: vi.fn(async () => ({ balance: 7n })) }
    const refund = { aggregate: vi.fn(async () => ({ _sum: { amount: 700n } })) }
    await reverseBuyerCoinsForRefund({ buyerCoinLedger, buyerCoinWallet, refund } as never, {
      refundId: 'merchandise', orderId: 'order', userId: 'buyer', refundAmount: 700n, orderGrandTotal: 1200n,
      coinFundingTargetCents: 0n, coinFundingTotalCents: 0n, merchandiseCashTarget: 700n, merchandiseCashTotal: 700n,
    })
    expect(buyerCoinLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: -7n, referenceType: 'REFUND_CASHBACK_REVERSAL' }) }))
  })

  it.each(['missing', 'insufficient', 'excess', 'prior-restores', 'different-wallets', 'wrong-wallet', 'missing-wallet'] as const)('rejects corrupt explicit %s spend history instead of clipping restoration', async (corruption) => {
    const spent = corruption === 'missing' ? [] : corruption === 'different-wallets' ? [{ walletId: 'one', amount: 1n }, { walletId: 'two', amount: 2n }]
      : [{ walletId: 'wallet', amount: corruption === 'insufficient' ? 2n : corruption === 'excess' ? 4n : 3n }]
    const buyerCoinLedger = {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn().mockResolvedValueOnce(spent).mockResolvedValueOnce([]),
      aggregate: vi.fn().mockResolvedValueOnce({ _sum: { amount: corruption === 'prior-restores' ? 4n : 0n } }).mockResolvedValueOnce({ _sum: { amount: 0n } }),
      create: vi.fn(),
    }
    const buyerCoinWallet = { update: vi.fn(), findUniqueOrThrow: vi.fn(), findUnique: vi.fn(async () => corruption === 'missing-wallet' ? null : { id: corruption === 'wrong-wallet' ? 'actual-buyer-wallet' : 'wallet' }) }
    const refund = { aggregate: vi.fn(async () => ({ _sum: { amount: 0n } })) }
    await expect(reverseBuyerCoinsForRefund({ buyerCoinLedger, buyerCoinWallet, refund } as never, {
      refundId: 'corrupt', orderId: 'order', userId: 'buyer', refundAmount: 0n, orderGrandTotal: 500n,
      coinFundingTargetCents: 300n, coinFundingTotalCents: 300n, merchandiseCashTarget: 0n, merchandiseCashTotal: 0n,
    })).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(buyerCoinWallet.update).not.toHaveBeenCalled()
    expect(buyerCoinLedger.create).not.toHaveBeenCalled()
  })

  it.each([0, 3])('preserves cumulative 333, 667 and 1000 refund rounding with %s spent coins', async (spentCoins) => {
    const wallet = { balance: 0n, debtBalance: 0n, lifetimeEarned: 3n, lifetimeSpent: BigInt(spentCoins) }
    const entries: Array<{ amount: bigint; referenceType: string; referenceId: string }> = []
    let refundedAmount = 0n
    const buyerCoinLedger = {
      findFirst: vi.fn(async ({ where }: { where: { referenceId: string } }) => entries.find((entry) => entry.referenceId === where.referenceId) ?? null),
      findMany: vi.fn(async ({ where }: { where: { type?: string } }) => where.type === 'SPENT'
        ? spentCoins ? [{ walletId: 'wallet-1', amount: 3n }] : []
        : [{ walletId: 'wallet-1', amount: 3n }]),
      aggregate: vi.fn(async ({ where }: { where: { referenceType: string } }) => ({
        _sum: { amount: entries.filter((entry) => entry.referenceType === where.referenceType).reduce((sum, entry) => sum + entry.amount, 0n) },
      })),
      create: vi.fn(async ({ data }: { data: { amount: bigint; referenceType: string; referenceId: string } }) => {
        entries.push(data)
        return data
      }),
    }
    type Change = { increment?: bigint; decrement?: bigint }
    const buyerCoinWallet = {
      findUniqueOrThrow: vi.fn(async () => ({ ...wallet })),
      update: vi.fn(async ({ data }: { data: Partial<Record<keyof typeof wallet, Change>> }) => {
        for (const field of ['balance', 'debtBalance', 'lifetimeEarned', 'lifetimeSpent'] as const) {
          wallet[field] += data[field]?.increment ?? 0n
          wallet[field] -= data[field]?.decrement ?? 0n
        }
        return { ...wallet }
      }),
    }
    const refund = { aggregate: vi.fn(async () => ({ _sum: { amount: refundedAmount } })) }
    const client = { buyerCoinLedger, buyerCoinWallet, refund }
    for (const [index, cumulative, amount] of [[1, 333n, 333n], [2, 667n, 334n], [3, 1000n, 333n]] as const) {
      refundedAmount = cumulative
      await reverseBuyerCoinsForRefund(client as never, {
        refundId: `refund-${index}`, orderId: 'order-1', refundAmount: amount, orderGrandTotal: 1000n, userId: 'user-1',
      })
      if (index === 1) expect(wallet).toEqual({ balance: 0n, debtBalance: 0n, lifetimeEarned: 3n, lifetimeSpent: BigInt(spentCoins) })
      if (index === 2) expect(wallet).toEqual({ balance: 0n, debtBalance: spentCoins ? 0n : 2n, lifetimeEarned: 1n, lifetimeSpent: spentCoins ? 1n : 0n })
    }
    expect(wallet).toEqual({ balance: 0n, debtBalance: spentCoins ? 0n : 3n, lifetimeEarned: 0n, lifetimeSpent: 0n })
    expect(entries.filter((entry) => entry.referenceType === 'REFUND_COIN_RESTORE').map((entry) => entry.amount)).toEqual(spentCoins ? [2n, 1n] : [])
    expect(entries.filter((entry) => entry.referenceType === 'REFUND_CASHBACK_REVERSAL').map((entry) => entry.amount)).toEqual([-2n, -1n])
    await reverseBuyerCoinsForRefund(client as never, {
      refundId: 'refund-3', orderId: 'order-1', refundAmount: 333n, orderGrandTotal: 1000n, userId: 'user-1',
    })
    expect(wallet).toEqual({ balance: 0n, debtBalance: spentCoins ? 0n : 3n, lifetimeEarned: 0n, lifetimeSpent: 0n })
    expect(entries).toHaveLength(spentCoins ? 4 : 2)
  })

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
