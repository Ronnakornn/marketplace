import { Prisma } from '#generated/client/client.ts'
import type {
  Inventory,
  InventoryMovement,
  InventoryMovementType,
  InventoryReservation,
  PrismaClient,
  Product,
  ProductVariant,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type InventoryTx = Prisma.TransactionClient

export interface InventoryMutationContext {
  actorUserId?: string | null
  reason?: string | null
  referenceType?: string | null
  referenceId?: string | null
  metadata?: Prisma.InputJsonValue
}

export interface CreateMovementInput extends InventoryMutationContext {
  inventory: Pick<Inventory, 'id' | 'variantId' | 'quantityOnHand' | 'quantityReserved'>
  updatedInventory: Pick<Inventory, 'quantityOnHand' | 'quantityReserved'>
  type: InventoryMovementType
  quantityDelta: number
}

export type InventoryVariantRecord = ProductVariant & {
  product: Pick<Product, 'id' | 'shopId' | 'title' | 'slug'>
  inventory: Inventory | null
}

export type SellerInventoryRecord = Inventory & {
  variant: ProductVariant & {
    product: Pick<Product, 'id' | 'shopId' | 'title' | 'slug'>
  }
}

export interface CreateReservationInput {
  checkoutId: string
  orderId?: string | null
  inventoryId: string
  quantity: number
  expiresAt: Date
}

export interface IInventoryRepository {
  transaction<T>(fn: (tx: InventoryTx) => Promise<T>): Promise<T>
  listSellerInventory(shopIds: string[]): Promise<SellerInventoryRecord[]>
  findVariantForSeller(variantId: string): Promise<InventoryVariantRecord | null>
  findInventoryByVariantId(variantId: string, tx?: InventoryTx): Promise<SellerInventoryRecord | null>
  findInventoryById(inventoryId: string, tx?: InventoryTx): Promise<SellerInventoryRecord | null>
  ensureInventory(variantId: string, tx?: InventoryTx): Promise<Inventory>
  updateInventory(
    inventoryId: string,
    data: Prisma.InventoryUpdateInput,
    tx?: InventoryTx,
  ): Promise<Inventory>
  createMovement(input: CreateMovementInput, tx?: InventoryTx): Promise<InventoryMovement>
  createReservation(input: CreateReservationInput, tx?: InventoryTx): Promise<InventoryReservation>
  findReservationById(reservationId: string, tx?: InventoryTx): Promise<InventoryReservation | null>
  updateReservation(
    reservationId: string,
    data: Prisma.InventoryReservationUpdateInput,
    tx?: InventoryTx,
  ): Promise<InventoryReservation>
  listMovementsByVariantId(variantId: string, limit: number): Promise<InventoryMovement[]>
}

const sellerInventoryInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true,
          shopId: true,
          title: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.InventoryInclude

export class PrismaInventoryRepository implements IInventoryRepository {
  private logger: ILogger

  constructor(appContext: AppContext, private prisma: PrismaClient) {
    this.logger = appContext.logger
  }

  transaction<T>(fn: (tx: InventoryTx) => Promise<T>): Promise<T> {
    this.logger.debug('PrismaInventoryRepository.transaction')
    return this.prisma.$transaction(fn)
  }

  listSellerInventory(shopIds: string[]): Promise<SellerInventoryRecord[]> {
    this.logger.debug('PrismaInventoryRepository.listSellerInventory', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.inventory.findMany({
      where: {
        variant: {
          product: {
            shopId: { in: shopIds },
          },
        },
      },
      include: sellerInventoryInclude,
      orderBy: { updatedAt: 'desc' },
    })
  }

  findVariantForSeller(variantId: string): Promise<InventoryVariantRecord | null> {
    this.logger.debug('PrismaInventoryRepository.findVariantForSeller', { variantId })
    return this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            shopId: true,
            title: true,
            slug: true,
          },
        },
        inventory: true,
      },
    })
  }

  findInventoryByVariantId(variantId: string, tx?: InventoryTx): Promise<SellerInventoryRecord | null> {
    this.logger.debug('PrismaInventoryRepository.findInventoryByVariantId', { variantId })
    return (tx ?? this.prisma).inventory.findUnique({
      where: { variantId },
      include: sellerInventoryInclude,
    })
  }

  findInventoryById(inventoryId: string, tx?: InventoryTx): Promise<SellerInventoryRecord | null> {
    this.logger.debug('PrismaInventoryRepository.findInventoryById', { inventoryId })
    return (tx ?? this.prisma).inventory.findUnique({
      where: { id: inventoryId },
      include: sellerInventoryInclude,
    })
  }

  ensureInventory(variantId: string, tx?: InventoryTx): Promise<Inventory> {
    this.logger.info('PrismaInventoryRepository.ensureInventory', { variantId })
    return (tx ?? this.prisma).inventory.upsert({
      where: { variantId },
      create: { variantId },
      update: {},
    })
  }

  updateInventory(inventoryId: string, data: Prisma.InventoryUpdateInput, tx?: InventoryTx): Promise<Inventory> {
    this.logger.info('PrismaInventoryRepository.updateInventory', { inventoryId })
    return (tx ?? this.prisma).inventory.update({
      where: { id: inventoryId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    })
  }

  createMovement(input: CreateMovementInput, tx?: InventoryTx): Promise<InventoryMovement> {
    this.logger.info('PrismaInventoryRepository.createMovement', {
      inventoryId: input.inventory.id,
      type: input.type,
      quantityDelta: input.quantityDelta,
    })
    return (tx ?? this.prisma).inventoryMovement.create({
      data: {
        inventoryId: input.inventory.id,
        variantId: input.inventory.variantId,
        type: input.type,
        quantityDelta: input.quantityDelta,
        quantityOnHandBefore: input.inventory.quantityOnHand,
        quantityOnHandAfter: input.updatedInventory.quantityOnHand,
        quantityReservedBefore: input.inventory.quantityReserved,
        quantityReservedAfter: input.updatedInventory.quantityReserved,
        actorUserId: input.actorUserId ?? null,
        reason: input.reason ?? null,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    })
  }

  createReservation(input: CreateReservationInput, tx?: InventoryTx): Promise<InventoryReservation> {
    this.logger.info('PrismaInventoryRepository.createReservation', { inventoryId: input.inventoryId })
    return (tx ?? this.prisma).inventoryReservation.create({
      data: {
        checkoutId: input.checkoutId,
        orderId: input.orderId ?? null,
        inventoryId: input.inventoryId,
        quantity: input.quantity,
        status: 'ACTIVE',
        expiresAt: input.expiresAt,
      },
    })
  }

  findReservationById(reservationId: string, tx?: InventoryTx): Promise<InventoryReservation | null> {
    this.logger.debug('PrismaInventoryRepository.findReservationById', { reservationId })
    return (tx ?? this.prisma).inventoryReservation.findUnique({ where: { id: reservationId } })
  }

  updateReservation(
    reservationId: string,
    data: Prisma.InventoryReservationUpdateInput,
    tx?: InventoryTx,
  ): Promise<InventoryReservation> {
    this.logger.info('PrismaInventoryRepository.updateReservation', { reservationId })
    return (tx ?? this.prisma).inventoryReservation.update({
      where: { id: reservationId },
      data,
    })
  }

  listMovementsByVariantId(variantId: string, limit: number): Promise<InventoryMovement[]> {
    this.logger.debug('PrismaInventoryRepository.listMovementsByVariantId', { variantId, limit })
    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
}
