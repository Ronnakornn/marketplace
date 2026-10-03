import type { ItemSaleSnapshot, ShopOrder, ShopSaleSnapshot } from '#generated/client/client.ts'
import { CheckoutServiceError } from './checkout.errors.ts'

export type NetTax = Readonly<{ net: bigint; tax: bigint }>
export type FrozenTaxPolicyV2 = Readonly<{
  version: 2; revision: string; ratePpm: number
  mode: 'INCLUSIVE' | 'EXCLUSIVE'
  fundingBasis: 'BUYER_AFTER_ALL_DISCOUNTS' | 'SELLER_AFTER_SHOP_COUPON'
  taxableShipping: boolean; shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER'
  rounding: 'LINE_HALF_UP'; exclusiveTaxFunding: 'BUYER'; custodian: 'SELLER'
}>

const invalidPolicy = () => new CheckoutServiceError('Tax policy must be complete and supported', 400, 'INVALID_TAX_POLICY')
const invalidSale = () => new CheckoutServiceError('Frozen sale economics are inconsistent', 409, 'INVALID_SETTLEMENT_SNAPSHOT')

export function parseFrozenTaxPolicy(value: unknown, revision = 'default-zero'): FrozenTaxPolicyV2 {
  if (value === null || value === undefined) return { version: 2, revision, ratePpm: 0, mode: 'EXCLUSIVE', fundingBasis: 'BUYER_AFTER_ALL_DISCOUNTS', taxableShipping: false, shippingBasis: 'SELLER_SHIPPING_AFTER_WAIVER', rounding: 'LINE_HALF_UP', exclusiveTaxFunding: 'BUYER', custodian: 'SELLER' }
  if (typeof value !== 'object' || Array.isArray(value)) throw invalidPolicy()
  const policy = Object.fromEntries(Object.entries(value))
  if (Object.values(policy).some((field) => field === null)) throw invalidPolicy()
  const rate = policy['ratePpm']
  if (typeof rate !== 'number' || !Number.isInteger(rate) || rate < 0 || rate > 1_000_000) throw invalidPolicy()
  const defaults = parseFrozenTaxPolicy(null, revision)
  const mode = policy['mode'] ?? (rate === 0 ? defaults.mode : undefined)
  const fundingBasis = policy['fundingBasis'] ?? (rate === 0 ? defaults.fundingBasis : undefined)
  const taxableShipping = policy['taxableShipping'] ?? (rate === 0 ? false : undefined)
  const shippingBasis = policy['shippingBasis'] ?? (rate === 0 ? defaults.shippingBasis : undefined)
  const rounding = policy['rounding'] ?? (rate === 0 ? defaults.rounding : undefined)
  const custodian = policy['custodian'] ?? (rate === 0 ? defaults.custodian : undefined)
  const exclusiveTaxFunding = policy['exclusiveTaxFunding'] ?? (rate === 0 ? defaults.exclusiveTaxFunding : undefined)
  const frozenRevision = policy['revision'] ?? revision
  if ((policy['version'] !== undefined && policy['version'] !== 2) || (mode !== 'INCLUSIVE' && mode !== 'EXCLUSIVE')
    || (fundingBasis !== 'BUYER_AFTER_ALL_DISCOUNTS' && fundingBasis !== 'SELLER_AFTER_SHOP_COUPON')
    || typeof taxableShipping !== 'boolean' || shippingBasis !== 'SELLER_SHIPPING_AFTER_WAIVER'
    || rounding !== 'LINE_HALF_UP' || custodian !== 'SELLER' || exclusiveTaxFunding !== 'BUYER'
    || typeof frozenRevision !== 'string' || !frozenRevision.trim()) throw invalidPolicy()
  return { version: 2, revision: frozenRevision, ratePpm: rate, mode, fundingBasis, taxableShipping, shippingBasis, rounding, exclusiveTaxFunding, custodian }
}

export type PricedSaleLine = Readonly<{
  cartItemId: string; quantity: number; grossMerchandise: bigint
  sellerCouponDiscount: bigint; platformCouponDiscount: bigint; coinDiscount: bigint
}>
export type SaleEconomicsInput = Readonly<{
  items: readonly PricedSaleLine[]; buyerShippingGross: bigint; platformShippingGross: bigint
}>

function halfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n)
}

function taxOf(base: bigint, policy: FrozenTaxPolicyV2): bigint {
  const rate = BigInt(policy.ratePpm)
  return halfUp(base * rate, policy.mode === 'INCLUSIVE' ? 1_000_000n + rate : 1_000_000n)
}

