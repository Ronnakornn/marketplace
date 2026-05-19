import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import { CheckoutServiceError } from './checkout.errors.ts'
import type {
  CheckoutCart,
  CheckoutCartItem,
  CreatePendingOrderInput,
  ICheckoutRepository,
} from './checkout.repository.ts'

const FLAT_SHIPPING_CENTS = 500
const CHECKOUT_RESERVATION_MINUTES = 15

export interface CheckoutActor {
  id: string
  role: Role
}

export interface CreateCheckoutData {
  cartId: string
  addressId: string
  couponCode?: string
  paymentMethod: string
  shippingMethod?: string
  locale?: string
}

export interface CheckoutResponse {
  orderId: string
  orderNo: string
  paymentId: string
  paymentStatus: 'pending'
  paymentUrl?: string
  totalCents: number
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
  ) {
    this.logger = appContext.logger
  }

  async createCheckout(actor: CheckoutActor, data: CreateCheckoutData): Promise<CheckoutResponse> {
    this.assertBuyer(actor)
    this.validateInput(data)
    this.logger.info('CheckoutService.createCheckout', { actorId: actor.id, cartId: data.cartId })

    return this.repo.transaction(async (txRepo) => {
      const cart = await txRepo.findCartForCheckout(data.cartId)
      this.assertCart(actor, cart)
      const address = await txRepo.findAddressForUser(data.addressId, actor.id)
      if (!address) throw new CheckoutServiceError('Address not found', 404, 'ADDRESS_NOT_FOUND')

      this.validateItems(cart!.items)
      const baseTotals = this.calculateTotals(cart!.items)
      const couponValidation = data.couponCode
        ? await this.validateCouponForCheckout(txRepo, actor.id, data.couponCode, baseTotals.subtotal)
        : null
      const totals = this.calculateTotals(cart!.items, couponValidation?.discountCents ?? 0)
      const orderNumber = this.createOrderNumber()
      const checkoutExpiresAt = new Date(Date.now() + CHECKOUT_RESERVATION_MINUTES * 60 * 1000)

      const result = await this.createPendingOrder(txRepo, {
          cartId: cart!.id,
          userId: actor.id,
          orderNumber,
          checkoutExpiresAt,
          address,
          totals,
          items: cart!.items,
          paymentMethod: data.paymentMethod.trim(),
          locale: data.locale,
          coupon: couponValidation ? { id: couponValidation.couponId } : null,
        })

      await this.cacheInvalidation?.invalidateInventory()

      return {
        orderId: result.order.id,
        orderNo: result.order.orderNumber,
        paymentId: result.payment.id,
        paymentStatus: 'pending',
        totalCents: totals.grandTotal,
      }
    })
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

  private calculateTotals(items: CheckoutCartItem[], discountCents = 0): CalculatedTotals {
    const currency = items[0]?.variant.currency ?? 'USD'
    if (items.some((item) => item.variant.currency !== currency)) {
      throw new CheckoutServiceError('Mixed currencies are not supported in checkout', 400, 'CHECKOUT_FAILED')
    }

    const subtotal = items.reduce((total, item) => total + item.variant.prices * item.quantity, 0)
    const shippingTotal = items.length > 0 ? FLAT_SHIPPING_CENTS : 0
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
    subtotal: number,
  ) {
    try {
      return await this.promotionService.validateCouponForsubtotal(repo, {
        userId,
        couponCode,
        subtotal,
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

  private createOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = crypto.randomUUID().slice(0, 8).toUpperCase()
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
