import type {
  Role,
  SellerApplicationStatus,
  SellerBusinessType,
  SellerKycDocumentReviewStatus,
  SellerKycDocumentSide,
  SellerKycDocumentType,
} from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { encryptKycValue, hashKycValue, maskLast4 } from '#server/lib/kyc-encryption.ts'
import { SellerOnboardingServiceError } from './seller-onboarding.errors.ts'
import type {
  ISellerOnboardingRepository,
  SellerApplicationRecord,
  SellerApplicationWriteInput,
  SellerKycDocumentInput,
} from './seller-onboarding.repository.ts'

const BUSINESS_TYPES = ['INDIVIDUAL', 'COMPANY'] as const
const APPLICATION_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
const DOCUMENT_TYPES = ['ID_CARD', 'BUSINESS_CERTIFICATE', 'BANK_BOOK', 'TAX_DOCUMENT'] as const
const DOCUMENT_SIDES = ['FRONT', 'BACK', 'EXTRA'] as const

export interface SellerOnboardingActor {
  id: string
  role: Role
}

export interface SellerApplicationInput {
  businessType?: string
  sellerProfileId?: string | null
  shopName?: string
  shopSlug?: string
  shopContactEmail?: string
  shopContactPhone?: string
  legalName?: string
  contactEmail?: string
  contactPhone?: string
  nationalId?: string | null
  companyRegistration?: string | null
  taxId?: string | null
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  pickupName?: string
  pickupPhone?: string | null
  pickupLine1?: string
  pickupLine2?: string | null
  pickupCity?: string
  pickupRegion?: string | null
  pickupPostalCode?: string
  pickupCountry?: string
  documents?: Array<{
    uploadId: string
    documentType: string
    side?: string
    sortOrder?: number
  }>
}

export interface SellerApplicationReviewInput {
  decision: 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

export interface SellerDocumentReviewInput {
  decision: 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

export interface SellerApplicationResponse {
  id: string
  userId: string
  sellerProfileId: string | null
  status: SellerApplicationStatus
  businessType: SellerBusinessType
  sellerProfile: {
    id: string
    userId: string
    businessType: SellerBusinessType
    verificationStatus: string
    legalName: string | null
    displayName: string | null
    contactEmail: string | null
    contactPhone: string | null
  } | null
  shop: {
    id: string
    ownerId: string
    sellerProfileId: string
    name: string
    slug: string
    contactEmail: string
    contactPhone: string
    status: string
    approvedAt: Date | null
    approvedById: string | null
    rejectedReason: string | null
  } | null
  shopName: string
  shopSlug: string
  shopContactEmail: string
  shopContactPhone: string
  legalName: string
  contactEmail: string
  contactPhone: string
  nationalIdLast4: string | null
  nationalIdMasked: string | null
  companyRegistrationLast4: string | null
  companyRegistrationMasked: string | null
  taxIdLast4: string | null
  taxIdMasked: string | null
  bankName: string
  bankAccountName: string
  bankAccountNumberLast4: string
  bankAccountNumberMasked: string | null
  pickupAddress: {
    name: string
    phone: string | null
    line1: string
    line2: string | null
    city: string
    region: string | null
    postalCode: string
    country: string
  }
  documents: Array<{
    id: string
    uploadId: string
    documentType: SellerKycDocumentType
    side: SellerKycDocumentSide
    sortOrder: number
    reviewStatus: SellerKycDocumentReviewStatus
    reviewedAt: Date | null
    reviewedById: string | null
    rejectionReason: string | null
    fileName: string
    contentType: string
    fileSize: number
    status: string
    completedAt: Date | null
    createdAt: Date
  }>
  submittedAt: Date | null
  reviewedAt: Date | null
  reviewedById: string | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AdminSellerApplicationResponse extends SellerApplicationResponse {
  user: {
    id: string
    name: string
    email: string
    status: string
  }
}

export interface SellerApplicationStatusResponse {
  application: SellerApplicationResponse | null
  shop: SellerApplicationResponse['shop'] | null
}

export class SellerOnboardingService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ISellerOnboardingRepository,
  ) {
    this.logger = appContext.logger
  }

