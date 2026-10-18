import { calculateCheckoutEconomics, checkoutFingerprint } from './checkout-economics.ts'
import { parseFrozenTaxPolicy } from './sale-economics.ts'
import { allocateRefundAmount } from '#server/modules/refund/refund-amount.service.ts'
import { moneyNumber } from '#server/lib/money.ts'
import { couponTargetEligible } from '#server/modules/promotion/coupon-targets.schemas.ts'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { CheckoutServiceError } from './checkout.errors.ts'
import type {
  AcceptedCheckoutQuote,
  CheckoutCartItem,
  CheckoutPricedItem,
  CheckoutTotalsRecord,
  ICheckoutRepository,
} from './checkout.repository.ts'

export type CouponOutcome =
  | { code: string; applied: true }
  | { code: string; applied: false; reason: string }

export interface CheckoutQuote {
  subtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  grandTotal: number
  currency: string
  includedTaxTotal: number
  addedTaxTotal: number
  reportedTaxTotal: number
  taxMode: 'INCLUSIVE' | 'EXCLUSIVE'
  taxPolicyRevision: string
  quoteFingerprint: string
  couponOutcomes: CouponOutcome[]
  coupon: CouponOutcome | null
  coinsApplied: number
  items: Array<{ id: string; shopId: string; unitPrice: number; lineTotal: number }>
  shops: Array<{ shopId: string; subtotal: number }>
}

export interface CheckoutQuoteEvaluation {
  quote: CheckoutQuote
  acceptedQuote: AcceptedCheckoutQuote
}

export interface EvaluateCheckoutQuoteInput {
  userId: string
  items: CheckoutCartItem[]
  shopCouponCode?: string
  platformCouponCode?: string
  couponCode?: string
  coinsToUse?: number
  policy: 'estimate' | 'commit'
}

export class CheckoutQuoteEvaluator {
  constructor(private promotionService: PromotionService, private v2Supported = process.env['CHECKOUT_V2_SETTLEMENT_ENABLED'] === 'true', private requirePromotionAdmission?: (input: { userId: string; shopIds: string[] }) => Promise<void>) {}

