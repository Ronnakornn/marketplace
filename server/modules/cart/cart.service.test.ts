import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import type { ICartRepository } from './cart.repository.ts'
import { CartService } from './cart.service.ts'

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

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): ICartRepository {
  return {
    findActiveCartByUserId: vi.fn(),
    findOrCreateActiveCart: vi.fn(),
    findItemByIdForUser: vi.fn(),
    findVariantForCart: vi.fn(),
    createItem: vi.fn(),
    updateItemQuantity: vi.fn(),
    deleteItem: vi.fn(),
    clearActiveCart: vi.fn(),
  }
}

function createActor(role: Role = 'USER') {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
  }
}

function createVariant(overrides: Partial<{
  id: string
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  shopId: string
  shopStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  quantityOnHand: number
  quantityReserved: number
  priceCents: number
}> = {}) {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const shopId = overrides.shopId ?? '11111111-1111-4111-8111-111111111111'

  return {
    id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
    productId: '22222222-2222-4222-8222-222222222222',
    sku: 'TSHIRT-BLK-M',
    title: 'Black / M',
    priceCents: overrides.priceCents ?? 1590,
    currency: 'USD',
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
    inventory: {
      id: '44444444-4444-4444-8444-444444444444',
      variantId: overrides.id ?? '33333333-3333-4333-8333-333333333333',
      quantityOnHand: overrides.quantityOnHand ?? 10,
      quantityReserved: overrides.quantityReserved ?? 2,
      reorderLevel: 0,
      updatedAt: now,
    },
    product: {
      id: '22222222-2222-4222-8222-222222222222',
      shopId,
      title: 'Oversized Cotton Tee',
      slug: 'oversized-cotton-tee',
      description: null,
      status: overrides.productStatus ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      shop: {
        id: shopId,
        name: 'Everyday Studio',
        slug: 'everyday-studio',
        status: overrides.shopStatus ?? 'ACTIVE',
      },
    },
  }
}

function createCart(overrides: Partial<{
  id: string
  userId: string
  items: any[]
}> = {}) {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: overrides.id ?? '55555555-5555-4555-8555-555555555555',
    userId: overrides.userId ?? 'user-1',
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
    items: overrides.items ?? [],
  }
}

function createItem(overrides: Partial<{
  id: string
  quantity: number
  unitPriceCents: number
  variant: ReturnType<typeof createVariant>
}> = {}) {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const variant = overrides.variant ?? createVariant()
  return {
    id: overrides.id ?? '66666666-6666-4666-8666-666666666666',
    cartId: '55555555-5555-4555-8555-555555555555',
    variantId: variant.id,
    quantity: overrides.quantity ?? 2,
    unitPriceCents: overrides.unitPriceCents ?? 1490,
    currency: 'USD',
    createdAt: now,
    updatedAt: now,
    variant,
  }
}

describe('CartService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a cart grouped by shop with captured unit prices and subtotal', async () => {
    const repo = createRepoMock()
    const item = createItem({ quantity: 2, unitPriceCents: 1490 })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart({ items: [item] }))
    const service = new CartService(createAppContext(), repo)

    await expect(service.getCart(createActor())).resolves.toMatchObject({
      id: '55555555-5555-4555-8555-555555555555',
      subtotalCents: 2980,
      shops: [
        {
          shop: { id: '11111111-1111-4111-8111-111111111111' },
          subtotalCents: 2980,
          items: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              quantity: 2,
              unitPriceCents: 1490,
              lineTotalCents: 2980,
              availableQuantity: 8,
            },
          ],
        },
      ],
    })
  })

  it('adds an active variant and captures current unit price', async () => {
    const repo = createRepoMock()
    const cart = createCart()
    const variant = createVariant({ priceCents: 1590 })
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 1, unitPriceCents: 1590, variant })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    vi.mocked(repo.createItem).mockResolvedValue(createItem({ quantity: 1, unitPriceCents: 1590, variant }))
    const service = new CartService(createAppContext(), repo)

    await service.addItem(createActor(), { variantId: variant.id, quantity: 1 })

    expect(repo.createItem).toHaveBeenCalledWith({
      cartId: cart.id,
      variantId: variant.id,
      quantity: 1,
      unitPriceCents: 1590,
      currency: 'USD',
    })
  })

  it('increases quantity when the variant already exists in cart', async () => {
    const repo = createRepoMock()
    const existingItem = createItem({ quantity: 2 })
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(createCart({ items: [existingItem] }))
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 5 })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(existingItem.variant)
    vi.mocked(repo.updateItemQuantity).mockResolvedValue(createItem({ quantity: 5 }))
    const service = new CartService(createAppContext(), repo)

    await service.addItem(createActor(), { variantId: existingItem.variantId, quantity: 3 })

    expect(repo.updateItemQuantity).toHaveBeenCalledWith(existingItem.id, 5)
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('rejects seller and admin access to buyer cart APIs', async () => {
    const service = new CartService(createAppContext(), createRepoMock())

    await expect(service.getCart(createActor('SELLER'))).rejects.toMatchObject({
      status: 403,
      code: 'CART_FORBIDDEN',
    })
    await expect(service.getCart(createActor('ADMIN'))).rejects.toMatchObject({
      status: 403,
      code: 'CART_FORBIDDEN',
    })
  })

  it('rejects non-positive quantities', async () => {
    const service = new CartService(createAppContext(), createRepoMock())

    await expect(service.addItem(createActor(), {
      variantId: '33333333-3333-4333-8333-333333333333',
      quantity: 0,
    })).rejects.toMatchObject({
      status: 400,
      code: 'CART_QUANTITY_INVALID',
    })
  })

  it('rejects inactive products', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(createVariant({ productStatus: 'DRAFT' }))
    const service = new CartService(createAppContext(), repo)

    await expect(service.addItem(createActor(), {
      variantId: '33333333-3333-4333-8333-333333333333',
      quantity: 1,
    })).rejects.toMatchObject({
      status: 400,
      code: 'PRODUCT_UNAVAILABLE',
    })
  })

  it('validates available stock before add and update', async () => {
    const repo = createRepoMock()
    const variant = createVariant({ quantityOnHand: 3, quantityReserved: 1 })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    const service = new CartService(createAppContext(), repo)

    await expect(service.addItem(createActor(), {
      variantId: variant.id,
      quantity: 3,
    })).rejects.toMatchObject({
      status: 409,
      code: 'CART_STOCK_UNAVAILABLE',
      details: { availableQuantity: 2 },
    })
  })

  it('updates and deletes only items in the buyer active cart', async () => {
    const repo = createRepoMock()
    const item = createItem()
    vi.mocked(repo.findItemByIdForUser).mockResolvedValue(item)
    vi.mocked(repo.updateItemQuantity).mockResolvedValue(createItem({ quantity: 3 }))
    vi.mocked(repo.deleteItem).mockResolvedValue(item)
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    const service = new CartService(createAppContext(), repo)

    await service.updateItem(createActor(), item.id, { quantity: 3 })
    await service.deleteItem(createActor(), item.id)

    expect(repo.findItemByIdForUser).toHaveBeenCalledWith(item.id, 'user-1')
    expect(repo.updateItemQuantity).toHaveBeenCalledWith(item.id, 3)
    expect(repo.deleteItem).toHaveBeenCalledWith(item.id)
  })
})
