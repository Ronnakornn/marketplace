import { toMoneyDto } from '#server/lib/money.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import type { TrackingService } from '#server/modules/tracking'
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
  const repo: ICartRepository = {
    withLockedActiveCart: vi.fn(async (userId, callback) => callback(await repo.findOrCreateActiveCart(userId), repo)),
    findActiveCartByUserId: vi.fn(),
    findOrCreateActiveCart: vi.fn(),
    findItemByIdForUser: vi.fn(),
    findVariantForCart: vi.fn(),
    findVariantsForCart: vi.fn(),
    findOwnedOrderItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    clearActiveCart: vi.fn(),
  }
  return repo
}

function createTrackingServiceMock(): Pick<TrackingService, 'recordProductAddToCart'> {
  return {
    recordProductAddToCart: vi.fn().mockResolvedValue({ ok: true }),
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
  price: number | bigint
  variantStatus: 'ACTIVE' | 'INACTIVE'
  currency: string
}> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const shopId = overrides.shopId ?? '11111111-1111-4111-8111-111111111111'

  return {
    id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
    productId: '22222222-2222-4222-8222-222222222222',
    sku: 'TSHIRT-BLK-M',
    title: 'Black / M',
    price: BigInt(overrides.price ?? 1590),
    currency: overrides.currency ?? 'USD',
    status: overrides.variantStatus ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    inventory: {
      id: '44444444-4444-4444-8444-444444444444',
      variantId: overrides.id ?? '33333333-3333-4333-8333-333333333333',
      quantityOnHand: overrides.quantityOnHand ?? 10,
      quantityReserved: overrides.quantityReserved ?? 2,
      reorderLevel: 0,
      version: 0,
      updatedAt: now,
    },
    product: {
      id: '22222222-2222-4222-8222-222222222222',
      shopId,
      categoryId: null,
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
}> = {}): any {
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
  unitPrice: number | bigint
  variant: ReturnType<typeof createVariant>
}> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const variant = overrides.variant ?? createVariant()
  return {
    id: overrides.id ?? '66666666-6666-4666-8666-666666666666',
    cartId: '55555555-5555-4555-8555-555555555555',
    variantId: variant.id,
    quantity: overrides.quantity ?? 2,
    unitPrice: BigInt(overrides.unitPrice ?? 1490),
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

  it('rejects a guest merge from a different authenticated account before touching its cart', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(createVariant())
    const service = new CartService(createAppContext(), repo)
    await expect(service.mergeGuestItem(createActor(), {
      userId: 'previous-account', variantId: 'variant', quantity: 20,
    })).rejects.toMatchObject({ code: 'CART_SESSION_CHANGED', status: 409 })
    expect(repo.withLockedActiveCart).not.toHaveBeenCalled()
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('partially merges a guest quantity under the cart lock using server price and reserved stock', async () => {
    const repo = createRepoMock()
    const variant = createVariant({ quantityOnHand: 8, quantityReserved: 2, price: 1750n })
    const item = createItem({ variant, quantity: 4 })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart({ items: [item] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    const service = new CartService(createAppContext(), repo)
    await expect(service.mergeGuestItem(createActor(), { userId: 'user-1', variantId: variant.id, quantity: 20 })).resolves.toEqual({ addedQuantity: 2 })
    expect(repo.withLockedActiveCart).toHaveBeenCalledWith('user-1', expect.any(Function))
    expect(repo.updateItem).toHaveBeenCalledWith(item.id, { quantity: 6, unitPrice: 1750n, currency: variant.currency })
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('leaves an existing cart quantity intact when stock is exhausted', async () => {
    const repo = createRepoMock()
    const variant = createVariant({ quantityOnHand: 2, quantityReserved: 2 })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart({ items: [createItem({ variant, quantity: 4 })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    await expect(new CartService(createAppContext(), repo).mergeGuestItem(createActor(), { userId: 'user-1', variantId: variant.id, quantity: 20 })).resolves.toEqual({ addedQuantity: 0 })
    expect(repo.updateItem).not.toHaveBeenCalled()
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('creates a guest merge line with only the available quantity', async () => {
    const repo = createRepoMock()
    const variant = createVariant()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    await expect(new CartService(createAppContext(), repo).mergeGuestItem(createActor(), { userId: 'user-1', variantId: variant.id, quantity: 20 })).resolves.toEqual({ addedQuantity: 8 })
    expect(repo.createItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 8, unitPrice: variant.price }))
  })

  it('rejects unavailable guest variants, invalid quantities and admin access without writes', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(createVariant({ variantStatus: 'INACTIVE' }))
    const service = new CartService(createAppContext(), repo)
    await expect(service.mergeGuestItem(createActor(), { userId: 'user-1', variantId: 'variant', quantity: 1 })).rejects.toMatchObject({ code: 'VARIANT_UNAVAILABLE' })
    await expect(service.mergeGuestItem(createActor(), { userId: 'user-1', variantId: 'variant', quantity: 0 })).rejects.toMatchObject({ code: 'CART_QUANTITY_INVALID' })
    await expect(service.mergeGuestItem(createActor('ADMIN'), { userId: 'admin-1', variantId: 'variant', quantity: 1 })).rejects.toMatchObject({ code: 'CART_FORBIDDEN' })
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('returns a cart grouped by shop with captured unit price and subtotal', async () => {
    const repo = createRepoMock()
    const item = createItem({ quantity: 2, unitPrice: 1490n })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart({ items: [item] }))
    const service = new CartService(createAppContext(), repo)

    await expect(service.getCart(createActor())).resolves.toMatchObject({
      id: '55555555-5555-4555-8555-555555555555',
      subtotal: 2980n,
      shops: [
        {
          shop: { id: '11111111-1111-4111-8111-111111111111' },
          subtotal: 2980n,
          items: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              quantity: 2,
              unitPrice: 1490n,
              lineTotal: 2980n,
              availableQuantity: 8,
            },
          ],
        },
      ],
    })
    const result = await service.getCart(createActor())
    expect(() => JSON.stringify(toMoneyDto(result))).not.toThrow()
  })

  it('adds an active variant and captures current unit price', async () => {
    const repo = createRepoMock()
    const cart = createCart()
    const variant = createVariant({ price: 1590n })
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 1, unitPrice: 1590n, variant })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    vi.mocked(repo.createItem).mockResolvedValue(createItem({ quantity: 1, unitPrice: 1590n, variant }))
    const service = new CartService(createAppContext(), repo)

    await service.addItem(createActor(), { variantId: variant.id, quantity: 1 })

    expect(repo.createItem).toHaveBeenCalledWith({
      cartId: cart.id,
      variantId: variant.id,
      quantity: 1,
      unitPrice: 1590n,
      currency: 'USD',
    })
    expect(repo.findOrCreateActiveCart).toHaveBeenCalledTimes(1)
  })

  it('records add-to-cart analytics after a successful add', async () => {
    const repo = createRepoMock()
    const trackingService = createTrackingServiceMock()
    const cart = createCart()
    const variant = createVariant({ price: 1590n })
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 2, unitPrice: 1590n, variant })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    vi.mocked(repo.createItem).mockResolvedValue(createItem({ quantity: 2, unitPrice: 1590n, variant }))
    const service = new CartService(createAppContext(), repo, trackingService as TrackingService)

    await service.addItem(createActor(), {
      variantId: variant.id,
      quantity: 2,
      sessionId: 'anon-session',
      source: 'product_detail',
    })

    expect(trackingService.recordProductAddToCart).toHaveBeenCalledWith({
      productId: variant.product.id,
      variantId: variant.id,
      shopId: variant.product.shop.id,
      userId: 'user-1',
      sessionId: 'anon-session',
      quantity: 2,
      source: 'product_detail',
    })
  })

  it('does not record add-to-cart analytics when cart add validation fails', async () => {
    const repo = createRepoMock()
    const trackingService = createTrackingServiceMock()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    vi.mocked(repo.findVariantForCart).mockResolvedValue(createVariant({ quantityOnHand: 1, quantityReserved: 0 }))
    const service = new CartService(createAppContext(), repo, trackingService as TrackingService)

    await expect(service.addItem(createActor(), {
      variantId: '33333333-3333-4333-8333-333333333333',
      quantity: 2,
    })).rejects.toMatchObject({ code: 'CART_STOCK_UNAVAILABLE' })

    expect(trackingService.recordProductAddToCart).not.toHaveBeenCalled()
  })

  it('keeps add-to-cart successful when analytics write fails', async () => {
    const repo = createRepoMock()
    const appContext = createAppContext()
    const trackingService = createTrackingServiceMock()
    vi.mocked(trackingService.recordProductAddToCart).mockRejectedValue(new Error('analytics unavailable'))
    const cart = createCart()
    const variant = createVariant()
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(cart)
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 1, variant })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    vi.mocked(repo.createItem).mockResolvedValue(createItem({ quantity: 1, variant }))
    const service = new CartService(appContext, repo, trackingService as TrackingService)

    await expect(service.addItem(createActor(), { variantId: variant.id, quantity: 1 })).resolves.toMatchObject({
      id: cart.id,
    })

    expect(appContext.logger.warn).toHaveBeenCalledWith('CartService.addItem analytics write failed', expect.objectContaining({
      actorId: 'user-1',
      productId: variant.product.id,
      variantId: variant.id,
      shopId: variant.product.shop.id,
      error: expect.any(Error),
    }))
  })

  it('increases quantity when the variant already exists in cart', async () => {
    const repo = createRepoMock()
    const existingItem = createItem({ quantity: 2 })
    vi.mocked(repo.findOrCreateActiveCart)
      .mockResolvedValueOnce(createCart({ items: [existingItem] }))
      .mockResolvedValueOnce(createCart({ items: [createItem({ quantity: 5 })] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(existingItem.variant)
    vi.mocked(repo.updateItem).mockResolvedValue(createItem({ quantity: 5, unitPrice: 1590n }))
    const service = new CartService(createAppContext(), repo)

    const result = await service.addItem(createActor(), { variantId: existingItem.variantId, quantity: 3 })

    expect(result.shops[0].items[0]).toMatchObject({ quantity: 5, unitPrice: 1590n, lineTotal: 7950n })
    expect(repo.updateItem).toHaveBeenCalledWith(existingItem.id, { quantity: 5, unitPrice: 1590n, currency: 'USD' })
    expect(repo.createItem).not.toHaveBeenCalled()
  })

  it('allows shop owners to use buyer cart APIs and rejects admins', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    const service = new CartService(createAppContext(), repo)

    await expect(service.getCart(createActor('USER'))).resolves.toMatchObject({ id: expect.any(String) })

    await expect(service.getCart(createActor('ADMIN'))).rejects.toMatchObject({
      status: 403,
      code: 'CART_FORBIDDEN',
    })
  })

  it('rejects admin access to buyer cart APIs', async () => {
    const service = new CartService(createAppContext(), createRepoMock())

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
    vi.mocked(repo.updateItem).mockResolvedValue(createItem({ quantity: 3 }))
    vi.mocked(repo.deleteItem).mockResolvedValue(item)
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart())
    const service = new CartService(createAppContext(), repo)

    await service.updateItem(createActor(), item.id, { quantity: 3 })
    await service.deleteItem(createActor(), item.id)

    expect(repo.findItemByIdForUser).toHaveBeenCalledWith(item.id, 'user-1')
    expect(repo.updateItem).toHaveBeenCalledWith(item.id, { quantity: 3, unitPrice: 1590n, currency: 'USD' })
    expect(repo.deleteItem).toHaveBeenCalledWith(item.id)
  })

  it('rejects inactive variants on add and quantity update', async () => {
    const repo = createRepoMock()
    const variant = createVariant({ variantStatus: 'INACTIVE' })
    const item = createItem({ variant })
    vi.mocked(repo.findOrCreateActiveCart).mockResolvedValue(createCart({ items: [item] }))
    vi.mocked(repo.findVariantForCart).mockResolvedValue(variant)
    vi.mocked(repo.findItemByIdForUser).mockResolvedValue(item)
    const service = new CartService(createAppContext(), repo)
    await expect(service.addItem(createActor(), { variantId: variant.id, quantity: 1 })).rejects.toMatchObject({ code: 'VARIANT_UNAVAILABLE' })
    await expect(service.updateItem(createActor(), item.id, { quantity: 3 })).rejects.toMatchObject({ code: 'VARIANT_UNAVAILABLE' })
  })
})

describe('CartService.buyAgain', () => {
  function fixture(items: Array<{ variantId: string; quantity: number }> = [{ variantId: 'variant-1', quantity: 3 }], existingItems: ReturnType<typeof createItem>[] = []) {
    const repo = createRepoMock()
    let cart = createCart({ items: existingItems })
    const variant = createVariant({ id: 'variant-1', currency: 'THB', price: 1990n })
    vi.mocked(repo.findOwnedOrderItems).mockResolvedValue({ items: items.map(item => ({ ...item, productTitle: 'Historical title', variantTitle: 'Default' })) })
    vi.mocked(repo.findVariantsForCart).mockResolvedValue([variant])
    vi.mocked(repo.withLockedActiveCart).mockImplementation(async (_userId, callback) => {
      const current = structuredClone(cart)
      const transactionalRepo: ICartRepository = {
        ...repo,
        createItem: async data => {
          const item = { ...createItem({ variant, quantity: data.quantity, unitPrice: data.unitPrice }), ...data }
          current.items.push(item)
          return item
        },
        updateItem: async (itemId, data) => {
          const index = current.items.findIndex((item: { id: string }) => item.id === itemId)
          const item = { ...current.items[index], ...data }
          current.items[index] = item
          return item
        },
      }
      const result = await callback(current, transactionalRepo)
      cart = current
      return result
    })
    return { repo, service: new CartService(createAppContext(), repo), cart: () => cart, variant }
  }

  it('aggregates historical SKUs and retries without adding historical quantities twice', async () => {
    const f = fixture([{ variantId: 'variant-1', quantity: 1 }, { variantId: 'variant-1', quantity: 2 }])
    const result = await f.service.buyAgain(createActor(), 'owned-order')
    expect(result.items).toEqual([{
      variantId: 'variant-1', productTitle: 'Historical title', variantTitle: 'Default', requestedQuantity: 3,
      existingQuantity: 0, targetQuantity: 3, addedQuantity: 3, finalQuantity: 3, availableQuantity: 8,
      kind: 'added', reason: null, unitPrice: 1990n, currency: 'THB',
    }])
    expect((await f.service.buyAgain(createActor(), 'owned-order')).items[0]).toMatchObject({
      kind: 'already_in_cart', existingQuantity: 3, addedQuantity: 0, finalQuantity: 3,
    })
    expect(f.cart().items.map((item: { quantity: number; unitPrice: bigint }) => [item.quantity, item.unitPrice])).toEqual([[3, 1990n]])
  })

  it.each([1, 5])('uses current exact price and currency while preserving existing quantity %i', async quantity => {
    const old = createVariant({ id: 'variant-1', currency: 'USD', price: 1000n })
    const f = fixture(undefined, [createItem({ quantity, unitPrice: 1000n, variant: old })])
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([createVariant({ id: 'variant-1', currency: 'THB', price: 9007199254740993123n })])
    const result = await f.service.buyAgain(createActor(), 'owned-order')
    expect(result.items[0]).toMatchObject({ finalQuantity: quantity === 1 ? 3 : 5, addedQuantity: quantity === 1 ? 2 : 0, unitPrice: 9007199254740993123n, currency: 'THB' })
    expect(f.cart().items[0]).toMatchObject({ quantity: quantity === 1 ? 3 : 5, unitPrice: 9007199254740993123n, currency: 'THB' })
    expect(toMoneyDto(result).items[0].unitPrice).toBe('9007199254740993123')
  })

  it('adds partial available stock after reservations without reducing existing lines', async () => {
    const f = fixture()
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([createVariant({ id: 'variant-1', currency: 'THB', quantityOnHand: 7, quantityReserved: 5 })])
    const result = await f.service.buyAgain(createActor(), 'owned-order')
    expect(result.items[0]).toMatchObject({ kind: 'partial', reason: 'STOCK_LIMIT', availableQuantity: 2, addedQuantity: 2, finalQuantity: 2, targetQuantity: 3 })
    expect(f.cart().items[0].quantity).toBe(2)
    expect((await f.service.buyAgain(createActor(), 'owned-order')).items[0]).toMatchObject({ kind: 'partial', addedQuantity: 0, finalQuantity: 2 })
  })

  it('skips an existing over-stock line while refreshing its price and preserving quantity', async () => {
    const f = fixture(undefined, [createItem({ quantity: 4, variant: createVariant({ id: 'variant-1' }) })])
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([createVariant({ id: 'variant-1', currency: 'THB', price: 2500n, quantityOnHand: 3, quantityReserved: 1 })])
    const result = await f.service.buyAgain(createActor(), 'owned-order')
    expect(result.items[0]).toMatchObject({ kind: 'skipped', reason: 'EXISTING_QUANTITY_EXCEEDS_STOCK', finalQuantity: 4, addedQuantity: 0, availableQuantity: 2 })
    expect(f.cart().items[0]).toMatchObject({ quantity: 4, unitPrice: 2500n, currency: 'THB' })
  })

  it.each([
    ['VARIANT_UNAVAILABLE', { variantStatus: 'INACTIVE' }],
    ['PRODUCT_UNAVAILABLE', { productStatus: 'ARCHIVED' }],
    ['SHOP_UNAVAILABLE', { shopStatus: 'SUSPENDED' }],
    ['OUT_OF_STOCK', { quantityOnHand: 2, quantityReserved: 2 }],
    ['PRICE_UNAVAILABLE', { price: 0n }],
    ['CURRENCY_UNSUPPORTED', { currency: 'USD' }],
  ] as const)('returns %s for unavailable items alongside successful additions', async (reason, overrides) => {
    const f = fixture([{ variantId: 'variant-1', quantity: 1 }, { variantId: 'variant-2', quantity: 1 }])
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([f.variant, createVariant({ id: 'variant-2', currency: 'THB', ...overrides })])
    const result = await f.service.buyAgain(createActor(), 'owned-order')
    expect(result.items.map(item => [item.kind, item.reason, item.finalQuantity])).toEqual([['added', null, 1], ['skipped', reason, 0]])
    expect(f.cart().items.map((item: { variantId: string }) => item.variantId)).toEqual(['variant-1'])
  })

  it('reports missing variants explicitly', async () => {
    const f = fixture()
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([])
    expect((await f.service.buyAgain(createActor(), 'owned-order')).items[0]).toMatchObject({ kind: 'skipped', reason: 'VARIANT_NOT_FOUND', finalQuantity: 0, unitPrice: null, currency: null })
    expect(f.cart().items).toEqual([])
  })

  it('does not expose or write another buyer order, and rejects administrators', async () => {
    const f = fixture()
    vi.mocked(f.repo.findOwnedOrderItems).mockResolvedValue(null)
    await expect(f.service.buyAgain(createActor(), 'foreign-order')).rejects.toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' })
    await expect(f.service.buyAgain(createActor('ADMIN'), 'owned-order')).rejects.toMatchObject({ status: 403, code: 'CART_FORBIDDEN' })
    expect(f.repo.withLockedActiveCart).not.toHaveBeenCalled()
  })

  it('does not continue a batch when a database write fails', async () => {
    const f = fixture([{ variantId: 'variant-1', quantity: 1 }, { variantId: 'variant-2', quantity: 1 }])
    vi.mocked(f.repo.findVariantsForCart).mockResolvedValue([f.variant, createVariant({ id: 'variant-2', currency: 'THB' })])
    const originalTransaction = vi.mocked(f.repo.withLockedActiveCart).getMockImplementation()!
    vi.mocked(f.repo.withLockedActiveCart).mockImplementation((userId, callback) => originalTransaction(userId, (cart, repo) => callback(cart, {
      ...repo, createItem: async data => {
        if (data.variantId === 'variant-2') throw new Error('Database unavailable')
        return repo.createItem(data)
      },
    })))
    await expect(f.service.buyAgain(createActor(), 'owned-order')).rejects.toThrow('Database unavailable')
    expect(f.cart().items).toEqual([])
  })
})