  async evaluate(
    repo: ICheckoutRepository,
    input: EvaluateCheckoutQuoteInput,
  ): Promise<CheckoutQuoteEvaluation> {
    const items = await this.priceItems(repo, input.items, input.policy, input.userId)
    if (input.couponCode || input.shopCouponCode || input.platformCouponCode || input.coinsToUse) await this.requirePromotionAdmission?.({ userId: input.userId, shopIds: [...new Set(items.map(item => item.variant.product.shop.id))] })
    const baseTotals = this.calculateTotals(items)
    const taxPolicy = parseFrozenTaxPolicy(await repo.readTaxPolicy())
    const explicitStack = input.shopCouponCode !== undefined || input.platformCouponCode !== undefined
    if (input.couponCode && explicitStack) throw new CheckoutServiceError('Use either legacy coupon or named shop/platform coupons', 400, 'INVALID_COUPON')
    const versionTwo = taxPolicy.ratePpm !== 0 || explicitStack
    if (versionTwo && !this.v2Supported) throw new CheckoutServiceError('Version-two tax settlement is not enabled', 503, 'TAX_SETTLEMENT_UNAVAILABLE')
    type ValidatedCoupon = Awaited<ReturnType<CheckoutQuoteEvaluator['validateCoupon']>>
    let sellerCoupon: ValidatedCoupon | null = null
    let platformCoupon: ValidatedCoupon | null = null
    const couponOutcomes: CouponOutcome[] = []
    const adjustments = new Map<string, number>()
    const validate = async (code: string, kind?: 'shop' | 'platform') => {
      try {
        let coupon = await this.validateCoupon(repo, input.userId, code, items, adjustments)
        if ((kind === 'shop' && !coupon.couponShopId) || (kind === 'platform' && coupon.couponShopId)) throw new CheckoutServiceError('Coupon funding scope does not match its slot', 400, 'INVALID_COUPON')
        if (input.policy === 'commit') {
          await repo.lockCouponForCheckout(coupon.couponId)
          coupon = await this.validateCoupon(repo, input.userId, code, items, adjustments)
          if ((kind === 'shop' && !coupon.couponShopId) || (kind === 'platform' && coupon.couponShopId)) throw new CheckoutServiceError('Coupon funding scope does not match its slot', 400, 'INVALID_COUPON')
        }
        this.assertAmount(coupon.discount, 'Coupon discount')
        const eligibleSubtotal = items.filter((item) => coupon.eligibleItemIds.includes(item.id) && (!coupon.couponShopId || item.variant.product.shop.id === coupon.couponShopId))
          .reduce((sum, item) => sum + item.unitPrice * item.quantity - (adjustments.get(item.id) ?? 0), 0)
        coupon = { ...coupon, discount: Math.min(coupon.discount, eligibleSubtotal), discountCents: Math.min(coupon.discount, eligibleSubtotal) }
        couponOutcomes.push({ code: coupon.couponCode, applied: true })
        return coupon
      } catch (error) {
        if (input.policy === 'estimate' && error instanceof CheckoutServiceError && error.code === 'INVALID_COUPON') {
          couponOutcomes.push({ code: code.trim().toUpperCase(), applied: false, reason: typeof error.details?.reason === 'string' ? error.details.reason : 'INVALID_COUPON' })
          return null
        }
        throw error
      }
    }
    if (input.couponCode) {
      const legacy = await validate(input.couponCode)
      if (legacy?.couponShopId) sellerCoupon = legacy
      else platformCoupon = legacy
    } else {
      if (input.shopCouponCode !== undefined) sellerCoupon = await validate(input.shopCouponCode, 'shop')
      if (sellerCoupon) {
        const stable = [...items].sort((a, b) => a.variant.product.shop.id.localeCompare(b.variant.product.shop.id) || a.id.localeCompare(b.id))
        const discounts = allocateRefundAmount(BigInt(sellerCoupon.discount), stable.map((item) => item.variant.product.shop.id === sellerCoupon!.couponShopId && sellerCoupon!.eligibleItemIds.includes(item.id) ? BigInt(item.unitPrice) * BigInt(item.quantity) : 0n))
        stable.forEach((item, index) => adjustments.set(item.id, moneyNumber(discounts[index]!)))
      }
      if (input.platformCouponCode !== undefined) platformCoupon = await validate(input.platformCouponCode, 'platform')
    }
    const couponDiscount = (sellerCoupon?.discount ?? 0) + (platformCoupon?.discount ?? 0)
    this.assertAmount(couponDiscount, 'Coupon discount')
    const coinsApplied = await this.resolveCoinRedemption(repo, input.userId, input.coinsToUse, baseTotals.subtotal, couponDiscount, input.policy === 'commit')
    const funding = { sellerCouponDiscount: sellerCoupon?.discount ?? 0, sellerCouponShopId: sellerCoupon?.couponShopId ?? null,
      sellerCouponItemIds: sellerCoupon?.eligibleItemIds, platformCouponItemIds: platformCoupon?.eligibleItemIds,
      platformCouponDiscount: platformCoupon?.discount ?? 0, coinDiscount: coinsApplied * 100,
      sellerFreeShippingShopIds: sellerCoupon?.freeShippingShopIds ?? [], platformFreeShippingShopIds: platformCoupon?.freeShippingShopIds ?? [] }
    const computed = calculateCheckoutEconomics(items, funding, taxPolicy)
    const totals = computed.totals
    const coupons = [sellerCoupon, platformCoupon].filter((coupon) => coupon !== null).map((coupon) => ({ id: coupon.couponId, code: coupon.couponCode, shopId: coupon.couponShopId }))
    const quoteFingerprint = checkoutFingerprint({ taxPolicy, funding, coupons, totals,
      items: computed.stableItems.map((item) => ({ id: item.id, quantity: item.quantity, unitPrice: item.unitPrice, variantId: item.variantId, flashSaleItemId: item.flashSaleItemId ?? null })),
      shops: computed.shops.map((shop) => ({ shopId: shop.shopId, originalShipping: shop.originalShipping, economics: shop.economics })) })
    const legacy = sellerCoupon ?? platformCoupon
    return { quote: { ...totals, taxMode: taxPolicy.mode, taxPolicyRevision: taxPolicy.revision, quoteFingerprint, couponOutcomes,
        coupon: couponOutcomes[0] ?? null, coinsApplied,
        items: computed.stableItems.map((item) => ({ id: item.id, shopId: item.variant.product.shop.id, unitPrice: item.unitPrice, lineTotal: item.unitPrice * item.quantity })),
        shops: computed.shops.map((shop) => ({ shopId: shop.shopId, subtotal: moneyNumber(shop.economics.items.reduce((sum, item) => sum + item.grossMerchandise, 0n)) })) },
      acceptedQuote: { totals, items: computed.stableItems, coupon: legacy ? { id: legacy.couponId } : null, couponCode: legacy?.couponCode,
        couponDiscount, couponShopId: sellerCoupon?.couponShopId ?? null, coinDiscount: coinsApplied * 100,
        freeShippingShopIds: [...new Set([...funding.sellerFreeShippingShopIds, ...funding.platformFreeShippingShopIds])], coinsToUse: coinsApplied,
        funding, taxPolicy, coupons, settlementPolicyVersion: versionTwo ? 2 : 1 } }
  }

