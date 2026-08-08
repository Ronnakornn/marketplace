import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import type { TrackingService } from '#server/modules/tracking'
import { CartServiceError } from './cart.errors.ts'
import type { ActiveCartDetail, CartItemDetail, ICartRepository } from './cart.repository.ts'

export interface CartActor {
  id: string
  role: Role
}

export interface AddCartItemData {
  variantId: string
  quantity: number
  sessionId?: string
  source?: string
}

export interface UpdateCartItemData {
  quantity: number
}

export interface CartResponse {
  id: string
  shops: CartShopGroup[]
  subtotal: number
  currency: string | null
}

export interface CartShopGroup {
  shop: {
    id: string
    name: string
    slug: string
  }
  items: CartResponseItem[]
  subtotal: number
  currency: string | null
}

export interface CartResponseItem {
  id: string
  product: {
    id: string
    title: string
    slug: string
    status: string
    imageUrl: string | null
  }
  variant: {
    id: string
    sku: string
    title: string
    price: number
    currency: string
  }
  quantity: number
  unitPrice: number
  currency: string
  lineTotal: number
  availableQuantity: number
}

export class CartService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ICartRepository,
    private trackingService?: TrackingService,
  ) {
    this.logger = appContext.logger
  }

  async getCart(actor: CartActor, localeInput?: string): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.debug('CartService.getCart', { actorId: actor.id })

    const cart = await this.repo.findOrCreateActiveCart(actor.id)
    return this.toCartResponse(cart, resolveContentLocale(localeInput))
  }

  async addItem(actor: CartActor, data: AddCartItemData): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.assertPositiveQuantity(data.quantity)
    this.logger.info('CartService.addItem', { actorId: actor.id, variantId: data.variantId })

    const cart = await this.repo.findOrCreateActiveCart(actor.id)
    const variant = await this.repo.findVariantForCart(data.variantId)
    this.assertVariantPurchasable(variant)

    const existing = cart.items.find((item) => item.variantId === data.variantId)
    const nextQuantity = (existing?.quantity ?? 0) + data.quantity
    this.assertStockAvailable(variant!, nextQuantity)

    if (existing) {
      await this.repo.updateItemQuantity(existing.id, nextQuantity)
    } else {
      await this.repo.createItem({
        cartId: cart.id,
        variantId: variant!.id,
        quantity: data.quantity,
        unitPrice: this.toMoneyNumber(this.getVariantPrice(variant!)),
        currency: variant!.currency,
      })
    }

    await this.recordAddToCartAnalytics(actor, variant!, data)
    return this.getCart(actor)
  }

  async updateItem(actor: CartActor, itemId: string, data: UpdateCartItemData): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.assertPositiveQuantity(data.quantity)
    this.logger.info('CartService.updateItem', { actorId: actor.id, itemId })

    const item = await this.repo.findItemByIdForUser(itemId, actor.id)
    if (!item) throw new CartServiceError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')
    this.assertVariantPurchasable(item.variant)
    this.assertStockAvailable(item.variant, data.quantity)

    await this.repo.updateItemQuantity(item.id, data.quantity)
    return this.getCart(actor)
  }

  async deleteItem(actor: CartActor, itemId: string): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.info('CartService.deleteItem', { actorId: actor.id, itemId })

    const item = await this.repo.findItemByIdForUser(itemId, actor.id)
    if (!item) throw new CartServiceError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')

    await this.repo.deleteItem(item.id)
    return this.getCart(actor)
  }

  async clearCart(actor: CartActor): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.info('CartService.clearCart', { actorId: actor.id })

    await this.repo.clearActiveCart(actor.id)
    return this.getCart(actor)
  }

  private assertBuyer(actor: CartActor): void {
    if (actor.role === 'ADMIN') {
      throw new CartServiceError('Buyer cart APIs are only available to buyer accounts', 403, 'CART_FORBIDDEN')
    }
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CartServiceError('Quantity must be a positive integer', 400, 'CART_QUANTITY_INVALID')
    }
  }

  private assertVariantPurchasable(variant: CartItemDetail['variant'] | null): asserts variant is CartItemDetail['variant'] {
    if (!variant) throw new CartServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    if (variant.product.status !== 'ACTIVE') {
      throw new CartServiceError('Product is unavailable', 400, 'PRODUCT_UNAVAILABLE')
    }
    if (variant.product.shop.status !== 'ACTIVE') {
      throw new CartServiceError('Shop is unavailable', 400, 'SHOP_UNAVAILABLE')
    }
  }

  private assertStockAvailable(variant: CartItemDetail['variant'], quantity: number): void {
    const availableQuantity = this.getAvailableQuantity(variant)
    if (availableQuantity < quantity) {
      throw new CartServiceError('Requested quantity exceeds available stock', 409, 'CART_STOCK_UNAVAILABLE', {
        availableQuantity,
      })
    }
  }

  private getAvailableQuantity(variant: CartItemDetail['variant']): number {
    const inventory = variant.inventory
    if (!inventory) return 0
    return Math.max(0, inventory.quantityOnHand - inventory.quantityReserved)
  }

  private async recordAddToCartAnalytics(actor: CartActor, variant: CartItemDetail['variant'], data: AddCartItemData): Promise<void> {
    if (!this.trackingService) return

    try {
      await this.trackingService.recordProductAddToCart({
        productId: variant.product.id,
        variantId: variant.id,
        shopId: variant.product.shop.id,
        userId: actor.id,
        sessionId: data.sessionId,
        quantity: data.quantity,
        source: data.source,
      })
    } catch (error) {
      this.logger.warn('CartService.addItem analytics write failed', {
        actorId: actor.id,
        productId: variant.product.id,
        variantId: variant.id,
        shopId: variant.product.shop.id,
        error,
      })
    }
  }

  private toCartResponse(cart: ActiveCartDetail, locale: ContentLocale): CartResponse {
    const groups = new Map<string, CartShopGroup>()

    for (const item of cart.items) {
      const shop = item.variant.product.shop
      const unitPrice = this.toMoneyNumber(item.unitPrice)
      const lineTotal = unitPrice * item.quantity
      const responseItem: CartResponseItem = {
        id: item.id,
        product: {
          id: item.variant.product.id,
          title: localizedText(locale, {
            th: item.variant.product.titleTh,
            en: item.variant.product.titleEn,
            fallback: item.variant.product.title,
          }) ?? item.variant.product.title,
          slug: item.variant.product.slug,
          status: item.variant.product.status,
          imageUrl: item.variant.product.images?.[0]?.url ?? null,
        },
        variant: {
          id: item.variant.id,
          sku: item.variant.sku,
          title: localizedText(locale, {
            th: item.variant.titleTh,
            en: item.variant.titleEn,
            fallback: item.variant.title,
          }) ?? item.variant.title,
          price: this.toMoneyNumber(this.getVariantPrice(item.variant)),
          currency: item.variant.currency,
        },
        quantity: item.quantity,
        unitPrice,
        currency: item.currency,
        lineTotal,
        availableQuantity: this.getAvailableQuantity(item.variant),
      }

      const group = groups.get(shop.id) ?? {
        shop: {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
        },
        items: [],
        subtotal: 0,
        currency: item.currency,
      }

      group.items.push(responseItem)
      group.subtotal += lineTotal
      if (group.currency !== item.currency) group.currency = null
      groups.set(shop.id, group)
    }

    const shops = [...groups.values()]
    const subtotal = shops.reduce((total, shop) => total + shop.subtotal, 0)
    const currency = shops.reduce<string | null>((current, shop) => {
      if (current === undefined) return shop.currency
      return current === shop.currency ? current : null
    }, shops[0]?.currency ?? null)

    return {
      id: cart.id,
      shops,
      subtotal,
      currency,
    }
  }

  private toMoneyNumber(value: bigint | number): number {
    return typeof value === 'bigint' ? Number(value) : value
  }

  private getVariantPrice(variant: CartItemDetail['variant']): bigint | number {
    return variant.price ?? (variant as unknown as { price: bigint | number }).price
  }
}
