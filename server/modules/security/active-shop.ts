import type { Shop } from '#generated/client/client.ts'
import { SecurityError } from './security.errors.ts'

export type ActiveSellerShop = Pick<Shop, 'id' | 'ownerId' | 'status'>

export interface ActiveShopAccessOptions {
  permissions?: string[]
}

export interface ActiveShopAccess {
  shop: ActiveSellerShop
  access: {
    kind: 'OWNER' | 'STAFF'
    permissions: string[]
  }
}

export interface ActiveShopRepository {
  findActiveShopsForUser(userId: string): Promise<ActiveSellerShop[]>
  findActiveShopForUser(userId: string, shopId: string): Promise<ActiveSellerShop | null>
}

export class ActiveShopResolver {
  constructor(private repo: ActiveShopRepository) {}

  async resolveActiveShops(userId: string): Promise<ActiveSellerShop[]> {
    return this.repo.findActiveShopsForUser(userId)
  }

  async requireAnyActiveShop(userId: string): Promise<ActiveSellerShop> {
    const { shop } = await this.requireAnyActiveShopAccess(userId)
    return shop
  }

  async requireAnyActiveShopAccess(userId: string, options: ActiveShopAccessOptions = {}): Promise<ActiveShopAccess> {
    const shop = (await this.resolveActiveShops(userId))[0]
    if (!shop) throw new SecurityError('Active seller shop not found', 403, 'SELLER_SHOP_NOT_ACTIVE')
    return this.toOwnerAccess(shop, options)
  }

  async requireActiveShop(userId: string, shopId: string): Promise<ActiveSellerShop> {
    const { shop } = await this.requireActiveShopAccess(userId, shopId)
    return shop
  }

  async requireActiveShopAccess(
    userId: string,
    shopId: string,
    options: ActiveShopAccessOptions = {},
  ): Promise<ActiveShopAccess> {
    const shop = await this.repo.findActiveShopForUser(userId, shopId)
    if (!shop) throw new SecurityError('Active seller shop access required', 403, 'SELLER_SHOP_NOT_ACTIVE')
    return this.toOwnerAccess(shop, options)
  }

  async hasActiveShop(userId: string, shopId: string): Promise<boolean> {
    return Boolean(await this.repo.findActiveShopForUser(userId, shopId))
  }

  private toOwnerAccess(shop: ActiveSellerShop, options: ActiveShopAccessOptions): ActiveShopAccess {
    return {
      shop,
      access: {
        kind: 'OWNER',
        permissions: options.permissions ?? ['*'],
      },
    }
  }
}
