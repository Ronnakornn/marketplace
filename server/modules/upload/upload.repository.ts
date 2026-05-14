import type { PrismaClient, Upload } from '#generated/client/client.ts'
import type { UploadStatus, UploadUsage } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface CreateUploadRecord {
  userId: string
  usage: UploadUsage
  fileName: string
  contentType: string
  fileSize: number
  key: string
  publicUrl?: string
}

export interface IUploadRepository {
  createUpload(input: CreateUploadRecord): Promise<Upload>
  findUploadById(fileId: string): Promise<Upload | null>
  markCompleted(fileId: string, completedAt: Date): Promise<Upload>
}

export class PrismaUploadRepository implements IUploadRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  createUpload(input: CreateUploadRecord): Promise<Upload> {
    this.logger.info('PrismaUploadRepository.createUpload', {
      userId: input.userId,
      usage: input.usage,
      key: input.key,
    })
    return this.prisma.upload.create({
      data: {
        ...input,
        status: 'PENDING' satisfies UploadStatus,
      },
    })
  }

  findUploadById(fileId: string): Promise<Upload | null> {
    this.logger.debug('PrismaUploadRepository.findUploadById', { fileId })
    return this.prisma.upload.findUnique({
      where: { id: fileId },
    })
  }

  markCompleted(fileId: string, completedAt: Date): Promise<Upload> {
    this.logger.info('PrismaUploadRepository.markCompleted', { fileId })
    return this.prisma.upload.update({
      where: { id: fileId },
      data: {
        status: 'COMPLETED',
        completedAt,
      },
    })
  }
}

export type UploadRecord = Upload
export type UploadUsageRecord = UploadUsage
