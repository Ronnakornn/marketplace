import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  createUploadStorageFromEnv,
  getLocalStorageConfigFromEnv,
  getStorageConfigFromEnv,
  LocalUploadStorage,
  S3UploadStorage,
} from './upload.storage.ts'

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
  it('defaults to local storage even when S3 credentials are present', () => {
    expect(createUploadStorageFromEnv(baseEnv)).toBeInstanceOf(LocalUploadStorage)
  })

  it('uses S3 only when explicitly selected', () => {
    expect(createUploadStorageFromEnv({ ...baseEnv, UPLOAD_STORAGE: 's3' })).toBeInstanceOf(S3UploadStorage)
  })

  it('rejects an incomplete explicit S3 configuration', () => {
    expect(() => createUploadStorageFromEnv({
      NODE_ENV: 'test',
      UPLOAD_STORAGE: 's3',
    })).toThrow(/incomplete/)
  })

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
    expect(config.privateRootDir).toBe(path.resolve('.data/uploads'))
    expect(config.signingSecret).toBe('test-secret')
  })

  it('writes uploaded images without changing their declared type', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'marketplace-upload-'))
    try {
      const storage = new LocalUploadStorage({
        rootDir,
        privateRootDir: rootDir,
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
        key: 'uploads/product_image/seller-1/image.png',
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
      const saved = await readFile(path.join(rootDir, 'uploads/product_image/seller-1/image.png'))
      const metadata = await sharp(saved).metadata()

      expect(result.contentType).toBe('image/png')
      expect(metadata.format).toBe('png')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })

  it('rejects uploaded bytes that do not match the signed content type', async () => {
    const storage = new LocalUploadStorage({
      rootDir: tmpdir(),
      privateRootDir: tmpdir(),
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

  it('serves local private files only through a valid signed URL', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'marketplace-public-'))
    const privateRootDir = await mkdtemp(path.join(tmpdir(), 'marketplace-private-'))
    try {
      const storage = new LocalUploadStorage({ rootDir, privateRootDir, signingSecret: 'test-secret' })
      const body = Buffer.from('%PDF-private')
      const putUrl = new URL(await storage.createPresignedPutUrl({
        key: 'private/kyc/seller-1/id.pdf',
        contentType: 'application/pdf',
        fileSize: body.byteLength,
        expiresIn: 900,
      }), 'http://localhost')
      await storage.writePresignedPutUrl!({
        key: putUrl.searchParams.get('key')!,
        contentType: putUrl.searchParams.get('contentType')!,
        fileSize: Number(putUrl.searchParams.get('fileSize')),
        expires: Number(putUrl.searchParams.get('expires')),
        signature: putUrl.searchParams.get('signature')!,
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      })
      const getUrl = new URL(await storage.createPresignedGetUrl({
        key: 'private/kyc/seller-1/id.pdf',
        contentType: 'application/pdf',
        expiresIn: 300,
      }), 'http://localhost')
      const result = await storage.readPresignedGetUrl!({
        key: getUrl.searchParams.get('key')!,
        contentType: getUrl.searchParams.get('contentType')!,
        expires: Number(getUrl.searchParams.get('expires')),
        signature: getUrl.searchParams.get('signature')!,
      })

      expect(Buffer.from(result.body).toString()).toBe('%PDF-private')
      expect(result.contentType).toBe('application/pdf')
      await expect(readFile(path.join(rootDir, 'private/kyc/seller-1/id.pdf'))).rejects.toThrow()
      expect(await readFile(path.join(privateRootDir, 'private/kyc/seller-1/id.pdf'), 'utf8')).toBe('%PDF-private')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
      await rm(privateRootDir, { recursive: true, force: true })
    }
  })
})