  async getApplication(actor: SellerOnboardingActor): Promise<SellerApplicationStatusResponse> {
    const application = await this.repo.findApplicationByUserId(actor.id)
    const response = application ? this.toResponse(application) : null
    return {
      application: response,
      shop: response?.shop ?? null,
    }
  }

  async saveDraft(actor: SellerOnboardingActor, input: SellerApplicationInput): Promise<SellerApplicationResponse> {
    this.logger.info('SellerOnboardingService.saveDraft', { actorId: actor.id })
    const existing = await this.repo.findApplicationByUserId(actor.id)
    if (existing?.status === 'APPROVED') {
      throw new SellerOnboardingServiceError('Approved seller applications cannot be edited', 409, 'SELLER_APPLICATION_LOCKED')
    }
    await this.assertSellerProfileAccess(actor.id, input.sellerProfileId)
    const normalized = this.normalizeInput(input, existing ?? undefined, false)
    await this.assertSlugAvailable(actor.id, normalized.shopSlug, existing?.shopId ?? null)
    const documents = input.documents === undefined ? undefined : await this.normalizeDocuments(actor.id, input.documents, false)
    const saved = await this.repo.upsertDraft(actor.id, normalized, documents)
    return this.toResponse(saved)
  }

  async submitApplication(actor: SellerOnboardingActor, input: SellerApplicationInput): Promise<SellerApplicationResponse> {
    this.logger.info('SellerOnboardingService.submitApplication', { actorId: actor.id })
    const existing = await this.repo.findApplicationByUserId(actor.id)
    if (existing?.status === 'APPROVED') {
      throw new SellerOnboardingServiceError('Seller application is already approved', 409, 'SELLER_APPLICATION_LOCKED')
    }
    await this.assertSellerProfileAccess(actor.id, input.sellerProfileId)
    const normalized = this.normalizeInput(input, existing ?? undefined, true)
    await this.assertSlugAvailable(actor.id, normalized.shopSlug, existing?.shopId ?? null)
    const documents = await this.normalizeDocuments(actor.id, input.documents, true, normalized.businessType)
    const submitted = await this.repo.submitApplication(actor.id, normalized, documents)
    return this.toResponse(submitted)
  }

  async listApplications(actor: SellerOnboardingActor, status?: string): Promise<AdminSellerApplicationResponse[]> {
    this.assertAdmin(actor)
    const normalizedStatus = status ? this.parseEnum<SellerApplicationStatus>(status, APPLICATION_STATUSES, 'Invalid application status') : undefined
    const applications = await this.repo.listApplications({ status: normalizedStatus })
    return applications.map((application) => this.toAdminResponse(application))
  }

  async getAdminApplication(actor: SellerOnboardingActor, applicationId: string): Promise<AdminSellerApplicationResponse> {
    this.assertAdmin(actor)
    const application = await this.repo.findApplicationById(applicationId)
    if (!application) throw new SellerOnboardingServiceError('Seller application not found', 404, 'SELLER_APPLICATION_NOT_FOUND')
    return this.toAdminResponse(application)
  }

  async reviewApplication(actor: SellerOnboardingActor, applicationId: string, input: SellerApplicationReviewInput): Promise<AdminSellerApplicationResponse> {
    this.assertAdmin(actor)
    this.logger.info('SellerOnboardingService.reviewApplication', { actorId: actor.id, applicationId, decision: input.decision })
    const existing = await this.repo.findApplicationById(applicationId)
    if (!existing) throw new SellerOnboardingServiceError('Seller application not found', 404, 'SELLER_APPLICATION_NOT_FOUND')
    if (existing.status !== 'SUBMITTED') {
      throw new SellerOnboardingServiceError('Only submitted applications can be reviewed', 409, 'SELLER_APPLICATION_NOT_REVIEWABLE')
    }
    if (input.decision === 'APPROVED') {
      this.assertRequiredDocumentsApproved(existing)
      const approved = await this.repo.approveApplication(applicationId, actor.id)
      return this.toAdminResponse(approved)
    }
    const reason = input.rejectionReason?.trim()
    if (!reason) {
      throw new SellerOnboardingServiceError('Rejection reason is required', 400, 'SELLER_REJECTION_REASON_REQUIRED')
    }
    const rejected = await this.repo.rejectApplication(applicationId, actor.id, reason)
    return this.toAdminResponse(rejected)
  }

