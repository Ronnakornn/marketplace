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
})
