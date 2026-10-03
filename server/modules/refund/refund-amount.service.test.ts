import { describe, expect, it } from 'vitest'
import { allocateRefundAmount, calculateRefundDebits, calculateReturnRefund } from './refund-amount.service.ts'

describe('refund amounts', () => {
  it('allocates successive cents to each shop without repeating the rounding debit', () => {
    expect(calculateRefundDebits({ amount: 1n, scope: { kind: 'order' }, shops: [
      { shopId: 'b', grandTotal: 1n, refundedAmount: 0n },
      { shopId: 'a', grandTotal: 1n, refundedAmount: 0n },
    ] })).toEqual([{ shopId: 'a', amount: 0n }, { shopId: 'b', amount: 1n }])
    expect(calculateRefundDebits({ amount: 1n, scope: { kind: 'order' }, shops: [
      { shopId: 'a', grandTotal: 1n, refundedAmount: 0n },
      { shopId: 'b', grandTotal: 1n, refundedAmount: 1n },
    ] })).toEqual([{ shopId: 'a', amount: 1n }, { shopId: 'b', amount: 0n }])
  })

  it('conserves the new refund when cumulative proportions would credit a shop', () => {
    expect(calculateRefundDebits({ amount: 1n, scope: { kind: 'order' }, shops: [
      { shopId: 'a', grandTotal: 2n, refundedAmount: 0n },
      { shopId: 'b', grandTotal: 1n, refundedAmount: 1n },
      { shopId: 'c', grandTotal: 2n, refundedAmount: 1n },
    ] })).toEqual([{ shopId: 'a', amount: 0n }, { shopId: 'b', amount: 0n }, { shopId: 'c', amount: 1n }])
  })

  it('exhausts only remaining caps after a targeted return', () => {
    expect(calculateRefundDebits({ amount: 6n, scope: { kind: 'shop', shopId: 'a' }, shops: [
      { shopId: 'a', grandTotal: 10n, refundedAmount: 0n },
      { shopId: 'b', grandTotal: 10n, refundedAmount: 0n },
    ] })).toEqual([{ shopId: 'a', amount: 6n }, { shopId: 'b', amount: 0n }])
    expect(calculateRefundDebits({ amount: 2n, scope: { kind: 'order' }, shops: [
      { shopId: 'a', grandTotal: 10n, refundedAmount: 6n },
      { shopId: 'b', grandTotal: 10n, refundedAmount: 0n },
    ] })).toEqual([{ shopId: 'a', amount: 0n }, { shopId: 'b', amount: 2n }])
    expect(calculateRefundDebits({ amount: 12n, scope: { kind: 'order' }, shops: [
      { shopId: 'a', grandTotal: 10n, refundedAmount: 6n },
      { shopId: 'b', grandTotal: 10n, refundedAmount: 2n },
    ] })).toEqual([{ shopId: 'a', amount: 4n }, { shopId: 'b', amount: 8n }])
  })

  it('rejects targeted over-refunds, missing shops and overdrawn legacy allocations', () => {
    const shops = [{ shopId: 'a', grandTotal: 2n, refundedAmount: 1n }]
    for (const input of [
      { amount: 2n, scope: { kind: 'shop', shopId: 'a' }, shops },
      { amount: 0n, scope: { kind: 'shop', shopId: 'missing' }, shops },
      { amount: 0n, scope: { kind: 'order' }, shops: [{ shopId: 'a', grandTotal: 2n, refundedAmount: 3n }] },
    ] satisfies Parameters<typeof calculateRefundDebits>[0][]) {
      expect(() => calculateRefundDebits(input)).toThrow(expect.objectContaining({ code: 'INVALID_REFUND_STATE', status: 409 }))
    }
  })

  it('returns no positive allocation for a zero refund', () => {
    expect(calculateRefundDebits({ amount: 0n, scope: { kind: 'order' }, shops: [
      { shopId: 'a', grandTotal: 1n, refundedAmount: 0n },
      { shopId: 'b', grandTotal: 1n, refundedAmount: 1n },
    ] })).toEqual([{ shopId: 'a', amount: 0n }, { shopId: 'b', amount: 0n }])
  })

  it('refunds the amount paid after coupons and coins, excluding shipping', () => {
    expect(calculateReturnRefund(
      { subtotal: 10000n, discountTotal: 2000n },
      [{ id: 'item', lineTotal: 10000n, quantity: 2 }],
      [{ orderItemId: 'item', quantity: 2 }],
    )).toBe(8000n)
  })

  it('allocates rounding deterministically across separate item returns', () => {
    const items = [{ id: 'b', lineTotal: 100n, quantity: 1 }, { id: 'a', lineTotal: 100n, quantity: 1 }]
    const shop = { subtotal: 200n, discountTotal: 1n }
    const first = calculateReturnRefund(shop, items, [{ orderItemId: 'a', quantity: 1 }])
    const second = calculateReturnRefund(shop, [...items].reverse(), [{ orderItemId: 'b', quantity: 1 }])
    expect([first, second]).toEqual([99n, 100n])
    expect(first + second).toBe(199n)
  })

  it('does not spread another shop coupon across the returned shop', () => {
    expect(calculateReturnRefund(
      { subtotal: 1000n, discountTotal: 1000n }, [{ id: 'a', lineTotal: 1000n, quantity: 1 }], [{ orderItemId: 'a', quantity: 1 }],
    )).toBe(0n)
    expect(calculateReturnRefund(
      { subtotal: 2000n, discountTotal: 0n }, [{ id: 'b', lineTotal: 2000n, quantity: 1 }], [{ orderItemId: 'b', quantity: 1 }],
    )).toBe(2000n)
  })

  it('rejects over-refunds and invalid return quantities', () => {
    expect(() => allocateRefundAmount(101n, [100n])).toThrow()
    expect(() => calculateReturnRefund({ subtotal: 100n, discountTotal: 0n },
      [{ id: 'a', lineTotal: 100n, quantity: 1 }], [{ orderItemId: 'a', quantity: 2 }])).toThrow()
  })
})
