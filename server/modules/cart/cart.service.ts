import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { CartServiceError } from './cart.errors.ts'
import type { ActiveCartDetail, CartItemDetail, ICartRepository } from './cart.repository.ts'

export interface CartActor {
  id: string
  role: Role
}

export interface AddCartItemData {
  variantId: string
  quantity: number
}

export interface UpdateCartItemData {
  quantity: number
}

export interface CartResponse {
  id: string
  shops: CartShopGroup[]
  subtotalCents: number
  currency: string | null
}

export interface CartShopGroup {
  shop: {
    id: string
    name: string
    slug: string
  }
  items: CartResponseItem[]
  subtotalCents: number
  currency: string | null
}

export interface CartResponseItem {
  id: string
  product: {
    id: string
    title: string
    slug: string
    status: string
  }
  variant: {
    id: string
    sku: string
    title: string
    priceCents: number
    currency: string
  }
  quantity: number
  unitPriceCents: number
  currency: string
  lineTotalCents: number
  availableQuantity: number
}

export class CartService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ICartRepository,
  ) {
    this.logger = appContext.logger
  }

  async getCart(actor: CartActor): Promise<CartResponse> {
    this.assertBuyer(actor)
    this.logger.debug('CartService.getCart', { actorId: actor.id })

    const cart = await this.repo.findOrCreateActiveCart(actor.id)
    return this.toCartResponse(cart)
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
        unitPriceCents: variant!.priceCents,
        currency: variant!.currency,
      })
    }

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
    if (actor.role !== 'USER') {
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

  private toCartResponse(cart: ActiveCartDetail): CartResponse {
    const groups = new Map<string, CartShopGroup>()

    for (const item of cart.items) {
      const shop = item.variant.product.shop
      const lineTotalCents = item.unitPriceCents * item.quantity
      const responseItem: CartResponseItem = {
        id: item.id,
        product: {
          id: item.variant.product.id,
          title: item.variant.product.title,
          slug: item.variant.product.slug,
          status: item.variant.product.status,
        },
        variant: {
          id: item.variant.id,
          sku: item.variant.sku,
          title: item.variant.title,
          priceCents: item.variant.priceCents,
          currency: item.variant.currency,
        },
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        currency: item.currency,
        lineTotalCents,
        availableQuantity: this.getAvailableQuantity(item.variant),
      }

      const group = groups.get(shop.id) ?? {
        shop: {
          id: shop.id,
          name: shop.name,
          slug: shop.slug,
        },
        items: [],
        subtotalCents: 0,
        currency: item.currency,
      }

      group.items.push(responseItem)
      group.subtotalCents += lineTotalCents
      if (group.currency !== item.currency) group.currency = null
      groups.set(shop.id, group)
    }

    const shops = [...groups.values()]
    const subtotalCents = shops.reduce((total, shop) => total + shop.subtotalCents, 0)
    const currency = shops.reduce<string | null>((current, shop) => {
      if (current === undefined) return shop.currency
      return current === shop.currency ? current : null
    }, shops[0]?.currency ?? null)

    return {
      id: cart.id,
      shops,
      subtotalCents,
      currency,
    }
  }
}
