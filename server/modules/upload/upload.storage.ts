import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type {
  CreatePresignedPutUrlInput,
  CreatePresignedGetUrlInput,
  LocalPresignedGetInput,
  LocalPresignedGetResponse,
  LocalPresignedPutInput,
  LocalPresignedPutResponse,
  LocalStorageConfig,
  StorageConfig,
  UploadStorage,
} from './upload.types.ts'

const publicUploadCacheControl = 'public, max-age=604800, stale-while-revalidate=86400'
const maxImagePixels = 40_000_000

export function getStorageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig | null {
  const endpoint = env['S3_ENDPOINT']
  const region = env['S3_REGION']
  const bucket = env['S3_BUCKET']
  const accessKeyId = env['S3_ACCESS_KEY_ID']
  const secretAccessKey = env['S3_SECRET_ACCESS_KEY']

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: env['S3_PUBLIC_BASE_URL'],
    cdnBaseUrl: env['NEXT_PUBLIC_CDN_URL'],
  }
}

export function getLocalStorageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LocalStorageConfig {
  return {
    rootDir: path.resolve(env['LOCAL_UPLOAD_DIR'] ?? path.join(process.cwd(), 'public')),
    privateRootDir: path.resolve(env['LOCAL_PRIVATE_UPLOAD_DIR'] ?? path.join(process.cwd(), '.data', 'uploads')),
    publicBaseUrl: env['LOCAL_UPLOAD_PUBLIC_BASE_URL'],
    signingSecret: env['LOCAL_UPLOAD_SECRET'] ?? env['BETTER_AUTH_SECRET'] ?? 'local-upload-development-secret',
  }
}

export function createUploadStorageFromEnv(env: NodeJS.ProcessEnv = process.env): UploadStorage {
  const provider = env['UPLOAD_STORAGE']?.trim().toLowerCase() || 'local'
  if (provider === 'local') return new LocalUploadStorage(getLocalStorageConfigFromEnv(env))
  if (provider !== 's3') throw new Error('UPLOAD_STORAGE must be local or s3')

  const config = getStorageConfigFromEnv(env)
  if (!config) throw new Error('S3 upload storage configuration is incomplete')
  return new S3UploadStorage(config)
}

export class S3UploadStorage implements UploadStorage {
  private client: S3Client

  constructor(private config: StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    })
  }

  createPresignedPutUrl(input: CreatePresignedPutUrlInput): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.fileSize,
      CacheControl: input.cacheControl ?? publicUploadCacheControl,
    })

    return getSignedUrl(this.client, command, { expiresIn: input.expiresIn })
  }

  createPresignedGetUrl(input: CreatePresignedGetUrlInput): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ResponseContentType: input.contentType,
      ResponseCacheControl: 'private, no-store',
      ResponseContentDisposition: 'inline',
    })
    return getSignedUrl(this.client, command, { expiresIn: input.expiresIn })
  }

  getPublicUrl(key: string): string | undefined {
    const baseUrl = this.config.cdnBaseUrl || this.config.publicBaseUrl
    if (!baseUrl) return undefined
    return `${baseUrl.replace(/\/+$/, '')}/${key}`
  }
}

export class LocalUploadStorage implements UploadStorage {
  private rootDir: string
  private privateRootDir: string

  constructor(private config: LocalStorageConfig) {
    this.rootDir = path.resolve(config.rootDir)
    this.privateRootDir = path.resolve(config.privateRootDir)
  }

  async createPresignedPutUrl(input: CreatePresignedPutUrlInput): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + input.expiresIn
    const signature = this.signUpload(input.key, input.contentType, input.fileSize, expires)
    const search = new URLSearchParams({
      key: input.key,
      contentType: input.contentType,
      fileSize: String(input.fileSize),
      expires: String(expires),
      signature,
    })

