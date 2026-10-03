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
  FlashSaleItem,
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

export type CheckoutPricedItem = Omit<CheckoutCartItem, 'unitPrice'> & {
  unitPrice: number
  flashSaleItemId?: string
}

export type CheckoutFlashSaleItem = Pick<FlashSaleItem, 'id' | 'salePrice' | 'stockLimit' | 'soldCount' | 'perUserLimit'>

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

export interface AcceptedCheckoutQuote {
  totals: CheckoutTotalsRecord
  items: CheckoutPricedItem[]
  coupon?: CheckoutCouponRef | null
  couponDiscount: number
  couponShopId: string | null
  coinDiscount: number
  freeShippingShopIds: string[]
  coinsToUse?: number
}

export interface CheckoutCommitmentInput {
  cartId: string
  userId: string
  orderNumber: string
  checkoutExpiresAt: Date
  address: CheckoutAddress
  paymentProvider: string
  locale?: string
  acceptedQuote: AcceptedCheckoutQuote
}

export interface CreatedCheckoutOrder {
  checkoutId: string
  order: Order
  payment: Payment
}

export interface ICheckoutRepository extends IPromotionValidationRepository {
  transaction<T>(callback: (repo: ICheckoutRepository) => Promise<T>): Promise<T>
  lockCartForCheckout(cartId: string): Promise<void>
  findCartForCheckout(cartId: string): Promise<CheckoutCart | null>
  findAddressForUser(addressId: string, userId: string): Promise<CheckoutAddress | null>
  lockCouponForCheckout(couponId: string): Promise<void>
  lockFlashSaleItemForCheckout(flashSaleItemId: string): Promise<void>
  findActiveFlashSaleItemForCheckout(variantId: string, now: Date): Promise<CheckoutFlashSaleItem | null>
  findBuyerCoinBalance(userId: string): Promise<number>
  lockBuyerCoinWallet(userId: string): Promise<void>
  commitCheckout(input: CheckoutCommitmentInput): Promise<CreatedCheckoutOrder>
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

