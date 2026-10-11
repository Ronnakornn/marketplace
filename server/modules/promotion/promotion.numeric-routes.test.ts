import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPromotionRoutes } from './promotion.routes.ts'
import { PromotionService } from './promotion.service.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(async () => ({ user: { id: 'admin', role: 'ADMIN', status: 'ACTIVE', emailVerified: true } })),
}))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: {} }))

const createCoupon = vi.fn(async (_actor: unknown, body: unknown) => body)
const addFlashSaleItem = vi.fn(async (_actor: unknown, _id: string, body: unknown) => body)
const updateFlashSaleItem = vi.fn(async (_actor: unknown, _id: string, body: unknown) => body)
const app = () => new Elysia().use(createPromotionRoutes({ promotionService: { createCoupon, addFlashSaleItem, updateFlashSaleItem } } as never))
const post = (body: object) => app().handle(new Request('http://localhost/api/admin/coupons', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))

describe('coupon numeric HTTP boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['discountValueCents', 1.5], ['discountPercentBps', 12.5], ['minOrderCents', 0.5],
    ['maxDiscountCents', 2.5], ['usageLimit', 1.5], ['perUserLimit', 1.5],
    ['discountValueCents', 9007199254740992], ['minOrderCents', 9007199254740992],
    ['maxDiscountCents', 9007199254740992], ['usageLimit', 2147483648],
    ['perUserLimit', 2147483648], ['discountPercentBps', 10001],
  ])('rejects %s=%s before coupon persistence', async (field, value) => {
    const response = await post({ code: 'NUMERIC', discountType: 'fixed', discountValueCents: 100, [field]: value })
    expect(response.status).toBe(422)
    expect(createCoupon).not.toHaveBeenCalled()
  })

  it('accepts a 12.50 percent coupon as 1250 integer basis points', async () => {
    const response = await post({ code: 'PERCENT', discountType: 'percent', discountPercentBps: 1250 })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code: 'PERCENT', discountType: 'percent', discountPercentBps: 1250 })
  })

  it.each([0.29, 1.15, 19.99])('accepts a valid two-decimal flash price %s through HTTP validation', async salePriceBaht => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const response = await app().handle(new Request(`http://localhost/api/admin/flash-sales/${id}/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: id, variantId: id, salePriceBaht, stockLimit: 1 }),
    }))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(await response.json()).toMatchObject({ salePriceBaht, stockLimit: 1 })
  })

  it('stores the canonical decimal minor units of a near-limit flash price through the real service', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const service = new PromotionService({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, {
      findFlashSaleById: vi.fn(async () => ({ id, shopId: null, status: 'DRAFT', startsAt: new Date('2999-01-01'), endsAt: new Date('2999-01-02') })),
      findActiveProductVariant: vi.fn(async () => ({ id, price: 9007199254740991n, product: { id, shopId: id } })),
      createFlashSaleItem: vi.fn(async (_saleId: string, input: { salePrice: number }) => ({ id, salePrice: input.salePrice })),
    } as never)
    const response = await new Elysia().use(createPromotionRoutes({ promotionService: service } as never)).handle(new Request(`http://localhost/api/admin/flash-sales/${id}/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: id, variantId: id, salePriceBaht: '90071992547409.90', stockLimit: 1 }),
    }))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(await response.json()).toEqual({ id, salePrice: '9007199254740990' })
  })

  it.each(['stockLimit', 'perUserLimit'] as const)('rejects invalid Int32 %s before flash item create or update', async field => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    for (const value of [-1, 0.5, 2_147_483_648, 9007199254740993, 1e100]) {
      for (const method of ['POST', 'PATCH']) {
        const path = method === 'POST' ? `/api/admin/flash-sales/${id}/items` : `/api/admin/flash-sale-items/${id}`
        const response = await app().handle(new Request(`http://localhost${path}`, {
          method, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...(method === 'POST' ? { productId: id, variantId: id, salePriceBaht: 5, stockLimit: 1 } : {}), [field]: value }),
        }))
        expect(response.status, await response.clone().text()).toBe(422)
      }
    }
    expect(addFlashSaleItem).not.toHaveBeenCalled()
    expect(updateFlashSaleItem).not.toHaveBeenCalled()
  })

  it('accepts maximum Int32 flash quotas and an unsold zero-quota update', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const response = await app().handle(new Request(`http://localhost/api/admin/flash-sales/${id}/items`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ productId: id, variantId: id, salePriceBaht: 5, stockLimit: 2_147_483_647, perUserLimit: 2_147_483_647 }),
    }))
    expect(response.status, await response.clone().text()).toBe(200)
    const updated = await app().handle(new Request(`http://localhost/api/admin/flash-sale-items/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stockLimit: 0, perUserLimit: null }),
    }))
    expect(updated.status, await updated.clone().text()).toBe(200)
    expect(await updated.json()).toEqual({ stockLimit: 0, perUserLimit: null })
  })
})
