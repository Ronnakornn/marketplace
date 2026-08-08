import { Value } from '@sinclair/typebox/value'
import { describe, expect, it } from 'vitest'
import { StorefrontParamsSchema, StorefrontQuerySchema, StorefrontResponseSchema } from './seller-shop.routes.ts'

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
