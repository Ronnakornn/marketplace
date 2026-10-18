import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type { PromotionCoupon } from '#server/modules/promotion/promotion.repository.ts'
import type {
  CheckoutAddress,
  CheckoutCart,
  CheckoutCartItem,
  CheckoutCommitmentInput,
  CheckoutFlashSaleItem,
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
    readCouponTargets: vi.fn(async () => ({ productIds: [], categoryIds: [] })),
    readTaxPolicy: vi.fn(async () => null),
    applyShippingPolicy: vi.fn(async (items) => items),
    transaction: vi.fn(async (callback) => callback(repo as ICheckoutRepository)),
    lockCartForCheckout: vi.fn(),
    findCartForCheckout: vi.fn(),
    findAddressForUser: vi.fn(),
    findCouponByCode: vi.fn(),
    countCouponRedemptionsForUser: vi.fn(),
    lockCouponForCheckout: vi.fn(),
    lockFlashSaleItemForCheckout: vi.fn(),
    findActiveFlashSaleItemsForCheckout: vi.fn().mockResolvedValue([]),
    findBuyerCoinBalance: vi.fn().mockResolvedValue(0),
    lockBuyerCoinWallet: vi.fn(),
    commitCheckout: vi.fn(),
  }
}

let repo: ICheckoutRepository
let promotionService: Pick<PromotionService, 'validateLoadedCouponForSubtotal'>

function createCoupon(overrides: Partial<PromotionCoupon> = {}): PromotionCoupon {
  return {
    id: '99999999-9999-4999-8999-999999999999', code: 'SAVE10', shopId: null,
    discountType: 'FIXED_AMOUNT', discountValue: 240n, discountPercentBps: null, minOrder: null, maxDiscount: null,
    startsAt: null, endsAt: null, usageLimit: null, perUserLimit: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    _count: { redemptions: 0 }, ...overrides,
  }
}

