import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type {
  CheckoutAddress,
  CheckoutCart,
  CheckoutCartItem,
  CheckoutCommitmentInput,
  ICheckoutRepository,
} from './checkout.repository.ts'
import { CheckoutService } from './checkout.service.ts'
import { CheckoutQuoteEvaluator } from './checkout-quote.evaluator.ts'

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

function createRepoMock(): ICheckoutRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo as ICheckoutRepository)),
    lockCartForCheckout: vi.fn(),
    findCartForCheckout: vi.fn(),
    findAddressForUser: vi.fn(),
    findCouponByCode: vi.fn(),
    countCouponRedemptionsForUser: vi.fn(),
    lockCouponForCheckout: vi.fn(),
    lockFlashSaleItemForCheckout: vi.fn(),
    findActiveFlashSaleItemForCheckout: vi.fn().mockResolvedValue(null),
    findBuyerCoinBalance: vi.fn().mockResolvedValue(0),
    lockBuyerCoinWallet: vi.fn(),
    commitCheckout: vi.fn(),
  }
}

let repo: ICheckoutRepository
let promotionService: Pick<PromotionService, 'validateCouponForsubtotal'>

function createActor(role: Role = 'USER') {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
  }
}

function createAddress(overrides: Partial<CheckoutAddress> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: overrides.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: overrides.userId ?? 'user-1',
    recipientName: overrides.recipientName ?? 'Jane Buyer',
    phone: overrides.phone ?? '0800000000',
    line1: overrides.line1 ?? '123 Market Road',
    line2: overrides.line2 ?? null,
    city: overrides.city ?? 'Bangkok',
    region: overrides.region ?? 'Bangkok',
    postalCode: overrides.postalCode ?? '10110',
    country: overrides.country ?? 'TH',
    isDefault: overrides.isDefault ?? true,
    createdAt: now,
    updatedAt: now,
  }
}

function createItem(overrides: Partial<{
  id: string
  variantId: string
  quantity: number
  price: number
  currency: string
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  variantStatus: 'ACTIVE' | 'INACTIVE'
  shopStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  shopId: string
  shippingFee: number
  quantityOnHand: number
  quantityReserved: number
}> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const variantId = overrides.variantId ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  return {
    id: overrides.id ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    variantId,
    quantity: overrides.quantity ?? 2,
    unitPrice: 1000,
    currency: overrides.currency ?? 'THB',
    createdAt: now,
    updatedAt: now,
    variant: {
      id: variantId,
      productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      sku: 'TEE-BLK-M',
      title: 'Black / M',
      price: overrides.price ?? 1200,
      currency: overrides.currency ?? 'THB',
      status: overrides.variantStatus ?? 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      inventory: {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        variantId,
        quantityOnHand: overrides.quantityOnHand ?? 10,
        quantityReserved: overrides.quantityReserved ?? 1,
        reorderLevel: 0,
        updatedAt: now,
      },
      product: {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        shopId: overrides.shopId ?? '11111111-1111-4111-8111-111111111111',
        categoryId: null,
        title: 'Oversized Cotton Tee',
        slug: 'oversized-cotton-tee',
        description: null,
        status: overrides.productStatus ?? 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        shop: {
          id: overrides.shopId ?? '11111111-1111-4111-8111-111111111111',
          name: 'Everyday Studio',
          slug: 'everyday-studio',
          status: overrides.shopStatus ?? 'ACTIVE',
          settings: { shippingFee: overrides.shippingFee ?? 500 },
        },
      },
    },
  }
}

function createCart(overrides: Partial<{
  userId: string
  status: 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED'
  items: CheckoutCartItem[]
}> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    userId: overrides.userId ?? 'user-1',
    status: overrides.status ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    items: overrides.items ?? [createItem()],
  }
}

