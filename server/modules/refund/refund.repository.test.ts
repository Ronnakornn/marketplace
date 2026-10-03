import { describe, expect, it, vi } from 'vitest'
import type { Order, Payment, PrismaClient, Refund, ReturnRequest, ShopOrder, WalletLedgerEntry } from '#generated/client/client.ts'
import { PrismaRefundRepository } from './refund.repository.ts'
import { reverseBuyerCoinsForRefund } from '#server/modules/promotion/buyer-coin.transitions.ts'

vi.mock('#server/modules/promotion/buyer-coin.transitions.ts', () => ({ reverseBuyerCoinsForRefund: vi.fn() }))

type HistoricalRefund = Pick<Refund, 'id' | 'orderId' | 'paymentId' | 'status' | 'amount'> & {
  payment: Pick<Payment, 'id' | 'orderId' | 'amount' | 'currency'>
  returnRequest: Pick<ReturnRequest, 'orderId' | 'shopId'> | null
}
type DebitEntry = Pick<WalletLedgerEntry, 'refundId' | 'orderId' | 'shopId' | 'amount' | 'currency'>
type DebitWrite = Pick<WalletLedgerEntry, 'walletId' | 'shopId' | 'orderId' | 'refundId' | 'type' | 'amount' | 'currency' | 'description'>

function setup(returnShopId: string | null = 'shop-1') {
  const refund: HistoricalRefund & {
    processingById: string
    order: Pick<Order, 'id' | 'grandTotal' | 'userId' | 'currency'>
  } = {
    id: 'refund-1', orderId: 'order-1', paymentId: 'payment-1', status: 'PROCESSING', processingById: 'admin-1', amount: returnShopId ? 4000n : 8000n,
    payment: { id: 'payment-1', orderId: 'order-1', amount: 10000n, currency: 'THB' },
    order: { id: 'order-1', grandTotal: 10000n, userId: 'buyer-1', currency: 'THB' },
    returnRequest: returnShopId ? { orderId: 'order-1', shopId: returnShopId } : null,
  }
  const tx = {
    itemSaleSnapshot: { count: vi.fn(async () => 0) },
    $queryRaw: vi.fn(async () => []),
    refund: {
      findUnique: vi.fn(async () => ({ ...refund })),
      findMany: vi.fn(async (): Promise<HistoricalRefund[]> => []),
      updateMany: vi.fn(async () => { refund.status = 'SUCCESS'; return { count: 1 } }),
    },
    shopOrder: { findMany: vi.fn(async (): Promise<Array<Pick<ShopOrder, 'shopId' | 'grandTotal' | 'currency'>>> => [
      { shopId: 'shop-1', grandTotal: 4000n, currency: 'THB' }, { shopId: 'shop-2', grandTotal: 6000n, currency: 'THB' },
    ]) },
    shopWallet: { upsert: vi.fn(async (input: { where: { shopId: string } }) => ({ id: `wallet-${input.where.shopId}`, currency: 'THB' })) },
    walletLedgerEntry: {
      findMany: vi.fn(async (): Promise<DebitEntry[]> => []),
      create: vi.fn(async (_input: { data: DebitWrite }) => ({})),
    },
    buyerCoinWallet: { findUnique: vi.fn(async () => null) },
  }
  const prisma = { $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) }
  const repo = new PrismaRefundRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, prisma as unknown as PrismaClient)
  const complete = () => repo.completeRefundSuccess('refund-1', 'PROCESSING', { completedById: 'admin-2', externalReference: 'REF-1' })
  const history = (amount: bigint, shopId: string | null = null): HistoricalRefund => ({
    id: 'refund-old', orderId: 'order-1', paymentId: 'payment-1', status: 'SUCCESS', amount,
    payment: { ...refund.payment }, returnRequest: shopId ? { orderId: 'order-1', shopId } : null,
  })
  const entry = (shopId: string, amount: bigint): DebitEntry => ({
    refundId: 'refund-old', orderId: 'order-1', shopId, amount, currency: 'THB',
  })
  vi.mocked(reverseBuyerCoinsForRefund).mockReset()
  return { repo, refund, tx, complete, history, entry }
}

