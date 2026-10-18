import { moneyInteger } from '#server/lib/money.ts'
import type { Cart } from '#generated/client/client.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import type { TrackingService } from '#server/modules/tracking'
import { CartServiceError } from './cart.errors.ts'
import type { ActiveCartDetail, CartItemDetail, HistoricalCartItem, ICartRepository } from './cart.repository.ts'
import type { BuyAgainItemOutcome, BuyAgainResult, BuyAgainSkipReason } from './buy-again.ts'

const MARKETPLACE_CURRENCY = 'THB'
const MAX_CART_QUANTITY = 2_147_483_647

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
  subtotal: bigint
  currency: string | null
}

export interface CartShopGroup {
  shop: {
    id: string
    name: string
    slug: string
  }
  items: CartResponseItem[]
  subtotal: bigint
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
    price: bigint
    currency: string
  }
  quantity: number
  unitPrice: bigint
  currency: string
  lineTotal: bigint
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
    this.logger.debug('CartService.addItem', { actorId: actor.id, variantId: data.variantId })

    const { cart, variant } = await this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      const variant = await repo.findVariantForCart(data.variantId)
      this.assertVariantPurchasable(variant)

      const existing = cart.items.find((item) => item.variantId === data.variantId)
      const nextQuantity = (existing?.quantity ?? 0) + data.quantity
      this.assertPositiveQuantity(nextQuantity)
      this.assertStockAvailable(variant, nextQuantity)

      const savedItem = existing
        ? await repo.updateItem(existing.id, {
          quantity: nextQuantity,
          unitPrice: this.toMoneyInteger(this.getVariantPrice(variant)),
          currency: variant.currency,
        })
        : await repo.createItem({
          cartId: cart.id,
          variantId: variant.id,
          quantity: data.quantity,
          unitPrice: this.toMoneyInteger(this.getVariantPrice(variant)),
          currency: variant.currency,
        })
      const items = existing
        ? cart.items.map(item => item.id === existing.id ? savedItem : item)
        : [...cart.items, savedItem]
      return { cart: { ...cart, items }, variant }
    })
    // Analytics is explicitly best-effort and must not delay the cart response.
    void this.recordAddToCartAnalytics(actor, variant, data)
    return this.toCartResponse(cart, resolveContentLocale(undefined))
  }

  async mergeGuestItem(actor: CartActor, data: AddCartItemData & Pick<Cart, 'userId'>): Promise<{ addedQuantity: number }> {
    this.assertBuyer(actor)
    if (actor.id !== data.userId) throw new CartServiceError(
      'The guest cart session has changed', 409, 'CART_SESSION_CHANGED',
    )
    this.assertPositiveQuantity(data.quantity)
    const { addedQuantity, variant } = await this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      const variant = await repo.findVariantForCart(data.variantId)
      this.assertVariantPurchasable(variant)
      const existing = cart.items.find(item => item.variantId === data.variantId)
      const existingQuantity = existing?.quantity ?? 0
      const capacity = Math.min(this.getAvailableQuantity(variant), MAX_CART_QUANTITY)
      const addedQuantity = Math.min(data.quantity, Math.max(0, capacity - existingQuantity))
      if (addedQuantity === 0) return { addedQuantity, variant }
      const quantity = existingQuantity + addedQuantity
      const unitPrice = this.toMoneyInteger(this.getVariantPrice(variant))
      if (existing) await repo.updateItem(existing.id, { quantity, unitPrice, currency: variant.currency })
      else await repo.createItem({ cartId: cart.id, variantId: variant.id, quantity, unitPrice, currency: variant.currency })
      return { addedQuantity, variant }
    })
    if (addedQuantity > 0) void this.recordAddToCartAnalytics(actor, variant, { ...data, quantity: addedQuantity })
    return { addedQuantity }
  }

  async updateItem(actor: CartActor, itemId: string, data: UpdateCartItemData): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.assertPositiveQuantity(data.quantity)
    this.logger.info('CartService.updateItem', { actorId: actor.id, itemId })

    const cart = await this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      const item = cart.items.find(item => item.id === itemId)
      if (!item) throw new CartServiceError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')
      this.assertVariantPurchasable(item.variant)
      this.assertStockAvailable(item.variant, data.quantity)
      const savedItem = await repo.updateItem(item.id, {
        quantity: data.quantity,
        unitPrice: this.toMoneyInteger(this.getVariantPrice(item.variant)),
        currency: item.variant.currency,
      })
      return { ...cart, items: cart.items.map(current => current.id === item.id ? savedItem : current) }
    })
    return this.toCartResponse(cart, resolveContentLocale(undefined))
  }

  async deleteItem(actor: CartActor, itemId: string): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.info('CartService.deleteItem', { actorId: actor.id, itemId })

    const cart = await this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      const item = cart.items.find(item => item.id === itemId)
      if (!item) throw new CartServiceError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND')
      await repo.deleteItem(item.id)
      return { ...cart, items: cart.items.filter(current => current.id !== item.id) }
    })
    return this.toCartResponse(cart, resolveContentLocale(undefined))
  }

  async clearCart(actor: CartActor): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.info('CartService.clearCart', { actorId: actor.id })

    const cart = await this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      await repo.clearActiveCart(actor.id)
      return { ...cart, items: [] }
    })
    return this.toCartResponse(cart, resolveContentLocale(undefined))
  }

  async buyAgain(actor: CartActor, orderId: string): Promise<BuyAgainResult> {
    this.assertBuyer(actor)
    const order = await this.repo.findOwnedOrderItems(orderId, actor.id)
    if (!order) throw new CartServiceError('Order not found', 404, 'ORDER_NOT_FOUND')

    const historical = new Map<string, HistoricalCartItem>()
    for (const item of order.items) {
      this.assertPositiveQuantity(item.quantity)
      const quantity = (historical.get(item.variantId)?.quantity ?? 0) + item.quantity
      this.assertPositiveQuantity(quantity)
      historical.set(item.variantId, { ...item, quantity })
    }

    return this.repo.withLockedActiveCart(actor.id, async (cart, repo) => {
      this.assertActiveCart(cart)
      const variants = new Map((await repo.findVariantsForCart([...historical.keys()])).map(variant => [variant.id, variant]))
      const existingItems = new Map(cart.items.map(item => [item.variantId, item]))
      const items: BuyAgainItemOutcome[] = []

      for (const item of historical.values()) {
        const variant = variants.get(item.variantId) ?? null
        const existing = existingItems.get(item.variantId)
        const existingQuantity = existing?.quantity ?? 0
        const targetQuantity = Math.max(existingQuantity, item.quantity)
        const availableQuantity = variant ? this.getAvailableQuantity(variant) : 0
        const unitPrice = variant ? this.toMoneyInteger(variant.price) : null
        const quantities = {
          variantId: item.variantId,
          productTitle: item.productTitle,
          variantTitle: item.variantTitle,
          requestedQuantity: item.quantity,
          existingQuantity,
          targetQuantity,
          availableQuantity,
        }
        const reason = this.buyAgainUnavailableReason(variant)
        if (reason || !variant || unitPrice === null) {
          items.push({ ...quantities, kind: 'skipped', reason: reason ?? 'VARIANT_NOT_FOUND', addedQuantity: 0,
            finalQuantity: existingQuantity, unitPrice, currency: variant?.currency ?? null })
          continue
        }

        if (existingQuantity > availableQuantity || availableQuantity === 0) {
          if (existing) await repo.updateItem(existing.id, { quantity: existingQuantity, unitPrice, currency: variant.currency })
          items.push({ ...quantities, kind: 'skipped',
            reason: existingQuantity > availableQuantity ? 'EXISTING_QUANTITY_EXCEEDS_STOCK' : 'OUT_OF_STOCK',
            addedQuantity: 0, finalQuantity: existingQuantity, unitPrice, currency: variant.currency })
          continue
        }

        const finalQuantity = Math.min(targetQuantity, availableQuantity)
        const addedQuantity = finalQuantity - existingQuantity
        if (existing) await repo.updateItem(existing.id, { quantity: finalQuantity, unitPrice, currency: variant.currency })
        else await repo.createItem({ cartId: cart.id, variantId: variant.id, quantity: finalQuantity, unitPrice, currency: variant.currency })
        const result = { ...quantities, addedQuantity, finalQuantity, unitPrice, currency: variant.currency }
        items.push(finalQuantity < targetQuantity
          ? { ...result, kind: 'partial', reason: 'STOCK_LIMIT' }
          : { ...result, kind: addedQuantity > 0 ? 'added' : 'already_in_cart', reason: null })
      }
      return { cartId: cart.id, items }
    })
  }

  private buyAgainUnavailableReason(variant: CartItemDetail['variant'] | null): BuyAgainSkipReason | null {
    if (!variant) return 'VARIANT_NOT_FOUND'
    if (variant.status !== 'ACTIVE') return 'VARIANT_UNAVAILABLE'
    if (variant.product.status !== 'ACTIVE' || variant.product.deletedAt) return 'PRODUCT_UNAVAILABLE'
    if (variant.product.shop.status !== 'ACTIVE' || variant.product.shop.deletedAt) return 'SHOP_UNAVAILABLE'
    if (this.toMoneyInteger(variant.price) <= 0n) return 'PRICE_UNAVAILABLE'
    if (variant.currency !== MARKETPLACE_CURRENCY) return 'CURRENCY_UNSUPPORTED'
    return null
  }

  private assertBuyer(actor: CartActor): void {
    if (actor.role === 'ADMIN') {
      throw new CartServiceError('Buyer cart APIs are only available to buyer accounts', 403, 'CART_FORBIDDEN')
    }
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_CART_QUANTITY) {
      throw new CartServiceError('Quantity must be a positive integer', 400, 'CART_QUANTITY_INVALID')
    }
  }

  private assertActiveCart(cart: ActiveCartDetail): void {
    if (cart.status !== 'ACTIVE') {
      throw new CartServiceError('Cart is no longer active; refresh before retrying', 409, 'CART_STATE_CONFLICT')
    }
  }

  private assertVariantPurchasable(variant: CartItemDetail['variant'] | null): asserts variant is CartItemDetail['variant'] {
    if (!variant) throw new CartServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    if (variant.status !== 'ACTIVE') {
      throw new CartServiceError('Variant is unavailable', 400, 'VARIANT_UNAVAILABLE')
    }
    if (variant.product.status !== 'ACTIVE' || variant.product.deletedAt) {
      throw new CartServiceError('Product is unavailable', 400, 'PRODUCT_UNAVAILABLE')
    }
    if (variant.product.shop.status !== 'ACTIVE' || variant.product.shop.deletedAt) {
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
      const unitPrice = this.toMoneyInteger(item.unitPrice)
      const lineTotal = unitPrice * BigInt(item.quantity)
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
          price: this.toMoneyInteger(this.getVariantPrice(item.variant)),
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
        subtotal: 0n,
        currency: item.currency,
      }

      group.items.push(responseItem)
      group.subtotal += lineTotal
      if (group.currency !== item.currency) group.currency = null
      groups.set(shop.id, group)
    }

    const shops = [...groups.values()]
    const subtotal = shops.reduce((total, shop) => total + shop.subtotal, 0n)
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

  private toMoneyInteger(value: bigint | number): bigint {
    return moneyInteger(value)
  }

  private getVariantPrice(variant: CartItemDetail['variant']): bigint {
    return variant.price
  }
}
