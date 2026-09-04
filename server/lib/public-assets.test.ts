import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isPublicAssetUrl } from './public-assets.ts'

describe('isPublicAssetUrl', () => {
  beforeEach(() => {
    process.env['NEXT_PUBLIC_CDN_URL'] = 'https://cdn.example.com'
  })

  afterEach(() => {
    delete process.env['NEXT_PUBLIC_CDN_URL']
  })

  it('accepts public paths and rejects signed or credential-bearing URLs', () => {
    expect(isPublicAssetUrl('/uploads/product_image/item/main.avif')).toBe(true)
    expect(isPublicAssetUrl('https://cdn.example.com/item.avif')).toBe(true)
    expect(isPublicAssetUrl('https://bucket.example.com/item.avif?X-Amz-Signature=secret')).toBe(false)
    expect(isPublicAssetUrl('https://cdn.example.com/item.avif?token=secret')).toBe(false)
    expect(isPublicAssetUrl('/api/uploads/local-get?id=1&expires=10&signature=secret')).toBe(false)
    expect(isPublicAssetUrl('https://user:secret@cdn.example.com/item.avif')).toBe(false)
    expect(isPublicAssetUrl('https://private.example.com/item.avif')).toBe(false)
    expect(isPublicAssetUrl('https://cdn.example.com/item.avif?AWSAccessKeyId=secret')).toBe(false)
    expect(isPublicAssetUrl('javascript:alert(1)')).toBe(false)
  })
})
