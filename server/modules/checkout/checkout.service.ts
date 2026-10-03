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
import {
  CheckoutQuoteEvaluator,
  type CheckoutQuote,
} from './checkout-quote.evaluator.ts'
import { CheckoutServiceError } from './checkout.errors.ts'
import type {
  CheckoutCart,
  CheckoutCartItem,
  CheckoutCommitmentInput,
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
  shopCouponCode?: string
  platformCouponCode?: string
  acceptedQuoteFingerprint?: string
  acceptedTaxPolicyRevision?: string
  coinsToUse?: number
  paymentMethod: string
  shippingMethod?: string
  locale?: string
}

export interface QuoteCheckoutData {
  cartId: string
  cartItemIds?: string[]
  couponCode?: string
  shopCouponCode?: string
  platformCouponCode?: string
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

export class CheckoutService {
  private logger: ILogger
  constructor(
    appContext: AppContext,
    private repo: ICheckoutRepository,
    private quoteEvaluator: CheckoutQuoteEvaluator,
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
    this.logger.debug('CheckoutService.createCheckout', { actorId: actor.id, cartId: data.cartId })

    const response = await this.repo.transaction(async (txRepo) => {
      await txRepo.lockCartForCheckout(data.cartId)
      const cart = await txRepo.findCartForCheckout(data.cartId)
      this.assertCart(actor, cart)
      const items = this.selectCartItems(cart.items, data.cartItemIds)
      const address = await txRepo.findAddressForUser(data.addressId, actor.id)
      if (!address) throw new CheckoutServiceError('Address not found', 404, 'ADDRESS_NOT_FOUND')

      this.validateItems(items)
      const evaluation = await this.quoteEvaluator.evaluate(txRepo, {
        userId: actor.id,
        items,
        couponCode: data.couponCode,
        shopCouponCode: data.shopCouponCode,
        platformCouponCode: data.platformCouponCode,
        coinsToUse: data.coinsToUse,
        policy: 'commit',
      })
      const totals = evaluation.acceptedQuote.totals
      if ((evaluation.acceptedQuote.settlementPolicyVersion === 2 && (!data.acceptedQuoteFingerprint || !data.acceptedTaxPolicyRevision))
        || (data.acceptedQuoteFingerprint !== undefined && data.acceptedQuoteFingerprint !== evaluation.quote.quoteFingerprint)
        || (data.acceptedTaxPolicyRevision !== undefined && data.acceptedTaxPolicyRevision !== evaluation.quote.taxPolicyRevision)) {
        throw new CheckoutServiceError('Checkout quote changed; review and accept the replacement quote', 409, 'QUOTE_CHANGED', { quote: evaluation.quote })
      }
      const orderNumber = this.createOrderNumber()
      const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_RESERVATION_MINUTES * 60 * 1000)

      const result = await this.commitCheckout(txRepo, {
          cartId: cart!.id,
          userId: actor.id,
          orderNumber,
          checkoutExpiresAt,
          address,
          paymentProvider: this.paymentConfig.provider,
          locale: data.locale,
          acceptedQuote: evaluation.acceptedQuote,
        })

      return {
        orderId: result.order.id,
        orderNo: result.order.orderNumber,
        paymentId: result.payment.id,
        paymentStatus: 'pending' as const,
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
    // Do not hold a database transaction connection while Redis scans/deletes
    // listing caches. The committed reservation remains the source of truth.
    await this.cacheInvalidation?.invalidateInventory()
    return response
  }

  async quoteCheckout(actor: CheckoutActor, data: QuoteCheckoutData): Promise<CheckoutQuote> {
    this.assertBuyer(actor)
    if (!data.cartId) throw new CheckoutServiceError('Cart id is required', 400, 'CHECKOUT_CART_REQUIRED')
    this.logger.debug('CheckoutService.quoteCheckout', { actorId: actor.id, cartId: data.cartId })

    const cart = await this.repo.findCartForCheckout(data.cartId)
    this.assertCart(actor, cart)
    const items = this.selectCartItems(cart.items, data.cartItemIds)

    const evaluation = await this.quoteEvaluator.evaluate(this.repo, {
      userId: actor.id,
      items,
      couponCode: data.couponCode,
      shopCouponCode: data.shopCouponCode,
      platformCouponCode: data.platformCouponCode,
      coinsToUse: data.coinsToUse,
      policy: 'estimate',
    })
    return evaluation.quote
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

  private getAvailableQuantity(item: CheckoutCartItem): number {
    const inventory = item.variant.inventory
    if (!inventory) return 0
    return Math.max(0, inventory.quantityOnHand - inventory.quantityReserved)
  }

  private createOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = uuidv4().slice(0, 8).toUpperCase()
    return `ORD-${timestamp}-${random}`
  }

  private async commitCheckout(
    repo: ICheckoutRepository,
    input: CheckoutCommitmentInput,
  ) {
    try {
      return await repo.commitCheckout(input)
    } catch (error) {
      if (error instanceof CheckoutServiceError) throw error
      throw new CheckoutServiceError('Checkout failed', 500, 'CHECKOUT_FAILED', {
        cause: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export type { CheckoutQuote }
