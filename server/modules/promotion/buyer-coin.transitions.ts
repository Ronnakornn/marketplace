import type { Prisma, PrismaClient } from '#generated/client/client.ts'

type BuyerCoinClient = Pick<PrismaClient, 'buyerCoinLedger' | 'buyerCoinWallet'>
type BuyerCoinTransactionClient = Pick<Prisma.TransactionClient, 'buyerCoinLedger' | 'buyerCoinWallet' | 'refund'>

function integerAmount(value: bigint | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
}

function proportionalTarget(original: bigint, refunded: bigint, orderTotal: bigint): bigint {
  if (original <= 0n || refunded <= 0n || orderTotal <= 0n) return 0n
  return (original * (refunded >= orderTotal ? orderTotal : refunded)) / orderTotal
}

export async function releasePendingBuyerCoins(prisma: BuyerCoinClient, orderId: string): Promise<void> {
  const entries = await prisma.buyerCoinLedger.findMany({
    where: { orderId, type: 'SPENT', status: 'PENDING' },
    select: { id: true, walletId: true, amount: true },
  })
  for (const entry of entries) {
    const result = await prisma.buyerCoinLedger.updateMany({
      where: { id: entry.id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
    if (result.count) {
      await prisma.buyerCoinWallet.update({
        where: { id: entry.walletId },
        data: { balance: { increment: entry.amount }, pendingBalance: { decrement: entry.amount } },
      })
    }
  }
}

export async function reverseBuyerCoinsForRefund(
  prisma: BuyerCoinTransactionClient,
  input: { refundId: string; orderId: string; refundAmount: bigint | number; orderGrandTotal: bigint | number; userId: string },
): Promise<void> {
  const existing = await prisma.buyerCoinLedger.findFirst({
    where: { referenceId: input.refundId, referenceType: { in: ['REFUND_COIN_RESTORE', 'REFUND_CASHBACK_REVERSAL'] } },
    select: { id: true },
  })
  const refundAmount = integerAmount(input.refundAmount)
  const orderGrandTotal = integerAmount(input.orderGrandTotal)
  if (existing || refundAmount <= 0n || orderGrandTotal <= 0n) return

  const [spentEntries, cashbackEntries, successfulRefunds, priorRestores, priorReversals] = await Promise.all([
    prisma.buyerCoinLedger.findMany({
      where: { orderId: input.orderId, type: 'SPENT', status: 'USED' },
      select: { walletId: true, amount: true },
    }),
    prisma.buyerCoinLedger.findMany({
      where: {
        orderId: input.orderId,
        OR: [
          { type: 'EARNED', status: 'AVAILABLE', referenceType: 'ORDER_CASHBACK' },
          { type: 'ADJUSTMENT', status: 'USED', referenceType: 'COIN_DEBT_SETTLEMENT' },
        ],
      },
      select: { walletId: true, amount: true },
    }),
    prisma.refund.aggregate({ where: { orderId: input.orderId, status: 'SUCCESS' }, _sum: { amount: true } }),
    prisma.buyerCoinLedger.aggregate({
      where: { orderId: input.orderId, type: 'REFUNDED', referenceType: 'REFUND_COIN_RESTORE' },
      _sum: { amount: true },
    }),
    prisma.buyerCoinLedger.aggregate({
      where: { orderId: input.orderId, type: 'ADJUSTMENT', referenceType: 'REFUND_CASHBACK_REVERSAL' },
      _sum: { amount: true },
    }),
  ])

  const cumulativeRefund = integerAmount(successfulRefunds._sum.amount ?? refundAmount)
  const totalSpent = spentEntries.reduce((sum, entry) => sum + integerAmount(entry.amount), 0n)
  const restored = integerAmount(priorRestores._sum.amount ?? 0)
  const spentDelta = proportionalTarget(totalSpent, cumulativeRefund, orderGrandTotal) - restored
  const spentWalletId = spentEntries[0]?.walletId
  if (spentWalletId && spentDelta > 0n) {
    const wallet = await prisma.buyerCoinWallet.update({
      where: { id: spentWalletId },
      data: { balance: { increment: spentDelta }, lifetimeSpent: { decrement: spentDelta }, version: { increment: 1 } },
      select: { balance: true },
    })
    await prisma.buyerCoinLedger.create({
      data: {
        walletId: spentWalletId,
        userId: input.userId,
        orderId: input.orderId,
        type: 'REFUNDED',
        status: 'AVAILABLE',
        amount: spentDelta,
        balanceAfter: wallet.balance,
        reason: 'Coins restored after refund',
        referenceType: 'REFUND_COIN_RESTORE',
        referenceId: input.refundId,
      },
    })
  }

  const totalCashback = cashbackEntries.reduce((sum, entry) => sum + (integerAmount(entry.amount) < 0n ? -integerAmount(entry.amount) : integerAmount(entry.amount)), 0n)
  const reversed = -integerAmount(priorReversals._sum.amount ?? 0)
  const cashbackDelta = proportionalTarget(totalCashback, cumulativeRefund, orderGrandTotal) - reversed
  const cashbackWalletId = cashbackEntries[0]?.walletId
  if (cashbackWalletId && cashbackDelta > 0n) {
    const currentWallet = await prisma.buyerCoinWallet.findUniqueOrThrow({
      where: { id: cashbackWalletId }, select: { balance: true },
    })
    const availableDeduction = integerAmount(currentWallet.balance) >= cashbackDelta ? cashbackDelta : integerAmount(currentWallet.balance)
    const debtIncrease = cashbackDelta - availableDeduction
    const wallet = await prisma.buyerCoinWallet.update({
      where: { id: cashbackWalletId },
      data: {
        balance: { decrement: availableDeduction },
        debtBalance: { increment: debtIncrease },
        lifetimeEarned: { decrement: cashbackDelta },
        version: { increment: 1 },
      },
      select: { balance: true },
    })
    await prisma.buyerCoinLedger.create({
      data: {
        walletId: cashbackWalletId,
        userId: input.userId,
        orderId: input.orderId,
        type: 'ADJUSTMENT',
        status: 'USED',
        amount: -cashbackDelta,
        balanceAfter: wallet.balance,
        reason: 'Cashback reversed after refund',
        referenceType: 'REFUND_CASHBACK_REVERSAL',
        referenceId: input.refundId,
      },
    })
  }
}