  private calculateTotals(
    items: CheckoutPricedItem[],
    discountCents = 0,
    freeShippingShopIds: string[] = [],
  ): CheckoutTotalsRecord {
    const currency = items[0]?.variant.currency ?? 'THB'
    if (items.some((item) => item.variant.currency !== currency) || currency !== 'THB') {
      throw new CheckoutServiceError('Checkout supports one THB currency only', 400, 'CHECKOUT_FAILED')
    }
    this.assertAmount(discountCents, 'Discount total')
    let subtotal = 0
    const shippingByShop = new Map<string, number>()
    for (const item of items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        throw new CheckoutServiceError('Item quantity must be a positive safe integer', 400, 'CHECKOUT_FAILED')
      }
      this.assertAmount(item.unitPrice, 'Unit price', 1)
      const lineTotal = item.unitPrice * item.quantity
      this.assertAmount(lineTotal, 'Item line total')
      subtotal += lineTotal
      this.assertAmount(subtotal, 'Item subtotal')
      const shop = item.variant.product.shop
      if (!shippingByShop.has(shop.id)) {
        const shippingFee = this.toBoundedAmount(shop.settings?.shippingFee ?? 0)
        this.assertAmount(shippingFee, 'Shipping fee')
        shippingByShop.set(shop.id, shippingFee)
      }
    }
    const waivedShopIds = new Set(freeShippingShopIds)
    const shippingTotal = [...shippingByShop].reduce(
      (total, [shopId, fee]) => total + (waivedShopIds.has(shopId) ? 0 : fee),
      0,
    )
    this.assertAmount(shippingTotal, 'Shipping total')
    const discountTotal = Math.min(Math.max(0, discountCents), subtotal)
    const grandTotal = subtotal - discountTotal + shippingTotal
    this.assertAmount(grandTotal, 'Grand total')
    return {
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal: 0,
      grandTotal,
      currency,
    }
  }

  private async priceItems(
    repo: ICheckoutRepository,
    items: CheckoutCartItem[],
    policy: EvaluateCheckoutQuoteInput['policy'],
    userId: string,
  ): Promise<CheckoutPricedItem[]> {
    const now = new Date()
    const variantIds = [...new Set(items.map((item) => item.variantId))]
    let candidates = await repo.findActiveFlashSaleItemsForCheckout(variantIds, now)
    if (policy === 'commit' && candidates.length) {
      const lockedCandidateIds = [...new Set(candidates.map((candidate) => candidate.id))].sort()
      for (const candidateId of lockedCandidateIds) await repo.lockFlashSaleItemForCheckout(candidateId)
      candidates = await repo.findActiveFlashSaleItemsForCheckout(variantIds, now, lockedCandidateIds)
    }
    const flashSaleByVariant = new Map(candidates.map((candidate) => [candidate.variantId, candidate]))
    const pricedItems = items.map((item) => {
      const regularPrice = this.toBoundedAmount(item.variant.price)
      this.assertAmount(regularPrice, 'Variant price', 1)
      return { ...item, unitPrice: regularPrice }
    })
    const shopIds = [...new Set(pricedItems.filter((item) => flashSaleByVariant.has(item.variantId))
      .map((item) => item.variant.product.shop.id))]
    if (shopIds.length) await this.requirePromotionAdmission?.({ userId, shopIds })
    return pricedItems.map((item) => {
      const flashSaleItem = flashSaleByVariant.get(item.variantId)
      if (!flashSaleItem) return item
      const salePrice = this.toBoundedAmount(flashSaleItem.salePrice)
      this.assertAmount(salePrice, 'Flash sale price')
      if (salePrice === 0 || salePrice >= item.unitPrice) return item
      return { ...item, unitPrice: salePrice, flashSaleItemId: flashSaleItem.id }
    })
  }

  private async validateCoupon(
    repo: ICheckoutRepository,
    userId: string,
    couponCode: string,
    items: CheckoutPricedItem[],
    adjustments: ReadonlyMap<string, number> = new Map(),
  ) {
    const candidate = await repo.findCouponByCode(couponCode.trim().toUpperCase())
    if (!candidate) throw new CheckoutServiceError('Coupon not found', 400, 'INVALID_COUPON')
    const targets = await repo.readCouponTargets(candidate.id)
    const eligibleItems = items.filter(item => (!candidate.shopId || candidate.shopId === item.variant.product.shop.id) && couponTargetEligible(targets, item.variant.product))
    if (!eligibleItems.length) throw new CheckoutServiceError('No items are eligible for this coupon', 400, 'INVALID_COUPON', { reason: 'COUPON_SCOPE_MISMATCH' })
    const subtotals = new Map<string, number>()
    for (const item of eligibleItems) {
      const shopId = item.variant.product.shop.id
      subtotals.set(shopId, (subtotals.get(shopId) ?? 0) + item.unitPrice * item.quantity - (adjustments.get(item.id) ?? 0))
    }
    const shopSubtotals = [...subtotals].map(([shopId, subtotal]) => ({ shopId, subtotal }))
    try {
      const result = await this.promotionService.validateLoadedCouponForSubtotal(repo, candidate, {
        userId,
        couponCode,
        subtotal: shopSubtotals.reduce((total, shop) => total + shop.subtotal, 0),
        shopSubtotals,
      })
      return { ...result, eligibleItemIds: eligibleItems.map(item => item.id) }
    } catch (error) {
      if (error instanceof PromotionServiceError) {
        throw new CheckoutServiceError('Invalid coupon', 400, 'INVALID_COUPON', {
          couponCode: couponCode.trim().toUpperCase(),
          reason: error.code,
        })
      }
      throw error
    }
  }

  private async resolveCoinRedemption(
    repo: ICheckoutRepository,
    userId: string,
    requested: number | undefined,
    subtotal: number,
    existingDiscount: number,
    lockWallet: boolean,
  ): Promise<number> {
    const coins = requested ?? 0
    this.assertAmount(coins, 'Requested coins')
    if (!coins) return 0
    if (lockWallet) await repo.lockBuyerCoinWallet(userId)
    const balance = await repo.findBuyerCoinBalance(userId)
    if (balance < 0n) throw new CheckoutServiceError('Coin balance must be a non-negative integer', 400, 'CHECKOUT_FAILED')
    const maximum = Math.min(
      moneyNumber(BigInt(subtotal) / 500n),
      moneyNumber(BigInt(Math.max(0, subtotal - existingDiscount)) / 100n),
    )
    if (BigInt(coins) > balance || coins > maximum) {
      throw new CheckoutServiceError(
        'Coin redemption exceeds available balance or the 20% item subtotal cap',
        400,
        'CHECKOUT_FAILED',
      )
    }
    return coins
  }

  private toBoundedAmount(value: bigint | number): number {
    try { return moneyNumber(value) } catch { throw new CheckoutServiceError('Amount must be a safe integer', 400, 'CHECKOUT_FAILED') }
  }

  private assertAmount(value: number, label: string, minimum = 0): void {
    if (!Number.isSafeInteger(value) || value < minimum) {
      throw new CheckoutServiceError(`${label} must be a safe integer of at least ${minimum}`, 400, 'CHECKOUT_FAILED')
    }
  }
}