  async reviewDocument(
    actor: SellerOnboardingActor,
    applicationId: string,
    documentId: string,
    input: SellerDocumentReviewInput,
  ): Promise<AdminSellerApplicationResponse> {
    this.assertAdmin(actor)
    this.logger.info('SellerOnboardingService.reviewDocument', {
      actorId: actor.id,
      applicationId,
      documentId,
      decision: input.decision,
    })

    const application = await this.repo.findApplicationById(applicationId)
    if (!application) throw new SellerOnboardingServiceError('Seller application not found', 404, 'SELLER_APPLICATION_NOT_FOUND')
    if (application.status !== 'SUBMITTED') {
      throw new SellerOnboardingServiceError('Only submitted applications can be reviewed', 409, 'SELLER_APPLICATION_NOT_REVIEWABLE')
    }

    const targetDocument = application.documents.find((document) => document.id === documentId)
    if (!targetDocument) {
      throw new SellerOnboardingServiceError('Seller document not found', 404, 'SELLER_DOCUMENT_NOT_FOUND')
    }

    const rejectionReason = input.rejectionReason?.trim() ?? ''
    if (input.decision === 'REJECTED' && !rejectionReason) {
      throw new SellerOnboardingServiceError('Rejection reason is required', 400, 'SELLER_DOCUMENT_REJECTION_REASON_REQUIRED')
    }

    const updated = await this.repo.reviewDocument(applicationId, documentId, {
      reviewStatus: input.decision,
      reviewedAt: new Date(),
      reviewedById: actor.id,
      rejectionReason: input.decision === 'REJECTED' ? rejectionReason : null,
    })

    if (!updated) {
      throw new SellerOnboardingServiceError('Seller document not found', 404, 'SELLER_DOCUMENT_NOT_FOUND')
    }
    return this.toAdminResponse(updated)
  }

