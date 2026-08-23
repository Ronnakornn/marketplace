import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type {
  ISellerShopRepository,
  SellerOwnedShopRecord,
  SellerShopSettingRecord,
} from './seller-shop.repository.ts'
import { resolveLocalizedSellerText, SellerShopService } from './seller-shop.service.ts'

function createAppContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

function createShop(overrides: Partial<SellerOwnedShopRecord> = {}): SellerOwnedShopRecord {
  const now = new Date('2026-05-26T00:00:00.000Z')
  return {
    id: 'shop-1',
    ownerId: 'seller-1',
    name: 'Shop One',
    slug: 'shop-one',
    status: 'ACTIVE',
    contactEmail: 'shop@example.com',
    contactPhone: '0812345678',
    description: null,
    descriptionTh: null,
    descriptionEn: null,
    logoUrl: null,
    coverUrl: null,
    metaTitle: null,
    metaDescription: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createSettings(overrides: Partial<SellerShopSettingRecord> = {}): SellerShopSettingRecord {
  return {
    id: 'setting-1',
    shopId: 'shop-1',
    autoAcceptOrder: false,
    allowCod: false,
    chatEnabled: true,
    vacationMode: false,
    defaultShippingProvider: null,
    shippingFee: 0n,
    returnPolicy: null,
    shippingPolicy: null,
    returnPolicyTh: null,
    returnPolicyEn: null,
    shippingPolicyTh: null,
    shippingPolicyEn: null,
    version: 1,
    updatedAt: new Date('2026-05-26T00:00:00.000Z'),
    ...overrides,
  }
}

function createRepo(): ISellerShopRepository {
  return {
    findSellerProfileByUserId: vi.fn(async () => ({ id: 'profile-1', userId: 'seller-1', maxShopCount: 5 })),
    listOwnedShops: vi.fn(async () => [createShop()]),
    findOwnedShopById: vi.fn(async () => createShop()),
    findOwnedActiveShopById: vi.fn(async () => createShop()),
    findShopBySlug: vi.fn(async () => null),
    updateShopProfile: vi.fn(async (_shopId, input) => createShop({ ...input })),
    findShopSettings: vi.fn(async () => createSettings()),
    upsertShopSettings: vi.fn(async (_shopId, input) => createSettings({
      ...input,
      ...(input.shippingFee === undefined ? {} : { shippingFee: BigInt(input.shippingFee) }),
    })),
    findPublicStorefront: vi.fn(async () => null),
  }
}

describe('SellerShopService', () => {
  let repo: ISellerShopRepository
  let service: SellerShopService

  beforeEach(() => {
    repo = createRepo()
    service = new SellerShopService(createAppContext(), repo)
  })

  it('lists owned shops and active shop context', async () => {
    await expect(service.listOwnedShops({ id: 'seller-1', role: 'USER' })).resolves.toMatchObject({
      maxShopCount: 5,
      activeShopId: 'shop-1',
      shops: [
        expect.objectContaining({ id: 'shop-1', name: 'Shop One', status: 'ACTIVE' }),
      ],
    })
  })

  it('updates shop profile for active owned shop', async () => {
    const result = await service.updateShopProfile(
      { id: 'seller-1', role: 'USER' },
      'shop-1',
      { name: 'Shop One Updated', contactEmail: 'new@example.com' },
    )

    expect(result.name).toBe('Shop One Updated')
    expect(result.contactEmail).toBe('new@example.com')
    expect(repo.updateShopProfile).toHaveBeenCalled()
  })

  it('rejects profile update when slug belongs to another owner', async () => {
    vi.mocked(repo.findShopBySlug).mockResolvedValue({ id: 'shop-2', ownerId: 'seller-2', slug: 'existing-slug' })

    await expect(service.updateShopProfile(
      { id: 'seller-1', role: 'USER' },
      'shop-1',
      { slug: 'existing-slug' },
    )).rejects.toMatchObject({ code: 'SHOP_SLUG_EXISTS' })
  })

  it('blocks settings update for non-active owned shop', async () => {
    vi.mocked(repo.findOwnedActiveShopById).mockResolvedValue(null)
    vi.mocked(repo.findOwnedShopById).mockResolvedValue(createShop({ status: 'PENDING' }))

    await expect(service.updateShopSettings(
      { id: 'seller-1', role: 'USER' },
      'shop-1',
      { chatEnabled: false },
    )).rejects.toMatchObject({ code: 'SELLER_SHOP_NOT_ACTIVE' })
  })

  it('upserts settings for active owned shop', async () => {
    const result = await service.updateShopSettings(
      { id: 'seller-1', role: 'USER' },
      'shop-1',
      { chatEnabled: false, vacationMode: true },
    )

    expect(result.chatEnabled).toBe(false)
    expect(result.vacationMode).toBe(true)
    expect(repo.upsertShopSettings).toHaveBeenCalledWith('shop-1', expect.objectContaining({
      chatEnabled: false,
      vacationMode: true,
    }))
  })

  it('normalizes blank localized values to null', async () => {
    await service.updateShopSettings({ id: 'seller-1', role: 'USER' }, 'shop-1', {
      shippingPolicyTh: '   ', returnPolicyEn: ' English returns ',
    })
    expect(repo.upsertShopSettings).toHaveBeenCalledWith('shop-1', expect.objectContaining({
      shippingPolicyTh: null, returnPolicyEn: 'English returns',
    }))
  })

  it('accepts a seller shipping fee in baht and stores minor units', async () => {
    const result = await service.updateShopSettings({ id: 'seller-1', role: 'USER' }, 'shop-1', {
      shippingFeeBaht: 89.5,
    })

    expect(repo.upsertShopSettings).toHaveBeenCalledWith('shop-1', { shippingFee: 8950 })
    expect(result.shippingFeeBaht).toBe(89.5)
  })

  it('rejects negative shipping fees and more than two decimal places', async () => {
    await expect(service.updateShopSettings({ id: 'seller-1', role: 'USER' }, 'shop-1', {
      shippingFeeBaht: -1,
    })).rejects.toMatchObject({ code: 'SHOP_SETTINGS_INVALID' })

    await expect(service.updateShopSettings({ id: 'seller-1', role: 'USER' }, 'shop-1', {
      shippingFeeBaht: 10.001,
    })).rejects.toMatchObject({ code: 'SHOP_SETTINGS_INVALID' })
  })

  it('rejects cross-shop profile updates', async () => {
    vi.mocked(repo.findOwnedActiveShopById).mockResolvedValue(null)
    vi.mocked(repo.findOwnedShopById).mockResolvedValue(null)
    await expect(service.updateShopProfile({ id: 'seller-1', role: 'USER' }, 'shop-2', { descriptionTh: 'x' }))
      .rejects.toMatchObject({ code: 'SHOP_FORBIDDEN' })
    expect(repo.updateShopProfile).not.toHaveBeenCalled()
  })
})

describe('resolveLocalizedSellerText', () => {
  const values = { th: 'ไทย', base: 'Base', en: 'English' }
  it('uses Thai, base, then English for Thai', () => {
    expect(resolveLocalizedSellerText('th', values)).toBe('ไทย')
    expect(resolveLocalizedSellerText('th', { ...values, th: ' ' })).toBe('Base')
    expect(resolveLocalizedSellerText('th', { ...values, th: null, base: null })).toBe('English')
  })
  it('uses English, base, then Thai for English', () => {
    expect(resolveLocalizedSellerText('en', values)).toBe('English')
    expect(resolveLocalizedSellerText('en', { ...values, en: ' ' })).toBe('Base')
    expect(resolveLocalizedSellerText('en', { ...values, en: null, base: null })).toBe('ไทย')
  })
})

describe('public storefront profile', () => {
  it('localizes safe fields, uses real metrics, and derives owner mode', async () => {
    const repo = createRepo()
    vi.mocked(repo.findPublicStorefront).mockResolvedValue({
      id: 'shop-1', ownerId: 'seller-1', name: 'Shop', slug: 'shop', description: 'Base', descriptionTh: 'ไทย', descriptionEn: 'English',
      logoUrl: null, coverUrl: null, ratingAverage: 4.5 as never, ratingCount: 12, followerCount: 34, productCount: 56,
      metaTitle: null, metaDescription: null, updatedAt: new Date(),
      settings: { chatEnabled: false, shippingPolicy: 'Base ship', shippingPolicyTh: null, shippingPolicyEn: 'Ship', returnPolicy: null, returnPolicyTh: 'คืน', returnPolicyEn: null },
    })
    const result = await new SellerShopService(createAppContext(), repo).getPublicStorefront('shop', 'th', 'seller-1')
    expect(result).toMatchObject({ description: 'ไทย', ratingAverage: 4.5, ratingCount: 12, followerCount: 34, productCount: 56, chatEnabled: false, shippingPolicy: 'Base ship', returnPolicy: 'คืน', viewer: { isOwner: true } })
    expect(result).not.toHaveProperty('ownerId')
    expect(result).not.toHaveProperty('contactEmail')
  })

  it('returns the same not-found response for inactive or missing shops', async () => {
    const repo = createRepo()
    vi.mocked(repo.findPublicStorefront).mockResolvedValue(null)
    await expect(new SellerShopService(createAppContext(), repo).getPublicStorefront('hidden-shop', 'en'))
      .rejects.toMatchObject({ status: 404, code: 'SHOP_NOT_FOUND' })
  })
})
