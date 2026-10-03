import type {
  Cart,
  CartItem,
  Inventory,
  Prisma,
  PrismaClient,
  Product,
  ProductVariant,
  Shop,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

type LocalizedProduct = Omit<Product, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
}

type LocalizedProductVariant = Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
  titleTh?: string | null
  titleEn?: string | null
}

export type CartItemDetail = CartItem & {
  variant: LocalizedProductVariant & {
    inventory: Inventory | null
    product: LocalizedProduct & {
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
      images: Array<{ url: string; isPrimary: boolean; sortOrder: number }>
    }
  }
}

export type ActiveCartDetail = Cart & {
  items: CartItemDetail[]
}

export interface CreateCartItemData {
  cartId: string
  variantId: string
  quantity: number
  unitPrice: bigint
  currency: string
}

export interface ICartRepository {
  withLockedActiveCart<T>(userId: string, callback: (cart: ActiveCartDetail, repo: ICartRepository) => Promise<T>): Promise<T>
  findActiveCartByUserId(userId: string): Promise<ActiveCartDetail | null>
  findOrCreateActiveCart(userId: string): Promise<ActiveCartDetail>
  findItemByIdForUser(itemId: string, userId: string): Promise<CartItemDetail | null>
  findVariantForCart(variantId: string): Promise<CartItemDetail['variant'] | null>
  createItem(data: CreateCartItemData): Promise<CartItemDetail>
  updateItemQuantity(itemId: string, quantity: number): Promise<CartItemDetail>
  deleteItem(itemId: string): Promise<CartItem>
  clearActiveCart(userId: string): Promise<number>
}

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            include: {
              images: {
                select: { url: true, isPrimary: true, sortOrder: true },
                orderBy: { isPrimary: 'desc' },
              },
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
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const

const itemInclude = {
  variant: {
    include: {
      inventory: true,
      product: {
        include: {
          images: {
            select: { url: true, isPrimary: true, sortOrder: true },
            orderBy: { isPrimary: 'desc' },
          },
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
} as const

export class PrismaCartRepository implements ICartRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient | Prisma.TransactionClient,
  ) {
    this.logger = appContext.logger
  }

  async withLockedActiveCart<T>(userId: string, callback: (cart: ActiveCartDetail, repo: ICartRepository) => Promise<T>): Promise<T> {
    const cart = await this.findOrCreateActiveCart(userId)
    return this.withTransaction(async repo => {
      await repo.prisma.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${cart.id} FOR UPDATE`
      await repo.prisma.$queryRaw`SELECT "id" FROM "CartItem" WHERE "cartId" = ${cart.id} ORDER BY "id" FOR UPDATE`
      const current = await repo.prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude })
      return callback(current, repo)
    })
  }

  private withTransaction<T>(callback: (repo: PrismaCartRepository) => Promise<T>): Promise<T> {
    if (!('$transaction' in this.prisma)) return callback(this)
    return this.prisma.$transaction(tx => callback(new PrismaCartRepository({ logger: this.logger, config: { environment: 'transaction' } }, tx)))
  }

  findActiveCartByUserId(userId: string): Promise<ActiveCartDetail | null> {
    this.logger.debug('PrismaCartRepository.findActiveCartByUserId', { userId })
    return this.prisma.cart.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: cartInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async findOrCreateActiveCart(userId: string): Promise<ActiveCartDetail> {
    this.logger.debug('PrismaCartRepository.findOrCreateActiveCart', { userId })
    const existing = await this.findActiveCartByUserId(userId)
    if (existing) return existing

    return this.withTransaction(async (repo) => {
      const tx = repo.prisma
      // A first-page GET and add-item request can both observe no active cart.
      // Serialize creation for this buyer and recheck after acquiring the lock.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
      const current = await tx.cart.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: cartInclude,
        orderBy: { createdAt: 'desc' },
      })
      if (current) return current

      return tx.cart.create({
        data: { userId, status: 'ACTIVE' },
        include: cartInclude,
      })
    })
  }

  findItemByIdForUser(itemId: string, userId: string): Promise<CartItemDetail | null> {
    this.logger.debug('PrismaCartRepository.findItemByIdForUser', { itemId, userId })
    return this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: {
          userId,
          status: 'ACTIVE',
        },
      },
      include: itemInclude,
    })
  }

  findVariantForCart(variantId: string): Promise<CartItemDetail['variant'] | null> {
    this.logger.debug('PrismaCartRepository.findVariantForCart', { variantId })
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        inventory: true,
        product: {
          include: {
            images: {
              select: { url: true, isPrimary: true, sortOrder: true },
              orderBy: { isPrimary: 'desc' },
            },
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
    })
  }

  createItem(data: CreateCartItemData): Promise<CartItemDetail> {
    this.logger.debug('PrismaCartRepository.createItem', { cartId: data.cartId, variantId: data.variantId })
    return this.prisma.cartItem.create({
      data,
      include: itemInclude,
    })
  }

  updateItemQuantity(itemId: string, quantity: number): Promise<CartItemDetail> {
    this.logger.info('PrismaCartRepository.updateItemQuantity', { itemId, quantity })
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: itemInclude,
    })
  }

  deleteItem(itemId: string): Promise<CartItem> {
    this.logger.info('PrismaCartRepository.deleteItem', { itemId })
    return this.prisma.cartItem.delete({
      where: { id: itemId },
    })
  }

  async clearActiveCart(userId: string): Promise<number> {
    this.logger.info('PrismaCartRepository.clearActiveCart', { userId })
    const result = await this.prisma.cartItem.deleteMany({
      where: {
        cart: {
          userId,
          status: 'ACTIVE',
        },
      },
    })
    return result.count
  }
}
