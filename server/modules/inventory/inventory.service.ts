import type {
  Inventory,
  InventoryMovement,
  InventoryMovementType,
  InventoryReservation,
  Prisma,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { InventoryServiceError } from './inventory.errors.ts'
import type {
  IInventoryRepository,
  InventoryMutationContext,
  InventoryTx,
  SellerInventoryRecord,
} from './inventory.repository.ts'

export interface InventoryActor {
  id: string
  role?: string
}

export interface SellerInventoryUpdateData {
  quantityOnHand?: number
  reorderLevel?: number
  reason?: string
}

export interface InventoryAdjustmentInput extends InventoryMutationContext {
  variantId: string
  quantityDelta: number
}

export interface InventoryReservationInput extends InventoryMutationContext {
  variantId: string
  quantity: number
  checkoutId: string
  orderId?: string | null
  expiresAt: Date
}

export interface InventoryReservationMutationInput extends InventoryMutationContext {
  reservationId: string
}

export interface InventoryReturnInput extends InventoryMutationContext {
  variantId: string
  quantity: number
}

export interface InventoryResponse {
  id: string
  variantId: string
  productId: string
  shopId: string
  sku: string
  variantTitle: string
  productTitle: string
  quantityOnHand: number
  quantityReserved: number
  availableStock: number
  reorderLevel: number
  updatedAt: Date
}

export class InventoryService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IInventoryRepository,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async listSellerInventory(actor: InventoryActor): Promise<InventoryResponse[]> {
    this.logger.debug('InventoryService.listSellerInventory', { actorId: actor.id })
    const shops = await this.resolveSellerShops(actor)
    return (await this.repo.listSellerInventory(shops.map((shop) => shop.id))).map((inventory) => this.toResponse(inventory))
  }

  async getSellerInventory(actor: InventoryActor, variantId: string): Promise<InventoryResponse> {
    this.logger.debug('InventoryService.getSellerInventory', { actorId: actor.id, variantId })
    await this.requireSellerVariantAccess(actor, variantId)
    await this.repo.ensureInventory(variantId)
    const inventory = await this.repo.findInventoryByVariantId(variantId)
    if (!inventory) throw new InventoryServiceError('Inventory not found', 404, 'INVENTORY_NOT_FOUND')
    return this.toResponse(inventory)
  }

  async updateSellerInventory(actor: InventoryActor, variantId: string, data: SellerInventoryUpdateData): Promise<InventoryResponse> {
    this.logger.info('InventoryService.updateSellerInventory', { actorId: actor.id, variantId })
    const update = this.normalizeSellerUpdate(data)
    await this.requireSellerVariantAccess(actor, variantId)
    const inventory = await this.repo.transaction(async (tx) => {
      const current = await this.repo.ensureInventory(variantId, tx)
      const quantityDelta = data.quantityOnHand === undefined ? 0 : data.quantityOnHand - current.quantityOnHand
      const updated = await this.repo.updateInventory(current.id, update, tx)
      await this.createMovement(current, updated, 'ADJUSTMENT', quantityDelta, {
        actorUserId: actor.id,
        reason: data.reason!.trim(),
        referenceType: 'SELLER_INVENTORY_UPDATE',
        referenceId: variantId,
      }, tx)
      return updated
    })
    const hydrated = await this.repo.findInventoryByVariantId(inventory.variantId)
    if (!hydrated) throw new InventoryServiceError('Inventory not found', 404, 'INVENTORY_NOT_FOUND')
    return this.toResponse(hydrated)
  }

  async listSellerMovements(actor: InventoryActor, variantId: string, limit = 50): Promise<InventoryMovement[]> {
    this.logger.debug('InventoryService.listSellerMovements', { actorId: actor.id, variantId })
    await this.requireSellerVariantAccess(actor, variantId)
    return this.repo.listMovementsByVariantId(variantId, Math.min(Math.max(limit, 1), 100))
  }

  adjustStock(input: InventoryAdjustmentInput): Promise<Inventory> {
    this.validatePositiveOrNegativeQuantity(input.quantityDelta, 'Quantity delta')
    return this.repo.transaction(async (tx) => {
      const current = await this.repo.ensureInventory(input.variantId, tx)
      const nextOnHand = current.quantityOnHand + input.quantityDelta
      if (nextOnHand < current.quantityReserved) {
        throw new InventoryServiceError('On-hand quantity cannot be lower than reserved quantity', 409, 'INSUFFICIENT_STOCK')
      }
      const updated = await this.repo.updateInventory(current.id, { quantityOnHand: nextOnHand }, tx)
      await this.createMovement(current, updated, 'ADJUSTMENT', input.quantityDelta, input, tx)
      return updated
    })
  }

  reserveStock(input: InventoryReservationInput): Promise<InventoryReservation> {
    this.validatePositiveQuantity(input.quantity, 'Reservation quantity')
    return this.repo.transaction(async (tx) => {
      const current = await this.repo.ensureInventory(input.variantId, tx)
      if (this.availableStock(current) < input.quantity) {
        throw new InventoryServiceError('Requested quantity exceeds available stock', 409, 'INSUFFICIENT_STOCK', {
          variantId: input.variantId,
          availableQuantity: this.availableStock(current),
        })
      }
      const updated = await this.repo.updateInventory(current.id, {
        quantityReserved: { increment: input.quantity },
      }, tx)
      const reservation = await this.repo.createReservation({
        checkoutId: input.checkoutId,
        orderId: input.orderId,
        inventoryId: current.id,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
      }, tx)
      await this.createMovement(current, updated, 'RESERVATION_CREATED', input.quantity, {
        ...input,
        referenceType: input.referenceType ?? 'CHECKOUT',
        referenceId: input.referenceId ?? input.checkoutId,
      }, tx)
      return reservation
    })
  }

  releaseReservation(input: InventoryReservationMutationInput): Promise<InventoryReservation> {
    return this.closeReservation(input, 'RELEASED', 'RESERVATION_RELEASED')
  }

  expireReservation(input: InventoryReservationMutationInput): Promise<InventoryReservation> {
    return this.closeReservation(input, 'EXPIRED', 'RESERVATION_RELEASED')
  }

  commitReservation(input: InventoryReservationMutationInput): Promise<InventoryReservation> {
    return this.repo.transaction(async (tx) => {
      const reservation = await this.getActiveReservation(input.reservationId, tx)
      const current = await this.getInventoryForReservation(reservation, tx)
      if (current.quantityReserved < reservation.quantity || current.quantityOnHand < reservation.quantity) {
        throw new InventoryServiceError('Reservation cannot be committed against current stock', 409, 'INSUFFICIENT_STOCK')
      }
      const updated = await this.repo.updateInventory(current.id, {
        quantityOnHand: { decrement: reservation.quantity },
        quantityReserved: { decrement: reservation.quantity },
      }, tx)
      const closed = await this.repo.updateReservation(reservation.id, { status: 'COMMITTED' }, tx)
      await this.createMovement(current, updated, 'RESERVATION_COMMITTED', -reservation.quantity, {
        ...input,
        referenceType: input.referenceType ?? 'INVENTORY_RESERVATION',
        referenceId: input.referenceId ?? reservation.id,
      }, tx)
      return closed
    })
  }

  restockReturn(input: InventoryReturnInput): Promise<Inventory> {
    this.validatePositiveQuantity(input.quantity, 'Return quantity')
    return this.repo.transaction(async (tx) => {
      const current = await this.repo.ensureInventory(input.variantId, tx)
      const updated = await this.repo.updateInventory(current.id, { quantityOnHand: { increment: input.quantity } }, tx)
      await this.createMovement(current, updated, 'RETURN_RESTOCK', input.quantity, input, tx)
      return updated
    })
  }

  private async closeReservation(
    input: InventoryReservationMutationInput,
    status: 'RELEASED' | 'EXPIRED',
    movementType: InventoryMovementType,
  ): Promise<InventoryReservation> {
    return this.repo.transaction(async (tx) => {
      const reservation = await this.getActiveReservation(input.reservationId, tx)
      const current = await this.getInventoryForReservation(reservation, tx)
      if (current.quantityReserved < reservation.quantity) {
        throw new InventoryServiceError('Reserved quantity cannot become negative', 409, 'INVENTORY_UNDERFLOW')
      }
      const updated = await this.repo.updateInventory(current.id, {
        quantityReserved: { decrement: reservation.quantity },
      }, tx)
      const closed = await this.repo.updateReservation(reservation.id, { status }, tx)
      await this.createMovement(current, updated, movementType, -reservation.quantity, {
        ...input,
        referenceType: input.referenceType ?? 'INVENTORY_RESERVATION',
        referenceId: input.referenceId ?? reservation.id,
      }, tx)
      return closed
    })
  }

  private async getActiveReservation(reservationId: string, tx: InventoryTx): Promise<InventoryReservation> {
    const reservation = await this.repo.findReservationById(reservationId, tx)
    if (!reservation) throw new InventoryServiceError('Reservation not found', 404, 'RESERVATION_NOT_FOUND')
    if (reservation.status !== 'ACTIVE') {
      throw new InventoryServiceError('Reservation is not active', 409, 'RESERVATION_NOT_ACTIVE')
    }
    return reservation
  }

  private async getInventoryForReservation(reservation: InventoryReservation, tx: InventoryTx): Promise<SellerInventoryRecord> {
    const current = await this.repo.findInventoryById(reservation.inventoryId, tx)
    if (!current) throw new InventoryServiceError('Inventory not found', 404, 'INVENTORY_NOT_FOUND')
    return current
  }

  private async requireSellerVariantAccess(actor: InventoryActor, variantId: string): Promise<void> {
    const variant = await this.repo.findVariantForSeller(variantId)
    if (!variant) throw new InventoryServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    if (this.activeShopResolver) {
      await this.activeShopResolver.requireActiveShop(actor.id, variant.product.shopId)
      return
    }
    throw new InventoryServiceError('Seller shop access required', 403, 'SELLER_SHOP_NOT_ACTIVE')
  }

  private async resolveSellerShops(actor: InventoryActor) {
    if (!this.activeShopResolver) throw new InventoryServiceError('Seller shop access required', 403, 'SELLER_SHOP_NOT_ACTIVE')
    const shops = await this.activeShopResolver.resolveActiveShops(actor.id)
    if (shops.length === 0) throw new InventoryServiceError('Active seller shop not found', 403, 'SELLER_SHOP_NOT_ACTIVE')
    return shops
  }

  private normalizeSellerUpdate(data: SellerInventoryUpdateData): Prisma.InventoryUpdateInput {
    if (data.quantityOnHand === undefined && data.reorderLevel === undefined) {
      throw new InventoryServiceError('At least one inventory field is required', 400, 'INVENTORY_VALIDATION_FAILED')
    }
    if (!data.reason?.trim()) {
      throw new InventoryServiceError('Inventory adjustment reason is required', 400, 'INVENTORY_REASON_REQUIRED')
    }
    const update: Prisma.InventoryUpdateInput = {}
    if (data.quantityOnHand !== undefined) {
      this.validateNonNegativeInteger(data.quantityOnHand, 'Quantity on hand')
      update.quantityOnHand = data.quantityOnHand
    }
    if (data.reorderLevel !== undefined) {
      this.validateNonNegativeInteger(data.reorderLevel, 'Reorder level')
      update.reorderLevel = data.reorderLevel
    }
    return update
  }

  private async createMovement(
    before: Pick<Inventory, 'id' | 'variantId' | 'quantityOnHand' | 'quantityReserved'>,
    after: Pick<Inventory, 'quantityOnHand' | 'quantityReserved'>,
    type: InventoryMovementType,
    quantityDelta: number,
    context: InventoryMutationContext,
    tx: InventoryTx,
  ): Promise<void> {
    if (after.quantityOnHand < 0 || after.quantityReserved < 0) {
      throw new InventoryServiceError('Inventory quantity cannot become negative', 409, 'INVENTORY_UNDERFLOW')
    }
    await this.repo.createMovement({
      inventory: before,
      updatedInventory: after,
      type,
      quantityDelta,
      actorUserId: context.actorUserId,
      reason: context.reason,
      referenceType: context.referenceType,
      referenceId: context.referenceId,
      metadata: context.metadata,
    }, tx)
  }

  private toResponse(inventory: SellerInventoryRecord): InventoryResponse {
    return {
      id: inventory.id,
      variantId: inventory.variantId,
      productId: inventory.variant.product.id,
      shopId: inventory.variant.product.shopId,
      sku: inventory.variant.sku,
      variantTitle: inventory.variant.title,
      productTitle: inventory.variant.product.title,
      quantityOnHand: inventory.quantityOnHand,
      quantityReserved: inventory.quantityReserved,
      availableStock: this.availableStock(inventory),
      reorderLevel: inventory.reorderLevel,
      updatedAt: inventory.updatedAt,
    }
  }

  private availableStock(inventory: Pick<Inventory, 'quantityOnHand' | 'quantityReserved'>): number {
    return inventory.quantityOnHand - inventory.quantityReserved
  }

  private validateNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new InventoryServiceError(`${label} must be a non-negative integer`, 400, 'INVENTORY_VALIDATION_FAILED')
    }
  }

  private validatePositiveQuantity(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new InventoryServiceError(`${label} must be a positive integer`, 400, 'INVENTORY_VALIDATION_FAILED')
    }
  }

  private validatePositiveOrNegativeQuantity(value: number, label: string): void {
    if (!Number.isInteger(value) || value === 0) {
      throw new InventoryServiceError(`${label} must be a non-zero integer`, 400, 'INVENTORY_VALIDATION_FAILED')
    }
  }
}