function splitTax(tax: bigint, gross: readonly bigint[]): bigint[] {
  const total = gross.reduce((sum, amount) => sum + amount, 0n)
  if (tax === 0n) return gross.map(() => 0n)
  if (total === 0n || tax > total) throw invalidSale()
  const parts = gross.map((amount) => amount * tax / total)
  const order = gross.map((amount, index) => ({ index, remainder: amount * tax % total }))
    .sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)
  const remaining = tax - parts.reduce((sum, amount) => sum + amount, 0n)
  for (let index = 0; BigInt(index) < remaining; index++) parts[order[index]!.index]! += 1n
  return parts
}

export function calculateSaleEconomics(input: SaleEconomicsInput, policy: FrozenTaxPolicyV2) {
  parseFrozenTaxPolicy(policy)
  if (!input.items.length || new Set(input.items.map((item) => item.cartItemId)).size !== input.items.length
    || input.buyerShippingGross < 0n || input.platformShippingGross < 0n) throw invalidSale()
  const items = [...input.items].sort((a, b) => a.cartItemId.localeCompare(b.cartItemId)).map((item) => {
    const { grossMerchandise: gross, sellerCouponDiscount: seller, platformCouponDiscount: platform, coinDiscount: coins } = item
    const buyer = gross - seller - platform - coins
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 2_147_483_647 || [gross, seller, platform, coins, buyer].some((amount) => amount < 0n)) throw invalidSale()
    const tax = taxOf(policy.fundingBasis === 'BUYER_AFTER_ALL_DISCOUNTS' ? buyer : gross - seller, policy)
    const taxes = policy.mode === 'EXCLUSIVE' || policy.fundingBasis === 'BUYER_AFTER_ALL_DISCOUNTS' ? [tax, 0n, 0n] : splitTax(tax, [buyer, platform, coins])
    const pools = [buyer, platform, coins].map((amount, index): NetTax => ({ net: amount - (policy.mode === 'INCLUSIVE' ? taxes[index]! : 0n), tax: taxes[index]! }))
    return { ...item, buyer: pools[0]!, platformCoupon: pools[1]!, coins: pools[2]!, buyerMerchandise: pools[0]!.net + pools[0]!.tax,
      sellerGrossMerchandise: pools.reduce((sum, pool) => sum + pool.net + pool.tax, 0n), commissionBase: pools.reduce((sum, pool) => sum + pool.net, 0n),
      includedTaxTotal: policy.mode === 'INCLUSIVE' ? tax : 0n, addedTaxTotal: policy.mode === 'EXCLUSIVE' ? tax : 0n,
      originalCashbackEligibleNet: pools[0]!.net, originalAffiliateEligibleNet: pools[0]!.net }
  })
  const shippingTax = policy.taxableShipping ? taxOf(input.buyerShippingGross + input.platformShippingGross, policy) : 0n
  const shippingTaxes = policy.mode === 'EXCLUSIVE' ? [shippingTax, 0n] : splitTax(shippingTax, [input.buyerShippingGross, input.platformShippingGross])
  const buyerShipping: NetTax = { net: input.buyerShippingGross - (policy.mode === 'INCLUSIVE' ? shippingTaxes[0]! : 0n), tax: shippingTaxes[0]! }
  const platformShipping: NetTax = { net: input.platformShippingGross - (policy.mode === 'INCLUSIVE' ? shippingTaxes[1]! : 0n), tax: shippingTaxes[1]! }
  const includedTaxTotal = items.reduce((sum, item) => sum + item.includedTaxTotal, 0n) + (policy.mode === 'INCLUSIVE' ? shippingTax : 0n)
  const addedTaxTotal = items.reduce((sum, item) => sum + item.addedTaxTotal, 0n) + (policy.mode === 'EXCLUSIVE' ? shippingTax : 0n)
  return { policy, items, buyerShipping, platformShipping, includedTaxTotal, addedTaxTotal, reportedTaxTotal: includedTaxTotal + addedTaxTotal,
    buyerCash: items.reduce((sum, item) => sum + item.buyerMerchandise, 0n) + buyerShipping.net + buyerShipping.tax,
    commissionBase: items.reduce((sum, item) => sum + item.commissionBase, 0n),
    sellerGrossMerchandise: items.reduce((sum, item) => sum + item.sellerGrossMerchandise, 0n),
    sellerGrossShipping: buyerShipping.net + buyerShipping.tax + platformShipping.net + platformShipping.tax }
}

