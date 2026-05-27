import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type {
  ISellerShopRepository,
  SellerOwnedShopRecord,
  SellerShopSettingRecord,
} from './seller-shop.repository.ts'
import { SellerShopService } from './seller-shop.service.ts'

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
    returnPolicy: null,
    shippingPolicy: null,
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
    upsertShopSettings: vi.fn(async (_shopId, input) => createSettings({ ...input })),
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
})
