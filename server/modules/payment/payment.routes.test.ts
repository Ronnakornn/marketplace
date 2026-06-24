import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createPaymentRoutes } from './payment.routes.ts'
import { PaymentServiceError } from './payment.errors.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

vi.mock('#server/lib/prisma.ts', () => ({
  prisma: {
    shop: {
      count: vi.fn(),
    },
    sellerApplication: {
      findFirst: vi.fn(),
    },
  },
}))

const paymentId = '14141414-1414-4141-8141-141414141414'

function mockAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
      ...overrides,
    },
  }
}

function createContainer() {
  return {
    paymentService: {
      handleWebhook: vi.fn(),
      handleMockPaymentEvent: vi.fn(async () => ({ ok: true, code: 'PAYMENT_PAID' })),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createPaymentRoutes(container))
}

describe('payment routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires authentication for mock payment events', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp().handle(new Request(`http://localhost/api/payments/mock/${paymentId}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType: 'payment.paid' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(401)
  })

  it('routes mock payment events to the payment service with authenticated buyer context', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)

    const response = await createApp(container).handle(new Request(`http://localhost/api/payments/mock/${paymentId}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType: 'payment.paid' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, code: 'PAYMENT_PAID' })
    expect(container.paymentService.handleMockPaymentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', role: 'USER' }),
      paymentId,
      { eventType: 'payment.paid' },
    )
  })

  it('returns consistent payment errors for admin misuse', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ id: 'admin-1', role: 'ADMIN' }) as any)
    vi.mocked(container.paymentService.handleMockPaymentEvent).mockRejectedValueOnce(
      new PaymentServiceError('Only buyers can trigger mock payment events', 403, 'PAYMENT_FORBIDDEN'),
    )

    const response = await createApp(container).handle(new Request(`http://localhost/api/payments/mock/${paymentId}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType: 'payment.failed' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PAYMENT_FORBIDDEN',
      },
    })
  })

  it('validates supported mock event types only', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)

    const response = await createApp().handle(new Request(`http://localhost/api/payments/mock/${paymentId}/events`, {
      method: 'POST',
      body: JSON.stringify({ eventType: 'payment.expired' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(422)
  })
})
