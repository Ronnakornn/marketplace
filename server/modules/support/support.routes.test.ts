import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import type { AuthContext } from '#server/modules/auth/auth.context.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ISupportRepository } from './support.repository.ts'
import { SupportService } from './support.service.ts'
import { createSupportRoutes } from './support.routes.ts'

const readiness = vi.hoisted(() => ({ activeShops: 1 }))
vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) }, getSocialProviderAvailability: () => ({}) }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: { shop: { count: async () => readiness.activeShops }, shopStaff: { count: async () => 0 }, sellerApplication: { findFirst: async () => null } } }))

const context: AppContext = { config: { environment: 'test' }, logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }
const repo: ISupportRepository = {
  listCompensationRefunds: vi.fn(), findCompensationRefund: vi.fn(), linkCompensation: vi.fn(), transaction: vi.fn(), lockOrder: vi.fn(), lockTicket: vi.fn(), findTicketReference: vi.fn(), findOwnedOrder: vi.fn(), findReturn: vi.fn(), findAppeal: vi.fn(),
  listAppealableReturns: vi.fn(), listTickets: vi.fn().mockResolvedValue({ items: [], total: 0 }), findTicket: vi.fn(), listMessages: vi.fn(), createTicket: vi.fn(), createDispute: vi.fn(), createMessage: vi.fn(), findAttachments: vi.fn(), updateTicket: vi.fn(), updateDispute: vi.fn(),
}
function app() { return new Elysia().use(createSupportRoutes({ supportService: new SupportService(context, repo) })) }
function auth(overrides: Partial<AuthContext['user']> = {}) {
  vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer', email: 'buyer@example.test', name: 'Buyer', role: 'USER', status: 'ACTIVE', emailVerified: true, ...overrides }, session: { id: 'session' } })
}
const ticketId = '11111111-1111-4111-8111-111111111111'

describe('support route guards and validation', () => {
  beforeEach(() => { vi.clearAllMocks(); readiness.activeShops = 1; auth() })

  it('rejects unauthenticated buyer, seller and administrator lists', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    for (const prefix of ['/api/support', '/api/seller/support', '/api/admin/support']) {
      expect((await app().handle(new Request(`http://localhost${prefix}/tickets`))).status).toBe(401)
    }
  })

  it('rejects ordinary users and unverified administrators from admin workflows', async () => {
    expect((await app().handle(new Request('http://localhost/api/admin/support/tickets'))).status).toBe(403)
    auth({ role: 'ADMIN', emailVerified: false })
    expect((await app().handle(new Request('http://localhost/api/admin/support/tickets'))).status).toBe(403)
    auth({ role: 'ADMIN' })
    expect((await app().handle(new Request('http://localhost/api/admin/support/tickets'))).status).toBe(200)
  })

  it('rejects suspended users and sellers without an active operational shop', async () => {
    auth({ status: 'SUSPENDED' })
    expect((await app().handle(new Request('http://localhost/api/support/tickets'))).status).toBe(403)
    auth()
    readiness.activeShops = 0
    expect((await app().handle(new Request('http://localhost/api/seller/support/tickets'))).status).toBe(403)
  })

  it('validates pagination and contextual UUIDs before reaching the service', async () => {
    expect((await app().handle(new Request('http://localhost/api/support/tickets?page=0'))).status).toBe(422)
    expect((await app().handle(new Request('http://localhost/api/support/tickets?limit=51'))).status).toBe(422)
    expect((await app().handle(new Request('http://localhost/api/support/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject: 'Help', body: 'Evidence', orderId: 'invalid' }) }))).status).toBe(422)
    expect(repo.createTicket).not.toHaveBeenCalled()
  })

  it('does not expose compensated dispute status as an administrator command', async () => {
    auth({ role: 'ADMIN' })
    const response = await app().handle(new Request(`http://localhost/api/admin/support/tickets/${ticketId}/dispute`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'COMPENSATED', decision: 'Unsupported' }) }))
    expect(response.status).toBe(422)
    expect(repo.updateDispute).not.toHaveBeenCalled()
  })
})
