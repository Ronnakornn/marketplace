import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { getLocalStorageConfigFromEnv, getStorageConfigFromEnv, LocalUploadStorage, S3UploadStorage } from './upload.storage.ts'

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

describe('local upload storage', () => {
  it('is the default local storage config when S3 is absent', () => {
    const config = getLocalStorageConfigFromEnv({
      NODE_ENV: 'test',
      LOCAL_UPLOAD_DIR: 'public',
      LOCAL_UPLOAD_SECRET: 'test-secret',
    })

    expect(config.rootDir).toBe(path.resolve('public'))
    expect(config.signingSecret).toBe('test-secret')
  })

  it('writes uploaded images as AVIF files', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'marketplace-upload-'))
    try {
      const storage = new LocalUploadStorage({
        rootDir,
        signingSecret: 'test-secret',
      })
      const body = await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: '#00ff00',
        },
      }).png().toBuffer()
      const uploadUrl = await storage.createPresignedPutUrl({
        key: 'uploads/product_image/seller-1/image.avif',
        contentType: 'image/png',
        fileSize: body.byteLength,
        expiresIn: 900,
      })
      const uploadBody = new ArrayBuffer(body.byteLength)
      new Uint8Array(uploadBody).set(body)
      const parsedUrl = new URL(uploadUrl, 'http://localhost')
      const result = await storage.writePresignedPutUrl!({
        key: parsedUrl.searchParams.get('key')!,
        contentType: parsedUrl.searchParams.get('contentType')!,
        fileSize: Number(parsedUrl.searchParams.get('fileSize')),
        expires: Number(parsedUrl.searchParams.get('expires')),
        signature: parsedUrl.searchParams.get('signature')!,
        body: uploadBody,
      })
      const saved = await readFile(path.join(rootDir, 'uploads/product_image/seller-1/image.avif'))
      const metadata = await sharp(saved).metadata()

      expect(result.contentType).toBe('image/avif')
      expect(metadata.format).toBe('heif')
      expect(metadata.compression).toBe('av1')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('rejects uploaded bytes that do not match the signed content type', async () => {
    const storage = new LocalUploadStorage({
      rootDir: tmpdir(),
      signingSecret: 'test-secret',
    })
    const body = Buffer.from('not an image')
    const uploadUrl = await storage.createPresignedPutUrl({
      key: 'uploads/product_image/seller-1/fake.avif',
      contentType: 'image/png',
      fileSize: body.byteLength,
      expiresIn: 900,
    })
    const parsedUrl = new URL(uploadUrl, 'http://localhost')

    await expect(storage.writePresignedPutUrl!({
      key: parsedUrl.searchParams.get('key')!,
      contentType: parsedUrl.searchParams.get('contentType')!,
      fileSize: Number(parsedUrl.searchParams.get('fileSize')),
      expires: Number(parsedUrl.searchParams.get('expires')),
      signature: parsedUrl.searchParams.get('signature')!,
      body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    })).rejects.toThrow()
  })
})
