import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { SellerOnboardingService } from './seller-onboarding.service.ts'
import type { ISellerOnboardingRepository, SellerApplicationRecord } from './seller-onboarding.repository.ts'

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

function createApplication(overrides: Partial<SellerApplicationRecord> = {}): SellerApplicationRecord {
  const now = new Date('2026-05-18T00:00:00.000Z')
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'buyer-1',
    shopId: 'shop-1',
    sellerProfileId: 'profile-1',
    status: 'SUBMITTED',
    businessType: 'INDIVIDUAL',
    shopName: 'Somchai Store',
    shopSlug: 'somchai-store',
    shopContactEmail: 'shop@example.com',
    shopContactPhone: '0899999999',
    legalName: 'Somchai Jaidee',
    contactEmail: 'seller@example.com',
    contactPhone: '0812345678',
    nationalIdHash: 'national-id-hash',
    nationalIdEncrypted: 'encrypted-id',
    nationalIdLast4: '6789',
    companyRegistrationEncrypted: null,
    companyRegistrationLast4: null,
    taxIdEncrypted: 'encrypted-tax',
    taxIdLast4: '4321',
    bankName: 'Kasikorn',
    bankAccountName: 'Somchai Jaidee',
    bankAccountNumberEncrypted: 'encrypted-bank',
    bankAccountNumberLast4: '1234',
    pickupName: 'Somchai',
    pickupPhone: '0812345678',
    pickupLine1: '99 Rama 1',
    pickupLine2: null,
    pickupCity: 'Bangkok',
    pickupRegion: 'Bangkok',
    pickupPostalCode: '10330',
    pickupCountry: 'TH',
    submittedAt: now,
    reviewedAt: null,
    reviewedById: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    sellerProfile: {
      id: 'profile-1',
      userId: 'buyer-1',
      businessType: 'INDIVIDUAL',
      verificationStatus: 'PENDING',
      legalName: 'Somchai Jaidee',
      displayName: 'Somchai Store',
      contactEmail: 'seller@example.com',
      contactPhone: '0812345678',
    },
    shop: {
      id: 'shop-1',
      ownerId: 'buyer-1',
      sellerProfileId: 'profile-1',
      name: 'Somchai Store',
      slug: 'somchai-store',
      contactEmail: 'shop@example.com',
      contactPhone: '0899999999',
      status: 'PENDING',
      approvedAt: null,
      approvedById: null,
      rejectedReason: null,
    },
    user: { id: 'buyer-1', name: 'Somchai', email: 'seller@example.com', status: 'ACTIVE' },
    documents: [
      createDocument('ID_CARD'),
      createDocument('BANK_BOOK'),
      createDocument('TAX_DOCUMENT'),
    ],
    ...overrides,
  }
}