function createRealCouponEvaluator(v2Supported = false) {
  const service = new PromotionService(createAppContext(), {
    ...repo,
    findBuyerCoinWallet: vi.fn(), listBuyerCoinLedger: vi.fn(), findCartForCouponValidation: vi.fn(),
    findSellerShops: vi.fn(), listPublicCoupons: vi.fn(), listBuyerCoupons: vi.fn(), findCouponForClaim: vi.fn(),
    createCouponClaim: vi.fn(), listAdminCoupons: vi.fn(), listSellerCoupons: vi.fn(), findCouponById: vi.fn(),
    createCoupon: vi.fn(), updateCoupon: vi.fn(), deleteCoupon: vi.fn(), listAdminFlashSales: vi.fn(),
    listSellerFlashSales: vi.fn(), findFlashSaleById: vi.fn(), createFlashSale: vi.fn(), updateFlashSale: vi.fn(),
    updateFlashSaleSafely: vi.fn(), findActiveProductVariant: vi.fn(), createFlashSaleItem: vi.fn(),
    findFlashSaleItemById: vi.fn(), findOverlappingFlashSaleItem: vi.fn(), sumActiveFlashSaleReservations: vi.fn(),
    updateFlashSaleItem: vi.fn(), deleteFlashSaleItem: vi.fn(),
  })
  return new CheckoutQuoteEvaluator(service, v2Supported)
}

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
    validateLoadedCouponForSubtotal: vi.fn(),
  }
  vi.mocked(repo.findCartForCheckout).mockResolvedValue(overrides.cart ?? createCart())
  vi.mocked(repo.findAddressForUser).mockResolvedValue(overrides.address === undefined ? createAddress() : overrides.address)
  vi.mocked(repo.findCouponByCode).mockResolvedValue({
    id: '99999999-9999-4999-8999-999999999999', code: 'SAVE10', shopId: overrides.couponShopId ?? null,
    discountType: 'FIXED_AMOUNT', discountValue: 0n, discountPercentBps: null, minOrder: null, maxDiscount: null,
    startsAt: null, endsAt: null, usageLimit: null, perUserLimit: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    _count: { redemptions: 0 },
  })
  vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValue(0)
  vi.mocked(repo.commitCheckout).mockImplementation(async (input) => createCreatedOrder(input))
  if (overrides.couponError) {
    vi.mocked(promotionService.validateLoadedCouponForSubtotal).mockRejectedValue(overrides.couponError)
  } else {
    vi.mocked(promotionService.validateLoadedCouponForSubtotal).mockResolvedValue({
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
    expect(promotionService.validateLoadedCouponForSubtotal).toHaveBeenCalledWith(repo, expect.objectContaining({ code: 'SAVE10' }), {
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
          includedTaxTotal: 0,
          addedTaxTotal: 0,
          reportedTaxTotal: 0,
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
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([{ id: 'flash-item-1', variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', salePrice: 0 } as never])

    const quote = await service.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.subtotal).toBe(2400)
  })

  it('keeps flash-sale estimates read-only and locks the row only for commitment', async () => {
    const quoteService = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([{
      id: 'flash-item-1',
      variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      salePrice: 900,
    } as never])

    const quote = await quoteService.quoteCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    })

    expect(quote.subtotal).toBe(1800)
    expect(repo.lockFlashSaleItemForCheckout).not.toHaveBeenCalled()

    const checkoutService = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([{
      id: 'flash-item-1',
      variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      salePrice: 900,
    } as never])
    await checkoutService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    expect(repo.lockFlashSaleItemForCheckout).toHaveBeenCalledWith('flash-item-1')
    expect(repo.findActiveFlashSaleItemsForCheckout).toHaveBeenCalledTimes(2)
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
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(10n)

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
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(10n)

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
  function flashSale(variantId: string, id: string, salePrice = 900n): CheckoutFlashSaleItem {
    return { id, variantId, salePrice, stockLimit: 10, soldCount: 0, perUserLimit: 3 }
  }

  it('reads a coupon once for estimates and once in each committed validation round', async () => {
    await setupSuccess()
    const coupon = createCoupon({ perUserLimit: 3 })
    vi.mocked(repo.findCouponByCode).mockResolvedValue(coupon)
    const evaluator = createRealCouponEvaluator()
    const input = { userId: 'user-1', items: [createItem()], couponCode: ' save10 ' }
    const estimate = await evaluator.evaluate(repo, { ...input, policy: 'estimate' })

    expect(estimate.quote).toMatchObject({ subtotal: 2400, discountTotal: 240, grandTotal: 2660, coupon: { code: 'SAVE10', applied: true } })
    expect(repo.findCouponByCode).toHaveBeenCalledExactlyOnceWith('SAVE10')
    expect(repo.countCouponRedemptionsForUser).toHaveBeenCalledExactlyOnceWith(coupon.id, input.userId)
    expect(repo.lockCouponForCheckout).not.toHaveBeenCalled()
    vi.clearAllMocks()

    const events: string[] = []
    vi.mocked(repo.findCouponByCode).mockImplementation(async () => { events.push('coupon'); return coupon })
    vi.mocked(repo.readCouponTargets).mockImplementation(async () => { events.push('targets'); return { productIds: [], categoryIds: [] } })
    vi.mocked(repo.countCouponRedemptionsForUser).mockImplementation(async () => { events.push('user-limit'); return 0 })
    vi.mocked(repo.lockCouponForCheckout).mockImplementation(async () => { events.push('lock') })
    const committed = await evaluator.evaluate(repo, { ...input, policy: 'commit' })

    expect(committed.quote).toEqual(estimate.quote)
    expect(events).toEqual(['coupon', 'targets', 'user-limit', 'lock', 'coupon', 'targets', 'user-limit'])
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
  })

  it.each([
    { name: 'inactive status', change: { isActive: false }, reason: 'COUPON_INACTIVE' },
    { name: 'expiry', change: { endsAt: new Date('2000-01-01') }, reason: 'COUPON_EXPIRED' },
    { name: 'future start', change: { startsAt: new Date('2999-01-01') }, reason: 'COUPON_NOT_STARTED' },
    { name: 'minimum amount', change: { minOrder: 5000n }, reason: 'COUPON_MIN_ORDER_NOT_MET' },
    { name: 'global redemption count', change: { usageLimit: 1, _count: { redemptions: 1 } }, reason: 'COUPON_USAGE_LIMIT_REACHED' },
  ])('revalidates changed coupon $name after locking', async ({ change, reason }) => {
    await setupSuccess()
    let coupon = createCoupon()
    vi.mocked(repo.findCouponByCode).mockImplementation(async () => coupon)
    vi.mocked(repo.lockCouponForCheckout).mockImplementation(async () => { coupon = { ...coupon, ...change } })

    await expect(createRealCouponEvaluator().evaluate(repo, {
      userId: 'user-1', items: [createItem()], couponCode: 'SAVE10', policy: 'commit',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON', details: { reason } })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
    expect(repo.readCouponTargets).toHaveBeenCalledTimes(2)
  })

  it('rechecks per-user coupon redemptions after locking', async () => {
    await setupSuccess()
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon({ perUserLimit: 1 }))
    vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValueOnce(0).mockResolvedValueOnce(1)

    await expect(createRealCouponEvaluator().evaluate(repo, {
      userId: 'user-1', items: [createItem()], couponCode: 'SAVE10', policy: 'commit',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON', details: { reason: 'COUPON_USER_LIMIT_REACHED' } })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
    expect(repo.countCouponRedemptionsForUser).toHaveBeenCalledTimes(2)
  })

  it('rechecks coupon targets after locking and rejects a newly excluded product', async () => {
    await setupSuccess()
    vi.mocked(repo.findCouponByCode).mockResolvedValue(createCoupon())
    vi.mocked(repo.readCouponTargets).mockResolvedValueOnce({ productIds: [], categoryIds: [] })
      .mockResolvedValueOnce({ productIds: ['another-product'], categoryIds: [] })

    await expect(createRealCouponEvaluator().evaluate(repo, {
      userId: 'user-1', items: [createItem()], couponCode: 'SAVE10', policy: 'commit',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON', details: { reason: 'COUPON_SCOPE_MISMATCH' } })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
    expect(repo.readCouponTargets).toHaveBeenCalledTimes(2)
  })

  it('rechecks named coupon funding after locking', async () => {
    await setupSuccess()
    vi.mocked(repo.findCouponByCode).mockResolvedValueOnce(createCoupon({ shopId: '11111111-1111-4111-8111-111111111111' }))
      .mockResolvedValueOnce(createCoupon())

    await expect(createRealCouponEvaluator(true).evaluate(repo, {
      userId: 'user-1', items: [createItem()], shopCouponCode: 'SAVE10', policy: 'commit',
    })).rejects.toMatchObject({ code: 'INVALID_COUPON' })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
  })

  it('applies named targeted coupons in shop then platform order with exact funding', async () => {
    await setupSuccess()
    const shopId = '11111111-1111-4111-8111-111111111111'
    const shopCoupon = createCoupon({ id: 'seller-coupon', code: 'SHOP', shopId, discountValue: 200n })
    const platformCoupon = createCoupon({ id: 'platform-coupon', code: 'PLATFORM', discountType: 'PERCENT', discountValue: null, discountPercentBps: 1000 })
    vi.mocked(repo.findCouponByCode).mockImplementation(async code => code === 'SHOP' ? shopCoupon : platformCoupon)
    vi.mocked(repo.readCouponTargets).mockResolvedValue({ productIds: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'], categoryIds: [] })
    const evaluator = createRealCouponEvaluator(true)
    const input = { userId: 'user-1', items: [createItem()], shopCouponCode: ' shop ', platformCouponCode: 'platform' }
    const estimated = await evaluator.evaluate(repo, { ...input, policy: 'estimate' })

    expect(estimated.quote).toMatchObject({ subtotal: 2400, discountTotal: 420, shippingTotal: 500, grandTotal: 2480 })
    expect(estimated.acceptedQuote.funding).toMatchObject({ sellerCouponDiscount: 200, sellerCouponShopId: shopId, platformCouponDiscount: 220 })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(2)
    vi.mocked(repo.findCouponByCode).mockClear()
    const committed = await evaluator.evaluate(repo, { ...input, policy: 'commit' })

    expect(committed.quote).toEqual(estimated.quote)
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(4)
    expect(repo.lockCouponForCheckout).toHaveBeenNthCalledWith(1, shopCoupon.id)
    expect(repo.lockCouponForCheckout).toHaveBeenNthCalledWith(2, platformCoupon.id)
  })

  it('rejects an accepted quote when the coupon amount changes in the committed round', async () => {
    await setupSuccess()
    let coupon = createCoupon()
    vi.mocked(repo.findCouponByCode).mockImplementation(async () => coupon)
    const service = new CheckoutService(createAppContext(), repo, createRealCouponEvaluator())
    const quote = await service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', couponCode: 'SAVE10' })
    vi.mocked(repo.lockCouponForCheckout).mockImplementation(async () => { coupon = { ...coupon, discountValue: 500n } })

    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe', couponCode: 'SAVE10', acceptedQuoteFingerprint: quote.quoteFingerprint,
    })).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    expect(repo.findCouponByCode).toHaveBeenCalledTimes(3)
    expect(repo.commitCheckout).not.toHaveBeenCalled()
  })

  it('prices mixed carts in one batch and preserves promotion admission', async () => {
    await setupSuccess()
    const items = Array.from({ length: 20 }, (_, index) => createItem({ id: `item-${index}`, variantId: `variant-${index}` }))
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([
      flashSale('variant-2', 'sale-2'), flashSale('variant-15', 'sale-15'),
    ])
    const admission = vi.fn().mockResolvedValue(undefined)
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)
    const result = await evaluator.evaluate(repo, { userId: 'user-1', items, policy: 'estimate' })
    expect(result.quote.subtotal).toBe(46800)
    expect(repo.findActiveFlashSaleItemsForCheckout).toHaveBeenCalledExactlyOnceWith(items.map(item => item.variantId), expect.any(Date))
    expect(repo.lockFlashSaleItemForCheckout).not.toHaveBeenCalled()
    expect(admission).toHaveBeenCalledExactlyOnceWith({ userId: 'user-1', shopIds: ['11111111-1111-4111-8111-111111111111'] })
    expect(result.acceptedQuote.items.filter(item => item.flashSaleItemId).map(item => item.flashSaleItemId).sort()).toEqual(['sale-15', 'sale-2'])
  })

  it('admits all candidate shops once, excluding ordinary shops and duplicate lines', async () => {
    await setupSuccess()
    const items = Array.from({ length: 20 }, (_, index) => createItem({
      id: `item-${index}`, variantId: `variant-${index}`, shopId: `shop-${index % 3}`,
    }))
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue(
      items.filter((_, index) => index % 3 !== 2).map(item => flashSale(item.variantId, `sale-${item.id}`)),
    )
    const admission = vi.fn().mockResolvedValue(undefined)
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)
    const result = await evaluator.evaluate(repo, { userId: 'user-1', items, policy: 'estimate' })

    expect(admission).toHaveBeenCalledExactlyOnceWith({ userId: 'user-1', shopIds: ['shop-0', 'shop-1'] })
    expect(result.quote.subtotal).toBe(39600)
  })

  it('fails the whole evaluation when admission denies one candidate shop', async () => {
    await setupSuccess()
    const items = [createItem({ variantId: 'one', shopId: 'allowed' }), createItem({ id: 'two', variantId: 'two', shopId: 'blocked' })]
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue(items.map(item => flashSale(item.variantId, `sale-${item.variantId}`)))
    const admission = vi.fn(async ({ shopIds }: { shopIds: string[] }) => {
      if (shopIds.includes('blocked')) throw new Error('FEATURE_DISABLED')
    })
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)

    await expect(evaluator.evaluate(repo, { userId: 'user-1', items, policy: 'estimate' })).rejects.toThrow('FEATURE_DISABLED')
    expect(admission).toHaveBeenCalledExactlyOnceWith({ userId: 'user-1', shopIds: ['allowed', 'blocked'] })
  })

  it.each([0n, 1200n, 1300n, -1n, 9007199254740992n])('requires admission even for an unusable flash price %s', async salePrice => {
    await setupSuccess()
    const item = createItem()
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([flashSale(item.variantId, 'sale', salePrice)])
    const admission = vi.fn().mockRejectedValue(new Error('FEATURE_DISABLED'))
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)

    await expect(evaluator.evaluate(repo, { userId: 'user-1', items: [item], policy: 'estimate' })).rejects.toThrow('FEATURE_DISABLED')
    expect(admission).toHaveBeenCalledOnce()
  })

  it('validates the regular price before promotion admission', async () => {
    await setupSuccess()
    const item = createItem({ price: 0 })
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([flashSale(item.variantId, 'sale')])
    const admission = vi.fn().mockResolvedValue(undefined)
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)

    await expect(evaluator.evaluate(repo, { userId: 'user-1', items: [item], policy: 'estimate' })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
    expect(admission).not.toHaveBeenCalled()
  })

  it('does not require Flash Sale admission when the locked reread has no candidates', async () => {
    await setupSuccess()
    const item = createItem()
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout)
      .mockResolvedValueOnce([flashSale(item.variantId, 'sale')]).mockResolvedValueOnce([])
    const admission = vi.fn().mockResolvedValue(undefined)
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)
    const result = await evaluator.evaluate(repo, { userId: 'user-1', items: [item], policy: 'commit' })

    expect(result.quote.subtotal).toBe(2400)
    expect(admission).not.toHaveBeenCalled()
    expect(repo.lockFlashSaleItemForCheckout).toHaveBeenCalledExactlyOnceWith('sale')
  })

  it('keeps coupon admission separate from the batched Flash Sale admission', async () => {
    await setupSuccess({ couponDiscountCents: 240 })
    const items = Array.from({ length: 20 }, (_, index) => createItem({ id: `item-${index}`, variantId: `variant-${index}` }))
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue(items.map(item => flashSale(item.variantId, `sale-${item.variantId}`)))
    const admission = vi.fn().mockResolvedValue(undefined)
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService, false, admission)
    const result = await evaluator.evaluate(repo, { userId: 'user-1', items, couponCode: 'SAVE10', policy: 'estimate' })

    expect(result.quote.subtotal).toBe(36000)
    expect(result.quote.discountTotal).toBe(240)
    expect(admission).toHaveBeenCalledTimes(2)
  })

  it('locks unique candidates in sorted order before one constrained re-read', async () => {
    await setupSuccess()
    const items = [createItem({ id: 'one', variantId: 'variant-1' }), createItem({ id: 'two', variantId: 'variant-2' }), createItem({ id: 'three', variantId: 'variant-1' })]
    const first = flashSale('variant-1', 'sale-z')
    const second = flashSale('variant-2', 'sale-a')
    const events: string[] = []
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout)
      .mockImplementationOnce(async () => { events.push('select'); return [first, second] })
      .mockImplementationOnce(async (_variants, _now, candidateIds) => {
        events.push('reread')
        expect(candidateIds).toEqual(['sale-a', 'sale-z'])
        return [{ ...first, salePrice: 800n }, second]
      })
    vi.mocked(repo.lockFlashSaleItemForCheckout).mockImplementation(async id => { events.push(id) })
    const evaluator = new CheckoutQuoteEvaluator(promotionService as PromotionService)
    const result = await evaluator.evaluate(repo, { userId: 'user-1', items, policy: 'commit' })
    expect(events).toEqual(['select', 'sale-a', 'sale-z', 'reread'])
    expect(result.quote.subtotal).toBe(5000)
    expect(repo.findActiveFlashSaleItemsForCheckout).toHaveBeenCalledTimes(2)
    expect(result.acceptedQuote.items.filter(item => item.variantId === 'variant-1').every(item => item.unitPrice === 800)).toBe(true)
  })

  it('falls back after deactivation and makes an accepted promotional quote stale', async () => {
    const service = await setupSuccess()
    const candidate = flashSale('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'sale-held')
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValueOnce([candidate])
    const quote = await service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValueOnce([candidate]).mockResolvedValueOnce([])
    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe', acceptedQuoteFingerprint: quote.quoteFingerprint,
    })).rejects.toMatchObject({ code: 'QUOTE_CHANGED' })
    expect(repo.findActiveFlashSaleItemsForCheckout).toHaveBeenLastCalledWith([candidate.variantId], expect.any(Date), ['sale-held'])
    expect(repo.commitCheckout).not.toHaveBeenCalled()
  })

  it('uses one flash lookup for twenty ordinary items', async () => {
    const items = Array.from({ length: 20 }, (_, index) => createItem({ id: `item-${index}`, variantId: `variant-${index}` }))
    const service = await setupSuccess({ cart: createCart({ items }) })
    const quote = await service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })
    expect(quote.subtotal).toBe(48000)
    expect(repo.findActiveFlashSaleItemsForCheckout).toHaveBeenCalledTimes(1)
  })

  it.each([
    { name: 'current variant price', salePrice: null, unitPrice: 1200, lineTotal: 2400, grandTotal: 2900 },
    { name: 'active flash price', salePrice: 900, unitPrice: 900, lineTotal: 1800, grandTotal: 2300 },
  ])('returns authoritative line and shop amounts for $name', async ({ salePrice, unitPrice, lineTotal, grandTotal }) => {
    const service = await setupSuccess()
    if (salePrice !== null) {
      vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([{ id: 'flash-item-1', variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', salePrice } as never])
    }
    const quote = await service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })
    expect(quote).toMatchObject({
      subtotal: lineTotal,
      shippingTotal: 500,
      grandTotal,
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', shopId: '11111111-1111-4111-8111-111111111111', unitPrice, lineTotal }],
      shops: [{ shopId: '11111111-1111-4111-8111-111111111111', subtotal: lineTotal }],
    })
  })

  it.each([
    { name: 'zero price', price: 0, quantity: 1, shippingFee: 0 },
    { name: 'negative price', price: -1, quantity: 1, shippingFee: 0 },
    { name: 'fractional price', price: 1.5, quantity: 1, shippingFee: 0 },
    { name: 'unsafe price', price: 9007199254740992, quantity: 1, shippingFee: 0 },
    { name: 'subtotal overflow', price: 9007199254740991, quantity: 2, shippingFee: 0 },
    { name: 'grand total overflow', price: 9007199254740991, quantity: 1, shippingFee: 1 },
    { name: 'negative shipping', price: 100, quantity: 1, shippingFee: -1 },
    { name: 'fractional shipping', price: 100, quantity: 1, shippingFee: 1.5 },
    { name: 'unsafe shipping', price: 100, quantity: 1, shippingFee: 9007199254740992 },
    { name: 'nonfinite shipping', price: 100, quantity: 1, shippingFee: Infinity },
    { name: 'negative quantity', price: 100, quantity: -1, shippingFee: 0 },
    { name: 'zero quantity', price: 100, quantity: 0, shippingFee: 0 },
    { name: 'fractional quantity', price: 100, quantity: 1.5, shippingFee: 0 },
  ])('rejects $name before persisting checkout', async ({ price, quantity, shippingFee }) => {
    const service = await setupSuccess({ cart: createCart({ items: [createItem({ price, quantity, shippingFee })] }) })
    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'card',
    })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED', status: 400 })
    expect(repo.commitCheckout).not.toHaveBeenCalled()
  })

  it('rejects a BigInt price beyond the exact numeric API range', async () => {
    const item = createItem({ quantity: 1, shippingFee: 0 })
    item.variant.price = 9007199254740993n
    const service = await setupSuccess({ cart: createCart({ items: [item] }) })
    await expect(service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
      .rejects.toMatchObject({ code: 'CHECKOUT_FAILED', status: 400 })
  })

  it('preserves a one-satang quote and the maximum safe integer without fees', async () => {
    const small = await setupSuccess({ cart: createCart({ items: [createItem({ price: 1, quantity: 1, shippingFee: 0 })] }) })
    expect(await small.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
      .toMatchObject({ subtotal: 1, discountTotal: 0, shippingTotal: 0, grandTotal: 1 })
    const large = await setupSuccess({ cart: createCart({ items: [createItem({ price: 9007199254740991, quantity: 1, shippingFee: 0 })] }) })
    expect(await large.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
      .toMatchObject({ subtotal: 9007199254740991, grandTotal: 9007199254740991 })
  })

  it('calculates a mixed multi-shop basket against literal item, coupon, coin and shipping amounts', async () => {
    const service = await setupSuccess({
      couponDiscountCents: 640,
      cart: createCart({ items: [
        createItem({ id: 'one', price: 1299, quantity: 3, shippingFee: 350 }),
        createItem({ id: 'two', variantId: 'variant-two', price: 250, quantity: 2, shippingFee: 350 }),
        createItem({ id: 'three', shopId: 'shop-two', variantId: 'variant-three', price: 999, quantity: 2, shippingFee: 450 }),
      ] }),
    })
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(20n)
    const quote = await service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', couponCode: 'SAVE', coinsToUse: 12 })
    expect(quote).toMatchObject({ subtotal: 6395, discountTotal: 1840, shippingTotal: 800, taxTotal: 0, grandTotal: 5355, coinsApplied: 12 })
    expect(quote.items).toEqual([
      { id: 'one', shopId: '11111111-1111-4111-8111-111111111111', unitPrice: 1299, lineTotal: 3897 },
      { id: 'two', shopId: '11111111-1111-4111-8111-111111111111', unitPrice: 250, lineTotal: 500 },
      { id: 'three', shopId: 'shop-two', unitPrice: 999, lineTotal: 1998 },
    ])
    expect(quote.shops).toEqual([
      { shopId: '11111111-1111-4111-8111-111111111111', subtotal: 4397 },
      { shopId: 'shop-two', subtotal: 1998 },
    ])
    await expect(service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', couponCode: 'SAVE', coinsToUse: 13 }))
      .rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })

  it.each([
    { subtotal: 499, coins: 1, rejected: true, grandTotal: 499 },
    { subtotal: 500, coins: 1, rejected: false, grandTotal: 400 },
  ])('checks coin cap at the $subtotal-satang boundary', async ({ subtotal, coins, rejected, grandTotal }) => {
    const service = await setupSuccess({ cart: createCart({ items: [createItem({ price: subtotal, quantity: 1, shippingFee: 0 })] }) })
    vi.mocked(repo.findBuyerCoinBalance).mockResolvedValue(20n)
    const quote = service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', coinsToUse: coins })
    if (rejected) await expect(quote).rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
    else expect(await quote).toMatchObject({ subtotal, discountTotal: 100, grandTotal })
  })

  it.each([-1, 1.5, NaN, 9007199254740992])('rejects malformed requested coins %s', async (coinsToUse) => {
    const service = await setupSuccess()
    await expect(service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', coinsToUse }))
      .rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })

  it.each([-1, 1.5, Infinity, 9007199254740992])('rejects malformed active flash price %s', async (salePrice) => {
    const service = await setupSuccess()
    vi.mocked(repo.findActiveFlashSaleItemsForCheckout).mockResolvedValue([{ id: 'flash-item-1', variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', salePrice } as never])
    await expect(service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
      .rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })

  it('rejects shipping sum overflow even when each fee is a safe integer', async () => {
    const service = await setupSuccess({ cart: createCart({ items: [
      createItem({ id: 'one', price: 1, quantity: 1, shippingFee: 9007199254740991 }),
      createItem({ id: 'two', shopId: 'shop-two', price: 1, quantity: 1, shippingFee: 9007199254740991 }),
    ] }) })
    await expect(service.quoteCheckout(createActor(), { cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
      .rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })

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