function createCreatedOrder(input?: Partial<CheckoutCommitmentInput>): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  return {
    checkoutId: '12121212-1212-4121-8121-121212121212',
    order: {
      id: '13131313-1313-4131-8131-131313131313',
      checkoutId: '12121212-1212-4121-8121-121212121212',
      userId: 'user-1',
      orderNumber: input?.orderNumber ?? 'ORD-TEST',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      subtotal: input?.acceptedQuote?.totals.subtotal ?? 2400,
      discountTotal: input?.acceptedQuote?.totals.discountTotal ?? 0,
      shippingTotal: input?.acceptedQuote?.totals.shippingTotal ?? 500,
      taxTotal: input?.acceptedQuote?.totals.taxTotal ?? 0,
      grandTotal: input?.acceptedQuote?.totals.grandTotal ?? 2900,
      currency: input?.acceptedQuote?.totals.currency ?? 'THB',
      shippingName: 'Jane Buyer',
      shippingPhone: '0800000000',
      shippingLine1: '123 Market Road',
      shippingLine2: null,
      shippingCity: 'Bangkok',
      shippingRegion: 'Bangkok',
      shippingPostalCode: '10110',
      shippingCountry: 'TH',
      createdAt: now,
      updatedAt: now,
    },
    payment: {
      id: '14141414-1414-4141-8141-141414141414',
      orderId: '13131313-1313-4131-8131-131313131313',
      provider: 'stripe',
      providerIntentId: `pending_${input?.orderNumber ?? 'ORD-TEST'}`,
      status: 'PENDING',
      amount: input?.acceptedQuote?.totals.grandTotal ?? 2900,
      currency: input?.acceptedQuote?.totals.currency ?? 'THB',
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    },
  }
}

async function setupSuccess(overrides: {
  cart?: CheckoutCart
  address?: CheckoutAddress | null
  couponDiscountCents?: number
  freeShipping?: boolean
  couponShopId?: string | null
  freeShippingShopIds?: string[]
  couponError?: PromotionServiceError
  cacheInvalidation?: CacheInvalidation
} = {}) {
  repo = createRepoMock()
  promotionService = {
    validateCouponForsubtotal: vi.fn(),
  }
  vi.mocked(repo.findCartForCheckout).mockResolvedValue(overrides.cart ?? createCart())
  vi.mocked(repo.findAddressForUser).mockResolvedValue(overrides.address === undefined ? createAddress() : overrides.address)
  vi.mocked(repo.findCouponByCode).mockResolvedValue(null)
  vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValue(0)
  vi.mocked(repo.commitCheckout).mockImplementation(async (input) => createCreatedOrder(input))
  if (overrides.couponError) {
    vi.mocked(promotionService.validateCouponForsubtotal).mockRejectedValue(overrides.couponError)
  } else {
    vi.mocked(promotionService.validateCouponForsubtotal).mockResolvedValue({
      couponId: '99999999-9999-4999-8999-999999999999',
      couponCode: 'SAVE10',
      discount: overrides.couponDiscountCents ?? 0,
      discountCents: overrides.couponDiscountCents ?? 0,
      subtotal: 2400,
      freeShipping: overrides.freeShipping ?? false,
      couponShopId: overrides.couponShopId ?? null,
      freeShippingShopIds: overrides.freeShippingShopIds
        ?? (overrides.freeShipping ? ['11111111-1111-4111-8111-111111111111'] : []),
    })
  }
  return new CheckoutService(
    createAppContext(),
    repo,
    new CheckoutQuoteEvaluator(promotionService as PromotionService),
    overrides.cacheInvalidation,
  )
}