  private normalizeInput(
    input: SellerApplicationInput,
    existing: SellerApplicationRecord | undefined,
    requireComplete: boolean,
  ): SellerApplicationWriteInput {
    const businessType = this.parseEnum<SellerBusinessType>(
      input.businessType ?? existing?.businessType ?? 'INDIVIDUAL',
      BUSINESS_TYPES,
      'Invalid business type',
    )
    const nationalId = input.nationalId === undefined ? undefined : input.nationalId
    const companyRegistration = input.companyRegistration === undefined ? undefined : input.companyRegistration
    const taxId = input.taxId === undefined ? undefined : input.taxId
    const bankAccountNumber = input.bankAccountNumber === undefined ? undefined : input.bankAccountNumber

    const normalized: SellerApplicationWriteInput = {
      businessType,
      sellerProfileId: input.sellerProfileId ?? existing?.sellerProfileId ?? null,
      shopName: this.normalizeText(input.shopName, existing?.shopName, 'Shop name', requireComplete),
      shopSlug: this.normalizeSlug(input.shopSlug ?? existing?.shopSlug ?? input.shopName ?? '', requireComplete),
      shopContactEmail: this.normalizeEmail(
        input.shopContactEmail ?? existing?.shopContactEmail ?? input.contactEmail ?? existing?.contactEmail ?? '',
        requireComplete,
        'Shop contact email',
      ),
      shopContactPhone: this.normalizeText(
        input.shopContactPhone ?? existing?.shopContactPhone ?? input.contactPhone,
        existing?.contactPhone,
        'Shop contact phone',
        requireComplete,
      ),
      legalName: this.normalizeText(input.legalName, existing?.legalName, 'Legal name', requireComplete),
      contactEmail: this.normalizeEmail(input.contactEmail ?? existing?.contactEmail ?? input.shopContactEmail ?? existing?.shopContactEmail ?? '', requireComplete, 'Contact email'),
      contactPhone: this.normalizeText(input.contactPhone, existing?.contactPhone, 'Contact phone', requireComplete),
      nationalIdHash: nationalId === undefined ? existing?.nationalIdHash ?? null : hashKycValue(nationalId),
      nationalIdEncrypted: nationalId === undefined ? existing?.nationalIdEncrypted ?? null : encryptKycValue(nationalId),
      nationalIdLast4: nationalId === undefined ? existing?.nationalIdLast4 ?? null : maskLast4(nationalId),
      companyRegistrationEncrypted: companyRegistration === undefined ? existing?.companyRegistrationEncrypted ?? null : encryptKycValue(companyRegistration),
      companyRegistrationLast4: companyRegistration === undefined ? existing?.companyRegistrationLast4 ?? null : maskLast4(companyRegistration),
      taxIdEncrypted: taxId === undefined ? existing?.taxIdEncrypted ?? null : encryptKycValue(taxId),
      taxIdLast4: taxId === undefined ? existing?.taxIdLast4 ?? null : maskLast4(taxId),
      bankName: this.normalizeText(input.bankName, existing?.bankName, 'Bank name', false),
      bankAccountName: this.normalizeText(input.bankAccountName, existing?.bankAccountName, 'Bank account name', false),
      bankAccountNumberEncrypted: bankAccountNumber === undefined
        ? existing?.bankAccountNumberEncrypted ?? ''
        : encryptKycValue(bankAccountNumber) ?? '',
      bankAccountNumberLast4: bankAccountNumber === undefined
        ? existing?.bankAccountNumberLast4 ?? ''
        : maskLast4(bankAccountNumber) ?? '',
      pickupName: this.normalizeText(input.pickupName, existing?.pickupName, 'Pickup name', false),
      pickupPhone: input.pickupPhone === undefined ? existing?.pickupPhone ?? null : this.normalizeNullableText(input.pickupPhone),
      pickupLine1: this.normalizeText(input.pickupLine1, existing?.pickupLine1, 'Pickup address line 1', false),
      pickupLine2: input.pickupLine2 === undefined ? existing?.pickupLine2 ?? null : this.normalizeNullableText(input.pickupLine2),
      pickupCity: this.normalizeText(input.pickupCity, existing?.pickupCity, 'Pickup city', false),
      pickupRegion: input.pickupRegion === undefined ? existing?.pickupRegion ?? null : this.normalizeNullableText(input.pickupRegion),
      pickupPostalCode: this.normalizeText(input.pickupPostalCode, existing?.pickupPostalCode, 'Pickup postal code', false),
      pickupCountry: this.normalizeText(input.pickupCountry, existing?.pickupCountry ?? 'TH', 'Pickup country', false),
    }

    if (requireComplete) this.assertComplete(normalized)
    return normalized
  }

  private assertComplete(input: SellerApplicationWriteInput): void {
    const required: Array<[string, string | null | undefined]> = [
      ['Shop name', input.shopName],
      ['Shop slug', input.shopSlug],
      ['Shop contact email', input.shopContactEmail],
      ['Shop contact phone', input.shopContactPhone],
      ['Legal name', input.legalName],
      ['Contact email', input.contactEmail],
      ['Contact phone', input.contactPhone],
    ]
    if (input.businessType === 'INDIVIDUAL') required.push(['National ID', input.nationalIdEncrypted])
    if (input.businessType === 'COMPANY') required.push(['Company registration', input.companyRegistrationEncrypted])
    required.push(['Tax ID', input.taxIdEncrypted])
    const missing = required.filter(([, value]) => !value).map(([label]) => label)
    if (missing.length > 0) {
      throw new SellerOnboardingServiceError('Seller application is incomplete', 400, 'SELLER_APPLICATION_INCOMPLETE', { missing })
    }
  }

