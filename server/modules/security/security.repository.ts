import type { PrismaClient } from '#generated/client/client.ts'
import type { Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { OwnershipGuardRepository } from './ownership-guards.ts'

export class PrismaOwnershipGuardRepository implements OwnershipGuardRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async cartBelongsToUser(userId: string, cartId: string): Promise<boolean> {
    this.logger.debug('PrismaOwnershipGuardRepository.cartBelongsToUser', { userId, cartId })
    return (await this.prisma.cart.count({ where: { id: cartId, userId } })) === 1
  }

  async orderBelongsToUser(userId: string, orderId: string): Promise<boolean> {
    this.logger.debug('PrismaOwnershipGuardRepository.orderBelongsToUser', { userId, orderId })
    return (await this.prisma.order.count({ where: { id: orderId, userId } })) === 1
  }

  async shopBelongsToSeller(userId: string, shopId: string): Promise<boolean> {
    return this.activeShopBelongsToUser(userId, shopId)
  }

  async activeShopBelongsToUser(userId: string, shopId: string): Promise<boolean> {
    this.logger.debug('PrismaOwnershipGuardRepository.activeShopBelongsToUser', { userId, shopId })
    return (await this.prisma.shop.count({ where: { id: shopId, ownerId: userId, status: 'ACTIVE' } })) === 1
  }

  async productBelongsToSeller(userId: string, productId: string): Promise<boolean> {
    return this.productBelongsToActiveShop(userId, productId)
  }

  async productBelongsToActiveShop(userId: string, productId: string): Promise<boolean> {
    this.logger.debug('PrismaOwnershipGuardRepository.productBelongsToActiveShop', { userId, productId })
    return (await this.prisma.product.count({
      where: {
        id: productId,
        shop: { ownerId: userId, status: 'ACTIVE' },
      },
    })) === 1
  }

  async shipmentBelongsToSeller(userId: string, shipmentId: string): Promise<boolean> {
    return this.shipmentBelongsToActiveShop(userId, shipmentId)
  }

  async shipmentBelongsToActiveShop(userId: string, shipmentId: string): Promise<boolean> {
    this.logger.debug('PrismaOwnershipGuardRepository.shipmentBelongsToActiveShop', { userId, shipmentId })
    return (await this.prisma.shipment.count({
      where: {
        id: shipmentId,
        shop: { ownerId: userId, status: 'ACTIVE' },
      },
    })) === 1
  }

  findActiveShopsForUser(userId: string): Promise<Array<Pick<Shop, 'id' | 'ownerId' | 'status'>>> {
    this.logger.debug('PrismaOwnershipGuardRepository.findActiveShopsForUser', { userId })
    return this.prisma.shop.findMany({
      where: { ownerId: userId, status: 'ACTIVE' },
      select: { id: true, ownerId: true, status: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  findActiveShopForUser(userId: string, shopId: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null> {
    this.logger.debug('PrismaOwnershipGuardRepository.findActiveShopForUser', { userId, shopId })
    return this.prisma.shop.findFirst({
      where: { id: shopId, ownerId: userId, status: 'ACTIVE' },
      select: { id: true, ownerId: true, status: true },
    })
  }
}
