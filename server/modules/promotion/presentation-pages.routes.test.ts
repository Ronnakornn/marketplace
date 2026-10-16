import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { listPageResult } from '#server/lib/list-page.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createPromotionRoutes } from './promotion.routes.ts'
import { createAffiliateRoutes } from '#server/modules/affiliate/affiliate.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) }, getSocialProviderAvailability: () => ({ google: false, facebook: false }) }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

const publicCoupons = vi.fn(async (_locale?: string, input = {}) => listPageResult([{ id: 'coupon', discountValueCents: 9007199254740993n }], 61, input))
const buyerCoupons = vi.fn(async (_actor: unknown, _locale?: string, input = {}) => listPageResult([], 0, input))
const adminCoupons = vi.fn(async (_actor: unknown, input = {}) => listPageResult([], 0, input))
const flashSales = vi.fn(async (_actor: unknown, input = {}) => listPageResult([], 0, input))
const affiliates = vi.fn(async (input = {}) => listPageResult([], 0, input))
const links = vi.fn(async (_actor: unknown, input = {}) => listPageResult([], 0, input))
const app = new Elysia()
  .use(createPromotionRoutes({ promotionService: { listPublicCoupons: publicCoupons, listBuyerCoupons: buyerCoupons, listAdminCoupons: adminCoupons, listAdminFlashSales: flashSales } } as unknown as ServiceContainer))
  .use(createAffiliateRoutes({ affiliateService: { listAdminAffiliates: affiliates, listLinks: links } } as unknown as ServiceContainer))

function actor(role: 'USER' | 'ADMIN') {
  return { user: { id: '11111111-1111-4111-8111-111111111111', role, email: 'test@example.test', name: 'Test', status: 'ACTIVE' as const, emailVerified: true }, session: { id: 'session' } }
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getAuthContext).mockResolvedValue(actor('USER')) })

describe('promotion presentation route boundaries', () => {
  it('passes the requested coupon page and returns exact money with global metadata', async () => {
    const response = await app.handle(new Request('http://localhost/api/coupons?page=2&limit=50&q=SAVE&locale=en'))
    expect(response.status).toBe(200)
    expect(publicCoupons).toHaveBeenCalledWith('en', { page: 2, limit: 50, q: 'SAVE', locale: 'en' })
    expect(await response.json()).toMatchObject({ data: [{ discountValueCents: '9007199254740993' }], meta: { page: 2, limit: 50, totalCount: 61 } })
  })
  it.each(['page=0', 'page=1.5', 'limit=0', 'limit=51', 'limit=1.5', 'q=' + 'x'.repeat(201)])('rejects invalid bounds %s before querying', async query => {
    expect((await app.handle(new Request('http://localhost/api/coupons?' + query))).status).toBe(422)
    expect(publicCoupons).not.toHaveBeenCalled()
  })
  it('keeps buyer routes authenticated and affiliate admin routes restricted', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    expect((await app.handle(new Request('http://localhost/api/me/coupons'))).status).toBe(401)
    expect((await app.handle(new Request('http://localhost/api/affiliate/links'))).status).toBe(401)
    vi.mocked(getAuthContext).mockResolvedValue(actor('USER'))
    expect((await app.handle(new Request('http://localhost/api/admin/affiliates'))).status).toBe(403)
    expect((await app.handle(new Request('http://localhost/api/admin/flash-sales'))).status).toBe(403)
    expect(affiliates).not.toHaveBeenCalled()
  })
  it('passes admin status filters and own-link scope through validated query objects', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(actor('ADMIN'))
    const response = await app.handle(new Request('http://localhost/api/admin/affiliates?page=3&limit=20&status=DISABLED&q=creator'))
    expect(response.status).toBe(200)
    expect(affiliates).toHaveBeenCalledWith({ page: 3, limit: 20, status: 'DISABLED', q: 'creator' })
    expect((await app.handle(new Request('http://localhost/api/admin/coupons?isActive=false&page=2'))).status).toBe(200)
    expect(adminCoupons).toHaveBeenCalledWith(actor('ADMIN').user, { isActive: false, page: 2 })
    const flashResponse = await app.handle(new Request('http://localhost/api/admin/flash-sales?page=2&limit=10&status=ENDED&q=sale'))
    expect(flashResponse.status).toBe(200)
    expect(flashSales).toHaveBeenCalledWith(actor('ADMIN').user, { page: 2, limit: 10, status: 'ENDED', q: 'sale' })
    vi.mocked(getAuthContext).mockResolvedValue(actor('USER'))
    expect((await app.handle(new Request('http://localhost/api/affiliate/links?page=4&limit=20'))).status).toBe(200)
    expect(links).toHaveBeenCalledWith(actor('USER').user, { page: 4, limit: 20 })
  })
})
