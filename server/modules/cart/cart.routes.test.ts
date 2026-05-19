import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createCartRoutes } from './cart.routes.ts'

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
    cartService: {
      getCart: vi.fn().mockResolvedValue({ id: 'cart-1', shops: [], subtotal: 0, currency: null }),
      addItem: vi.fn().mockResolvedValue({ id: 'cart-1', shops: [], subtotal: 0, currency: null }),
      updateItem: vi.fn().mockResolvedValue({ id: 'cart-1', shops: [], subtotal: 0, currency: null }),
      deleteItem: vi.fn().mockResolvedValue({ id: 'cart-1', shops: [], subtotal: 0, currency: null }),
      clearCart: vi.fn().mockResolvedValue({ id: 'cart-1', shops: [], subtotal: 0, currency: null }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createCartRoutes(container))
}

function mockAuth(role: 'USER' | 'ADMIN' = 'USER') {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@example.com`,
      name: role,
      role,
      status: 'ACTIVE',
    },
  } as any)
}

describe('cart routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated access', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const response = await createApp().handle(new Request('http://localhost/api/cart'))

    expect(response.status).toBe(401)
  })

  it('routes GET /api/cart to the cart service for authenticated buyers', async () => {
    mockAuth('USER')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/cart'))

    expect(response.status).toBe(200)
    expect(container.cartService.getCart).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1', role: 'USER' }))
  })

  it('passes POST /api/cart/items body to the cart service', async () => {
    mockAuth('USER')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/cart/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        variantId: '33333333-3333-4333-8333-333333333333',
        quantity: 2,
      }),
    }))

    expect(response.status).toBe(200)
    expect(container.cartService.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      { variantId: '33333333-3333-4333-8333-333333333333', quantity: 2 },
    )
  })

  it('passes authenticated users through to buyer cart APIs', async () => {
    mockAuth('USER')
    const container = createContainer()
    await createApp(container).handle(new Request('http://localhost/api/cart'))

    expect(container.cartService.getCart).toHaveBeenCalledWith(expect.objectContaining({ role: 'USER' }))
  })
})
