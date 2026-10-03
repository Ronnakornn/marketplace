import { describe, expect, it } from 'vitest'
import { completeSettlementRefundPlan, createSettlementRefundPlan, validateSettlementRefundState, type SettlementRefundState } from './settlement-refund.service.ts'

function fixture(): SettlementRefundState {
  return { orderId: 'order', currency: 'THB', history: [],
    shops: [{ id: 'shop-order', orderId: 'order', shopId: 'shop', currency: 'THB', subtotal: 100n, discountTotal: 20n, shippingTotal: 5n, taxTotal: 0n, includedTaxTotal: 0n, reportedTaxTotal: 0n, grandTotal: 85n, saleSnapshot: {
      shopOrderId: 'shop-order', policyVersion: 1, currency: 'THB', commissionBase: 100n, commissionBps: 1000, originalCommission: 10n,
      originalShipping: 5n, buyerShipping: 5n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n, recognizedAt: null,
      taxRatePpm: null, taxMode: null, taxFundingBasis: null, taxableShipping: null, taxShippingBasis: null, taxRounding: null, taxCustodian: null, taxExclusiveFunding: null, taxPolicyRevision: null,
      sellerGrossMerchandise: null, sellerGrossShipping: null, buyerShippingNet: null, buyerShippingTax: null, platformShippingNet: null, platformShippingTax: null, includedTaxTotal: null, addedTaxTotal: null, reportedTaxTotal: null,
    } }],
    items: [{ id: 'item', orderId: 'order', shopId: 'shop', quantity: 1, lineTotal: 100n, saleSnapshot: {
      orderItemId: 'item', shopOrderId: 'shop-order', originalQuantity: 1, grossMerchandise: 100n, sellerCouponDiscount: 0n,
      platformCouponDiscount: 20n, coinDiscount: 0n, buyerMerchandise: 80n, couponId: 'coupon', couponCode: 'PLATFORM',
      buyerMerchandiseNet: null, buyerMerchandiseTax: null, platformCouponNet: null, platformCouponTax: null, coinFundingNet: null, coinFundingTax: null, originalCashbackEligibleNet: null, originalAffiliateEligibleNet: null,
      shopCouponId: null, shopCouponCode: null, platformCouponId: null, platformCouponCode: null,
    } }],
  }
}
const merchandiseReturn = { items: [{ orderItemId: 'item', quantity: 1 }], shipping: [] }

function inclusiveFixture(quantity: number, gross: bigint, net: bigint, tax: bigint): SettlementRefundState {
  const state = fixture()
  const shop = state.shops[0]!
  const sale = shop.saleSnapshot!
  Object.assign(shop, { subtotal: gross, discountTotal: 0n, shippingTotal: 0n, taxTotal: 0n, includedTaxTotal: tax, reportedTaxTotal: tax, grandTotal: gross })
  Object.assign(sale, { policyVersion: 2, commissionBase: net, originalCommission: net * 1000n / 10000n, originalShipping: 0n, buyerShipping: 0n,
    taxRatePpm: 70000, taxMode: 'INCLUSIVE', taxFundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false, taxShippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', taxRounding: 'LINE_HALF_UP', taxCustodian: 'SELLER', taxExclusiveFunding: 'BUYER', taxPolicyRevision: 'original-7',
    sellerGrossMerchandise: gross, sellerGrossShipping: 0n, buyerShippingNet: 0n, buyerShippingTax: 0n, platformShippingNet: 0n, platformShippingTax: 0n, includedTaxTotal: tax, addedTaxTotal: 0n, reportedTaxTotal: tax })
  const item = state.items[0]!
  Object.assign(item, { quantity, lineTotal: gross })
  Object.assign(item.saleSnapshot!, { originalQuantity: quantity, grossMerchandise: gross, platformCouponDiscount: 0n, buyerMerchandise: gross,
    buyerMerchandiseNet: net, buyerMerchandiseTax: tax, platformCouponNet: 0n, platformCouponTax: 0n, coinFundingNet: 0n, coinFundingTax: 0n, originalCashbackEligibleNet: net, originalAffiliateEligibleNet: net, couponId: null, couponCode: null })
  return state
}

