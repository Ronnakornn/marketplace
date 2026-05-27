import { describe, expect, it, vi } from 'vitest'
import { PrismaSellerOnboardingRepository } from './seller-onboarding.repository.ts'

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

function createRepository() {
  return new PrismaSellerOnboardingRepository({
    logger: createLogger(),
    config: { environment: 'test' },
  } as any, {} as any)
}

describe('PrismaSellerOnboardingRepository document replacement', () => {
  it('resets document review fields to pending when replacing documents', async () => {
    const repo = createRepository()
    const tx = {
      sellerKycDocument: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        createMany: vi.fn(async () => ({ count: 2 })),
      },
    }

    await (repo as any).replaceDocumentsWithTx(tx as any, 'app-1', [
      { uploadId: 'upload-1', documentType: 'ID_CARD', side: 'FRONT', sortOrder: 2 },
      { uploadId: 'upload-2', documentType: 'BANK_BOOK' },
    ])

    expect(tx.sellerKycDocument.deleteMany).toHaveBeenCalledWith({ where: { applicationId: 'app-1' } })
    expect(tx.sellerKycDocument.createMany).toHaveBeenCalledWith({
      data: [
        {
          applicationId: 'app-1',
          uploadId: 'upload-1',
          documentType: 'ID_CARD',
          side: 'FRONT',
          sortOrder: 2,
          reviewStatus: 'PENDING',
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
        },
        {
          applicationId: 'app-1',
          uploadId: 'upload-2',
          documentType: 'BANK_BOOK',
          side: 'FRONT',
          sortOrder: 0,
          reviewStatus: 'PENDING',
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
        },
      ],
    })
  })

  it('does not recreate rows when the incoming document list is empty', async () => {
    const repo = createRepository()
    const tx = {
      sellerKycDocument: {
        deleteMany: vi.fn(async () => ({ count: 2 })),
        createMany: vi.fn(async () => ({ count: 0 })),
      },
    }

    await (repo as any).replaceDocumentsWithTx(tx as any, 'app-2', [])

    expect(tx.sellerKycDocument.deleteMany).toHaveBeenCalledWith({ where: { applicationId: 'app-2' } })
    expect(tx.sellerKycDocument.createMany).not.toHaveBeenCalled()
  })
})