function snapshotSetup(recognized = true) {
  const original = setup(null)
  const snapshot = { shopOrderId: 'shop-order-1', policyVersion: 1, currency: 'THB', commissionBase: 10000n, commissionBps: 1000,
    originalCommission: 1000n, originalShipping: 0n, buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n, recognizedAt: recognized ? new Date() : null }
  const itemSnapshot = { orderItemId: 'item-1', shopOrderId: 'shop-order-1', originalQuantity: 1, grossMerchandise: 10000n, sellerCouponDiscount: 0n,
    platformCouponDiscount: 2000n, coinDiscount: 0n, buyerMerchandise: 8000n, couponId: null, couponCode: null }
  const itemAllocation = { id: 'item-allocation', refundId: 'refund-1', orderItemId: 'item-1', quantity: 1, cashMerchandise: 8000n, platformCouponReversal: 2000n, coinFundingReversal: 0n }
  const shopAllocation = { id: 'shop-allocation', refundId: 'refund-1', shopOrderId: 'shop-order-1', buyerShippingRefund: 0n, platformShippingReversal: 0n, commissionReversal: 0n, shippingCause: 'NONE', walletPostedAt: null }
  original.refund.payment.amount = original.refund.order.grandTotal = 8000n
  Object.assign(original.refund, { payment: { ...original.refund.payment, status: 'SUCCEEDED' }, itemAllocations: [itemAllocation], shopAllocations: [shopAllocation] })
  const shops = [{ id: 'shop-order-1', orderId: 'order-1', shopId: 'shop-1', grandTotal: 8000n, taxTotal: 0n, currency: 'THB', saleSnapshot: snapshot }]
  original.tx.shopOrder.findMany.mockResolvedValue(shops)
  const tx = Object.assign(original.tx, {
    orderItem: { findMany: vi.fn(async () => [{ id: 'item-1', orderId: 'order-1', shopId: 'shop-1', quantity: 1, lineTotal: 10000n, saleSnapshot: itemSnapshot }]) },
    refundShopAllocation: { update: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) },
    refundItemAllocation: { deleteMany: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) },
    shipment: { count: vi.fn(async () => 0) },
  })
  Object.assign(tx.refund, { update: vi.fn(async () => ({})) })
  return { ...original, tx, snapshot, itemSnapshot, itemAllocation, shopAllocation, shops }
}

