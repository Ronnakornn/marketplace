import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaSellerShopRepository } from './seller-shop.repository.ts'

const appContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
} as AppContext

describe('PrismaSellerShopRepository localized storefront fields', () => {
  it('selects localized profile fields and persists the update', async () => {
    const update = vi.fn().mockResolvedValue({})
    const repo = new PrismaSellerShopRepository(appContext, { shop: { update } } as never)
    await repo.updateShopProfile('shop-1', { descriptionTh: 'ไทย', descriptionEn: 'English' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'shop-1' },
      data: { descriptionTh: 'ไทย', descriptionEn: 'English' },
      select: expect.objectContaining({ descriptionTh: true, descriptionEn: true }),
    }))
  })

  it('selects localized policies and scopes the upsert by shop id', async () => {
    const upsert = vi.fn().mockResolvedValue({})
    const repo = new PrismaSellerShopRepository(appContext, { shopSetting: { upsert } } as never)
    await repo.upsertShopSettings('shop-1', { shippingPolicyTh: 'ส่ง', returnPolicyEn: 'Return' })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { shopId: 'shop-1' },
      create: { shopId: 'shop-1', shippingPolicyTh: 'ส่ง', returnPolicyEn: 'Return' },
      select: expect.objectContaining({ shippingPolicyTh: true, returnPolicyEn: true }),
    }))
  })

  it.each([
    ['22222222-2222-4222-8222-222222222222', { id: '22222222-2222-4222-8222-222222222222' }],
    ['demo-shop', { slug: 'demo-shop' }],
  ])('resolves active public storefront %s without private fields', async (identifier, identity) => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repo = new PrismaSellerShopRepository(appContext, { shop: { findFirst } } as never)
    await repo.findPublicStorefront(identifier)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { ...identity, status: 'ACTIVE', deletedAt: null },
      select: expect.not.objectContaining({ contactEmail: true, contactPhone: true }),
    }))
  })

  it('resolves a UUID slug after an active id miss with the same public projection', async () => {
    const identifier = '22222222-2222-4222-8222-222222222222'
    const storefront = { id: '33333333-3333-4333-8333-333333333333', slug: identifier, name: 'Published shop', ratingAverage: '4.67', ratingCount: 3 }
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(storefront)
    const repo = new PrismaSellerShopRepository(appContext, { shop: { findFirst } } as never)

    expect(await repo.findPublicStorefront(identifier)).toEqual(storefront)
    expect(findFirst).toHaveBeenCalledTimes(2)
    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: identifier, status: 'ACTIVE', deletedAt: null } }))
    expect(findFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { slug: identifier, status: 'ACTIVE', deletedAt: null } }))
    expect(findFirst.mock.calls[1]![0].select).toEqual(findFirst.mock.calls[0]![0].select)
    expect(findFirst.mock.calls[1]![0].select).not.toHaveProperty('contactEmail')
    expect(findFirst.mock.calls[1]![0].select).not.toHaveProperty('contactPhone')
  })

  it('prefers a matching active id over a colliding UUID slug without fallback', async () => {
    const identifier = '22222222-2222-4222-8222-222222222222'
    const storefront = { id: identifier, slug: 'id-owner', name: 'ID shop', ratingAverage: '4.67', ratingCount: 3 }
    const slugCollision = { id: '33333333-3333-4333-8333-333333333333', slug: identifier, name: 'Other shop' }
    const findFirst = vi.fn().mockResolvedValueOnce(storefront).mockResolvedValueOnce(slugCollision)
    const repo = new PrismaSellerShopRepository(appContext, { shop: { findFirst } } as never)

    expect(await repo.findPublicStorefront(identifier)).toEqual(storefront)
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: identifier, status: 'ACTIVE', deletedAt: null } }))
  })
})