export function validateFrozenSaleEconomics(sale: ShopSaleSnapshot, items: readonly ItemSaleSnapshot[], totals: Pick<ShopOrder, 'subtotal' | 'discountTotal' | 'shippingTotal' | 'taxTotal' | 'includedTaxTotal' | 'reportedTaxTotal' | 'grandTotal'>) {
  if ([sale.originalShipping, sale.sellerShippingWaiver, sale.buyerShipping, sale.platformShippingSubsidy].some((amount) => amount < 0n)) throw invalidSale()
  if (sale.policyVersion !== 2 || [sale.taxRatePpm, sale.taxMode, sale.taxFundingBasis, sale.taxableShipping, sale.taxShippingBasis, sale.taxRounding, sale.taxCustodian, sale.taxExclusiveFunding, sale.taxPolicyRevision].some((value) => value === null)) throw invalidSale()
  const policy = parseFrozenTaxPolicy({ version: 2, ratePpm: sale.taxRatePpm, mode: sale.taxMode, fundingBasis: sale.taxFundingBasis, taxableShipping: sale.taxableShipping, shippingBasis: sale.taxShippingBasis, rounding: sale.taxRounding, custodian: sale.taxCustodian, exclusiveTaxFunding: sale.taxExclusiveFunding, revision: sale.taxPolicyRevision })
  if (sale.buyerShippingNet === null || sale.buyerShippingTax === null || sale.platformShippingNet === null || sale.platformShippingTax === null) throw invalidSale()
  const expected = calculateSaleEconomics({ items: items.map((item) => ({ cartItemId: item.orderItemId, quantity: item.originalQuantity, grossMerchandise: item.grossMerchandise, sellerCouponDiscount: item.sellerCouponDiscount, platformCouponDiscount: item.platformCouponDiscount, coinDiscount: item.coinDiscount })), buyerShippingGross: policy.mode === 'EXCLUSIVE' ? sale.buyerShippingNet : sale.buyerShipping, platformShippingGross: sale.platformShippingSubsidy }, policy)
  for (const item of items) {
    const line = expected.items.find((line) => line.cartItemId === item.orderItemId)!
    if (item.buyerMerchandiseNet !== line.buyer.net || item.buyerMerchandiseTax !== line.buyer.tax
      || item.platformCouponNet !== line.platformCoupon.net || item.platformCouponTax !== line.platformCoupon.tax
      || item.coinFundingNet !== line.coins.net || item.coinFundingTax !== line.coins.tax
      || item.buyerMerchandise !== line.buyerMerchandise || item.originalCashbackEligibleNet !== line.originalCashbackEligibleNet
      || item.originalAffiliateEligibleNet !== line.originalAffiliateEligibleNet) throw invalidSale()
  }
  const advertised = items.reduce((sum, item) => sum + item.grossMerchandise, 0n)
  const discounts = items.reduce((sum, item) => sum + item.sellerCouponDiscount + item.platformCouponDiscount + item.coinDiscount, 0n)
  const originalShipping = sale.originalShipping - sale.sellerShippingWaiver
  if (sale.commissionBase !== expected.commissionBase || sale.sellerGrossMerchandise !== expected.sellerGrossMerchandise
    || sale.sellerGrossShipping !== expected.sellerGrossShipping || sale.buyerShippingNet !== expected.buyerShipping.net || sale.buyerShippingTax !== expected.buyerShipping.tax
    || sale.platformShippingNet !== expected.platformShipping.net || sale.platformShippingTax !== expected.platformShipping.tax
    || sale.buyerShipping !== expected.buyerShipping.net + expected.buyerShipping.tax || sale.platformShippingSubsidy !== expected.platformShipping.net + expected.platformShipping.tax
    || originalShipping < 0n || expected.sellerGrossShipping !== originalShipping + (policy.mode === 'EXCLUSIVE' ? expected.buyerShipping.tax : 0n)
    || sale.includedTaxTotal !== expected.includedTaxTotal || sale.addedTaxTotal !== expected.addedTaxTotal || sale.reportedTaxTotal !== expected.reportedTaxTotal
    || !Number.isInteger(sale.commissionBps) || sale.commissionBps < 0 || sale.commissionBps > 10000 || sale.originalCommission !== expected.commissionBase * BigInt(sale.commissionBps) / 10000n
    || totals.subtotal !== advertised || totals.discountTotal !== discounts || totals.shippingTotal !== expected.buyerShipping.net + expected.buyerShipping.tax - (policy.mode === 'EXCLUSIVE' ? expected.buyerShipping.tax : 0n)
    || totals.taxTotal !== expected.addedTaxTotal || totals.includedTaxTotal !== expected.includedTaxTotal || totals.reportedTaxTotal !== expected.reportedTaxTotal || totals.grandTotal !== expected.buyerCash) throw invalidSale()
  return expected
}