describe('CheckoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates checkout, reserves stock input, creates pending order/payment, and marks cart checked out through repository', async () => {
    const service = await setupSuccess({ couponDiscountCents: 240 })

    const result = await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: ' save10 ',
      paymentMethod: 'stripe',
    })

    expect(result).toMatchObject({
      orderId: '13131313-1313-4131-8131-131313131313',
      paymentId: '14141414-1414-4141-8141-141414141414',
      paymentStatus: 'pending',
      paymentUrl: '/th/payment/mock/14141414-1414-4141-8141-141414141414',
      totalCents: 2660,
    })
    expect(repo.transaction).toHaveBeenCalledOnce()
    expect(promotionService.validateCouponForsubtotal).toHaveBeenCalledWith(repo, {
      userId: 'user-1',
      couponCode: ' save10 ',
      subtotal: 2400,
      shopSubtotals: [{ shopId: '11111111-1111-4111-8111-111111111111', subtotal: 2400 }],
    })
    expect(repo.commitCheckout).toHaveBeenCalledWith(expect.objectContaining({
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId: 'user-1',
      paymentProvider: 'mock',
      acceptedQuote: expect.objectContaining({
        coupon: { id: '99999999-9999-4999-8999-999999999999' },
        totals: {
          subtotal: 2400,
          discountTotal: 240,
          shippingTotal: 500,
          taxTotal: 0,
          grandTotal: 2660,
          currency: 'THB',
        },
      }),
    }))
  })

  it('uses request locale when generating the mock payment URL', async () => {
    const service = await setupSuccess()

    const result = await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
      locale: 'en',
    })

    expect(result.paymentUrl).toBe('/en/payment/mock/14141414-1414-4141-8141-141414141414')
  })

  it('invalidates inventory cache only after the checkout transaction commits', async () => {
    const events: string[] = []
    const cacheInvalidation = { invalidateInventory: vi.fn(async () => { events.push('invalidate'); return 0 }) } as unknown as CacheInvalidation
    const service = await setupSuccess({ cacheInvalidation })
    vi.mocked(repo.transaction).mockImplementationOnce(async (callback) => {
      const result = await callback(repo)
      events.push('commit')
      return result
    })
    await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'card',
    })
    expect(events).toEqual(['commit', 'invalidate'])
  })

  it('rejects cash on delivery because fulfillment does not support COD settlement', async () => {
    const service = await setupSuccess()

    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'cod',
    })).rejects.toMatchObject({ code: 'PAYMENT_METHOD_UNAVAILABLE' })

    expect(repo.transaction).not.toHaveBeenCalled()
  })

  it('creates an order from only the explicitly selected cart items', async () => {
    const selected = createItem({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
    const unselected = createItem({
      id: 'abababab-abab-4bab-8bab-abababababab',
      variantId: 'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
      price: 5000,
    })
    const service = await setupSuccess({ cart: createCart({ items: [selected, unselected] }) })

    await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      cartItemIds: [selected.id],
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    expect(repo.commitCheckout).toHaveBeenCalledWith(expect.objectContaining({
      acceptedQuote: expect.objectContaining({
        items: [expect.objectContaining({ ...selected, unitPrice: 1200 })],
        totals: expect.objectContaining({ subtotal: 2400 }),
      }),
    }))
  })

  it('uses current trusted variant price for order item snapshots instead of cart captured price', async () => {
    const service = await setupSuccess()
    await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    const input = vi.mocked(repo.commitCheckout).mock.calls[0]![0]
    expect(input.acceptedQuote.items[0]!.unitPrice).toBe(1200)
    expect(input.acceptedQuote.items[0]!.variant.price).toBe(1200)
    expect(input.acceptedQuote.items[0]!.variant.product.title).toBe('Oversized Cotton Tee')
    expect(input.acceptedQuote.items[0]!.variant.product.shop.name).toBe('Everyday Studio')
  })

  it('rejects empty carts, wrong user carts, invalid addresses, inactive products, and insufficient stock', async () => {
    await expect((await setupSuccess({ cart: createCart({ items: [] }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CART_EMPTY' })

    await expect((await setupSuccess({ cart: createCart({ userId: 'other-user' }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CART_NOT_FOUND' })

    await expect((await setupSuccess({ address: null })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'ADDRESS_NOT_FOUND' })

    await expect((await setupSuccess({ cart: createCart({ items: [createItem({ productStatus: 'DRAFT' })] }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'PRODUCT_INACTIVE' })

    await expect((await setupSuccess({ cart: createCart({ items: [createItem({ variantStatus: 'INACTIVE' })] }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'VARIANT_INACTIVE' })

    await expect((await setupSuccess({ cart: createCart({ items: [createItem({ quantityOnHand: 2, quantityReserved: 1, quantity: 2 })] }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })

    await expect((await setupSuccess({ cart: createCart({ status: 'CHECKED_OUT' }) })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CART_NOT_ACTIVE' })
  })

  it('applies valid coupon discounts and maps invalid coupons to checkout errors', async () => {
    const validCouponService = await setupSuccess({ couponDiscountCents: 2400 })
    await validCouponService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'SAVE10',
      paymentMethod: 'stripe',
    })
    expect(vi.mocked(repo.commitCheckout).mock.calls[0]![0].acceptedQuote.totals).toMatchObject({
      discountTotal: 2400,
      grandTotal: 500,
    })

    const cappedDiscountService = await setupSuccess({ couponDiscountCents: 999999 })
    await cappedDiscountService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'BIGSAVE',
      paymentMethod: 'stripe',
    })
    expect(vi.mocked(repo.commitCheckout).mock.calls[0]![0].acceptedQuote.totals).toMatchObject({
      discountTotal: 2400,
      grandTotal: 500,
    })

    await expect((await setupSuccess({
      couponError: new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND'),
    })).createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'NOPE',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON', details: { reason: 'COUPON_NOT_FOUND' } })
  })

  it('quotes the same grand total that checkout charges when no coupon is supplied', async () => {
    const quoteService = await setupSuccess()
    const quote = await quoteService.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    const checkoutService = await setupSuccess()
    const checkout = await checkoutService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    expect(quote.grandTotal).toBe(checkout.totalCents)
    expect(quote.coupon).toBeNull()
  })

  it('quotes the same grand total that checkout charges with a valid coupon', async () => {
    const quoteService = await setupSuccess({ couponDiscountCents: 240 })
    const quote = await quoteService.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      couponCode: 'SAVE10',
    })

    const checkoutService = await setupSuccess({ couponDiscountCents: 240 })
    const checkout = await checkoutService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'SAVE10',
      paymentMethod: 'stripe',
    })

    expect(quote.grandTotal).toBe(checkout.totalCents)
    expect(quote.coupon).toMatchObject({ code: 'SAVE10', applied: true })
  })

  it('includes shipping in the quoted grand total', async () => {
    const service = await setupSuccess()
    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.shippingTotal).toBeGreaterThan(0)
    expect(quote.grandTotal).toBeGreaterThan(quote.subtotal - quote.discountTotal)
  })

  it('ignores a zero-priced legacy flash-sale row', async () => {
    const service = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemForCheckout).mockResolvedValue({ id: 'flash-item-1', salePrice: 0 } as never)

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.subtotal).toBe(2400)
  })

  it('keeps flash-sale estimates read-only and locks the row only for commitment', async () => {
    const quoteService = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemForCheckout).mockResolvedValue({
      id: 'flash-item-1',
      salePrice: 900,
    } as never)

    const quote = await quoteService.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.subtotal).toBe(1800)
    expect(repo.lockFlashSaleItemForCheckout).not.toHaveBeenCalled()

    const checkoutService = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemForCheckout).mockResolvedValue({
      id: 'flash-item-1',
      salePrice: 900,
    } as never)
    await checkoutService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    expect(repo.lockFlashSaleItemForCheckout).toHaveBeenCalledWith('flash-item-1')
    expect(repo.findActiveFlashSaleItemForCheckout).toHaveBeenCalledTimes(2)
  })

  it('waives shipping only when an applied coupon grants free shipping', async () => {
    const quoteService = await setupSuccess({ freeShipping: true })
    const quote = await quoteService.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      couponCode: 'FREESHIP',
    })

    expect(quote.shippingTotal).toBe(0)
    expect(quote.grandTotal).toBe(quote.subtotal)

    const checkoutService = await setupSuccess({ freeShipping: true })
    await checkoutService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'FREESHIP',
      paymentMethod: 'stripe',
    })
    expect(repo.commitCheckout).toHaveBeenCalledWith(expect.objectContaining({
      acceptedQuote: expect.objectContaining({
        freeShippingShopIds: ['11111111-1111-4111-8111-111111111111'],
      }),
    }))
  })

  it('waives shipping only for the seller coupon shop in a multi-shop checkout', async () => {
    const firstShopItem = createItem({ shippingFee: 500 })
    const secondShopItem = createItem({
      id: 'dededede-dede-4ded-8ded-dededededede',
      variantId: 'edededed-eded-4ede-8ede-edededededed',
      shopId: '22222222-2222-4222-8222-222222222222',
      shippingFee: 750,
    })
    const service = await setupSuccess({
      cart: createCart({ items: [firstShopItem, secondShopItem] }),
      freeShipping: true,
      couponShopId: '11111111-1111-4111-8111-111111111111',
      freeShippingShopIds: ['11111111-1111-4111-8111-111111111111'],
    })

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      couponCode: 'SHOPSHIP',
    })

    expect(quote.shippingTotal).toBe(750)
  })

  it('charges each selected shop shipping fee once', async () => {
    const firstShopItem = createItem({ shippingFee: 500 })
    const sameShopItem = createItem({
      id: 'abababab-abab-4bab-8bab-abababababab',
      variantId: 'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcbc',
      shippingFee: 500,
    })
    const secondShopItem = createItem({
      id: 'dededede-dede-4ded-8ded-dededededede',
      variantId: 'edededed-eded-4ede-8ede-edededededed',
      shopId: '22222222-2222-4222-8222-222222222222',
      shippingFee: 750,
    })
    const service = await setupSuccess({ cart: createCart({ items: [firstShopItem, sameShopItem, secondShopItem] }) })

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.shippingTotal).toBe(1250)
  })

  it('does not fail the quote when the coupon is unusable', async () => {
    const service = await setupSuccess({
      couponError: new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND'),
    })

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      couponCode: 'NOPE',
    })

    expect(quote.coupon).toMatchObject({ code: 'NOPE', applied: false, reason: 'COUPON_NOT_FOUND' })
    expect(quote.discountTotal).toBe(0)
  })

  it('still fails order creation for the same unusable coupon that a quote tolerates', async () => {
    const service = await setupSuccess({
      couponError: new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND'),
    })

    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'NOPE',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON' })
  })

  it('quotes without writing anything', async () => {
    const service = await setupSuccess()
    await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(repo.commitCheckout).not.toHaveBeenCalled()
    expect(repo.transaction).not.toHaveBeenCalled()
  })

  it('applies buyer coins within the balance and twenty-percent subtotal cap', async () => {
    const service = await setupSuccess()
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(10)

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      coinsToUse: 4,
    })

    expect(quote.coinsApplied).toBe(4)
    expect(quote.discountTotal).toBe(400)
    expect(repo.lockBuyerCoinWallet).not.toHaveBeenCalled()
  })

  it('does not spend coins that cannot reduce the post-coupon subtotal', async () => {
    const service = await setupSuccess({ couponDiscountCents: 2400 })
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(10)

    await expect(service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      couponCode: 'SAVE10',
      coinsToUse: 1,
    })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })

  it('rejects quoting a cart that belongs to another buyer', async () => {
    const service = await setupSuccess({ cart: createCart({ userId: 'other-user' }) })

    await expect(service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })).rejects.toMatchObject({ code: 'CART_NOT_FOUND' })
  })

  it('rejects admins and rolls back through repository transaction failures', async () => {
    const service = await setupSuccess()
    await expect(service.createCheckout(createActor('ADMIN'), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CHECKOUT_FORBIDDEN' })

    vi.mocked(repo.commitCheckout).mockRejectedValue(new Error('forced rollback'))

    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })
})

