import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { PaymentServiceError } from '#server/modules/payment/payment.errors.ts'
import { CartServiceError } from '#server/modules/cart/cart.errors.ts'
import { createOrderRoutes } from './order.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: { shop: { count: vi.fn() }, shopStaff: { count: vi.fn() }, sellerApplication: { findFirst: vi.fn() } } }))

const orderId = '13131313-1313-4131-8131-131313131313'

function createContainer() {
  return {
    orderService: { listBuyerOrders: vi.fn(), getBuyerOrder: vi.fn(), getBuyerOrderTracking: vi.fn(), listSellerOrders: vi.fn(), getSellerOrder: vi.fn() },
    paymentService: { cancelBuyerOrder: vi.fn().mockResolvedValue({ ok: true }) },
    cartService: { buyAgain: vi.fn().mockResolvedValue({ cartId: 'cart-1', items: [{ kind: 'added', unitPrice: 9007199254740993123n, currency: 'THB', addedQuantity: 2, finalQuantity: 3 }] }) },
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

  it('requires authentication to buy again', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const container = createContainer()
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request(`http://localhost/api/orders/${orderId}/buy-again`, { method: 'POST' }))
    expect(response.status).toBe(401)
    expect(container.cartService.buyAgain).not.toHaveBeenCalled()
  })

  it('uses authenticated buyer and path order ID without trusting body prices or variants', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as any)
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request(`http://localhost/api/orders/${orderId}/buy-again`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variantId: 'foreign-variant', quantity: 1000, unitPrice: 1 }),
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ cartId: 'cart-1', items: [{ kind: 'added', unitPrice: '9007199254740993123', currency: 'THB', addedQuantity: 2, finalQuantity: 3 }] })
    expect(container.cartService.buyAgain).toHaveBeenCalledWith(expect.objectContaining({ id: 'buyer-1' }), orderId)
  })

  it.each([
    [404, 'ORDER_NOT_FOUND'], [403, 'CART_FORBIDDEN'], [409, 'CART_STATE_CONFLICT'],
  ])('returns buy-again domain error %i %s', async (status, code) => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as any)
    vi.mocked(container.cartService.buyAgain).mockRejectedValue(new CartServiceError('Unavailable', status, code))
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request(`http://localhost/api/orders/${orderId}/buy-again`, { method: 'POST' }))
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: { code, message: 'Unavailable', details: {} } })
  })

  it('rejects a malformed order ID before cart service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as any)
    const response = await new Elysia().use(createOrderRoutes(container)).handle(new Request('http://localhost/api/orders/invalid/buy-again', { method: 'POST' }))
    expect(response.status).toBe(422)
    expect(container.cartService.buyAgain).not.toHaveBeenCalled()
  })
})
