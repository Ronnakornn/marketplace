import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { PaymentServiceError } from '#server/modules/payment/payment.errors.ts'
import { createOrderRoutes } from './order.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: { shop: { count: vi.fn() }, shopStaff: { count: vi.fn() }, sellerApplication: { findFirst: vi.fn() } } }))

const orderId = '13131313-1313-4131-8131-131313131313'

function createContainer() {
  return {
    orderService: { listBuyerOrders: vi.fn(), getBuyerOrder: vi.fn(), getBuyerOrderTracking: vi.fn(), listSellerOrders: vi.fn(), getSellerOrder: vi.fn() },
    paymentService: { cancelBuyerOrder: vi.fn().mockResolvedValue({ ok: true }) },
  } as any
}

describe('order routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires authentication to cancel an order', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const response = await new Elysia().use(createOrderRoutes(createContainer())).handle(new Request(`http://localhost/api/orders/${orderId}/cancel`, { method: 'POST' }))
    expect(response.status).toBe(401)
  })

  it('sends buyer cancellation to payment state transition service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as any)
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request(`http://localhost/api/orders/${orderId}/cancel`, { method: 'POST' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(container.paymentService.cancelBuyerOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 'buyer-1' }), orderId)
  })

  it('returns cancellation state errors as 409', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as any)
    vi.mocked(container.paymentService.cancelBuyerOrder).mockRejectedValue(new PaymentServiceError('Order can no longer be cancelled', 409, 'ORDER_CANCELLATION_NOT_ALLOWED'))
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request(`http://localhost/api/orders/${orderId}/cancel`, { method: 'POST' }))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'ORDER_CANCELLATION_NOT_ALLOWED' } })
  })
})
