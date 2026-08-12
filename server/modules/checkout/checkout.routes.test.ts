import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createCheckoutRoutes } from './checkout.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createContainer() {
  return {
    checkoutService: {
      createCheckout: vi.fn().mockResolvedValue({
        orderId: 'order-1',
        orderNo: 'ORD-TEST',
        paymentId: 'payment-1',
        paymentStatus: 'pending',
        paymentUrl: '/th/payment/mock/payment-1',
        totalCents: 2900,
      }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createCheckoutRoutes(container))
}

function mockAuth(role: 'USER' | 'ADMIN' = 'USER') {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      name: role,
      role,
      status: 'ACTIVE',
      emailVerified: true,
    },
  } as any)
}

const validBody = {
  cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  cartItemIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
  addressId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  couponCode: 'SAVE10',
  paymentMethod: 'stripe',
  shippingMethod: 'flat',
}

describe('checkout routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated checkout', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp().handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(response.status).toBe(401)
  })

  it('passes valid buyer checkout requests to the service', async () => {
    mockAuth('USER')
    const container = createContainer()

    const response = await createApp(container).handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      paymentUrl: '/th/payment/mock/payment-1',
    })
    expect(container.checkoutService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', role: 'USER' }),
      validBody,
    )
  })

  it('lets the service reject seller and admin users', async () => {
    mockAuth('ADMIN')
    const container = createContainer()

    await createApp(container).handle(new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    }))

    expect(container.checkoutService.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'ADMIN' }),
      validBody,
    )
  })
})
