import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPayoutRoutes } from './payout.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(async () => ({ user: { id: 'seller-1', role: 'USER', status: 'ACTIVE', emailVerified: true } })),
}))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: {
  shop: { count: vi.fn(async () => 1) }, shopStaff: { count: vi.fn(async () => 0) },
  sellerApplication: { findFirst: vi.fn(async () => null) },
} }))

const createSellerPayout = vi.fn(async (_actor: unknown, body: { amount: number }) => body)
const post = (amount: number) => new Elysia().use(createPayoutRoutes({ payoutService: { createSellerPayout } } as never))
  .handle(new Request('http://localhost/api/seller/payouts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount }),
  }))

describe('payout numeric HTTP boundary', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([0, -1, 1.5, 9007199254740992])('rejects amount %s before creating a payout', async amount => {
    expect((await post(amount)).status).toBe(422)
    expect(createSellerPayout).not.toHaveBeenCalled()
  })
  it.each([1, 9007199254740991])('accepts a safe positive integer amount %s', async amount => {
    const response = await post(amount)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ amount: amount.toString() })
  })
})
