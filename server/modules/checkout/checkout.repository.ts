import type {
  Address,
  Cart,
  CartItem,
  Coupon,
  Inventory,
  Order,
  Payment,
  PrismaClient,
  Product,
  ProductVariant,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { IPromotionValidationRepository, PromotionCoupon } from '#server/modules/promotion/promotion.repository.ts'
import { CheckoutServiceError } from './checkout.errors.ts'

type CheckoutTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type CheckoutCartItem = CartItem & {
  variant: ProductVariant & {
    inventory: Inventory | null
    product: Product & {
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
    }
  }
}

export type CheckoutCart = Cart & {
  items: CheckoutCartItem[]
}

export type CheckoutAddress = Address

export type CheckoutCouponRef = Pick<Coupon, 'id'>

export interface CheckoutTotalsRecord {
  subtotalCents: number
  discountTotalCents: number
  shippingTotalCents: number
  taxTotalCents: number
  grandTotalCents: number
  currency: string
}

export interface CreatePendingOrderInput {
  cartId: string
  userId: string
  orderNumber: string
  checkoutExpiresAt: Date
  address: CheckoutAddress
  totals: CheckoutTotalsRecord
  items: CheckoutCartItem[]
  paymentMethod: string
  coupon?: CheckoutCouponRef | null
}

export interface CreatedCheckoutOrder {
  checkoutId: string
  order: Order
  payment: Payment
}

export interface ICheckoutRepository extends IPromotionValidationRepository {
  transaction<T>(callback: (repo: ICheckoutRepository) => Promise<T>): Promise<T>
  findCartForCheckout(cartId: string): Promise<CheckoutCart | null>
  findAddressForUser(addressId: string, userId: string): Promise<CheckoutAddress | null>
  createPendingOrder(input: CreatePendingOrderInput): Promise<CreatedCheckoutOrder>
}

const checkoutCartInclude = {
  items: {
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            include: {
              shop: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

export class PrismaCheckoutRepository implements ICheckoutRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | CheckoutTx,
  ) {
    this.logger = appContext.logger
  }

  transaction<T>(callback: (repo: ICheckoutRepository) => Promise<T>): Promise<T> {
    const client = this.prisma as PrismaClient
    if (typeof client.$transaction !== 'function') {
      return callback(this)
    }

    return client.$transaction((tx) => callback(new PrismaCheckoutRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)))
  }

  findCartForCheckout(cartId: string): Promise<CheckoutCart | null> {
    this.logger.debug('PrismaCheckoutRepository.findCartForCheckout', { cartId })
    return this.prisma.cart.findUnique({
      where: { id: cartId },
      include: checkoutCartInclude,
    })
  }

  findAddressForUser(addressId: string, userId: string): Promise<CheckoutAddress | null> {
    this.logger.debug('PrismaCheckoutRepository.findAddressForUser', { addressId, userId })
    return this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
      },
    })
  }

  findCouponByCode(code: string): Promise<PromotionCoupon | null> {
    this.logger.debug('PrismaCheckoutRepository.findCouponByCode', { code })
    return this.prisma.coupon.findUnique({
      where: { code },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    })
  }

  countCouponRedemptionsForUser(couponId: string, userId: string): Promise<number> {
    this.logger.debug('PrismaCheckoutRepository.countCouponRedemptionsForUser', { couponId, userId })
    return this.prisma.couponRedemption.count({
      where: { couponId, userId },
    })
  }

  async createPendingOrder(input: CreatePendingOrderInput): Promise<CreatedCheckoutOrder> {
    this.logger.info('PrismaCheckoutRepository.createPendingOrder', { cartId: input.cartId, userId: input.userId })

    const checkout = await this.prisma.checkout.create({
      data: {
        cartId: input.cartId,
        userId: input.userId,
        status: 'PAYMENT_PENDING',
        subtotalCents: input.totals.subtotalCents,
        discountTotalCents: input.totals.discountTotalCents,
        shippingTotalCents: input.totals.shippingTotalCents,
        taxTotalCents: input.totals.taxTotalCents,
        grandTotalCents: input.totals.grandTotalCents,
        currency: input.totals.currency,
        expiresAt: input.checkoutExpiresAt,
      },
    })

    for (const item of input.items) {
      const inventory = item.variant.inventory
      if (!inventory) {
        throw new CheckoutServiceError('Inventory not found for variant', 409, 'INSUFFICIENT_STOCK', {
          variantId: item.variantId,
          availableQuantity: 0,
        })
      }

      const reserveResult = await this.prisma.inventory.updateMany({
        where: {
          variantId: item.variantId,
          quantityReserved: {
            lte: inventory.quantityOnHand - item.quantity,
          },
        },
        data: {
          quantityReserved: {
            increment: item.quantity,
          },
        },
      })
      if (reserveResult.count !== 1) {
        throw new CheckoutServiceError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK', {
          variantId: item.variantId,
        })
      }

      await this.prisma.inventoryReservation.create({
        data: {
          checkoutId: checkout.id,
          variantId: item.variantId,
          quantity: item.quantity,
          status: 'ACTIVE',
          expiresAt: input.checkoutExpiresAt,
        },
      })
    }

    const order = await this.prisma.order.create({
      data: {
        checkoutId: checkout.id,
        userId: input.userId,
        orderNumber: input.orderNumber,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        subtotalCents: input.totals.subtotalCents,
        discountTotalCents: input.totals.discountTotalCents,
        shippingTotalCents: input.totals.shippingTotalCents,
        taxTotalCents: input.totals.taxTotalCents,
        grandTotalCents: input.totals.grandTotalCents,
        currency: input.totals.currency,
        shippingName: input.address.recipientName,
        shippingPhone: input.address.phone,
        shippingLine1: input.address.line1,
        shippingLine2: input.address.line2,
        shippingCity: input.address.city,
        shippingRegion: input.address.region,
        shippingPostalCode: input.address.postalCode,
        shippingCountry: input.address.country,
        items: {
          create: input.items.map((item) => ({
            shopId: item.variant.product.shop.id,
            variantId: item.variantId,
            productTitle: item.variant.product.title,
            productSlug: item.variant.product.slug,
            variantTitle: item.variant.title,
            variantSku: item.variant.sku,
            shopName: item.variant.product.shop.name,
            shopSlug: item.variant.product.shop.slug,
            quantity: item.quantity,
            unitPriceCents: item.variant.priceCents,
            lineTotalCents: item.variant.priceCents * item.quantity,
            currency: item.variant.currency,
            fulfillmentStatus: 'PENDING',
          })),
        },
      },
    })

    if (input.coupon) {
      await this.prisma.couponRedemption.create({
        data: {
          couponId: input.coupon.id,
          userId: input.userId,
          orderId: order.id,
        },
      })
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: input.paymentMethod,
        providerIntentId: `pending_${input.orderNumber}`,
        status: 'PENDING',
        amountCents: input.totals.grandTotalCents,
        currency: input.totals.currency,
      },
    })

    await this.prisma.cart.update({
      where: { id: input.cartId },
      data: { status: 'CHECKED_OUT' },
    })

    return {
      checkoutId: checkout.id,
      order,
      payment,
    }
  }
}
