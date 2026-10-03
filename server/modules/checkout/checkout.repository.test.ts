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
  it('creates order item totals when the Prisma result extension returns BigInt prices as numbers', async () => {
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
            subtotal: 2400,
            shippingTotal: 350,
            grandTotal: 2750,
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
    expect(prisma.flashSaleReservation.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        flashSaleItemId: 'flash-item-1',
        status: 'ACTIVE',
        expiresAt: { gt: expect.any(Date) },
      }),
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
      where: expect.objectContaining({
        flashSaleItemId: 'flash-item-1',
        userId: 'buyer-1',
        OR: [
          { status: 'COMMITTED' },
          { status: 'ACTIVE', expiresAt: { gt: expect.any(Date) } },
        ],
      }),
    }))
  })

  it.each([
    { name: 'shop and coin discounts', prices: [1000, 2000], shipping: [100, 200], coupon: 1000, couponShopId: 'shop-1',
      coins: 600, subtotal: 3000, discount: 1600, shippingTotal: 300, grand: 1700, discounts: [1000, 600], shopTotals: [100, 1600] },
    { name: 'near-limit proportional discount', prices: [6004799503160660, 3002399751580331], shipping: [0, 0], coupon: 9007199254740891, couponShopId: null,
      coins: 0, subtotal: 9007199254740991, discount: 9007199254740891, shippingTotal: 0, grand: 100,
      discounts: [6004799503160593, 3002399751580298], shopTotals: [67, 33] },
  ])('keeps two-shop settlement totals exact for $name', async (example) => {
    const prisma = {
      checkout: { create: vi.fn().mockResolvedValue({ id: 'checkout-1' }) },
      inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      inventoryReservation: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
      payment: { create: vi.fn().mockResolvedValue({ id: 'payment-1' }) },
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
    const shopOrders = orderData.shopOrders.create as Array<{ subtotal: number; discountTotal: number; shippingTotal: number; grandTotal: number }>
    expect(shopOrders).toHaveLength(2)
    expect(shopOrders.map((row) => row.discountTotal)).toEqual(example.discounts)
    expect(shopOrders.map((row) => row.grandTotal)).toEqual(example.shopTotals)
    expect(shopOrders.reduce((sum, row) => sum + row.subtotal, 0)).toBe(orderData.subtotal)
    expect(shopOrders.reduce((sum, row) => sum + row.discountTotal, 0)).toBe(orderData.discountTotal)
    expect(shopOrders.reduce((sum, row) => sum + row.shippingTotal, 0)).toBe(orderData.shippingTotal)
    expect(shopOrders.reduce((sum, row) => sum + row.grandTotal, 0)).toBe(orderData.grandTotal)
  })
})