describe('CheckoutQuoteEvaluator', () => {
  it('evaluates the same accepted quote artifact used by preview and commitment', async () => {
    await setupSuccess({ couponDiscountCents: 240 })
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService)

    const evaluation = await evaluator.evaluate(repo, {
      userId: 'user-1',
      items: createCart().items,
      couponCode: 'SAVE10',
      coinsToUse: 0,
      policy: 'estimate',
    })
    const commitment = await evaluator.evaluate(repo, {
      userId: 'user-1',
      items: createCart().items,
      couponCode: 'SAVE10',
      coinsToUse: 0,
      policy: 'commit',
    })

    expect(evaluation.quote).toMatchObject({
      subtotal: 2400,
      discountTotal: 240,
      shippingTotal: 500,
      grandTotal: 2660,
      coupon: { code: 'SAVE10', applied: true },
    })
    expect(evaluation.acceptedQuote).toMatchObject({
      totals: { subtotal: 2400, discountTotal: 240, shippingTotal: 500, grandTotal: 2660 },
      coupon: { id: '99999999-9999-4999-8999-999999999999' },
      couponDiscount: 240,
    })
    expect(commitment.acceptedQuote).toEqual(evaluation.acceptedQuote)
    expect(repo.lockCouponForCheckout).toHaveBeenCalledWith('99999999-9999-4999-8999-999999999999')
  })
})
