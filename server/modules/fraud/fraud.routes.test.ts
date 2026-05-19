import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createFraudRoutes } from './fraud.routes.ts'

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
    fraudService: {
      listFraudCases: vi.fn().mockResolvedValue({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      getFraudCase: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }),
      markFraudCaseReviewed: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: 'REVIEWED' }),
      resolveFraudCase: vi.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', status: 'RESOLVED' }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createFraudRoutes(container))
}

function mockAuth(role: 'USER' | 'ADMIN' = 'ADMIN') {
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

describe('fraud routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lets admins list fraud cases', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/admin/fraud/cases'))

    expect(response.status).toBe(200)
    expect(container.fraudService.listFraudCases).toHaveBeenCalledWith(
      { id: 'admin-1', role: 'ADMIN' },
      {},
    )
  })

  it('rejects non-admin fraud case access before service execution', async () => {
    mockAuth('USER')
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/admin/fraud/cases'))

    expect(response.status).toBe(403)
    expect(container.fraudService.listFraudCases).not.toHaveBeenCalled()
  })

  it('lets admins fetch, review, and resolve fraud cases', async () => {
    mockAuth('ADMIN')
    const container = createContainer()
    const app = createApp(container)
    const caseId = '11111111-1111-4111-8111-111111111111'

    expect((await app.handle(new Request(`http://localhost/api/admin/fraud/cases/${caseId}`))).status).toBe(200)
    expect((await app.handle(new Request(`http://localhost/api/admin/fraud/cases/${caseId}/review`, { method: 'PATCH' }))).status).toBe(200)
    expect((await app.handle(new Request(`http://localhost/api/admin/fraud/cases/${caseId}/resolve`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' }),
    }))).status).toBe(200)

    expect(container.fraudService.getFraudCase).toHaveBeenCalled()
    expect(container.fraudService.markFraudCaseReviewed).toHaveBeenCalledWith(caseId, 'admin-1')
    expect(container.fraudService.resolveFraudCase).toHaveBeenCalledWith(caseId, 'admin-1', 'RESOLVED')
  })
})
