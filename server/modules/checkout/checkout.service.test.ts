import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '#generated/client/enums.ts'
import { PromotionServiceError } from '#server/modules/promotion/promotion.errors.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type {
  CheckoutAddress,
  CheckoutCart,
  CheckoutCartItem,
  CreatedCheckoutOrder,
  CreatePendingOrderInput,
  ICheckoutRepository,
} from './checkout.repository.ts'
import { CheckoutService } from './checkout.service.ts'

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
    findCartForCheckout: vi.fn(),
    findAddressForUser: vi.fn(),
    findCouponByCode: vi.fn(),
    countCouponRedemptionsForUser: vi.fn(),
    createPendingOrder: vi.fn(),
  }
}

let repo: ICheckoutRepository
let promotionService: Pick<PromotionService, 'validateCouponForSubtotal'>

function createActor(role: Role = 'USER') {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
  }
}

function createAddress(overrides: Partial<CheckoutAddress> = {}): CheckoutAddress {
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
  priceCents: number
  currency: string
  productStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  variantStatus: 'ACTIVE' | 'INACTIVE'
  shopStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
  quantityOnHand: number
  quantityReserved: number
}> = {}): CheckoutCartItem {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const variantId = overrides.variantId ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  return {
    id: overrides.id ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    variantId,
    quantity: overrides.quantity ?? 2,
    unitPriceCents: 1000,
    currency: overrides.currency ?? 'USD',
    createdAt: now,
    updatedAt: now,
    variant: {
      id: variantId,
      productId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      sku: 'TEE-BLK-M',
      title: 'Black / M',
      priceCents: overrides.priceCents ?? 1200,
      currency: overrides.currency ?? 'USD',
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
        shopId: '11111111-1111-4111-8111-111111111111',
        title: 'Oversized Cotton Tee',
        slug: 'oversized-cotton-tee',
        description: null,
        status: overrides.productStatus ?? 'ACTIVE',
        createdAt: now,
        updatedAt: now,
        shop: {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Everyday Studio',
          slug: 'everyday-studio',
          status: overrides.shopStatus ?? 'ACTIVE',
        },
      },
    },
  }
}

function createCart(overrides: Partial<{
  userId: string
  status: 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED'
  items: CheckoutCartItem[]
}> = {}): CheckoutCart {
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

function createCreatedOrder(input?: Partial<CreatePendingOrderInput>): CreatedCheckoutOrder {
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
      subtotalCents: input?.totals?.subtotalCents ?? 2400,
      discountTotalCents: input?.totals?.discountTotalCents ?? 0,
      shippingTotalCents: input?.totals?.shippingTotalCents ?? 500,
      taxTotalCents: input?.totals?.taxTotalCents ?? 0,
      grandTotalCents: input?.totals?.grandTotalCents ?? 2900,
      currency: input?.totals?.currency ?? 'USD',
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
      amountCents: input?.totals?.grandTotalCents ?? 2900,
      currency: input?.totals?.currency ?? 'USD',
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
  couponError?: PromotionServiceError
} = {}) {
  repo = createRepoMock()
  promotionService = {
    validateCouponForSubtotal: vi.fn(),
  }
  vi.mocked(repo.findCartForCheckout).mockResolvedValue(overrides.cart ?? createCart())
  vi.mocked(repo.findAddressForUser).mockResolvedValue(overrides.address === undefined ? createAddress() : overrides.address)
  vi.mocked(repo.findCouponByCode).mockResolvedValue(null)
  vi.mocked(repo.countCouponRedemptionsForUser).mockResolvedValue(0)
  vi.mocked(repo.createPendingOrder).mockImplementation(async (input) => createCreatedOrder(input))
  if (overrides.couponError) {
    vi.mocked(promotionService.validateCouponForSubtotal).mockRejectedValue(overrides.couponError)
  } else {
    vi.mocked(promotionService.validateCouponForSubtotal).mockResolvedValue({
      couponId: '99999999-9999-4999-8999-999999999999',
      couponCode: 'SAVE10',
      discountCents: overrides.couponDiscountCents ?? 0,
      subtotalCents: 2400,
    })
  }
  return new CheckoutService(createAppContext(), repo, promotionService as PromotionService)
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
      totalCents: 2660,
    })
    expect(repo.transaction).toHaveBeenCalledOnce()
    expect(promotionService.validateCouponForSubtotal).toHaveBeenCalledWith(repo, {
      userId: 'user-1',
      couponCode: ' save10 ',
      subtotalCents: 2400,
    })
    expect(repo.createPendingOrder).toHaveBeenCalledWith(expect.objectContaining({
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId: 'user-1',
      paymentMethod: 'stripe',
      coupon: { id: '99999999-9999-4999-8999-999999999999' },
      totals: {
        subtotalCents: 2400,
        discountTotalCents: 240,
        shippingTotalCents: 500,
        taxTotalCents: 0,
        grandTotalCents: 2660,
        currency: 'USD',
      },
    }))
  })

  it('uses current trusted variant price for order item snapshots instead of cart captured price', async () => {
    const service = await setupSuccess()
    await service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })

    const input = vi.mocked(repo.createPendingOrder).mock.calls[0]![0]
    expect(input.items[0]!.unitPriceCents).toBe(1000)
    expect(input.items[0]!.variant.priceCents).toBe(1200)
    expect(input.items[0]!.variant.product.title).toBe('Oversized Cotton Tee')
    expect(input.items[0]!.variant.product.shop.name).toBe('Everyday Studio')
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
    expect(vi.mocked(repo.createPendingOrder).mock.calls[0]![0].totals).toMatchObject({
      discountTotalCents: 2400,
      grandTotalCents: 500,
    })

    const cappedDiscountService = await setupSuccess({ couponDiscountCents: 999999 })
    await cappedDiscountService.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      couponCode: 'BIGSAVE',
      paymentMethod: 'stripe',
    })
    expect(vi.mocked(repo.createPendingOrder).mock.calls[0]![0].totals).toMatchObject({
      discountTotalCents: 2400,
      grandTotalCents: 500,
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

  it('rejects seller/admin users and rolls back through repository transaction failures', async () => {
    await expect((await setupSuccess()).createCheckout(createActor('SELLER'), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CHECKOUT_FORBIDDEN' })

    const service = await setupSuccess()
    vi.mocked(repo.createPendingOrder).mockRejectedValue(new Error('forced rollback'))

    await expect(service.createCheckout(createActor(), {
      cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      paymentMethod: 'stripe',
    })).rejects.toMatchObject({ code: 'CHECKOUT_FAILED' })
  })
})