  private async normalizeDocuments(
    userId: string,
    input: SellerApplicationInput['documents'],
    requireComplete: boolean,
    businessType: SellerBusinessType = 'INDIVIDUAL',
  ): Promise<SellerKycDocumentInput[]> {
    if (!input) {
      if (requireComplete) throw new SellerOnboardingServiceError('KYC documents are required', 400, 'SELLER_DOCUMENTS_REQUIRED')
      return []
    }

    const documents = input.map((document) => ({
      uploadId: document.uploadId,
      documentType: this.parseEnum<SellerKycDocumentType>(document.documentType, DOCUMENT_TYPES, 'Invalid document type'),
      side: this.parseEnum<SellerKycDocumentSide>(document.side ?? 'FRONT', DOCUMENT_SIDES, 'Invalid document side'),
      sortOrder: this.normalizeSortOrder(document.sortOrder),
    }))
    const duplicateKeys = new Set<string>()
    const documentTypes = new Set<SellerKycDocumentType>()
    for (const document of documents) {
      const duplicateKey = `${document.documentType}:${document.side}`
      if (duplicateKeys.has(duplicateKey)) {
        throw new SellerOnboardingServiceError('Duplicate KYC document type', 400, 'SELLER_DOCUMENT_DUPLICATE')
      }
      duplicateKeys.add(duplicateKey)
      documentTypes.add(document.documentType)
      const upload = await this.repo.findUploadForUser(document.uploadId, userId)
      if (!upload || upload.usage !== 'KYC_DOCUMENT' || upload.status !== 'COMPLETED') {
        throw new SellerOnboardingServiceError('KYC document upload is invalid', 400, 'SELLER_DOCUMENT_INVALID')
      }
    }

    if (requireComplete) {
      const required: SellerKycDocumentType[] = businessType === 'COMPANY'
        ? ['BUSINESS_CERTIFICATE', 'ID_CARD', 'TAX_DOCUMENT']
        : ['ID_CARD', 'TAX_DOCUMENT']
      const missing = required.filter((type) => !documentTypes.has(type))
      if (missing.length > 0) {
        throw new SellerOnboardingServiceError('Required KYC documents are missing', 400, 'SELLER_DOCUMENTS_REQUIRED', { missing })
      }
    }

    return documents
  }

  private async assertSlugAvailable(userId: string, slug: string, currentShopId: string | null): Promise<void> {
    if (!slug) return
    const existing = await this.repo.findShopBySlug(slug)
    if (existing && existing.id !== currentShopId && existing.ownerId !== userId) {
      throw new SellerOnboardingServiceError('Shop slug already exists', 409, 'SELLER_SHOP_SLUG_EXISTS')
    }
  }

  private async assertSellerProfileAccess(userId: string, sellerProfileId: string | null | undefined): Promise<void> {
    if (!sellerProfileId) return
    const sellerProfile = await this.repo.findSellerProfileById(sellerProfileId)
    if (!sellerProfile || sellerProfile.userId !== userId) {
      throw new SellerOnboardingServiceError('Seller profile is invalid', 403, 'SELLER_PROFILE_FORBIDDEN')
    }
  }

  private assertAdmin(actor: SellerOnboardingActor): void {
    if (actor.role !== 'ADMIN') {
      throw new SellerOnboardingServiceError('Admin access required', 403, 'SELLER_APPLICATION_FORBIDDEN')
    }
  }

  private parseEnum<T extends string>(value: string, allowed: readonly string[], message: string): T {
    if (!allowed.includes(value)) {
      throw new SellerOnboardingServiceError(message, 400, 'SELLER_APPLICATION_INVALID')
    }
    return value as T
  }

  private normalizeText(value: string | null | undefined, existing: string | null | undefined, label: string, required: boolean): string {
    const normalized = value === undefined ? existing ?? '' : value?.trim() ?? ''
    if (required && !normalized) {
      throw new SellerOnboardingServiceError(`${label} is required`, 400, 'SELLER_APPLICATION_INCOMPLETE')
    }
    return normalized
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    const normalized = value?.trim()
    return normalized || null
  }

