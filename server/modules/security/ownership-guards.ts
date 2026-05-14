import { SecurityError } from './security.errors.ts'

export interface OwnershipGuardRepository {
  cartBelongsToUser(userId: string, cartId: string): Promise<boolean>
  orderBelongsToUser(userId: string, orderId: string): Promise<boolean>
  shopBelongsToSeller(userId: string, shopId: string): Promise<boolean>
  productBelongsToSeller(userId: string, productId: string): Promise<boolean>
  shipmentBelongsToSeller(userId: string, shipmentId: string): Promise<boolean>
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
    await this.assertAllowed(await this.repo.shopBelongsToSeller(userId, shopId), 'Seller does not own shop')
  }

  async assertSellerOwnsProduct(userId: string, productId: string): Promise<void> {
    await this.assertAllowed(await this.repo.productBelongsToSeller(userId, productId), 'Seller does not own product')
  }

  async assertSellerOwnsShipment(userId: string, shipmentId: string): Promise<void> {
    await this.assertAllowed(await this.repo.shipmentBelongsToSeller(userId, shipmentId), 'Seller does not own shipment')
  }

  private async assertAllowed(allowed: boolean, message: string): Promise<void> {
    if (!allowed) throw new SecurityError(message, 403, 'FORBIDDEN')
  }
}
