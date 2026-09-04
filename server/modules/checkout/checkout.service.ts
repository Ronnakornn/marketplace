import { v4 as uuidv4 } from 'uuid'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import {
  createPaymentCheckoutUrl,
  getPaymentProviderConfigFromEnv,
  type PaymentProviderConfig,
} from '#server/modules/payment/payment.config.ts'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { CheckoutServiceError } from './checkout.errors.ts'
import type {
  CheckoutCart,
  CheckoutCartItem,
  CheckoutPricedItem,
  CreatePendingOrderInput,
  ICheckoutRepository,
} from './checkout.repository.ts'

const CHECKOUT_RESERVATION_MINUTES = 15

export interface CheckoutActor {
  id: string
  role: Role
}

export interface CreateCheckoutData {
  cartId: string
  cartItemIds?: string[]
  addressId: string
  couponCode?: string
  coinsToUse?: number
  paymentMethod: string
  shippingMethod?: string
  locale?: string
}

export interface QuoteCheckoutData {
  cartId: string
  cartItemIds?: string[]
  couponCode?: string
  coinsToUse?: number
}

export interface CheckoutResponse {
  orderId: string
  orderNo: string
  paymentId: string
  paymentStatus: 'pending'
  paymentUrl: string
  totalCents: number
}

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

interface CalculatedTotals {
  subtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  grandTotal: number
  currency: string
}

