import { SecurityError } from './security.errors.ts'
import type { ActiveShopRepository } from './active-shop.ts'

export interface OwnershipGuardRepository extends ActiveShopRepository {
  cartBelongsToUser(userId: string, cartId: string): Promise<boolean>
  orderBelongsToUser(userId: string, orderId: string): Promise<boolean>
  activeShopBelongsToUser(userId: string, shopId: string): Promise<boolean>
  productBelongsToActiveShop(userId: string, productId: string): Promise<boolean>
  shipmentBelongsToActiveShop(userId: string, shipmentId: string): Promise<boolean>
}

export class OwnershipGuards {
  constructor(private repo: OwnershipGuardRepository) {}

  async assertUserOwnsCart(userId: string, cartId: string): Promise<void> {
    await this.assertAllowed(await this.repo.cartBelongsToUser(userId, cartId), 'User does not own cart')
  }

  async assertUserOwnsOrder(userId: string, orderId: string): Promise<void> {
    await this.assertAllowed(await this.repo.orderBelongsToUser(userId, orderId), 'User does not own order')
  }

  async assertSellerOwnsShop(userId: string, shopId: string): Promise<void> {
    await this.assertAllowed(await this.repo.activeShopBelongsToUser(userId, shopId), 'Active seller shop access required')
  }

  async assertSellerOwnsProduct(userId: string, productId: string): Promise<void> {
    await this.assertAllowed(await this.repo.productBelongsToActiveShop(userId, productId), 'Active seller product access required')
  }

  async assertSellerOwnsShipment(userId: string, shipmentId: string): Promise<void> {
    await this.assertAllowed(await this.repo.shipmentBelongsToActiveShop(userId, shipmentId), 'Active seller shipment access required')
  }

  private async assertAllowed(allowed: boolean, message: string): Promise<void> {
    if (!allowed) throw new SecurityError(message, 403, 'FORBIDDEN')
  }
}