function createDocument(documentType: 'ID_CARD' | 'BANK_BOOK' | 'TAX_DOCUMENT' | 'BUSINESS_CERTIFICATE') {
  const now = new Date('2026-05-18T00:00:00.000Z')
  return {
    id: `${documentType.toLowerCase()}-doc`,
    applicationId: '11111111-1111-4111-8111-111111111111',
    uploadId: `${documentType.toLowerCase()}-upload`,
    documentType,
    side: 'FRONT' as const,
    sortOrder: 0,
    createdAt: now,
    upload: {
      id: `${documentType.toLowerCase()}-upload`,
      userId: 'buyer-1',
      usage: 'KYC_DOCUMENT' as const,
      status: 'COMPLETED' as const,
      fileName: `${documentType.toLowerCase()}.pdf`,
      contentType: 'application/pdf',
      fileSize: 1024,
      key: `uploads/kyc_document/buyer-1/${documentType.toLowerCase()}.pdf`,
      publicUrl: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  }
}

function createRepo(): ISellerOnboardingRepository {
  return {
    findApplicationByUserId: vi.fn(async () => null),
    findApplicationById: vi.fn(async () => createApplication()),
    findSellerProfileById: vi.fn(async () => ({
      id: 'profile-1',
      userId: 'buyer-1',
    })),
    findShopBySlug: vi.fn(async () => null),
    findUploadForUser: vi.fn(async () => ({
      id: 'upload-1',
      userId: 'buyer-1',
      usage: 'KYC_DOCUMENT',
      status: 'COMPLETED',
    })),
    upsertDraft: vi.fn(async () => createApplication({ status: 'DRAFT', submittedAt: null })),
    submitApplication: vi.fn(async () => createApplication()),
    listApplications: vi.fn(async () => [createApplication()]),
    approveApplication: vi.fn(async () => createApplication({
      status: 'APPROVED',
      reviewedAt: new Date('2026-05-18T01:00:00.000Z'),
      reviewedById: 'admin-1',
      sellerProfile: {
        id: 'profile-1',
        userId: 'buyer-1',
        businessType: 'INDIVIDUAL',
        verificationStatus: 'VERIFIED',
        legalName: 'Somchai Jaidee',
        displayName: 'Somchai Store',
        contactEmail: 'seller@example.com',
        contactPhone: '0812345678',
      },
      shop: {
        id: 'shop-1',
        ownerId: 'buyer-1',
        sellerProfileId: 'profile-1',
        name: 'Somchai Store',
        slug: 'somchai-store',
        contactEmail: 'shop@example.com',
        contactPhone: '0899999999',
        status: 'ACTIVE',
        approvedAt: new Date('2026-05-18T01:00:00.000Z'),
        approvedById: 'admin-1',
        rejectedReason: null,
      },
    })),
    rejectApplication: vi.fn(async () => createApplication({
      status: 'REJECTED',
      reviewedAt: new Date('2026-05-18T01:00:00.000Z'),
      reviewedById: 'admin-1',
      rejectionReason: 'Document mismatch',
    })),
  } as unknown as ISellerOnboardingRepository
}

const completeInput = {
  businessType: 'INDIVIDUAL',
  shopName: 'Somchai Store',
  shopSlug: 'somchai-store',
  shopContactEmail: 'shop@example.com',
  shopContactPhone: '0899999999',
  legalName: 'Somchai Jaidee',
  contactEmail: 'seller@example.com',
  contactPhone: '0812345678',
  nationalId: '1101700206789',
  taxId: '0105555044321',
  bankName: 'Kasikorn',
  bankAccountName: 'Somchai Jaidee',
  bankAccountNumber: '1234567890',
  pickupName: 'Somchai',
  pickupPhone: '0812345678',
  pickupLine1: '99 Rama 1',
  pickupCity: 'Bangkok',
  pickupRegion: 'Bangkok',
  pickupPostalCode: '10330',
  pickupCountry: 'TH',
  documents: [
    { uploadId: 'id-upload', documentType: 'ID_CARD' },
    { uploadId: 'bank-upload', documentType: 'BANK_BOOK' },
    { uploadId: 'tax-upload', documentType: 'TAX_DOCUMENT' },
  ],
}

describe('SellerOnboardingService', () => {
  let repo: ISellerOnboardingRepository
  let service: SellerOnboardingService

  beforeEach(() => {
    repo = createRepo()
    service = new SellerOnboardingService(createAppContext(), repo)
  })

  it('allows a buyer account to submit a seller application', async () => {
    const result = await service.submitApplication({ id: 'buyer-1', role: 'USER' }, completeInput)

    expect(result.status).toBe('SUBMITTED')
    expect(result.nationalIdMasked).toBe('****6789')
    expect(result.taxIdMasked).toBe('****4321')
    expect(result.bankAccountNumberMasked).toBe('****1234')
    expect(JSON.stringify(result)).not.toContain('encrypted-id')
    expect(JSON.stringify(result)).not.toContain('1101700206789')
    expect(repo.submitApplication).toHaveBeenCalled()
  })

  it('returns KYC document metadata without document URLs', async () => {
    const result = await service.getAdminApplication(
      { id: 'admin-1', role: 'ADMIN' },
      '11111111-1111-4111-8111-111111111111',
    )

    expect(result.documents[0]).toMatchObject({
      documentType: 'ID_CARD',
      fileName: 'id_card.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      completedAt: expect.any(Date),
    })
    expect(result.documents[0]).not.toHaveProperty('publicUrl')
  })

  it('allows a buyer account to save a draft application', async () => {
    const result = await service.saveDraft({ id: 'buyer-1', role: 'USER' }, {
      shopName: 'Draft Shop',
      shopContactEmail: 'draft-shop@example.com',
      shopContactPhone: '0800000000',
    })

    expect(result.status).toBe('DRAFT')
    expect(repo.upsertDraft).toHaveBeenCalledWith(
      'buyer-1',
      expect.objectContaining({
        shopName: 'Draft Shop',
        shopSlug: 'draft-shop',
        shopContactEmail: 'draft-shop@example.com',
        shopContactPhone: '0800000000',
      }),
      undefined,
    )
  })

  it('rejects submit when required KYC documents are missing', async () => {
    await expect(service.submitApplication({ id: 'buyer-1', role: 'USER' }, { ...completeInput, documents: [] }))
      .rejects.toMatchObject({ code: 'SELLER_DOCUMENTS_REQUIRED' })
  })

  it('rejects KYC documents that are not completed uploads owned by the applicant', async () => {
    vi.mocked(repo.findUploadForUser).mockResolvedValue(null)

    await expect(service.submitApplication({ id: 'buyer-1', role: 'USER' }, completeInput))
      .rejects.toMatchObject({ code: 'SELLER_DOCUMENT_INVALID' })
    expect(repo.findUploadForUser).toHaveBeenCalledWith('id-upload', 'buyer-1')
  })

  it('approves a submitted application through admin review', async () => {
    const result = await service.reviewApplication(
      { id: 'admin-1', role: 'ADMIN' },
      '11111111-1111-4111-8111-111111111111',
      { decision: 'APPROVED' },
    )

    expect(result.status).toBe('APPROVED')
    expect(result.shop?.status).toBe('ACTIVE')
    expect(repo.approveApplication).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'admin-1')
  })

  it('rejects a submitted application with a reason', async () => {
    const result = await service.reviewApplication(
      { id: 'admin-1', role: 'ADMIN' },
      '11111111-1111-4111-8111-111111111111',
      { decision: 'REJECTED', rejectionReason: 'Document mismatch' },
    )

    expect(result.status).toBe('REJECTED')
    expect(result.rejectionReason).toBe('Document mismatch')
    expect(repo.rejectApplication).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'admin-1',
      'Document mismatch',
    )
  })

  it('permits resubmission after rejection', async () => {
    vi.mocked(repo.findApplicationByUserId).mockResolvedValue(createApplication({
      status: 'REJECTED',
      rejectionReason: 'Document mismatch',
    }))

    const result = await service.submitApplication({ id: 'buyer-1', role: 'USER' }, completeInput)

    expect(result.status).toBe('SUBMITTED')
    expect(repo.submitApplication).toHaveBeenCalled()
  })

  it('supports filtering cancelled applications for admin review', async () => {
    await service.listApplications({ id: 'admin-1', role: 'ADMIN' }, 'CANCELLED')

    expect(repo.listApplications).toHaveBeenCalledWith({ status: 'CANCELLED' })
  })
})
