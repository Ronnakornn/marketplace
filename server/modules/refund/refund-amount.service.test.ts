import { describe, expect, it } from 'vitest'
import { allocateRefundAmount, calculateReturnRefund } from './refund-amount.service.ts'

describe('refund amounts', () => {
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
