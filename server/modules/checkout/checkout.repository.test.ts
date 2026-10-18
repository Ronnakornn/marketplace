import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository, type CheckoutCommitmentInput } from './checkout.repository.ts'

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

describe('PrismaCheckoutRepository', () => {
  it('selects earliest active promotions per requested variant without hiding exhausted quotas', async () => {
    const rows = [{ id: 'sale', variantId: 'variant', salePrice: 900n, stockLimit: 1, soldCount: 1, perUserLimit: 1 }]
    const prisma = { flashSaleItem: { findMany: vi.fn().mockResolvedValue(rows) } }
    const repository = new PrismaCheckoutRepository({ logger: createLogger(), config: { environment: 'test' } }, prisma as unknown as PrismaClient)
    const now = new Date('2026-10-18T00:00:00Z')
    expect(await repository.findActiveFlashSaleItemsForCheckout(['variant', 'variant'], now)).toEqual(rows)
    expect(prisma.flashSaleItem.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { variantId: { in: ['variant'] }, isActive: true, flashSale: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } } },
      select: { id: true, variantId: true, salePrice: true, stockLimit: true, soldCount: true, perUserLimit: true },
      distinct: ['variantId'], orderBy: { flashSale: { endsAt: 'asc' } },
    })
    await repository.findActiveFlashSaleItemsForCheckout(['variant'], now, ['held-sale'])
    expect(prisma.flashSaleItem.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['held-sale'] } }) }))
    await repository.findActiveFlashSaleItemsForCheckout([], now)
    await repository.findActiveFlashSaleItemsForCheckout(['variant'], now, [])
    expect(prisma.flashSaleItem.findMany).toHaveBeenCalledTimes(2)
  })

  it('rejects an invalid commission rate before writing checkout money', async () => {
    const prisma = { checkout: { create: vi.fn() } }
    vi.stubEnv('PLATFORM_COMMISSION_BPS', '10001')
    try {
      const repo = new PrismaCheckoutRepository({ logger: createLogger(), config: { environment: 'test' } }, prisma as unknown as PrismaClient)
      await expect(repo.commitCheckout({ acceptedQuote: {} } as unknown as CheckoutCommitmentInput)).rejects.toMatchObject({ code: 'COMMISSION_RULE_NOT_FOUND' })
      expect(prisma.checkout.create).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects a seller gross earning beyond safe integer limits even when discounted buyer cash fits', async () => {
    const prisma = { checkout: { create: vi.fn() }, order: { create: vi.fn() }, payment: { create: vi.fn() } }
    const repo = new PrismaCheckoutRepository({ logger: createLogger(), config: { environment: 'test' } }, prisma as unknown as PrismaClient)
    const input = { acceptedQuote: {
      totals: { subtotal: 9007199254740991, discountTotal: 4000, shippingTotal: 4000, taxTotal: 0, grandTotal: 9007199254740991, currency: 'THB' },
      couponDiscount: 4000, couponShopId: null, coinDiscount: 0, freeShippingShopIds: [],
      items: [{ id: 'item', unitPrice: 9007199254740991, quantity: 1,
        variant: { product: { shop: { id: 'shop-1', settings: { shippingFee: 4000 } } } } }],
    } } as unknown as CheckoutCommitmentInput
    await expect(repo.commitCheckout(input)).rejects.toMatchObject({ status: 409, code: 'INVALID_MONEY_AMOUNT' })
    expect(prisma.checkout.create).not.toHaveBeenCalled()
    expect(prisma.order.create).not.toHaveBeenCalled()
    expect(prisma.payment.create).not.toHaveBeenCalled()
  })

  it('persists exact bigint item and shop totals from bounded operational quote prices', async () => {
    const order = { id: 'order-1' }
    const payment = { id: 'payment-1' }
    const prisma = {
      checkout: {
        create: vi.fn().mockResolvedValue({ id: 'checkout-1' }),
      },
      inventory: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryReservation: {
        create: vi.fn().mockResolvedValue({ id: 'reservation-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        create: vi.fn().mockResolvedValue(order),
      },
      payment: {
        create: vi.fn().mockResolvedValue(payment),
      },
      itemSaleSnapshot: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      cart: {
        update: vi.fn().mockResolvedValue({ id: 'cart-1' }),
      },
      cartItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      flashSaleItem: {
        findUnique: vi.fn().mockResolvedValue({ stockLimit: 10, soldCount: 1, perUserLimit: 3 }),
      },
      flashSaleReservation: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
        create: vi.fn().mockResolvedValue({ id: 'flash-reservation-1' }),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    }
    const repository = new PrismaCheckoutRepository(
      { logger: createLogger(), config: { environment: 'test' } },
      prisma as unknown as PrismaClient,
    )
    const input = {
      cartId: 'cart-1',
      userId: 'buyer-1',
      orderNumber: 'ORD-TEST',
      checkoutExpiresAt: new Date('2026-07-28T10:00:00.000Z'),
      address: {
        recipientName: 'Buyer',
        phone: null,
        line1: '1 Market Road',
        line2: null,
        city: 'Bangkok',
        region: null,
        postalCode: '10110',
        country: 'TH',
      },
      acceptedQuote: {
        totals: {
          subtotal: 2400,
          discountTotal: 0,
          shippingTotal: 350,
          taxTotal: 0,
          grandTotal: 2750,
          currency: 'THB',
        },
        items: [{
        id: 'cart-item-1',
        variantId: 'variant-1',
        quantity: 2,
        unitPrice: 1200,
        flashSaleItemId: 'flash-item-1',
        variant: {
          price: 1200,
          currency: 'THB',
          title: 'Default',
          titleTh: null,
          titleEn: 'Planner',
          sku: 'PLANNER-1',
          inventory: {
            id: 'inventory-1',
            quantityOnHand: 10,
          },
          product: {
            title: 'Default product',
            titleTh: null,
            titleEn: 'Home Organization Planner',
            slug: 'home-organization-planner',
            shop: {
              id: 'shop-1',
              name: 'Home Shop',
              slug: 'home-shop',
              settings: { shippingFee: 350 },
            },
          },
        },
        }],
        couponDiscount: 0,
        couponShopId: null,
        coinDiscount: 0,
        freeShippingShopIds: [],
      },
      paymentProvider: 'mock',
      locale: 'en',
    } as unknown as CheckoutCommitmentInput

    await expect(repository.commitCheckout(input)).resolves.toMatchObject({
      checkoutId: 'checkout-1',
      order,
      payment,
    })
    expect(prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        shopOrders: {
          create: [expect.objectContaining({
            shopId: 'shop-1',
            subtotal: 2400n,
            shippingTotal: 350n,
            grandTotal: 2750n,
          })],
        },
        items: {
          create: [expect.objectContaining({
            unitPrice: 1200n,
            lineTotal: 2400n,
          })],
        },
      }),
    }))
    expect(prisma.inventoryReservation.updateMany).toHaveBeenCalledWith({
      where: { checkoutId: 'checkout-1', status: 'ACTIVE' },
      data: { orderId: 'order-1' },
    })
    expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: 'cart-1', id: { in: ['cart-item-1'] } },
    })
    expect(prisma.itemSaleSnapshot.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      originalQuantity: 2, grossMerchandise: 2400n, sellerCouponDiscount: 0n,
      platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: 2400n,
    })] })
    expect(prisma.flashSaleReservation.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        flashSaleItemId: 'flash-item-1',
        status: 'ACTIVE',
      },
    }))
    expect(prisma.$queryRaw).toHaveBeenCalled()
    // A concurrent sale may invalidate the cart snapshot before reservation.
    prisma.$executeRaw.mockResolvedValueOnce(0)
    prisma.order.create.mockClear()
    await expect(repository.commitCheckout(input)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect(prisma.order.create).not.toHaveBeenCalled()
    const sql = prisma.$executeRaw.mock.calls[0]![0].join('?')
    expect(sql).toContain('"quantityOnHand" - "quantityReserved" >=')

    expect(prisma.flashSaleReservation.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        flashSaleItemId: 'flash-item-1',
        userId: 'buyer-1',
        status: { in: ['COMMITTED', 'ACTIVE'] },
      },
    }))

    prisma.$executeRaw.mockResolvedValue(1)
    prisma.flashSaleItem.findUnique.mockResolvedValue({ stockLimit: 1, soldCount: 1, perUserLimit: 3 })
    prisma.flashSaleReservation.create.mockClear()
    await expect(repository.commitCheckout(input)).rejects.toMatchObject({ code: 'CHECKOUT_FAILED', message: 'Flash sale quota is no longer available' })
    expect(prisma.order.create).not.toHaveBeenCalled()
    expect(prisma.flashSaleReservation.create).not.toHaveBeenCalled()

    prisma.flashSaleItem.findUnique.mockResolvedValue({ stockLimit: 10, soldCount: 0, perUserLimit: 1 })
    await expect(repository.commitCheckout(input)).rejects.toMatchObject({ code: 'CHECKOUT_FAILED', message: 'Flash sale quota is no longer available' })
    expect(prisma.order.create).not.toHaveBeenCalled()
    expect(prisma.flashSaleReservation.create).not.toHaveBeenCalled()

  })

  it.each([
    { name: 'shop and coin discounts', prices: [1000, 2000], shipping: [100, 200], coupon: 1000, couponShopId: 'shop-1',
      coins: 600, subtotal: 3000, discount: 1600, shippingTotal: 300, grand: 1700, discounts: [1000n, 600n], shopTotals: [100n, 1600n] },
    { name: 'near-limit proportional discount', prices: [6004799503160660, 3002399751580331], shipping: [0, 0], coupon: 9007199254740891, couponShopId: null,
      coins: 0, subtotal: 9007199254740991, discount: 9007199254740891, shippingTotal: 0, grand: 100,
      discounts: [6004799503160593n, 3002399751580298n], shopTotals: [67n, 33n] },
  ])('keeps two-shop settlement totals exact for $name', async (example) => {
    const prisma = {
      checkout: { create: vi.fn().mockResolvedValue({ id: 'checkout-1' }) },
      inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      inventoryReservation: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
      payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1' }) },
      itemSaleSnapshot: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
      cart: { update: vi.fn().mockResolvedValue({}) },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(1),
    }
    const repository = new PrismaCheckoutRepository(
      { logger: createLogger(), config: { environment: 'test' } }, prisma as unknown as PrismaClient,
    )
    const item = (id: string, shopId: string, unitPrice: number, shippingFee: number) => ({
      id, variantId: `variant-${id}`, quantity: 1, unitPrice, flashSaleItemId: null,
      variant: {
        price: unitPrice, currency: 'THB', title: id, titleTh: null, titleEn: id, sku: id,
        inventory: { id: `inventory-${id}`, quantityOnHand: 10 },
        product: { title: id, titleTh: null, titleEn: id, slug: id, shop: { id: shopId, name: shopId, slug: shopId, settings: { shippingFee } } },
      },
    })
    const input = {
      cartId: 'cart-1', userId: 'buyer-1', orderNumber: 'ORD-SPLIT', checkoutExpiresAt: new Date('2026-09-04T00:00:00.000Z'),
      address: { recipientName: 'Buyer', phone: null, line1: '1 Road', line2: null, city: 'Bangkok', region: null, postalCode: '10110', country: 'TH' },
      acceptedQuote: {
        totals: { subtotal: example.subtotal, discountTotal: example.discount, shippingTotal: example.shippingTotal, taxTotal: 0, grandTotal: example.grand, currency: 'THB' },
        items: [item('one', 'shop-1', example.prices[0]!, example.shipping[0]!), item('two', 'shop-2', example.prices[1]!, example.shipping[1]!)],
        couponDiscount: example.coupon, couponShopId: example.couponShopId, coinDiscount: example.coins, freeShippingShopIds: [],
      },
      paymentProvider: 'mock', locale: 'en',
    } as unknown as CheckoutCommitmentInput

    await repository.commitCheckout(input)

    const orderData = prisma.order.create.mock.calls[0]![0].data
    const shopOrders = orderData.shopOrders.create as Array<{ subtotal: bigint; discountTotal: bigint; shippingTotal: bigint; grandTotal: bigint }>
    expect(shopOrders).toHaveLength(2)
    expect(shopOrders.map((row) => row.discountTotal)).toEqual(example.discounts)
    expect(shopOrders.map((row) => row.grandTotal)).toEqual(example.shopTotals)
    expect(shopOrders.reduce((sum, row) => sum + row.subtotal, 0n)).toBe(BigInt(orderData.subtotal))
    expect(shopOrders.reduce((sum, row) => sum + row.discountTotal, 0n)).toBe(BigInt(orderData.discountTotal))
    expect(shopOrders.reduce((sum, row) => sum + row.shippingTotal, 0n)).toBe(BigInt(orderData.shippingTotal))
    expect(shopOrders.reduce((sum, row) => sum + row.grandTotal, 0n)).toBe(BigInt(orderData.grandTotal))
    const snapshots = prisma.itemSaleSnapshot.createMany.mock.calls[0][0].data
    if (example.couponShopId) {
      expect(snapshots.map((row: { sellerCouponDiscount: bigint; platformCouponDiscount: bigint; coinDiscount: bigint; buyerMerchandise: bigint }) =>
        [row.sellerCouponDiscount, row.platformCouponDiscount, row.coinDiscount, row.buyerMerchandise])).toEqual([
        [1000n, 0n, 0n, 0n], [0n, 0n, 600n, 1400n],
      ])
      expect(orderData.shopOrders.create.map((row: { saleSnapshot: { create: { commissionBase: bigint; originalCommission: bigint } } }) =>
        [row.saleSnapshot.create.commissionBase, row.saleSnapshot.create.originalCommission])).toEqual([[0n, 0n], [2000n, 200n]])
    } else {
      expect(snapshots.map((row: { sellerCouponDiscount: bigint; platformCouponDiscount: bigint; coinDiscount: bigint; buyerMerchandise: bigint }) =>
        [row.sellerCouponDiscount, row.platformCouponDiscount, row.coinDiscount, row.buyerMerchandise])).toEqual([
        [0n, 6004799503160593n, 0n, 67n], [0n, 3002399751580298n, 0n, 33n],
      ])
    }
  })

  it.each([{ couponShopId: null, sellerWaiver: 0n, platformSubsidy: 4000n },
    { couponShopId: 'shop-1', sellerWaiver: 4000n, platformSubsidy: 0n }])('snapshots the payer for free shipping from $couponShopId', async (example) => {
    const prisma = {
      checkout: { create: vi.fn().mockResolvedValue({ id: 'checkout-1' }) },
      inventoryReservation: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
      itemSaleSnapshot: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      couponRedemption: { create: vi.fn().mockResolvedValue({}) },
      payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1' }) },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $executeRaw: vi.fn().mockResolvedValue(1),
    }
    const repo = new PrismaCheckoutRepository({ logger: createLogger(), config: { environment: 'test' } }, prisma as unknown as PrismaClient)
    const input = {
      cartId: 'cart', userId: 'buyer', orderNumber: 'ORD-SHIPPING', paymentProvider: 'mock', checkoutExpiresAt: new Date(),
      address: { recipientName: 'Buyer', phone: null, line1: '1 Road', line2: null, city: 'Bangkok', region: null, postalCode: '10110', country: 'TH' },
      acceptedQuote: {
        totals: { subtotal: 100000, discountTotal: 0, shippingTotal: 0, taxTotal: 0, grandTotal: 100000, currency: 'THB' },
        coupon: { id: 'coupon-1' }, couponCode: 'FREE_SHIP', couponDiscount: 0, couponShopId: example.couponShopId, coinDiscount: 0, freeShippingShopIds: ['shop-1'],
        items: [{ id: 'cart-item', variantId: 'variant', quantity: 1, unitPrice: 100000,
          variant: { currency: 'THB', title: 'Item', sku: 'SKU', inventory: { id: 'inventory' },
            product: { title: 'Item', slug: 'item', shop: { id: 'shop-1', name: 'Shop', slug: 'shop', settings: { shippingFee: 4000 } } } } }],
      },
    } as unknown as CheckoutCommitmentInput
    await repo.commitCheckout(input)
    expect(prisma.order.create.mock.calls[0][0].data.shopOrders.create[0].saleSnapshot.create).toMatchObject({
      policyVersion: 1, commissionBase: 100000n, commissionBps: 1000, originalCommission: 10000n,
      originalShipping: 4000n, buyerShipping: 0n, sellerShippingWaiver: example.sellerWaiver, platformShippingSubsidy: example.platformSubsidy,
    })
    expect(prisma.itemSaleSnapshot.createMany.mock.calls[0][0].data[0]).toMatchObject({ couponId: 'coupon-1', couponCode: 'FREE_SHIP' })
  })
})