  private normalizeSlug(value: string, required: boolean): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!slug && !required) return ''
    if (slug.length < 2) {
      throw new SellerOnboardingServiceError('Shop slug is too short', 400, 'SELLER_APPLICATION_INVALID')
    }
    return slug
  }

  private normalizeEmail(value: string, required: boolean, label = 'Contact email'): string {
    const email = value.trim().toLowerCase()
    if (!email && !required) return ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new SellerOnboardingServiceError(`${label} is invalid`, 400, 'SELLER_APPLICATION_INVALID')
    }
    return email
  }

  private normalizeSortOrder(value: number | undefined): number {
    if (value === undefined) return 0
    if (!Number.isInteger(value) || value < 0) {
      throw new SellerOnboardingServiceError('Document sort order is invalid', 400, 'SELLER_APPLICATION_INVALID')
    }
    return value
  }

  private assertRequiredDocumentsApproved(application: SellerApplicationRecord): void {
    const requiredDocumentTypes = this.requiredDocumentTypes(application.businessType)
    const unresolved = requiredDocumentTypes
      .map((documentType) => {
        const sameTypeDocuments = application.documents.filter((document) => document.documentType === documentType)
        const approved = sameTypeDocuments.some((document) => document.reviewStatus === 'APPROVED')
        if (approved) return null

        return {
          documentType,
          documentIds: sameTypeDocuments.map((document) => document.id),
          reviewStatuses: Array.from(new Set(sameTypeDocuments.map((document) => document.reviewStatus))),
        }
      })
      .filter((item): item is { documentType: SellerKycDocumentType; documentIds: string[]; reviewStatuses: SellerKycDocumentReviewStatus[] } => item !== null)

    if (unresolved.length > 0) {
      throw new SellerOnboardingServiceError(
        'Required KYC documents are not approved',
        409,
        'SELLER_DOCUMENTS_NOT_APPROVED',
        { unresolved },
      )
    }
  }

  private requiredDocumentTypes(businessType: SellerBusinessType): SellerKycDocumentType[] {
    return businessType === 'COMPANY'
      ? ['BUSINESS_CERTIFICATE', 'ID_CARD', 'TAX_DOCUMENT']
      : ['ID_CARD', 'TAX_DOCUMENT']
  }

  private toAdminResponse(application: SellerApplicationRecord): AdminSellerApplicationResponse {
    return {
      ...this.toResponse(application),
      user: application.user,
    }
  }

  private toResponse(application: SellerApplicationRecord): SellerApplicationResponse {
    return {
      id: application.id,
      userId: application.userId,
      sellerProfileId: application.sellerProfileId,
      status: application.status,
      businessType: application.businessType,
      sellerProfile: application.sellerProfile,
      shop: application.shop,
      shopName: application.shopName,
      shopSlug: application.shopSlug,
      shopContactEmail: application.shopContactEmail,
      shopContactPhone: application.shopContactPhone,
      legalName: application.legalName,
      contactEmail: application.contactEmail,
      contactPhone: application.contactPhone,
      nationalIdLast4: application.nationalIdLast4,
      nationalIdMasked: this.maskFromLast4(application.nationalIdLast4),
      companyRegistrationLast4: application.companyRegistrationLast4,
      companyRegistrationMasked: this.maskFromLast4(application.companyRegistrationLast4),
      taxIdLast4: application.taxIdLast4,
      taxIdMasked: this.maskFromLast4(application.taxIdLast4),
      bankName: application.bankName,
      bankAccountName: application.bankAccountName,
      bankAccountNumberLast4: application.bankAccountNumberLast4,
      bankAccountNumberMasked: this.maskFromLast4(application.bankAccountNumberLast4),
      pickupAddress: {
        name: application.pickupName,
        phone: application.pickupPhone,
        line1: application.pickupLine1,
        line2: application.pickupLine2,
        city: application.pickupCity,
        region: application.pickupRegion,
        postalCode: application.pickupPostalCode,
        country: application.pickupCountry,
      },
      documents: application.documents.map((document) => ({
        id: document.id,
        uploadId: document.uploadId,
        documentType: document.documentType,
        side: document.side,
        sortOrder: document.sortOrder,
        reviewStatus: document.reviewStatus,
        reviewedAt: document.reviewedAt,
        reviewedById: document.reviewedById,
        rejectionReason: document.rejectionReason,
        fileName: document.upload.fileName,
        contentType: document.upload.contentType,
        fileSize: document.upload.fileSize,
        status: document.upload.status,
        completedAt: document.upload.completedAt,
        createdAt: document.upload.createdAt,
      })),
      submittedAt: application.submittedAt,
      reviewedAt: application.reviewedAt,
      reviewedById: application.reviewedById,
      rejectionReason: application.rejectionReason,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    }
  }

  private maskFromLast4(last4: string | null | undefined): string | null {
    return last4 ? `****${last4}` : null
  }
}
