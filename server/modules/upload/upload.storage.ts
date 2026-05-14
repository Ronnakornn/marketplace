import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { CreatePresignedPutUrlInput, StorageConfig, UploadStorage } from './upload.types.ts'

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
  }
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
    })

    return getSignedUrl(this.client, command, { expiresIn: input.expiresIn })
  }

  getPublicUrl(key: string): string | undefined {
    if (!this.config.publicBaseUrl) return undefined
    return `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${key}`
  }
}