export class CheckoutService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ICheckoutRepository,
    private promotionService: PromotionService,
    private cacheInvalidation?: CacheInvalidation,
    private paymentConfig: PaymentProviderConfig = getPaymentProviderConfigFromEnv(),
  ) {
    this.logger = appContext.logger
  }

  async createCheckout(actor: CheckoutActor, data: CreateCheckoutData): Promise<CheckoutResponse> {
    this.assertBuyer(actor)
    this.validateInput(data)
    if (this.paymentConfig.provider === 'disabled') {
      throw new CheckoutServiceError('Payment checkout is not configured', 503, 'PAYMENT_UNAVAILABLE')
    }
    this.logger.info('CheckoutService.createCheckout', { actorId: actor.id, cartId: data.cartId })

    return this.repo.transaction(async (txRepo) => {
      const cart = await txRepo.findCartForCheckout(data.cartId)
      this.assertCart(actor, cart)
      const items = this.selectCartItems(cart.items, data.cartItemIds)
      const address = await txRepo.findAddressForUser(data.addressId, actor.id)
      if (!address) throw new CheckoutServiceError('Address not found', 404, 'ADDRESS_NOT_FOUND')

      this.validateItems(items)
      const pricedItems = await this.priceItems(txRepo, items)
      const baseTotals = this.calculateTotals(pricedItems)
      let couponValidation = data.couponCode
        ? await this.validateCouponForCheckout(txRepo, actor.id, data.couponCode, pricedItems)
        : null
      if (couponValidation) {
        await txRepo.lockCouponForCheckout(couponValidation.couponId)
        couponValidation = await this.validateCouponForCheckout(
          txRepo,
          actor.id,
          data.couponCode!,
          pricedItems,
        )
      }
      const coinsToUse = await this.resolveCoinRedemption(txRepo, actor.id, data.coinsToUse, baseTotals.subtotal, couponValidation?.discount ?? 0)
      const totals = this.calculateTotals(
        pricedItems,
        (couponValidation?.discount ?? 0) + coinsToUse * 100,
        couponValidation?.freeShippingShopIds ?? [],
      )
      const orderNumber = this.createOrderNumber()
      const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_RESERVATION_MINUTES * 60 * 1000)

      const result = await this.createPendingOrder(txRepo, {
          cartId: cart!.id,
          userId: actor.id,
          orderNumber,
          checkoutExpiresAt,
          address,
          totals,
          items: pricedItems,
          paymentProvider: this.paymentConfig.provider,
          locale: data.locale,
          coupon: couponValidation ? { id: couponValidation.couponId } : null,
          couponDiscount: couponValidation?.discount ?? 0,
          couponShopId: couponValidation?.couponShopId ?? null,
          coinDiscount: coinsToUse * 100,
          freeShippingShopIds: couponValidation?.freeShippingShopIds ?? [],
          coinsToUse,
        })

      await this.cacheInvalidation?.invalidateInventory()

      return {
        orderId: result.order.id,
        orderNo: result.order.orderNumber,
        paymentId: result.payment.id,
        paymentStatus: 'pending',
        paymentUrl: createPaymentCheckoutUrl(this.paymentConfig, {
          paymentId: result.payment.id,
          orderId: result.order.id,
          amount: totals.grandTotal,
          currency: totals.currency,
          expiresAt: checkoutExpiresAt,
          locale: data.locale,
        }),
        totalCents: totals.grandTotal,
      }
    })
  }

  async quoteCheckout(actor: CheckoutActor, data: QuoteCheckoutData): Promise<CheckoutQuote> {
    this.assertBuyer(actor)
    if (!data.cartId) throw new CheckoutServiceError('Cart id is required', 400, 'CHECKOUT_CART_REQUIRED')
    this.logger.info('CheckoutService.quoteCheckout', { actorId: actor.id, cartId: data.cartId })

    const cart = await this.repo.findCartForCheckout(data.cartId)
    this.assertCart(actor, cart)
    const items = this.selectCartItems(cart.items, data.cartItemIds)

    const pricedItems = await this.priceItems(this.repo, items)
    const baseTotals = this.calculateTotals(pricedItems)
    let coupon: CouponOutcome | null = null
    let discountCents = 0
    let freeShippingShopIds: string[] = []

    if (data.couponCode) {
      try {
        const couponValidation = await this.validateCouponForCheckout(this.repo, actor.id, data.couponCode, pricedItems)
        discountCents = couponValidation.discount
        freeShippingShopIds = couponValidation.freeShippingShopIds
        coupon = { code: couponValidation.couponCode, applied: true }
      } catch (error) {
        if (error instanceof CheckoutServiceError && error.code === 'INVALID_COUPON') {
          coupon = {
            code: (error.details?.couponCode as string | undefined) ?? data.couponCode.trim().toUpperCase(),
            applied: false,
            reason: (error.details?.reason as string | undefined) ?? 'INVALID_COUPON',
          }
        } else {
          throw error
        }
      }
    }

    const coinsApplied = await this.resolveCoinRedemption(this.repo, actor.id, data.coinsToUse, baseTotals.subtotal, discountCents)
    const totals = this.calculateTotals(pricedItems, discountCents + coinsApplied * 100, freeShippingShopIds)

    return {
      ...totals,
      coupon,
      coinsApplied,
    }
  }

  private assertBuyer(actor: CheckoutActor): void {
    if (actor.role === 'ADMIN') {
      throw new CheckoutServiceError('Checkout is only available to buyer accounts', 403, 'CHECKOUT_FORBIDDEN')
    }
  }

  private validateInput(data: CreateCheckoutData): void {
    if (!data.cartId) throw new CheckoutServiceError('Cart id is required', 400, 'CHECKOUT_CART_REQUIRED')
    if (!data.addressId) throw new CheckoutServiceError('Address id is required', 400, 'CHECKOUT_ADDRESS_REQUIRED')
    if (!data.paymentMethod?.trim()) {
      throw new CheckoutServiceError('Payment method is required', 400, 'CHECKOUT_PAYMENT_METHOD_REQUIRED')
    }
    if (data.paymentMethod.trim().toLowerCase() === 'cod') {
      throw new CheckoutServiceError('Cash on delivery is not available', 400, 'PAYMENT_METHOD_UNAVAILABLE')
    }
  }

  private assertCart(actor: CheckoutActor, cart: CheckoutCart | null): asserts cart is CheckoutCart {
    if (!cart) throw new CheckoutServiceError('Cart not found', 404, 'CART_NOT_FOUND')
    if (cart.userId !== actor.id) throw new CheckoutServiceError('Cart does not belong to buyer', 403, 'CART_NOT_FOUND')
    if (cart.status !== 'ACTIVE') throw new CheckoutServiceError('Cart is not active', 400, 'CART_NOT_ACTIVE')
    if (cart.items.length === 0) throw new CheckoutServiceError('Cart cannot be empty', 400, 'CART_EMPTY')
  }

  private validateItems(items: CheckoutCartItem[]): void {
    for (const item of items) {
      if (item.variant.product.status !== 'ACTIVE') {
        throw new CheckoutServiceError('Product is inactive', 400, 'PRODUCT_INACTIVE', {
          itemId: item.id,
          productId: item.variant.product.id,
        })
      }
      if (item.variant.status !== 'ACTIVE') {
        throw new CheckoutServiceError('Variant is inactive', 400, 'VARIANT_INACTIVE', {
          itemId: item.id,
          variantId: item.variant.id,
        })
      }
      if (item.variant.product.shop.status !== 'ACTIVE') {
        throw new CheckoutServiceError('Shop is unavailable', 400, 'PRODUCT_INACTIVE', {
          itemId: item.id,
          shopId: item.variant.product.shop.id,
        })
      }
      const availableQuantity = this.getAvailableQuantity(item)
      if (availableQuantity < item.quantity) {
        throw new CheckoutServiceError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK', {
          itemId: item.id,
          variantId: item.variantId,
          availableQuantity,
        })
      }
    }
  }

  private selectCartItems(cartItems: CheckoutCartItem[], cartItemIds?: string[]): CheckoutCartItem[] {
    if (!cartItemIds) return cartItems
    if (!cartItemIds.length) throw new CheckoutServiceError('Select at least one cart item', 400, 'CART_ITEMS_REQUIRED')
    const selectedIds = new Set(cartItemIds)
    if (selectedIds.size !== cartItemIds.length) {
      throw new CheckoutServiceError('Duplicate cart item selection', 400, 'CART_ITEM_SELECTION_INVALID')
    }
    const items = cartItems.filter((item) => selectedIds.has(item.id))
    if (items.length !== selectedIds.size) {
      throw new CheckoutServiceError('Selected cart item not found', 404, 'CART_ITEM_NOT_FOUND')
    }
    return items
  }

  private calculateTotals(items: CheckoutPricedItem[], discountCents = 0, freeShippingShopIds: string[] = []): CalculatedTotals {
    const currency = items[0]?.variant.currency ?? 'THB'
    if (items.some((item) => item.variant.currency !== currency)) {
      throw new CheckoutServiceError('Mixed currencies are not supported in checkout', 400, 'CHECKOUT_FAILED')
    }
    if (currency !== 'THB') {
      throw new CheckoutServiceError('Checkout supports THB only', 400, 'CHECKOUT_FAILED')
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
    const taxTotal = 0
    const discountTotal = Math.min(Math.max(0, discountCents), subtotal)
    const grandTotal = Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal)

    return {
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      grandTotal,
      currency,
    }
  }

  private async validateCouponForCheckout(
    repo: ICheckoutRepository,
    userId: string,
    couponCode: string,
    items: CheckoutPricedItem[],
  ) {
    const shopSubtotals = this.calculateShopSubtotals(items)
    const subtotal = shopSubtotals.reduce((total, shop) => total + shop.subtotal, 0)
    try {
      return await this.promotionService.validateCouponForsubtotal(repo, {
        userId,
        couponCode,
        subtotal,
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

  private getAvailableQuantity(item: CheckoutCartItem): number {
    const inventory = item.variant.inventory
    if (!inventory) return 0
    return Math.max(0, inventory.quantityOnHand - inventory.quantityReserved)
  }

  private calculateShopSubtotals(items: CheckoutPricedItem[]): Array<{ shopId: string; subtotal: number }> {
    const subtotals = new Map<string, number>()
    for (const item of items) {
      const shopId = item.variant.product.shop.id
      subtotals.set(shopId, (subtotals.get(shopId) ?? 0) + item.unitPrice * item.quantity)
    }
    return [...subtotals].map(([shopId, subtotal]) => ({ shopId, subtotal }))
  }

  private async priceItems(repo: ICheckoutRepository, items: CheckoutCartItem[]): Promise<CheckoutPricedItem[]> {
    const now = new Date()
    return Promise.all(items.map(async (item) => {
      const flashSaleItem = await repo.findActiveFlashSaleItemForCheckout(item.variantId, now)
      const regularPrice = Number(item.variant.price)
      if (!flashSaleItem || Number(flashSaleItem.salePrice) <= 0 || Number(flashSaleItem.salePrice) >= regularPrice) {
        return { ...item, unitPrice: regularPrice }
      }
      return { ...item, unitPrice: Number(flashSaleItem.salePrice), flashSaleItemId: flashSaleItem.id }
    }))
  }

  private async resolveCoinRedemption(repo: ICheckoutRepository, userId: string, requested: number | undefined, subtotal: number, existingDiscount = 0): Promise<number> {
    const coins = Math.max(0, Math.floor(requested ?? 0))
    if (!coins) return 0
    await repo.lockBuyerCoinWallet(userId)
    const balance = await repo.findBuyerCoinBalance(userId)
    const maximum = Math.min(Math.floor(subtotal * 0.2 / 100), Math.floor(Math.max(0, subtotal - existingDiscount) / 100))
    if (coins > balance || coins > maximum) {
      throw new CheckoutServiceError('Coin redemption exceeds available balance or the 20% item subtotal cap', 400, 'CHECKOUT_FAILED')
    }
    return coins
  }

  private createOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = uuidv4().slice(0, 8).toUpperCase()
    return `ORD-${timestamp}-${random}`
  }

  private async createPendingOrder(
    repo: ICheckoutRepository,
    input: CreatePendingOrderInput,
  ) {
    try {
      return await repo.createPendingOrder(input)
    } catch (error) {
      if (error instanceof CheckoutServiceError) throw error
      throw new CheckoutServiceError('Checkout failed', 500, 'CHECKOUT_FAILED', {
        cause: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export type { CreatePendingOrderInput }
