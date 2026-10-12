import { createHash } from 'node:crypto'
import { moneyNumber, toMoneyDto } from '#server/lib/money.ts'
import { allocateRefundAmount } from '#server/modules/refund/refund-amount.service.ts'
import type { CheckoutPricedItem } from './checkout.repository.ts'
import { calculateSaleEconomics, type FrozenTaxPolicyV2 } from './sale-economics.ts'

export type CheckoutDiscountFunding = {
  sellerCouponDiscount: number; sellerCouponShopId: string | null; platformCouponDiscount: number; coinDiscount: number
  sellerFreeShippingShopIds: string[]; platformFreeShippingShopIds: string[]
  sellerCouponItemIds?: string[]; platformCouponItemIds?: string[]
}

export function calculateCheckoutEconomics(items: readonly CheckoutPricedItem[], funding: CheckoutDiscountFunding, policy: FrozenTaxPolicyV2) {
  const stable = [...items].sort((a, b) => a.variant.product.shop.id.localeCompare(b.variant.product.shop.id) || a.id.localeCompare(b.id))
  const gross = stable.map((item) => BigInt(item.unitPrice) * BigInt(item.quantity))
  const sellerDiscounts = allocateRefundAmount(BigInt(funding.sellerCouponDiscount), stable.map((item, index) => item.variant.product.shop.id === funding.sellerCouponShopId && (!funding.sellerCouponItemIds || funding.sellerCouponItemIds.includes(item.id)) ? gross[index]! : 0n))
  const sellerMerchandise = gross.map((amount, index) => amount - sellerDiscounts[index]!)
  const platformDiscounts = allocateRefundAmount(BigInt(funding.platformCouponDiscount), sellerMerchandise.map((amount, index) => !funding.platformCouponItemIds || funding.platformCouponItemIds.includes(stable[index]!.id) ? amount : 0n))
  const coinDiscounts = allocateRefundAmount(BigInt(funding.coinDiscount), sellerMerchandise.map((amount, index) => amount - platformDiscounts[index]!))
  const shopIds = [...new Set(stable.map((item) => item.variant.product.shop.id))]
  const shops = shopIds.map((shopId) => {
    const positions = stable.map((item, index) => ({ item, index })).filter(({ item }) => item.variant.product.shop.id === shopId)
    const originalShipping = BigInt(positions[0]!.item.variant.product.shop.settings?.shippingFee ?? 0)
    const sellerShippingWaiver = funding.sellerFreeShippingShopIds.includes(shopId) ? originalShipping : 0n
    const platformShippingSubsidy = sellerShippingWaiver === 0n && funding.platformFreeShippingShopIds.includes(shopId) ? originalShipping : 0n
    const buyerShippingGross = originalShipping - sellerShippingWaiver - platformShippingSubsidy
    const economics = calculateSaleEconomics({ items: positions.map(({ item, index }) => ({ cartItemId: item.id, quantity: item.quantity,
      grossMerchandise: gross[index]!, sellerCouponDiscount: sellerDiscounts[index]!, platformCouponDiscount: platformDiscounts[index]!, coinDiscount: coinDiscounts[index]! })), buyerShippingGross, platformShippingGross: platformShippingSubsidy }, policy)
    return { shopId, originalShipping, sellerShippingWaiver, platformShippingSubsidy, buyerShippingGross, economics }
  })
  const subtotal = gross.reduce((sum, amount) => sum + amount, 0n)
  const discountTotal = BigInt(funding.sellerCouponDiscount) + BigInt(funding.platformCouponDiscount) + BigInt(funding.coinDiscount)
  const shippingTotal = shops.reduce((sum, shop) => sum + shop.buyerShippingGross, 0n)
  const taxTotal = shops.reduce((sum, shop) => sum + shop.economics.addedTaxTotal, 0n)
  const includedTaxTotal = shops.reduce((sum, shop) => sum + shop.economics.includedTaxTotal, 0n)
  const reportedTaxTotal = includedTaxTotal + taxTotal
  const grandTotal = shops.reduce((sum, shop) => sum + shop.economics.buyerCash, 0n)
  if (grandTotal !== subtotal - discountTotal + shippingTotal + taxTotal) throw new Error('Checkout funding identities are inconsistent')
  return { stableItems: stable, shops, totals: { subtotal: moneyNumber(subtotal), discountTotal: moneyNumber(discountTotal), shippingTotal: moneyNumber(shippingTotal), taxTotal: moneyNumber(taxTotal), includedTaxTotal: moneyNumber(includedTaxTotal), addedTaxTotal: moneyNumber(taxTotal), reportedTaxTotal: moneyNumber(reportedTaxTotal), grandTotal: moneyNumber(grandTotal), currency: 'THB' } }
}

export function checkoutFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(toMoneyDto(value))).digest('hex')
}
