import { describe, expect, it } from 'vitest'
import { calculateSaleEconomics, parseFrozenTaxPolicy, type FrozenTaxPolicyV2 } from './sale-economics.ts'

const policy: FrozenTaxPolicyV2 = { version: 2, revision: 'fixture-1', ratePpm: 70000, mode: 'INCLUSIVE', fundingBasis: 'SELLER_AFTER_SHOP_COUPON', taxableShipping: false, shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', rounding: 'LINE_HALF_UP', exclusiveTaxFunding: 'BUYER', custodian: 'SELLER' }
const line = { cartItemId: 'cart-a', quantity: 1, grossMerchandise: 10700n, sellerCouponDiscount: 0n, platformCouponDiscount: 0n, coinDiscount: 0n }
const input = { items: [line], buyerShippingGross: 0n, platformShippingGross: 0n }

describe('original sale net and tax facts', () => {
  it('keeps zero tax economics and discount funding exactly', () => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, grossMerchandise: 10000n, sellerCouponDiscount: 1000n, platformCouponDiscount: 1000n, coinDiscount: 500n }], buyerShippingGross: 400n }, parseFrozenTaxPolicy(null))
    expect(result).toMatchObject({ buyerCash: 7900n, commissionBase: 9000n, sellerGrossMerchandise: 9000n, sellerGrossShipping: 400n, includedTaxTotal: 0n, addedTaxTotal: 0n })
    expect(result.items[0]!.buyer).toEqual({ net: 7500n, tax: 0n })
  })

  it.each(['INCLUSIVE', 'EXCLUSIVE'] as const)('preserves seller receipts and excludes tax from commission for %s', (mode) => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, grossMerchandise: mode === 'INCLUSIVE' ? 10700n : 10000n }] }, { ...policy, mode })
    expect(result).toMatchObject({ buyerCash: 10700n, commissionBase: 10000n, sellerGrossMerchandise: 10700n, reportedTaxTotal: 700n })
    expect(result.items[0]).toMatchObject({ buyer: { net: 10000n, tax: 700n }, originalCashbackEligibleNet: 10000n, originalAffiliateEligibleNet: 10000n })
    expect(result.addedTaxTotal).toBe(mode === 'INCLUSIVE' ? 0n : 700n)
  })

  it('allocates inclusive seller-basis tax into the original platform funding', () => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, platformCouponDiscount: 1070n }] }, policy)
    expect(result).toMatchObject({ buyerCash: 9630n, commissionBase: 10000n, reportedTaxTotal: 700n })
    expect(result.items[0]).toMatchObject({ buyer: { net: 9000n, tax: 630n }, platformCoupon: { net: 1000n, tax: 70n } })
  })

  it('keeps platform funding outside buyer-basis tax', () => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, platformCouponDiscount: 1070n }] }, { ...policy, fundingBasis: 'BUYER_AFTER_ALL_DISCOUNTS' })
    expect(result).toMatchObject({ buyerCash: 9630n, commissionBase: 10070n, reportedTaxTotal: 630n })
    expect(result.items[0]!.platformCoupon).toEqual({ net: 1070n, tax: 0n })
  })

  it.each([['SELLER_AFTER_SHOP_COUPON', 9700n, 700n], ['BUYER_AFTER_ALL_DISCOUNTS', 9630n, 630n]] as const)('charges exclusive tax only to buyer using %s', (fundingBasis, cash, tax) => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, grossMerchandise: 10000n, platformCouponDiscount: 1000n }] }, { ...policy, mode: 'EXCLUSIVE', fundingBasis })
    expect(result.buyerCash).toBe(cash)
    expect(result.addedTaxTotal).toBe(tax)
    expect(result.items[0]!.platformCoupon).toEqual({ net: 1000n, tax: 0n })
  })

  it('taxes subsidized seller shipping independently of buyer merchandise basis', () => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, grossMerchandise: 0n }], platformShippingGross: 1000n }, { ...policy, mode: 'EXCLUSIVE', fundingBasis: 'BUYER_AFTER_ALL_DISCOUNTS', taxableShipping: true })
    expect(result).toMatchObject({ buyerCash: 70n, sellerGrossShipping: 1070n, commissionBase: 0n, addedTaxTotal: 70n, buyerShipping: { net: 0n, tax: 70n }, platformShipping: { net: 1000n, tax: 0n } })
  })

  it('extracts inclusive shipping tax without adding it again', () => {
    const result = calculateSaleEconomics({ ...input, buyerShippingGross: 1070n }, { ...policy, taxableShipping: true })
    expect(result).toMatchObject({ buyerCash: 11770n, buyerShipping: { net: 1000n, tax: 70n }, commissionBase: 10000n, addedTaxTotal: 0n, reportedTaxTotal: 770n })
  })

  it('rounds extended lines independently rather than the invoice', () => {
    const result = calculateSaleEconomics({ ...input, items: [{ ...line, quantity: 5, grossMerchandise: 5n }, { ...line, cartItemId: 'cart-b', grossMerchandise: 5n }] }, { ...policy, mode: 'EXCLUSIVE', ratePpm: 100000 })
    expect(result).toMatchObject({ addedTaxTotal: 2n, buyerCash: 12n })
  })

  it('supports the inclusive rate endpoints and rejects incomplete nonzero policy', () => {
    expect(parseFrozenTaxPolicy({ ...policy, ratePpm: 1_000_000 }).ratePpm).toBe(1_000_000)
    expect(() => parseFrozenTaxPolicy({ ratePpm: 70000 })).toThrow('complete')
    for (const ratePpm of [-1, 1.5, 1000001]) expect(() => parseFrozenTaxPolicy({ ...policy, ratePpm })).toThrow('complete')
    expect(() => parseFrozenTaxPolicy({ ...policy, custodian: 'PLATFORM' })).toThrow('complete')
    expect(() => parseFrozenTaxPolicy({ ...policy, taxableShipping: null })).toThrow('complete')
  })
})
