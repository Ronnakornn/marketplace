import crypto from 'node:crypto'
import type { UploadUsage } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { UploadServiceError } from './upload.errors.ts'
import type { IUploadRepository, UploadRecord } from './upload.repository.ts'
import type {
  PresignedUploadInput,
  PresignedUploadResponse,
  UploadActor,
  UploadResponse,
  UploadStorage,
  UploadUsageInput,
} from './upload.types.ts'

const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxFileSizeByUsage: Record<UploadUsageInput, number> = {
  product_image: 5 * 1024 * 1024,
  shop_image: 5 * 1024 * 1024,
  review_image: 3 * 1024 * 1024,
}
const usageToRecord: Record<UploadUsageInput, UploadUsage> = {
  product_image: 'PRODUCT_IMAGE',
  shop_image: 'SHOP_IMAGE',
  review_image: 'REVIEW_IMAGE',
}
const recordToUsage: Record<UploadUsage, UploadUsageInput> = {
  PRODUCT_IMAGE: 'product_image',
  SHOP_IMAGE: 'shop_image',
  REVIEW_IMAGE: 'review_image',
}
const presignedUrlExpiresIn = 900

export class UploadService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IUploadRepository,
    private storage: UploadStorage | null,
  ) {
    this.logger = appContext.logger
  }

  async createPresignedUrl(actor: UploadActor, input: PresignedUploadInput): Promise<PresignedUploadResponse> {
    this.assertStorageConfigured()
    this.assertUsage(input.usage)
    this.assertRoleAllowed(actor, input.usage)
    this.assertContentType(input.contentType)
    this.assertFileSize(input.usage, input.fileSize)

    const safeFileName = this.toSafeFileName(input.fileName)
    const key = this.createStorageKey(input.usage, actor.id, safeFileName)
    const publicUrl = this.storage!.getPublicUrl(key)
    const upload = await this.repo.createUpload({
      userId: actor.id,
      usage: usageToRecord[input.usage],
      fileName: safeFileName,
      contentType: input.contentType,
      fileSize: input.fileSize,
      key,
      publicUrl,
    })
    const uploadUrl = await this.storage!.createPresignedPutUrl({
      key,
      contentType: input.contentType,
      fileSize: input.fileSize,
      expiresIn: presignedUrlExpiresIn,
    })

    this.logger.info('UploadService.createPresignedUrl', {
      actorId: actor.id,
      fileId: upload.id,
      usage: input.usage,
    })

    return {
      fileId: upload.id,
      uploadUrl,
      publicUrl,
      key,
      expiresIn: presignedUrlExpiresIn,
    }
  }

  async completeUpload(actor: UploadActor, fileId: string): Promise<UploadResponse> {
    const upload = await this.repo.findUploadById(fileId)
    if (!upload) throw new UploadServiceError('Upload not found', 404, 'UPLOAD_NOT_FOUND')
    this.assertCanAccess(actor, upload)
    if (upload.status === 'COMPLETED') {
      throw new UploadServiceError('Upload is already completed', 409, 'UPLOAD_ALREADY_COMPLETED')
    }

    const completed = await this.repo.markCompleted(upload.id, new Date())
    return this.toResponse(completed)
  }

  async getUpload(actor: UploadActor, fileId: string): Promise<UploadResponse> {
    const upload = await this.repo.findUploadById(fileId)
    if (!upload) throw new UploadServiceError('Upload not found', 404, 'UPLOAD_NOT_FOUND')
    this.assertCanAccess(actor, upload)
    return this.toResponse(upload)
  }

  private assertStorageConfigured(): void {
    if (!this.storage) {
      throw new UploadServiceError('S3 storage is not configured', 500, 'STORAGE_CONFIG_MISSING')
    }
  }

  private assertUsage(usage: string): asserts usage is UploadUsageInput {
    if (!(usage in maxFileSizeByUsage)) {
      throw new UploadServiceError('Invalid upload usage', 400, 'INVALID_UPLOAD_USAGE')
    }
  }

  private assertRoleAllowed(actor: UploadActor, usage: UploadUsageInput): void {
    if (actor.role === 'ADMIN') return
    if ((usage === 'product_image' || usage === 'shop_image') && actor.role === 'SELLER') return
    if (usage === 'review_image' && actor.role === 'USER') return

    throw new UploadServiceError('Upload usage is not allowed for this user', 403, 'UPLOAD_FORBIDDEN')
  }

  private assertCanAccess(actor: UploadActor, upload: UploadRecord): void {
    if (actor.role === 'ADMIN') return
    if (upload.userId !== actor.id) {
      throw new UploadServiceError('Upload does not belong to this user', 403, 'UPLOAD_FORBIDDEN')
    }
  }

  private assertContentType(contentType: string): void {
    if (!allowedContentTypes.has(contentType)) {
      throw new UploadServiceError('Invalid file type', 400, 'INVALID_FILE_TYPE', {
        allowedContentTypes: [...allowedContentTypes],
      })
    }
  }

  private assertFileSize(usage: UploadUsageInput, fileSize: number): void {
    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > maxFileSizeByUsage[usage]) {
      throw new UploadServiceError('File is too large', 400, 'FILE_TOO_LARGE', {
        maxFileSize: maxFileSizeByUsage[usage],
      })
    }
  }

  private createStorageKey(usage: UploadUsageInput, userId: string, safeFileName: string): string {
    const now = new Date()
    const year = String(now.getUTCFullYear())
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const fileId = crypto.randomUUID()
    return `uploads/${usage}/${userId}/${year}/${month}/${fileId}-${safeFileName}`
  }

  private toSafeFileName(fileName: string): string {
    const normalized = fileName.trim().replace(/\\/g, '/').split('/').pop() ?? 'upload'
    const withoutControlChars = normalized.replace(/[\u0000-\u001f\u007f]/g, '')
    const safe = withoutControlChars
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 120)

    return safe || 'upload'
  }

  private toResponse(upload: UploadRecord): UploadResponse {
    return {
      id: upload.id,
      userId: upload.userId,
      usage: recordToUsage[upload.usage],
      status: upload.status === 'COMPLETED' ? 'completed' : 'pending',
      fileName: upload.fileName,
      contentType: upload.contentType,
      fileSize: upload.fileSize,
      key: upload.key,
      publicUrl: upload.publicUrl ?? undefined,
      completedAt: upload.completedAt,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    }
  }
}
