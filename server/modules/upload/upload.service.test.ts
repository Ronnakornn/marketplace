import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Upload } from '#generated/client/client.ts'
import type { UploadStatus, UploadUsage } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IUploadRepository } from './upload.repository.ts'
import { UploadService } from './upload.service.ts'
import type { UploadStorage } from './upload.types.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IUploadRepository {
  return {
    createUpload: vi.fn(async (input) => createUpload({ ...input, id: '11111111-1111-4111-8111-111111111111' })),
    findUploadById: vi.fn(),
    markCompleted: vi.fn(async (fileId, completedAt) => createUpload({
      id: fileId,
      status: 'COMPLETED',
      completedAt,
    })),
  }
}

function createStorageMock(): UploadStorage {
  return {
    createPresignedPutUrl: vi.fn(async (input) => `https://storage.example.com/presigned/${input.key}`),
    getPublicUrl: vi.fn((key) => `https://cdn.example.com/${key}`),
  }
}

function createUpload(overrides: Partial<Upload> = {}): Upload {
  const now = new Date('2026-05-14T00:00:00.000Z')
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    userId: overrides.userId ?? 'seller-1',
    usage: overrides.usage ?? 'PRODUCT_IMAGE' as UploadUsage,
    status: overrides.status ?? 'PENDING' as UploadStatus,
    fileName: overrides.fileName ?? 'shirt.png',
    contentType: overrides.contentType ?? 'image/png',
    fileSize: overrides.fileSize ?? 1024,
    key: overrides.key ?? 'uploads/product_image/seller-1/2026/05/id-shirt.png',
    publicUrl: overrides.publicUrl ?? 'https://cdn.example.com/uploads/product_image/seller-1/2026/05/id-shirt.png',
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function sellerActor() {
  return { id: 'seller-1', role: 'SELLER' as const }
}

let repo: IUploadRepository
let storage: UploadStorage
let service: UploadService

describe('UploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    storage = createStorageMock()
    service = new UploadService(createAppContext(), repo, storage)
  })

  it('creates a presigned URL for seller product images', async () => {
    const result = await service.createPresignedUrl(sellerActor(), {
      fileName: 'shirt.png',
      contentType: 'image/png',
      fileSize: 1024,
      usage: 'product_image',
    })

    expect(result).toMatchObject({
      fileId: '11111111-1111-4111-8111-111111111111',
      expiresIn: 900,
    })
    expect(result.key).toContain('uploads/product_image/seller-1/')
    expect(result.uploadUrl).toContain(encodeURIComponent(result.key).replace(/%2F/g, '/'))
    expect(repo.createUpload).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'seller-1',
      usage: 'PRODUCT_IMAGE',
      contentType: 'image/png',
    }))
  })

  it('rejects invalid file types', async () => {
    await expect(service.createPresignedUrl(sellerActor(), {
      fileName: 'shirt.gif',
      contentType: 'image/gif',
      fileSize: 1024,
      usage: 'product_image',
    })).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' })
  })

  it('rejects files larger than the usage limit', async () => {
    await expect(service.createPresignedUrl({ id: 'buyer-1', role: 'USER' }, {
      fileName: 'review.png',
      contentType: 'image/png',
      fileSize: 3 * 1024 * 1024 + 1,
      usage: 'review_image',
    })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  })

  it('rejects invalid usage values', async () => {
    await expect(service.createPresignedUrl(sellerActor(), {
      fileName: 'shirt.png',
      contentType: 'image/png',
      fileSize: 1024,
      usage: 'avatar' as never,
    })).rejects.toMatchObject({ code: 'INVALID_UPLOAD_USAGE' })
  })

  it('generates a safe upload key from unsafe file names', async () => {
    await service.createPresignedUrl(sellerActor(), {
      fileName: '..\\..\\summer shirt (final).png',
      contentType: 'image/png',
      fileSize: 1024,
      usage: 'shop_image',
    })

    expect(repo.createUpload).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'summer-shirt-final-.png',
      key: expect.stringMatching(/^uploads\/shop_image\/seller-1\/\d{4}\/\d{2}\/[0-9a-f-]+-summer-shirt-final-\.png$/),
    }))
  })

  it('prevents users from completing another user upload', async () => {
    vi.mocked(repo.findUploadById).mockResolvedValue(createUpload({ userId: 'seller-2' }))

    await expect(service.completeUpload(sellerActor(), '11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' })
  })

  it('completes a pending upload', async () => {
    vi.mocked(repo.findUploadById).mockResolvedValue(createUpload())

    const result = await service.completeUpload(sellerActor(), '11111111-1111-4111-8111-111111111111')

    expect(repo.markCompleted).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', expect.any(Date))
    expect(result.status).toBe('completed')
  })

  it('rejects duplicate complete calls', async () => {
    vi.mocked(repo.findUploadById).mockResolvedValue(createUpload({ status: 'COMPLETED' as UploadStatus }))

    await expect(service.completeUpload(sellerActor(), '11111111-1111-4111-8111-111111111111'))
      .rejects.toMatchObject({ code: 'UPLOAD_ALREADY_COMPLETED' })
  })

  it('fails clearly when storage config is missing', async () => {
    service = new UploadService(createAppContext(), repo, null)

    await expect(service.createPresignedUrl(sellerActor(), {
      fileName: 'shirt.png',
      contentType: 'image/png',
      fileSize: 1024,
      usage: 'product_image',
    })).rejects.toMatchObject({ code: 'STORAGE_CONFIG_MISSING' })
  })
})
