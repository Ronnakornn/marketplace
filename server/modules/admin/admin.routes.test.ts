import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAdminRoutes } from './admin.routes.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'

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
    adminService: {
      getDashboard: vi.fn(async () => ({
        users: { total: 0, buyers: 0, sellers: 0 },
        shops: { total: 0, active: 0, suspended: 0 },
        products: { total: 0, active: 0, banned: 0 },
        orders: { total: 0, paid: 0, delivered: 0, cancelled: 0 },
        refunds: { pending: 0, success: 0, failed: 0 },
        exceptions: {
          pendingPayments: 0,
          failedPayments: 0,
          delayedShipments: 0,
          returnEscalations: 0,
          refundEscalations: 0,
          pendingShops: 0,
          pendingProducts: 0,
          payoutApprovals: 0,
          fraudOpen: 0,
        },
      })),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createAdminRoutes(container))
}

function mockAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      ...overrides,
    },
  }
}

describe('admin routes authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated admin requests', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp().handle(new Request('http://localhost/api/admin/dashboard'))

    expect(response.status).toBe(401)
  })

  it('rejects non-admin users', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ role: 'USER' }) as any)

    const response = await createApp().handle(new Request('http://localhost/api/admin/dashboard'))

    expect(response.status).toBe(403)
  })

  it('rejects unverified admins', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ emailVerified: false }) as any)

    const response = await createApp().handle(new Request('http://localhost/api/admin/dashboard'))

    expect(response.status).toBe(403)
  })

  it('rejects suspended admins', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ status: 'SUSPENDED' }) as any)

    const response = await createApp().handle(new Request('http://localhost/api/admin/dashboard'))

    expect(response.status).toBe(403)
  })

  it('passes verified active admins to the admin service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)

    const response = await createApp(container).handle(new Request('http://localhost/api/admin/dashboard'))

    expect(response.status).toBe(200)
    expect(container.adminService.getDashboard).toHaveBeenCalledWith({ id: 'admin-1', role: 'ADMIN' })
  })
})
