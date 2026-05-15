import { describe, expect, it } from 'vitest'
import { getStorageConfigFromEnv, S3UploadStorage } from './upload.storage.ts'

const baseEnv = {
  NODE_ENV: 'test' as const,
  S3_ENDPOINT: 'https://storage.example.com',
  S3_REGION: 'auto',
  S3_BUCKET: 'marketplace',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  S3_PUBLIC_BASE_URL: 'https://bucket.storage.example.com',
}

describe('upload storage config', () => {
  it('prefers the CDN URL for public uploaded image URLs', () => {
    const config = getStorageConfigFromEnv({
      ...baseEnv,
      NEXT_PUBLIC_CDN_URL: 'https://cdn.example.com/',
    })

    expect(config).not.toBeNull()
    const storage = new S3UploadStorage(config!)

    expect(storage.getPublicUrl('uploads/product_image/seller-1/image.webp'))
      .toBe('https://cdn.example.com/uploads/product_image/seller-1/image.webp')
  })

  it('falls back to the S3 public base URL when no CDN is configured', () => {
    const config = getStorageConfigFromEnv(baseEnv)

    expect(config).not.toBeNull()
    const storage = new S3UploadStorage(config!)

    expect(storage.getPublicUrl('uploads/product_image/seller-1/image.webp'))
      .toBe('https://bucket.storage.example.com/uploads/product_image/seller-1/image.webp')
  })
})
