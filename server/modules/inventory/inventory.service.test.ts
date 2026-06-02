import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { InventoryServiceError } from './inventory.errors.ts'
import type { IInventoryRepository } from './inventory.repository.ts'
import { InventoryService } from './inventory.service.ts'

const now = new Date('2026-01-01T00:00:00.000Z')

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createInventory(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'inventory-1',
    variantId: 'variant-1',
    quantityOnHand: 10,
    quantityReserved: 2,
    reorderLevel: 1,
    version: 1,
    updatedAt: now,
    variant: {
      id: 'variant-1',
      productId: 'product-1',
      sku: 'SKU-1',
      title: 'Variant One',
      product: {
        id: 'product-1',
        shopId: 'shop-1',
        title: 'Product One',
        slug: 'product-one',
      },
    },
    ...overrides,
  }
}

function createReservation(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'reservation-1',
    checkoutId: 'checkout-1',
    orderId: null,
    inventoryId: 'inventory-1',
    quantity: 3,
    status: 'ACTIVE',
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createVariant(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'variant-1',
    productId: 'product-1',
    sku: 'SKU-1',
    title: 'Variant One',
    product: {
      id: 'product-1',
      shopId: 'shop-1',
      title: 'Product One',
      slug: 'product-one',
    },
    inventory: createInventory(),
    ...overrides,
  }
}

function createRepo(): IInventoryRepository {
  return {
    transaction: vi.fn((fn) => fn({} as any)),
    listSellerInventory: vi.fn(),
    findVariantForSeller: vi.fn(),
    findInventoryByVariantId: vi.fn(),
    findInventoryById: vi.fn(),
    ensureInventory: vi.fn(),
    updateInventory: vi.fn(),
    createMovement: vi.fn(),
    createReservation: vi.fn(),
    findReservationById: vi.fn(),
    updateReservation: vi.fn(),
    listMovementsByVariantId: vi.fn(),
  }
}

function createActiveShopResolver() {
  return {
    resolveActiveShops: vi.fn().mockResolvedValue([{ id: 'shop-1', ownerId: 'seller-1', status: 'ACTIVE' }]),
    requireActiveShop: vi.fn().mockResolvedValue({ id: 'shop-1', ownerId: 'seller-1', status: 'ACTIVE' }),
  } as any
}

function createActor() {
  return { id: 'seller-1', role: 'USER' }
}

let repo: IInventoryRepository
let activeShopResolver: ReturnType<typeof createActiveShopResolver>
let service: InventoryService

function setup() {
  repo = createRepo()
  activeShopResolver = createActiveShopResolver()
  service = new InventoryService(createAppContext(), repo, activeShopResolver)
  vi.mocked(repo.ensureInventory).mockResolvedValue(createInventory())
  vi.mocked(repo.findInventoryByVariantId).mockResolvedValue(createInventory())
  vi.mocked(repo.findInventoryById).mockResolvedValue(createInventory())
  vi.mocked(repo.updateInventory).mockImplementation(async (_id, data: any) => createInventory({
    quantityOnHand: typeof data.quantityOnHand === 'number'
      ? data.quantityOnHand
      : data.quantityOnHand?.decrement
        ? 7
        : data.quantityOnHand?.increment
          ? 13
          : 10,
    quantityReserved: data.quantityReserved?.increment
      ? 5
      : data.quantityReserved?.decrement
        ? 0
        : 2,
  }))
  vi.mocked(repo.createReservation).mockResolvedValue(createReservation())
  vi.mocked(repo.findReservationById).mockResolvedValue(createReservation())
  vi.mocked(repo.updateReservation).mockImplementation(async (_id, data: any) => createReservation({ status: data.status }))
  vi.mocked(repo.findVariantForSeller).mockResolvedValue(createVariant())
}

