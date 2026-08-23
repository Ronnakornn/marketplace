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
  ShopSetting,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { localizedText, resolveContentLocale } from '#server/lib/localization.ts'
import type { IPromotionValidationRepository, PromotionCoupon } from '#server/modules/promotion/promotion.repository.ts'
import { CheckoutServiceError } from './checkout.errors.ts'

type CheckoutTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export type CheckoutCartItem = CartItem & {
  variant: (Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
    titleTh?: string | null
    titleEn?: string | null
  }) & {
    inventory: Inventory | null
    product: (Omit<Product, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
      titleTh?: string | null
      titleEn?: string | null
      descriptionTh?: string | null
      descriptionEn?: string | null
    }) & {
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'> & {
        settings: Pick<ShopSetting, 'shippingFee'> | null
      }
    }
  }
}

export type CheckoutCart = Cart & {
  items: CheckoutCartItem[]
}

export type CheckoutAddress = Address

export type CheckoutCouponRef = Pick<Coupon, 'id'>

export interface CheckoutTotalsRecord {
  subtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  grandTotal: number
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
  paymentProvider: string
  locale?: string
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
  lockCouponForCheckout(couponId: string): Promise<void>
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
                  settings: {
                    select: { shippingFee: true },
                  },
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
          select: { redemptions: { where: { status: { in: ['RESERVED', 'REDEEMED'] } } } },
        },
      },
    })
  }

  countCouponRedemptionsForUser(couponId: string, userId: string): Promise<number> {
    this.logger.debug('PrismaCheckoutRepository.countCouponRedemptionsForUser', { couponId, userId })
    return this.prisma.couponRedemption.count({
      where: { couponId, userId, status: { in: ['RESERVED', 'REDEEMED'] } },
    })
  }

  async lockCouponForCheckout(couponId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${couponId}::uuid FOR UPDATE`
  }

  async createPendingOrder(input: CreatePendingOrderInput): Promise<CreatedCheckoutOrder> {
    this.logger.info('PrismaCheckoutRepository.createPendingOrder', { cartId: input.cartId, userId: input.userId })

    const checkout = await this.prisma.checkout.create({
      data: {
        cartId: input.cartId,
        userId: input.userId,
        status: 'PAYMENT_PENDING',
        subtotal: input.totals.subtotal,
        discountTotal: input.totals.discountTotal,
        shippingTotal: input.totals.shippingTotal,
        taxTotal: input.totals.taxTotal,
        grandTotal: input.totals.grandTotal,
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
          inventoryId: inventory.id,
          quantity: item.quantity,
          status: 'ACTIVE',
          expiresAt: input.checkoutExpiresAt,
        },
      })
    }

    const locale = resolveContentLocale(input.locale)
    const shopOrderGroups = new Map<string, { subtotal: number; shippingTotal: number }>()
    for (const item of input.items) {
      const shop = item.variant.product.shop
      const current = shopOrderGroups.get(shop.id) ?? {
        subtotal: 0,
        shippingTotal: Math.max(0, Number(shop.settings?.shippingFee ?? 0)),
      }
      current.subtotal += Number(item.variant.price) * item.quantity
      shopOrderGroups.set(shop.id, current)
    }

    let remainingDiscount = input.totals.discountTotal
    const shopOrderCreates = [...shopOrderGroups.entries()].map(([shopId, group], index, groups) => {
      const isLast = index === groups.length - 1
      const proportionalDiscount = input.totals.subtotal > 0
        ? Math.floor(input.totals.discountTotal * group.subtotal / input.totals.subtotal)
        : 0
      const discountTotal = Math.min(group.subtotal, isLast ? remainingDiscount : proportionalDiscount)
      remainingDiscount -= discountTotal
      return {
        shopId,
        status: 'PENDING_PAYMENT' as const,
        fulfillmentStatus: 'PENDING' as const,
        subtotal: group.subtotal,
        discountTotal,
        shippingTotal: group.shippingTotal,
        taxTotal: 0,
        grandTotal: group.subtotal - discountTotal + group.shippingTotal,
        currency: input.totals.currency,
      }
    })

    const order = await this.prisma.order.create({
      data: {
        checkoutId: checkout.id,
        userId: input.userId,
        orderNumber: input.orderNumber,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        subtotal: input.totals.subtotal,
        discountTotal: input.totals.discountTotal,
        shippingTotal: input.totals.shippingTotal,
        taxTotal: input.totals.taxTotal,
        grandTotal: input.totals.grandTotal,
        currency: input.totals.currency,
        shippingName: input.address.recipientName,
        shippingPhone: input.address.phone,
        shippingLine1: input.address.line1,
        shippingLine2: input.address.line2,
        shippingCity: input.address.city,
        shippingRegion: input.address.region,
        shippingPostalCode: input.address.postalCode,
        shippingCountry: input.address.country,
        shopOrders: { create: shopOrderCreates },
        items: {
          create: input.items.map((item) => {
            const unitPrice = BigInt(item.variant.price)

            return {
              shopId: item.variant.product.shop.id,
              variantId: item.variantId,
              productTitle: localizedText(locale, {
                th: item.variant.product.titleTh,
                en: item.variant.product.titleEn,
                fallback: item.variant.product.title,
              }) ?? item.variant.product.title,
              productSlug: item.variant.product.slug,
              variantTitle: localizedText(locale, {
                th: item.variant.titleTh,
                en: item.variant.titleEn,
                fallback: item.variant.title,
              }) ?? item.variant.title,
              variantSku: item.variant.sku,
              shopName: item.variant.product.shop.name,
              shopSlug: item.variant.product.shop.slug,
              quantity: item.quantity,
              unitPrice,
              lineTotal: unitPrice * BigInt(item.quantity),
              currency: item.variant.currency,
              fulfillmentStatus: 'PENDING',
            }
          }),
        },
      },
    })

    await this.prisma.inventoryReservation.updateMany({
      where: { checkoutId: checkout.id, status: 'ACTIVE' },
      data: { orderId: order.id },
    })

    if (input.coupon) {
      await this.prisma.couponRedemption.create({
        data: {
          couponId: input.coupon.id,
          userId: input.userId,
          orderId: order.id,
          status: 'RESERVED',
        },
      })
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: input.paymentProvider,
        providerIntentId: `pending_${input.orderNumber}`,
        status: 'PENDING',
        amount: input.totals.grandTotal,
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