    return `/api/uploads/local-put?${search.toString()}`
  }

  getPublicUrl(key: string): string | undefined {
    const normalizedKey = key.replace(/^\/+/, '')
    if (!this.config.publicBaseUrl) return `/${normalizedKey}`
    return `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${normalizedKey}`
  }

  async createPresignedGetUrl(input: CreatePresignedGetUrlInput): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + input.expiresIn
    const signature = this.signDownload(input.key, input.contentType, expires)
    const search = new URLSearchParams({
      key: input.key,
      contentType: input.contentType,
      expires: String(expires),
      signature,
    })
    return `/api/uploads/local-get?${search.toString()}`
  }

  async writePresignedPutUrl(input: LocalPresignedPutInput): Promise<LocalPresignedPutResponse> {
    const now = Math.floor(Date.now() / 1000)
    if (input.expires < now) throw new Error('Local upload URL has expired')

    const expectedSignature = this.signUpload(input.key, input.contentType, input.fileSize, input.expires)
    if (expectedSignature.length !== input.signature.length) throw new Error('Invalid local upload signature')
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(input.signature))) {
      throw new Error('Invalid local upload signature')
    }
    if (input.body.byteLength !== input.fileSize) throw new Error('Uploaded file size does not match declared size')

    const source = Buffer.from(input.body)
    await assertContentMatchesMimeType(source, input.contentType)
    const absolutePath = this.toSafeAbsolutePath(input.key)

    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, source)

    return {
      key: input.key,
      contentType: input.contentType,
      fileSize: source.byteLength,
    }
  }

  async readPresignedGetUrl(input: LocalPresignedGetInput): Promise<LocalPresignedGetResponse> {
    const now = Math.floor(Date.now() / 1000)
    if (input.expires < now) throw new Error('Local download URL has expired')

    const expectedSignature = this.signDownload(input.key, input.contentType, input.expires)
    if (expectedSignature.length !== input.signature.length) throw new Error('Invalid local download signature')
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(input.signature))) {
      throw new Error('Invalid local download signature')
    }

    return {
      body: await readFile(this.toSafeAbsolutePath(input.key)),
      contentType: input.contentType,
    }
  }

  private signUpload(key: string, contentType: string, fileSize: number, expires: number): string {
    return crypto
      .createHmac('sha256', this.config.signingSecret)
      .update(`${key}\n${contentType}\n${fileSize}\n${expires}`)
      .digest('hex')
  }

  private signDownload(key: string, contentType: string, expires: number): string {
    return crypto
      .createHmac('sha256', this.config.signingSecret)
      .update(`GET\n${key}\n${contentType}\n${expires}`)
      .digest('hex')
  }

  private toSafeAbsolutePath(key: string): string {
    const rootDir = key.startsWith('private/') ? this.privateRootDir : this.rootDir
    const absolutePath = path.resolve(rootDir, key)
    if (!absolutePath.startsWith(`${rootDir}${path.sep}`)) {
      throw new Error('Invalid local upload path')
    }
    return absolutePath
  }
}

async function assertContentMatchesMimeType(source: Buffer, contentType: string): Promise<void> {
  if (contentType.startsWith('image/')) {
    const metadata = await sharp(source, { failOn: 'error', limitInputPixels: maxImagePixels }).metadata()
    const expectedFormats: Record<string, string[]> = {
      'image/jpeg': ['jpeg'],
      'image/png': ['png'],
      'image/webp': ['webp'],
      'image/avif': ['heif', 'avif'],
    }
    if (!metadata.format || !expectedFormats[contentType]?.includes(metadata.format)) {
      throw new Error('Uploaded image content does not match declared type')
    }
    return
  }
  if (contentType === 'application/pdf' && source.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Uploaded PDF content does not match declared type')
  }
  if (contentType === 'video/mp4' && source.subarray(4, 8).toString('ascii') !== 'ftyp') {
    throw new Error('Uploaded MP4 content does not match declared type')
  }
  if (contentType === 'video/webm' && source.subarray(0, 4).toString('hex') !== '1a45dfa3') {
    throw new Error('Uploaded WebM content does not match declared type')
  }
}