describe('InventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('prevents overselling without mutation side effects', async () => {
    vi.mocked(repo.ensureInventory).mockResolvedValue(createInventory({ quantityOnHand: 2, quantityReserved: 1 }))

    await expect(service.reserveStock({
      variantId: 'variant-1',
      quantity: 2,
      checkoutId: 'checkout-1',
      expiresAt: now,
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })

    expect(repo.updateInventory).not.toHaveBeenCalled()
    expect(repo.createReservation).not.toHaveBeenCalled()
    expect(repo.createMovement).not.toHaveBeenCalled()
  })

  it('writes adjustment movement in the same transaction', async () => {
    await service.adjustStock({
      variantId: 'variant-1',
      quantityDelta: 4,
      actorUserId: 'seller-1',
      reason: 'cycle count',
    })

    expect(repo.transaction).toHaveBeenCalledOnce()
    expect(repo.updateInventory).toHaveBeenCalledWith('inventory-1', { quantityOnHand: 14 }, expect.anything())
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADJUSTMENT',
      quantityDelta: 4,
      reason: 'cycle count',
      actorUserId: 'seller-1',
    }), expect.anything())
  })

  it('creates, releases, commits, and expires reservations with ledger rows', async () => {
    vi.mocked(repo.findInventoryById).mockResolvedValue(createInventory({ quantityReserved: 3 }))

    await service.reserveStock({
      variantId: 'variant-1',
      quantity: 3,
      checkoutId: 'checkout-1',
      expiresAt: now,
      reason: 'checkout',
    })
    await service.releaseReservation({ reservationId: 'reservation-1', reason: 'buyer cancelled' })
    await service.commitReservation({ reservationId: 'reservation-1', reason: 'paid' })
    await service.expireReservation({ reservationId: 'reservation-1', reason: 'timeout' })

    expect(repo.createReservation).toHaveBeenCalledWith(expect.objectContaining({
      checkoutId: 'checkout-1',
      inventoryId: 'inventory-1',
      quantity: 3,
    }), expect.anything())
    expect(repo.updateReservation).toHaveBeenCalledWith('reservation-1', { status: 'RELEASED' }, expect.anything())
    expect(repo.updateReservation).toHaveBeenCalledWith('reservation-1', { status: 'COMMITTED' }, expect.anything())
    expect(repo.updateReservation).toHaveBeenCalledWith('reservation-1', { status: 'EXPIRED' }, expect.anything())
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESERVATION_CREATED' }), expect.anything())
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESERVATION_RELEASED' }), expect.anything())
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({ type: 'RESERVATION_COMMITTED' }), expect.anything())
  })

  it('enforces seller ownership for seller inventory reads', async () => {
    activeShopResolver.requireActiveShop.mockRejectedValue(new InventoryServiceError('forbidden', 403, 'SELLER_SHOP_NOT_ACTIVE'))

    await expect(service.getSellerInventory(createActor(), 'variant-1')).rejects.toMatchObject({
      code: 'SELLER_SHOP_NOT_ACTIVE',
    })
  })

  it('does not allow sellers to set reserved quantity directly', async () => {
    await service.updateSellerInventory(createActor(), 'variant-1', {
      quantityOnHand: 12,
      reason: 'seller count',
    } as any)

    expect(repo.updateInventory).toHaveBeenCalledWith('inventory-1', {
      quantityOnHand: 12,
    }, expect.anything())
    expect(JSON.stringify(vi.mocked(repo.updateInventory).mock.calls[0]?.[1])).not.toContain('quantityReserved')
  })

  it('restocks returns without changing reserved quantity', async () => {
    await service.restockReturn({
      variantId: 'variant-1',
      quantity: 2,
      reason: 'return accepted',
    })

    expect(repo.updateInventory).toHaveBeenCalledWith('inventory-1', {
      quantityOnHand: { increment: 2 },
    }, expect.anything())
    expect(repo.createMovement).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RETURN_RESTOCK',
      quantityDelta: 2,
    }), expect.anything())
  })
})
