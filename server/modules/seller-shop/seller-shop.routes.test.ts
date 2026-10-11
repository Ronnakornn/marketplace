import { Value } from '@sinclair/typebox/value'
import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { prisma } from '#server/lib/prisma.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createSellerShopRoutes, StorefrontParamsSchema, StorefrontQuerySchema, StorefrontResponseSchema, UpdateShopProfileBodySchema, UpdateShopSettingsBodySchema } from './seller-shop.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))
vi.mock('#server/lib/prisma.ts', () => ({ prisma: {
  shop: { count: vi.fn() }, shopStaff: { count: vi.fn() }, sellerApplication: { findFirst: vi.fn() },
} }))

describe('seller shop composed HTTP input schemas', () => {
  function createApp() {
    const updateShopSettings = vi.fn(async (_actor, _shopId, body) => body)
    const updateShopProfile = vi.fn(async (_actor, _shopId, body) => body)
    const container = { sellerShopService: { updateShopSettings, updateShopProfile } }
    return { app: new Elysia().use(createSellerShopRoutes(container as unknown as ServiceContainer)), updateShopSettings, updateShopProfile }
  }

  function patch(path: 'settings' | 'profile', body: object) {
    return new Request(`http://localhost/api/seller/shops/22222222-2222-4222-8222-222222222222/${path}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthContext).mockResolvedValue({ user: {
      id: 'seller-1', name: 'Seller', email: 'seller@example.test', role: 'USER', status: 'ACTIVE', emailVerified: true,
    }, session: { id: 'test-session-seller-1' } })
    vi.mocked(prisma.shop.count).mockResolvedValue(1)
    vi.mocked(prisma.shopStaff.count).mockResolvedValue(0)
    vi.mocked(prisma.sellerApplication.findFirst).mockResolvedValue(null)
  })

  it('accepts the actual shipping form decimal string through the authenticated production route', async () => {
    const { app, updateShopSettings } = createApp()
    const response = await app.handle(patch('settings', { shippingFeeBaht: '49.95' }))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(updateShopSettings).toHaveBeenCalledExactlyOnceWith({ id: 'seller-1', role: 'USER' }, '22222222-2222-4222-8222-222222222222', { shippingFeeBaht: '49.95' })
  })

  it.each([0, 49.95, 100000, '0', '100000.00'])('preserves compatible bounded shipping input %s', async shippingFeeBaht => {
    const { app, updateShopSettings } = createApp()
    const response = await app.handle(patch('settings', { shippingFeeBaht }))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(updateShopSettings.mock.calls[0]?.[2]).toEqual({ shippingFeeBaht })
  })

  it('accepts generated settings fields together with all localized extensions', async () => {
    const { app, updateShopSettings } = createApp()
    const body = { autoAcceptOrder: true, allowCod: false, chatEnabled: true, vacationMode: false,
      defaultShippingProvider: null, returnPolicy: 'Return', shippingPolicy: 'Shipping',
      returnPolicyTh: 'คืน', returnPolicyEn: null, shippingPolicyTh: null, shippingPolicyEn: 'Delivery', shippingFeeBaht: '49.95' }
    const response = await app.handle(patch('settings', body))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(updateShopSettings.mock.calls[0]?.[2]).toEqual(body)
  })

  it.each([
    { shippingFeeBaht: '49.951' }, { shippingFeeBaht: '-1' }, { shippingFeeBaht: 'NaN' },
    { shippingFeeBaht: -1 }, { shippingFeeBaht: 100001 }, { shippingFeeBaht: null },
    { chatEnabled: 'yes' }, { returnPolicyTh: 'x'.repeat(5001) },
  ])('rejects invalid settings before service: %j', async body => {
    const { app, updateShopSettings } = createApp()
    const response = await app.handle(patch('settings', body))
    expect(response.status).toBe(422)
    expect(updateShopSettings).not.toHaveBeenCalled()
  })

  it.each([{ shippingFee: 4995 }, { version: 99 }, { ownerId: 'other-user' }])('closes the settings schema and keeps private fields outside the service input: %j', async extra => {
    const { app, updateShopSettings } = createApp()
    const body = { shippingFeeBaht: '49.95', ...extra }
    expect(Value.Check(UpdateShopSettingsBodySchema, body)).toBe(false)
    const response = await app.handle(patch('settings', body))
    expect(response.status).toBe(200)
    expect(updateShopSettings.mock.calls[0]?.[2]).toEqual({ shippingFeeBaht: '49.95' })
  })

  it('accepts generated profile fields together with localized descriptions', async () => {
    const { app, updateShopProfile } = createApp()
    const body = { name: 'Shop', slug: 'shop', contactEmail: 'seller@example.test', contactPhone: '+66800000001',
      description: null, logoUrl: null, coverUrl: null, metaTitle: 'Shop title', metaDescription: null,
      descriptionTh: 'ร้าน', descriptionEn: 'Shop description' }
    const response = await app.handle(patch('profile', body))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(updateShopProfile.mock.calls[0]?.[2]).toEqual(body)
  })

  it('rejects oversized profile extensions before service', async () => {
    const { app, updateShopProfile } = createApp()
    const response = await app.handle(patch('profile', { descriptionEn: 'x'.repeat(5001) }))
    expect(response.status).toBe(422)
    expect(updateShopProfile).not.toHaveBeenCalled()
  })

  it.each([{ ownerId: 'other-user' }, { status: 'ACTIVE' }])('closes the profile schema and keeps private fields outside the service input: %j', async extra => {
    const { app, updateShopProfile } = createApp()
    const body = { descriptionEn: 'Shop description', ...extra }
    expect(Value.Check(UpdateShopProfileBodySchema, body)).toBe(false)
    const response = await app.handle(patch('profile', body))
    expect(response.status).toBe(200)
    expect(updateShopProfile.mock.calls[0]?.[2]).toEqual({ descriptionEn: 'Shop description' })
  })
})

describe('public storefront route schemas', () => {
  it('accepts UUID or slug identifiers and only supported locales', () => {
    expect(Value.Check(StorefrontParamsSchema, { shopId: '22222222-2222-4222-8222-222222222222' })).toBe(true)
    expect(Value.Check(StorefrontParamsSchema, { shopId: 'demo-shop' })).toBe(true)
    expect(Value.Check(StorefrontParamsSchema, { shopId: '../private' })).toBe(false)
    expect(Value.Check(StorefrontQuerySchema, { locale: 'th' })).toBe(true)
    expect(Value.Check(StorefrontQuerySchema, { locale: 'fr' })).toBe(false)
  })

  it('rejects private or unexpected response fields', () => {
    const response = {
      id: 'shop-1', name: 'Shop', slug: 'shop', description: null, logoUrl: null, coverUrl: null,
      ratingAverage: 4.5, ratingCount: 1, followerCount: 2, productCount: 3, chatEnabled: true,
      shippingPolicy: null, returnPolicy: null, updatedAt: new Date(), viewer: { isOwner: false },
    }
    expect(Value.Check(StorefrontResponseSchema, response)).toBe(true)
    expect(Value.Check(StorefrontResponseSchema, { ...response, contactEmail: 'private@example.com' })).toBe(false)
    expect(Value.Check(StorefrontResponseSchema, { ...response, ownerId: 'private-owner' })).toBe(false)
  })
})
