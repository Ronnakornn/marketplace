import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createInventoryRoutes } from './inventory.routes.ts'

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
    inventoryService: {
      listSellerInventory: vi.fn().mockResolvedValue([]),
      getSellerInventory: vi.fn().mockResolvedValue({ id: 'inventory-1' }),
      updateSellerInventory: vi.fn().mockResolvedValue({ id: 'inventory-1' }),
      listSellerMovements: vi.fn().mockResolvedValue([]),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createInventoryRoutes(container))
}

function mockAuth() {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: 'seller-1',
      email: 'seller@example.com',
      name: 'Seller',
      role: 'USER',
      status: 'ACTIVE',
    },
  } as any)
}

describe('inventory routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated seller inventory access', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const response = await createApp().handle(new Request('http://localhost/api/seller/inventory'))

    expect(response.status).toBe(401)
  })

  it('routes seller inventory list to the inventory service', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/seller/inventory'))

    expect(response.status).toBe(200)
    expect(container.inventoryService.listSellerInventory).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }))
  })

  it('passes seller inventory adjustment body without reserved quantity', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/seller/variants/33333333-3333-4333-8333-333333333333/inventory', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        quantityOnHand: 12,
        quantityReserved: 99,
        reason: 'cycle count',
      }),
    }))

    expect(response.status).toBe(200)
    expect(container.inventoryService.updateSellerInventory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seller-1' }),
      '33333333-3333-4333-8333-333333333333',
      { quantityOnHand: 12, reason: 'cycle count' },
    )
  })

  it('routes movement history requests', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/seller/variants/33333333-3333-4333-8333-333333333333/inventory/movements?limit=25'))

    expect(response.status).toBe(200)
    expect(container.inventoryService.listSellerMovements).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'seller-1' }),
      '33333333-3333-4333-8333-333333333333',
      25,
    )
  })
})
