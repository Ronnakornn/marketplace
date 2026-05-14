import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createAuditLogRoutes } from './audit-log.routes.ts'

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
    auditLogService: {
      listAuditLogs: vi.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      getAuditLog: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createAuditLogRoutes(container))
}

function mockAuth(role: 'USER' | 'SELLER' | 'ADMIN' = 'ADMIN') {
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

describe('audit log routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets admins list audit logs', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/admin/audit-logs'))

    expect(response.status).toBe(200)
    expect(container.auditLogService.listAuditLogs).toHaveBeenCalledWith(
      { id: 'admin-1', role: 'ADMIN' },
      {},
    )
  })

  it('rejects non-admin audit log list access before service execution', async () => {
    mockAuth('USER')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/admin/audit-logs'))

    expect(response.status).toBe(403)
    expect(container.auditLogService.listAuditLogs).not.toHaveBeenCalled()
  })

  it('passes audit log filters through query params', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const response = await createApp(container).handle(new Request(
      'http://localhost/api/admin/audit-logs?actorUserId=admin-1&entityType=User&action=USER_STATUS_CHANGED&page=2&limit=5',
    ))

    expect(response.status).toBe(200)
    expect(container.auditLogService.listAuditLogs).toHaveBeenCalledWith(
      { id: 'admin-1', role: 'ADMIN' },
      expect.objectContaining({
        actorUserId: 'admin-1',
        entityType: 'User',
        action: 'USER_STATUS_CHANGED',
        page: 2,
        limit: 5,
      }),
    )
  })

  it('lets admins fetch one audit log', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const response = await createApp(container).handle(new Request(
      'http://localhost/api/admin/audit-logs/11111111-1111-4111-8111-111111111111',
    ))

    expect(response.status).toBe(200)
    expect(container.auditLogService.getAuditLog).toHaveBeenCalledWith(
      { id: 'admin-1', role: 'ADMIN' },
      '11111111-1111-4111-8111-111111111111',
    )
  })
})