describe('refund completion transaction', () => {
  it('reverses seller entitlement and original commission separately for a subsidized sale', async () => {
    const { complete, tx } = snapshotSetup()
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS', amount: 8000n })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => [input.data.type, input.data.amount])).toEqual([['refund_adjustment', -10000n], ['commission_fee', 1000n]])
    expect(tx.refundShopAllocation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { commissionReversal: 1000n } }))
    expect(tx.refundShopAllocation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { walletPostedAt: expect.any(Date) } }))
    await expect(complete()).resolves.toBeNull()
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledTimes(2)
  })

  it('records a pre-earning reversal without creating wallet debt', async () => {
    const { complete, tx } = snapshotSetup(false)
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
    expect(tx.shopWallet.upsert).not.toHaveBeenCalled()
    expect(tx.refundShopAllocation.update).toHaveBeenCalledTimes(1)
    expect(reverseBuyerCoinsForRefund).toHaveBeenCalledWith(tx, expect.objectContaining({ coinFundingTargetCents: 0n, merchandiseCashTarget: 8000n, merchandiseCashTotal: 8000n }))
  })

  it('completes a zero-cash subsidy reversal with economic wallet postings', async () => {
    const { complete, refund, tx, itemAllocation, itemSnapshot, shops } = snapshotSetup()
    refund.amount = refund.order.grandTotal = refund.payment.amount = 0n
    shops[0]!.grandTotal = 0n
    itemAllocation.cashMerchandise = itemSnapshot.buyerMerchandise = 0n
    itemAllocation.platformCouponReversal = itemSnapshot.platformCouponDiscount = 10000n
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS', amount: 0n })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => input.data.amount)).toEqual([-10000n, 1000n])
    expect(reverseBuyerCoinsForRefund).toHaveBeenCalledWith(tx, expect.objectContaining({ refundAmount: 0n, merchandiseCashTotal: 0n }))
  })

  it('rejects new-policy amount-only refunds before status or ledger writes', async () => {
    const { complete, refund, tx } = snapshotSetup()
    Object.assign(refund, { itemAllocations: [], shopAllocations: [] })
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('rejects preparing a plan after external processing starts', async () => {
    const { repo, tx } = snapshotSetup()
    await expect(repo.prepareRefundPlan('refund-1', { items: [{ orderItemId: 'item-1', quantity: 1 }], shipping: [] })).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refundItemAllocation.deleteMany).not.toHaveBeenCalled()
  })

  it('leaves allocations untouched if processing wins the pending-plan compare-and-swap', async () => {
    const { repo, refund, tx } = snapshotSetup()
    refund.status = 'PENDING'
    tx.refund.updateMany.mockResolvedValue({ count: 0 })
    await expect(repo.prepareRefundPlan('refund-1', { items: [{ orderItemId: 'item-1', quantity: 1 }], shipping: [] })).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refund.updateMany).toHaveBeenCalledWith({ where: { id: 'refund-1', status: 'PENDING' }, data: { amount: 8000n } })
    expect(tx.refundItemAllocation.deleteMany).not.toHaveBeenCalled()
    expect(tx.refundShopAllocation.deleteMany).not.toHaveBeenCalled()
  })

  it('debits only the returned shop once and reverses coins in the same transaction', async () => {
    const { complete, tx } = setup()
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    await expect(complete()).resolves.toBeNull()
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledTimes(1)
    expect(tx.walletLedgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ shopId: 'shop-1', amount: -4000n, refundId: 'refund-1', type: 'refund_adjustment' }) })
    expect(reverseBuyerCoinsForRefund).toHaveBeenCalledWith(tx, expect.objectContaining({ refundId: 'refund-1' }))
  })

  it('allocates an order-wide refund between shop snapshots', async () => {
    const { complete, tx } = setup(null)
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => input.data.amount)).toEqual([-3200n, -4800n])
  })

  it('uses the previous actual cent debit when completing the next refund', async () => {
    const { complete, refund, tx, history, entry } = setup(null)
    refund.amount = 1n
    refund.payment.amount = refund.order.grandTotal = 2n
    tx.shopOrder.findMany.mockResolvedValue([
      { shopId: 'shop-1', grandTotal: 1n, currency: 'THB' }, { shopId: 'shop-2', grandTotal: 1n, currency: 'THB' },
    ])
    tx.refund.findMany.mockResolvedValue([history(1n)])
    tx.walletLedgerEntry.findMany.mockResolvedValue([entry('shop-2', -1n)])
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => [input.data.shopId, input.data.amount])).toEqual([['shop-1', -1n]])
  })

  it('retains a targeted allocation and exhausts remaining shops on the full refund', async () => {
    const { complete, refund, tx, history, entry } = setup(null)
    refund.amount = 7000n
    tx.refund.findMany.mockResolvedValue([history(3000n, 'shop-1')])
    tx.walletLedgerEntry.findMany.mockResolvedValue([entry('shop-1', -3000n)])
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => input.data.amount)).toEqual([-1000n, -6000n])
  })

  it('includes committed allocations from a different payment attempt for the order', async () => {
    const { complete, tx, history, entry } = setup(null)
    const past = history(2000n)
    past.paymentId = past.payment.id = 'payment-other'
    tx.refund.findMany.mockResolvedValue([past])
    tx.walletLedgerEntry.findMany.mockResolvedValue([entry('shop-2', -2000n)])
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => [input.data.shopId, input.data.amount])).toEqual([
      ['shop-1', -4000n], ['shop-2', -4000n],
    ])
  })

  it('rejects a return beyond its shop remaining allocation', async () => {
    const { complete, tx, history, entry } = setup()
    tx.refund.findMany.mockResolvedValue([history(1n)])
    tx.walletLedgerEntry.findMany.mockResolvedValue([entry('shop-1', -1n)])
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('rejects cumulative refunds above the paid amount', async () => {
    const { complete, tx, history, entry } = setup()
    tx.refund.findMany.mockResolvedValue([history(7000n)])
    tx.walletLedgerEntry.findMany.mockResolvedValue([entry('shop-1', -1000n), entry('shop-2', -6000n)])
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE' })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('rejects a successful historical refund with missing wallet debits', async () => {
    const { complete, tx, history } = setup(null)
    tx.refund.findMany.mockResolvedValue([history(1n)])
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
  })

  it.each(['currency', 'order', 'shop', 'sign', 'failed', 'orphan', 'return-shop', 'payment-order', 'overdrawn'] as const)(
    'rejects corrupt historical %s allocations before any writes', async (corruption) => {
      const { complete, tx, history, entry } = setup(null)
      const past = history(1n)
      const debit = entry('shop-2', -1n)
      if (corruption === 'currency') debit.currency = 'USD'
      if (corruption === 'order') debit.orderId = 'other-order'
      if (corruption === 'shop') debit.shopId = 'other-shop'
      if (corruption === 'sign') debit.amount = 1n
      if (corruption === 'failed') past.status = 'FAILED'
      if (corruption === 'orphan') debit.refundId = null
      if (corruption === 'return-shop') past.returnRequest = { orderId: 'order-1', shopId: 'shop-1' }
      if (corruption === 'payment-order') past.payment.orderId = 'other-order'
      if (corruption === 'overdrawn') { past.amount = 6001n; debit.amount = -6001n }
      tx.refund.findMany.mockResolvedValue([past])
      tx.walletLedgerEntry.findMany.mockResolvedValue([debit])
      await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
      expect(tx.refund.updateMany).not.toHaveBeenCalled()
      expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
    },
  )

  it('ignores a failed refund without any ledger allocation', async () => {
    const { complete, tx, history } = setup(null)
    tx.refund.findMany.mockResolvedValue([{ ...history(10000n), status: 'FAILED' }])
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS' })
    expect(tx.walletLedgerEntry.create.mock.calls.map(([input]) => input.data.amount)).toEqual([-3200n, -4800n])
  })

  it('completes a zero refund without any wallet debit', async () => {
    const { complete, refund, tx } = setup(null)
    refund.amount = 0n
    await expect(complete()).resolves.toMatchObject({ status: 'SUCCESS', amount: 0n })
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled()
  })

  it('rejects snapshot currency and total mismatches', async () => {
    const { complete, refund, tx } = setup(null)
    refund.payment.currency = 'USD'
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    refund.payment.currency = 'THB'
    refund.payment.amount = 10001n
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    refund.payment.amount = 10000n
    tx.shopOrder.findMany.mockResolvedValue([{ shopId: 'shop-1', grandTotal: 10000n, currency: 'USD' }])
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    tx.shopOrder.findMany.mockResolvedValue([{ shopId: 'shop-1', grandTotal: 9999n, currency: 'THB' }])
    await expect(complete()).rejects.toMatchObject({ code: 'INVALID_REFUND_STATE', status: 409 })
    expect(tx.refund.updateMany).not.toHaveBeenCalled()
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
