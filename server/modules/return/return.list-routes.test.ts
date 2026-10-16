import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReturnRoutes } from './return.routes.ts'
import { createPayoutRoutes } from '#server/modules/payout/payout.routes.ts'

const { listReturns, listPayouts } = vi.hoisted(() => ({ listReturns: vi.fn(), listPayouts: vi.fn() }))
vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn(async () => ({ user: { id: 'seller-1', role: 'USER', status: 'ACTIVE', emailVerified: true } })) }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: {
  shop: { count: vi.fn(async () => 1) }, shopStaff: { count: vi.fn(async () => 0) }, sellerApplication: { findFirst: vi.fn(async () => null) },
} }))

function get(path: string) {
  return new Elysia().use(createReturnRoutes({ returnService: { listBuyerReturns: listReturns, listSellerReturns: listReturns } } as never))
    .use(createPayoutRoutes({ payoutService: { listSellerPayouts: listPayouts, listAdminPayouts: listPayouts } } as never))
    .handle(new Request(`http://localhost${path}`))
}
beforeEach(() => {
  vi.clearAllMocks()
  const response = { data: [{ amount: 9007199254740993n }], meta: { page: 4, limit: 20, totalCount: 61, totalPages: 4, hasNextPage: false, hasPreviousPage: true } }
  listReturns.mockResolvedValue(response)
  listPayouts.mockResolvedValue(response)
})

describe('return and payout bounded HTTP list contracts', () => {
  it.each(['/api/returns', '/api/seller/returns', '/api/seller/payouts'])('rejects oversized and invalid pagination on %s', async (path) => {
    for (const query of ['limit=51', 'limit=0', 'page=0', 'page=1.5', `q=${'a'.repeat(201)}`, 'shopId=invalid']) {
      expect((await get(`${path}?${query}`)).status).toBe(422)
    }
    expect(listReturns).not.toHaveBeenCalled()
    expect(listPayouts).not.toHaveBeenCalled()
  })

  it.each(['/api/returns', '/api/seller/returns', '/api/seller/payouts'])('retains filters, complete pagination and exact amount strings on %s', async (path) => {
    const status = path.endsWith('payouts') ? 'paid' : 'completed'
    const response = await get(`${path}?page=4&limit=20&q=needle&status=${status}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ amount: '9007199254740993' }], meta: { page: 4, limit: 20, totalCount: 61, totalPages: 4, hasNextPage: false, hasPreviousPage: true } })
    const service = path.endsWith('payouts') ? listPayouts : listReturns
    expect(service).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }), { page: 4, limit: 20, q: 'needle', status })
  })

  it('retains the existing administrator guard on payouts', async () => {
    expect((await get('/api/admin/payouts?page=1&limit=20')).status).toBe(403)
    expect(listPayouts).not.toHaveBeenCalled()
  })
})
