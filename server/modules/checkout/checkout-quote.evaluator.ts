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
  coupon: CouponOutcome | null
  coinsApplied: number
}

export interface CheckoutQuoteEvaluation {
  quote: CheckoutQuote
  acceptedQuote: AcceptedCheckoutQuote
}

export interface EvaluateCheckoutQuoteInput {
  userId: string
  items: CheckoutCartItem[]
  couponCode?: string
  coinsToUse?: number
  policy: 'estimate' | 'commit'
}

export class CheckoutQuoteEvaluator {
  constructor(private promotionService: PromotionService) {}

  async evaluate(
    repo: ICheckoutRepository,
    input: EvaluateCheckoutQuoteInput,
  ): Promise<CheckoutQuoteEvaluation> {
    const items = await this.priceItems(repo, input.items, input.policy)
    const baseTotals = this.calculateTotals(items)
    let couponValidation = null
    let coupon: CouponOutcome | null = null

    if (input.couponCode) {
      try {
        couponValidation = await this.validateCoupon(repo, input.userId, input.couponCode, items)
        if (input.policy === 'commit') {
          await repo.lockCouponForCheckout(couponValidation.couponId)
          couponValidation = await this.validateCoupon(repo, input.userId, input.couponCode, items)
        }
        coupon = { code: couponValidation.couponCode, applied: true }
      } catch (error) {
        if (input.policy === 'estimate' && error instanceof CheckoutServiceError && error.code === 'INVALID_COUPON') {
          coupon = {
            code: (error.details?.couponCode as string | undefined) ?? input.couponCode.trim().toUpperCase(),
            applied: false,
            reason: (error.details?.reason as string | undefined) ?? 'INVALID_COUPON',
          }
        } else {
          throw error
        }
      }
    }

    const couponDiscount = couponValidation?.discount ?? 0
    const coinsApplied = await this.resolveCoinRedemption(
      repo,
      input.userId,
      input.coinsToUse,
      baseTotals.subtotal,
      couponDiscount,
      input.policy === 'commit',
    )
    const freeShippingShopIds = couponValidation?.freeShippingShopIds ?? []
    const totals = this.calculateTotals(items, couponDiscount + coinsApplied * 100, freeShippingShopIds)

    return {
      quote: { ...totals, coupon, coinsApplied },
      acceptedQuote: {
        totals,
        items,
        coupon: couponValidation ? { id: couponValidation.couponId } : null,
        couponDiscount,
        couponShopId: couponValidation?.couponShopId ?? null,
        coinDiscount: coinsApplied * 100,
        freeShippingShopIds,
        coinsToUse: coinsApplied,
      },
    }
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
    const subtotal = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
    const shippingByShop = new Map<string, number>()
    for (const item of items) {
      const shop = item.variant.product.shop
      if (!shippingByShop.has(shop.id)) {
        shippingByShop.set(shop.id, Math.max(0, Number(shop.settings?.shippingFee ?? 0)))
      }
    }
    const waivedShopIds = new Set(freeShippingShopIds)
    const shippingTotal = [...shippingByShop].reduce(
      (total, [shopId, fee]) => total + (waivedShopIds.has(shopId) ? 0 : fee),
      0,
    )
    const discountTotal = Math.min(Math.max(0, discountCents), subtotal)
    return {
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal: 0,
      grandTotal: Math.max(0, subtotal - discountTotal + shippingTotal),
      currency,
    }
  }

  private async priceItems(
    repo: ICheckoutRepository,
    items: CheckoutCartItem[],
    policy: EvaluateCheckoutQuoteInput['policy'],
  ): Promise<CheckoutPricedItem[]> {
    const now = new Date()
    return Promise.all(items.map(async (item) => {
      let flashSaleItem = await repo.findActiveFlashSaleItemForCheckout(item.variantId, now)
      if (policy === 'commit' && flashSaleItem) {
        await repo.lockFlashSaleItemForCheckout(flashSaleItem.id)
        flashSaleItem = await repo.findActiveFlashSaleItemForCheckout(item.variantId, now)
      }
      const regularPrice = Number(item.variant.price)
      if (!flashSaleItem || Number(flashSaleItem.salePrice) <= 0 || Number(flashSaleItem.salePrice) >= regularPrice) {
        return { ...item, unitPrice: regularPrice }
      }
      return { ...item, unitPrice: Number(flashSaleItem.salePrice), flashSaleItemId: flashSaleItem.id }
    }))
  }

  private async validateCoupon(
    repo: ICheckoutRepository,
    userId: string,
    couponCode: string,
    items: CheckoutPricedItem[],
  ) {
    const subtotals = new Map<string, number>()
    for (const item of items) {
      const shopId = item.variant.product.shop.id
      subtotals.set(shopId, (subtotals.get(shopId) ?? 0) + item.unitPrice * item.quantity)
    }
    const shopSubtotals = [...subtotals].map(([shopId, subtotal]) => ({ shopId, subtotal }))
    try {
      return await this.promotionService.validateCouponForsubtotal(repo, {
        userId,
        couponCode,
        subtotal: shopSubtotals.reduce((total, shop) => total + shop.subtotal, 0),
        shopSubtotals,
      })
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
    const coins = Math.max(0, Math.floor(requested ?? 0))
    if (!coins) return 0
    if (lockWallet) await repo.lockBuyerCoinWallet(userId)
    const balance = await repo.findBuyerCoinBalance(userId)
    const maximum = Math.min(
      Math.floor(subtotal * 0.2 / 100),
      Math.floor(Math.max(0, subtotal - existingDiscount) / 100),
    )
    if (coins > balance || coins > maximum) {
      throw new CheckoutServiceError(
        'Coin redemption exceeds available balance or the 20% item subtotal cap',
        400,
        'CHECKOUT_FAILED',
      )
    }
    return coins
  }
}