  async lockCartForCheckout(cartId: string): Promise<void> {
    // Call only inside the commit transaction, before reading the cart snapshot.
    // Parent lock serializes checkout and new item inserts (their FK key-share
    // lock); child locks stop quantity edits/deletes while the quote is committed.
    await this.prisma.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cartId} FOR UPDATE`
    await this.prisma.$queryRaw`SELECT "id" FROM "CartItem" WHERE "cartId" = ${cartId} ORDER BY "id" FOR UPDATE`
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

  async findActiveFlashSaleItemForCheckout(variantId: string, now: Date): Promise<CheckoutFlashSaleItem | null> {
    return this.prisma.flashSaleItem.findFirst({
      where: {
        variantId,
        isActive: true,
        flashSale: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      },
      select: { id: true, salePrice: true, stockLimit: true, soldCount: true, perUserLimit: true },
      orderBy: { flashSale: { endsAt: 'asc' } },
    })
  }

  async lockFlashSaleItemForCheckout(flashSaleItemId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "FlashSaleItem" WHERE "id" = ${flashSaleItemId}::uuid FOR UPDATE`
  }

  async findBuyerCoinBalance(userId: string): Promise<number> {
    const wallet = await this.prisma.buyerCoinWallet.findUnique({ where: { userId }, select: { balance: true } })
    return Number(wallet?.balance ?? 0)
  }

  async lockBuyerCoinWallet(userId: string): Promise<void> {
    await this.prisma.$queryRaw`SELECT "id" FROM "BuyerCoinWallet" WHERE "userId" = ${userId}::uuid FOR UPDATE`
  }

  async commitCheckout(input: CheckoutCommitmentInput): Promise<CreatedCheckoutOrder> {
    this.logger.debug('PrismaCheckoutRepository.commitCheckout', { cartId: input.cartId, userId: input.userId })
    const quote = input.acceptedQuote

    const checkout = await this.prisma.checkout.create({
      data: {
        cartId: input.cartId,
        userId: input.userId,
        status: 'PAYMENT_PENDING',
        subtotal: quote.totals.subtotal,
        discountTotal: quote.totals.discountTotal,
        shippingTotal: quote.totals.shippingTotal,
        taxTotal: quote.totals.taxTotal,
        grandTotal: quote.totals.grandTotal,
        currency: quote.totals.currency,
        expiresAt: input.checkoutExpiresAt,
      },
    })

    for (const item of quote.items) {
      const inventory = item.variant.inventory
      if (!inventory) {
        throw new CheckoutServiceError('Inventory not found for variant', 409, 'INSUFFICIENT_STOCK', {
          variantId: item.variantId,
          availableQuantity: 0,
        })
      }

      const reservedCount = await this.prisma.$executeRaw`
        UPDATE "Inventory"
        SET "quantityReserved" = "quantityReserved" + ${item.quantity},
            "version" = "version" + 1, "updatedAt" = NOW()
        WHERE "variantId" = ${item.variantId}::uuid
          AND "quantityOnHand" - "quantityReserved" >= ${item.quantity}
      `
      if (reservedCount !== 1) {
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

      if (item.flashSaleItemId) {
        await this.prisma.$queryRaw`SELECT "id" FROM "FlashSaleItem" WHERE "id" = ${item.flashSaleItemId}::uuid FOR UPDATE`
        const reservationCutoff = new Date()
        const flashSaleItem = await this.prisma.flashSaleItem.findUnique({
          where: { id: item.flashSaleItemId },
          select: { stockLimit: true, soldCount: true, perUserLimit: true },
        })
        if (!flashSaleItem) throw new CheckoutServiceError('Flash sale item not found', 409, 'CHECKOUT_FAILED')
        const [reserved, buyerReserved] = await Promise.all([
          this.prisma.flashSaleReservation.aggregate({
            where: { flashSaleItemId: item.flashSaleItemId, status: 'ACTIVE', expiresAt: { gt: reservationCutoff } },
            _sum: { quantity: true },
          }),
          flashSaleItem.perUserLimit === null
            ? Promise.resolve({ _sum: { quantity: 0 } })
            : this.prisma.flashSaleReservation.aggregate({
              where: {
                flashSaleItemId: item.flashSaleItemId,
                userId: input.userId,
                OR: [
                  { status: 'COMMITTED' },
                  { status: 'ACTIVE', expiresAt: { gt: reservationCutoff } },
                ],
              },
              _sum: { quantity: true },
            }),
        ])
        const available = flashSaleItem.stockLimit - flashSaleItem.soldCount - Number(reserved._sum.quantity ?? 0)
        const buyerQuantity = Number(buyerReserved._sum.quantity ?? 0) + item.quantity
        if (available < item.quantity || (flashSaleItem.perUserLimit !== null && buyerQuantity > flashSaleItem.perUserLimit)) {
          throw new CheckoutServiceError('Flash sale quota is no longer available', 409, 'CHECKOUT_FAILED', { variantId: item.variantId })
        }
        await this.prisma.flashSaleReservation.create({
          data: { checkoutId: checkout.id, flashSaleItemId: item.flashSaleItemId, userId: input.userId, quantity: item.quantity, expiresAt: input.checkoutExpiresAt },
        })
      }
    }

    const locale = resolveContentLocale(input.locale)
    const shopOrderGroups = new Map<string, { subtotal: number; shippingTotal: number }>()
    for (const item of quote.items) {
      const shop = item.variant.product.shop
      const current = shopOrderGroups.get(shop.id) ?? {
        subtotal: 0,
        shippingTotal: quote.freeShippingShopIds.includes(shop.id) ? 0 : Math.max(0, Number(shop.settings?.shippingFee ?? 0)),
      }
      current.subtotal += item.unitPrice * item.quantity
      shopOrderGroups.set(shop.id, current)
    }

    let remainingPlatformDiscount = quote.coinDiscount + (quote.couponShopId ? 0 : quote.couponDiscount)
    let remainingPlatformDiscountCapacity = [...shopOrderGroups.entries()].reduce(
      (total, [shopId, group]) => total + Math.max(0, group.subtotal - (quote.couponShopId === shopId ? quote.couponDiscount : 0)),
      0,
    )
    const shopOrderCreates = [...shopOrderGroups.entries()].map(([shopId, group]) => {
      const shopCouponDiscount = quote.couponShopId === shopId ? Math.min(group.subtotal, quote.couponDiscount) : 0
      const availableForPlatformDiscount = group.subtotal - shopCouponDiscount
      const proportionalPlatformDiscount = remainingPlatformDiscountCapacity > 0
        ? Number(BigInt(remainingPlatformDiscount) * BigInt(availableForPlatformDiscount) / BigInt(remainingPlatformDiscountCapacity))
        : 0
      const platformDiscount = Math.min(availableForPlatformDiscount, proportionalPlatformDiscount)
      remainingPlatformDiscount -= platformDiscount
      remainingPlatformDiscountCapacity -= availableForPlatformDiscount
      const discountTotal = platformDiscount + shopCouponDiscount
      return {
        shopId,
        status: 'PENDING_PAYMENT' as const,
        fulfillmentStatus: 'PENDING' as const,
        subtotal: group.subtotal,
        discountTotal,
        shippingTotal: group.shippingTotal,
        taxTotal: 0,
        grandTotal: group.subtotal - discountTotal + group.shippingTotal,
        currency: quote.totals.currency,
      }
    })

    const order = await this.prisma.order.create({
      data: {
        checkoutId: checkout.id,
        userId: input.userId,
        orderNumber: input.orderNumber,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        subtotal: quote.totals.subtotal,
        discountTotal: quote.totals.discountTotal,
        shippingTotal: quote.totals.shippingTotal,
        taxTotal: quote.totals.taxTotal,
        grandTotal: quote.totals.grandTotal,
        currency: quote.totals.currency,
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
          create: quote.items.map((item) => {
            const unitPrice = BigInt(item.unitPrice)

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

    if (quote.coinsToUse && quote.coinsToUse > 0) {
      const wallet = await this.prisma.buyerCoinWallet.findUnique({ where: { userId: input.userId }, select: { id: true, balance: true } })
      if (!wallet || Number(wallet.balance) < quote.coinsToUse) {
        throw new CheckoutServiceError('Insufficient coin balance', 409, 'CHECKOUT_FAILED')
      }
      await this.prisma.buyerCoinWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: quote.coinsToUse }, pendingBalance: { increment: quote.coinsToUse } },
      })
      await this.prisma.buyerCoinLedger.create({
        data: { walletId: wallet.id, userId: input.userId, orderId: order.id, type: 'SPENT', status: 'PENDING', amount: quote.coinsToUse, reason: 'Checkout coin redemption', referenceType: 'ORDER_COIN_REDEMPTION', referenceId: order.id },
      })
    }

    if (quote.coupon) {
      await this.prisma.couponRedemption.create({
        data: {
          couponId: quote.coupon.id,
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
        amount: quote.totals.grandTotal,
        currency: quote.totals.currency,
      },
    })

    await this.prisma.cartItem.deleteMany({
      where: { cartId: input.cartId, id: { in: quote.items.map((item) => item.id) } },
    })

    return {
      checkoutId: checkout.id,
      order,
      payment,
    }
  }
}
