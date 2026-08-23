import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { PrismaCheckoutRepository, type CreatePendingOrderInput } from './checkout.repository.ts'

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
      totals: {
        subtotal: 2400,
        discountTotal: 0,
        shippingTotal: 350,
        taxTotal: 0,
        grandTotal: 2750,
        currency: 'THB',
      },
      items: [{
        variantId: 'variant-1',
        quantity: 2,
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
      paymentMethod: 'mock',
      locale: 'en',
    } as unknown as CreatePendingOrderInput

    await expect(repository.createPendingOrder(input)).resolves.toMatchObject({
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
  })
})