function recordSuccess(state: SettlementRefundState, plan: ReturnType<typeof completeSettlementRefundPlan>, id: string) {
  state.history = [...state.history, { id, status: 'SUCCESS', amount: plan.amount, itemAllocations: plan.items, shopAllocations: plan.shops }]
}

describe('snapshot settlement refund planning', () => {
  it('exhausts original net94/tax7 in three quantities with literal cash33/33/35', () => {
    const state = inclusiveFixture(3, 101n, 94n, 7n)
    const results = [0, 1, 2].map((index) => {
      const plan = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
      recordSuccess(state, plan, String(index))
      return plan
    })
    expect(results.map((plan) => plan.amount)).toEqual([33n, 33n, 35n])
    expect(results.map((plan) => plan.items[0]?.cashMerchandise)).toEqual([31n, 31n, 32n])
    expect(results.map((plan) => plan.items[0]?.buyerTaxRefund)).toEqual([2n, 2n, 3n])
    expect(results.map((plan) => plan.shops[0]?.commissionReversal)).toEqual([2n, 3n, 4n])
    expect(() => createSettlementRefundPlan(state, merchandiseReturn)).toThrow(/remaining item/)
  })

  it('keeps atomic net nonnegative when quantity12→13 has gross-floor delta0 and tax1', () => {
    const state = inclusiveFixture(25, 23n, 21n, 2n)
    const first = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, { items: [{ orderItemId: 'item', quantity: 12 }], shipping: [] }))
    recordSuccess(state, first, 'first')
    const next = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(next.items[0]).toMatchObject({ successfulQuantityBefore: 12, cashMerchandise: 0n, buyerTaxRefund: 1n })
    expect(next.amount).toBe(1n)
  })

  it('reserves one same-item interval and releases confirmed failure without consuming it', () => {
    const state = inclusiveFixture(3, 101n, 94n, 7n)
    const pending = createSettlementRefundPlan(state, merchandiseReturn)
    state.history = [{ id: 'pending', status: 'PROCESSING', amount: pending.amount, itemAllocations: pending.items, shopAllocations: pending.shops }]
    expect(() => createSettlementRefundPlan(state, merchandiseReturn)).toThrow(/reserved refund/)
    state.history = [{ ...state.history[0]!, status: 'FAILED' }]
    const retry = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(retry.amount).toBe(33n)
    expect(retry.items[0]?.successfulQuantityBefore).toBe(0)
  })

  it('rejects missing v2 tax facts and discontinuous successful quantity history', () => {
    const missing = inclusiveFixture(3, 101n, 94n, 7n)
    missing.items[0]!.saleSnapshot!.buyerMerchandiseTax = null
    expect(() => createSettlementRefundPlan(missing, merchandiseReturn)).toThrow(/tax snapshot/)
    const state = inclusiveFixture(3, 101n, 94n, 7n)
    const original = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    original.items[0]!.successfulQuantityBefore = 1
    recordSuccess(state, original, 'corrupt')
    expect(() => validateSettlementRefundState(state)).toThrow(/intervals|inconsistent/)
  })
  it('conserves the accepted combined funding example independently of coupon APIs', () => {
    const state = fixture()
    const item = state.items[0]!
    item.lineTotal = 100000n
    Object.assign(item.saleSnapshot!, { grossMerchandise: 100000n, sellerCouponDiscount: 10000n, platformCouponDiscount: 5000n, coinDiscount: 2000n, buyerMerchandise: 83000n, couponId: null, couponCode: null })
    Object.assign(state.shops[0]!.saleSnapshot!, { commissionBase: 90000n, originalCommission: 9000n, originalShipping: 4000n, buyerShipping: 4000n })
    const merchandise = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(merchandise.amount).toBe(83000n)
    expect(merchandise.items[0]).toMatchObject({ cashMerchandise: 83000n, platformCouponReversal: 5000n, coinFundingReversal: 2000n })
    expect(merchandise.items.reduce((sum, row) => sum + row.cashMerchandise + row.platformCouponReversal + row.coinFundingReversal, 0n)).toBe(90000n)
    expect(merchandise.shops[0]?.commissionReversal).toBe(9000n)
    const canceled = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, { ...merchandiseReturn, shipping: [{ shopOrderId: 'shop-order', cause: 'PRE_SHIPMENT_CANCEL' }] }))
    expect(canceled.amount).toBe(87000n)
    expect(canceled.shops[0]).toMatchObject({ buyerShippingRefund: 4000n, commissionReversal: 9000n })
  })

  it('returns buyer cash separately from seller merchandise and original fee', () => {
    const state = fixture()
    const plan = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(plan.amount).toBe(80n)
    expect(plan.items).toEqual([{ orderItemId: 'item', quantity: 1, successfulQuantityBefore: 0, cashMerchandise: 80n, buyerTaxRefund: 0n, platformCouponReversal: 20n, platformCouponTaxReversal: 0n, coinFundingReversal: 0n, coinTaxReversal: 0n }])
    expect(plan.shops).toEqual([{ shopOrderId: 'shop-order', buyerShippingRefund: 0n, buyerShippingTaxRefund: 0n, platformShippingReversal: 0n, platformShippingTaxReversal: 0n, commissionReversal: 10n, shippingCause: 'NONE' }])
  })

  it('reverses a fully subsidized zero-cash item and its fee', () => {
    const state = fixture()
    state.items[0]!.saleSnapshot!.buyerMerchandise = 0n
    state.items[0]!.saleSnapshot!.platformCouponDiscount = 100n
    const plan = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(plan.amount).toBe(0n)
    expect(plan.items[0]?.platformCouponReversal).toBe(100n)
    expect(plan.shops[0]?.commissionReversal).toBe(10n)
  })

  it('refunds charged shipping for seller fault while retaining incurred platform subsidy', () => {
    const state = fixture()
    state.shops[0]!.saleSnapshot!.originalShipping = 10n
    state.shops[0]!.saleSnapshot!.platformShippingSubsidy = 5n
    const plan = createSettlementRefundPlan(state, { ...merchandiseReturn, shipping: [{ shopOrderId: 'shop-order', cause: 'SELLER_FAULT' }] })
    expect(plan.amount).toBe(85n)
    expect(plan.shops[0]).toMatchObject({ buyerShippingRefund: 5n, platformShippingReversal: 0n, shippingCause: 'SELLER_FAULT' })
  })

  it('reverses unincurred platform free shipping on preship cancellation', () => {
    const state = fixture()
    state.shops[0]!.saleSnapshot!.buyerShipping = 0n
    state.shops[0]!.saleSnapshot!.platformShippingSubsidy = 5n
    const plan = createSettlementRefundPlan(state, { ...merchandiseReturn, shipping: [{ shopOrderId: 'shop-order', cause: 'PRE_SHIPMENT_CANCEL' }] })
    expect(plan.amount).toBe(80n)
    expect(plan.shops[0]).toMatchObject({ buyerShippingRefund: 0n, platformShippingReversal: 5n })
  })

  it('retains shipping for a change-of-mind return', () => {
    const plan = createSettlementRefundPlan(fixture(), { ...merchandiseReturn, shipping: [{ shopOrderId: 'shop-order', cause: 'CHANGE_OF_MIND' }] })
    expect(plan.amount).toBe(80n)
    expect(plan.shops[0]).toMatchObject({ buyerShippingRefund: 0n, platformShippingReversal: 0n })
  })

  it.each(['PENDING', 'PROCESSING', 'SUCCESS'] as const)('reserves the full item against an overlapping %s plan', (status) => {
    const state = fixture()
    const previous = status === 'SUCCESS' ? completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn)) : createSettlementRefundPlan(state, merchandiseReturn)
    state.history = [{ id: 'previous', status, amount: previous.amount, itemAllocations: previous.items, shopAllocations: previous.shops }]
    expect(() => createSettlementRefundPlan(state, merchandiseReturn)).toThrowError(/reserved refund|remaining item/)
  })

  it('releases a failed plan without consuming original entitlement', () => {
    const state = fixture()
    const failed = createSettlementRefundPlan(state, merchandiseReturn)
    state.history = [{ id: 'failed', status: 'FAILED', amount: failed.amount, itemAllocations: failed.items, shopAllocations: failed.shops }]
    expect(createSettlementRefundPlan(state, merchandiseReturn).amount).toBe(80n)
  })

  it('freezes partial quantities from original cumulative funding rights', () => {
    const state = fixture()
    state.items[0]!.quantity = state.items[0]!.saleSnapshot!.originalQuantity = 2
    const plan = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    expect(plan.amount).toBe(40n)
    expect(plan.items[0]).toMatchObject({ quantity: 1, cashMerchandise: 40n, platformCouponReversal: 10n })
    expect(plan.shops[0]?.commissionReversal).toBe(5n)
  })

  it('rejects a historical component mismatch even below its original cap', () => {
    const state = fixture()
    const past = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    past.items[0]!.platformCouponReversal = 19n
    state.history = [{ id: 'old', status: 'SUCCESS', amount: past.amount, itemAllocations: past.items, shopAllocations: past.shops }]
    expect(() => validateSettlementRefundState(state)).toThrowError(/inconsistent/)
  })

  it('rejects a historical fee mismatch even below the original fee', () => {
    const state = fixture()
    const past = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, merchandiseReturn))
    past.shops[0]!.commissionReversal = 9n
    state.history = [{ id: 'old', status: 'SUCCESS', amount: past.amount, itemAllocations: past.items, shopAllocations: past.shops }]
    expect(() => validateSettlementRefundState(state)).toThrowError(/Historical original commission/)
  })

  it('rejects frozen cash that disagrees with saved components', () => {
    const state = fixture()
    const saved = createSettlementRefundPlan(state, merchandiseReturn)
    expect(() => completeSettlementRefundPlan(state, { ...saved, amount: 79n })).toThrowError(/cash does not match/)
  })

  it('distinguishes legacy sales from incomplete snapshots', () => {
    const state = fixture()
    state.shops[0]!.saleSnapshot = null
    expect(() => validateSettlementRefundState(state)).toThrowError(/incomplete/)
    state.items[0]!.saleSnapshot = null
    expect(validateSettlementRefundState(state)).toBe(false)
  })

  it('reverses the original one-cent commission across separate full-item returns', () => {
    const state = fixture()
    const sale = state.shops[0]!.saleSnapshot!
    sale.commissionBase = 3n; sale.commissionBps = 3334; sale.originalCommission = 1n
    const original = state.items[0]!
    state.items = [1n, 2n].map((value, index) => ({ ...original, id: `item-${index}`, lineTotal: value, saleSnapshot: {
      ...original.saleSnapshot!, orderItemId: `item-${index}`, grossMerchandise: value, buyerMerchandise: value, platformCouponDiscount: 0n,
    } }))
    const first = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, { items: [{ orderItemId: 'item-0', quantity: 1 }], shipping: [] }))
    expect(first.shops[0]?.commissionReversal).toBe(0n)
    state.history = [{ id: 'first', status: 'SUCCESS', amount: first.amount, itemAllocations: first.items, shopAllocations: first.shops }]
    const second = completeSettlementRefundPlan(state, createSettlementRefundPlan(state, { items: [{ orderItemId: 'item-1', quantity: 1 }], shipping: [] }))
    expect(second.shops[0]?.commissionReversal).toBe(1n)
    expect(first.amount + second.amount).toBe(3n)
  })
})
