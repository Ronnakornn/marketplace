import type {
  Prisma,
  PrismaClient,
  SellerApplication,
  SellerKycDocument,
  SellerProfile,
  Shop,
  Upload,
  User,
} from '#generated/client/client.ts'
import type {
  SellerApplicationStatus,
  SellerBusinessType,
  SellerKycDocumentSide,
  SellerKycDocumentType,
  SellerVerificationStatus,
} from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface SellerApplicationWriteInput {
  businessType: SellerBusinessType
  sellerProfileId?: string | null
  shopName: string
  shopSlug: string
  shopContactEmail: string
  shopContactPhone: string
  legalName: string
  contactEmail: string
  contactPhone: string
  nationalIdHash?: string | null
  nationalIdEncrypted?: string | null
  nationalIdLast4?: string | null
  companyRegistrationEncrypted?: string | null
  companyRegistrationLast4?: string | null
  taxIdEncrypted?: string | null
  taxIdLast4?: string | null
  bankName: string
  bankAccountName: string
  bankAccountNumberEncrypted: string
  bankAccountNumberLast4: string
  pickupName: string
  pickupPhone?: string | null
  pickupLine1: string
  pickupLine2?: string | null
  pickupCity: string
  pickupRegion?: string | null
  pickupPostalCode: string
  pickupCountry: string
}

export interface SellerKycDocumentInput {
  uploadId: string
  documentType: SellerKycDocumentType
  side?: SellerKycDocumentSide
  sortOrder?: number
}

export type SellerApplicationRecord = SellerApplication & {
  user: Pick<User, 'id' | 'name' | 'email' | 'status'>
  sellerProfile: Pick<SellerProfile, 'id' | 'userId' | 'businessType' | 'verificationStatus' | 'legalName' | 'displayName' | 'contactEmail' | 'contactPhone'> | null
  shop: Pick<Shop, 'id' | 'ownerId' | 'sellerProfileId' | 'name' | 'slug' | 'contactEmail' | 'contactPhone' | 'status' | 'approvedAt' | 'approvedById' | 'rejectedReason'> | null
  documents: Array<SellerKycDocument & {
    upload: Pick<Upload, 'id' | 'fileName' | 'contentType' | 'fileSize' | 'status' | 'completedAt' | 'createdAt'>
  }>
}

export interface SellerApplicationListFilters {
  status?: SellerApplicationStatus
}

export interface ISellerOnboardingRepository {
  findApplicationByUserId(userId: string): Promise<SellerApplicationRecord | null>
  findApplicationById(applicationId: string): Promise<SellerApplicationRecord | null>
  findSellerProfileById(sellerProfileId: string): Promise<Pick<SellerProfile, 'id' | 'userId'> | null>
  findShopBySlug(slug: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'slug' | 'status'> | null>
  findUploadForUser(uploadId: string, userId: string): Promise<Pick<Upload, 'id' | 'userId' | 'usage' | 'status'> | null>
  upsertDraft(userId: string, input: SellerApplicationWriteInput, documents?: SellerKycDocumentInput[]): Promise<SellerApplicationRecord>
  submitApplication(userId: string, input: SellerApplicationWriteInput, documents: SellerKycDocumentInput[]): Promise<SellerApplicationRecord>
  listApplications(filters: SellerApplicationListFilters): Promise<SellerApplicationRecord[]>
  approveApplication(applicationId: string, reviewerId: string): Promise<SellerApplicationRecord>
  rejectApplication(applicationId: string, reviewerId: string, rejectionReason: string): Promise<SellerApplicationRecord>
}

const applicationInclude = {
  user: { select: { id: true, name: true, email: true, status: true } },
  sellerProfile: {
    select: {
      id: true,
      userId: true,
      businessType: true,
      verificationStatus: true,
      legalName: true,
      displayName: true,
      contactEmail: true,
      contactPhone: true,
    },
  },
  shop: {
    select: {
      id: true,
      ownerId: true,
      sellerProfileId: true,
      name: true,
      slug: true,
      contactEmail: true,
      contactPhone: true,
      status: true,
      approvedAt: true,
      approvedById: true,
      rejectedReason: true,
    },
  },
  documents: {
    include: {
      upload: {
        select: {
          id: true,
          fileName: true,
          contentType: true,
          fileSize: true,
          status: true,
          completedAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const

export class PrismaSellerOnboardingRepository implements ISellerOnboardingRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findApplicationByUserId(userId: string): Promise<SellerApplicationRecord | null> {
    this.logger.debug('PrismaSellerOnboardingRepository.findApplicationByUserId', { userId })
    return this.prisma.sellerApplication.findFirst({
      where: { userId },
      include: applicationInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  findApplicationById(applicationId: string): Promise<SellerApplicationRecord | null> {
    this.logger.debug('PrismaSellerOnboardingRepository.findApplicationById', { applicationId })
    return this.prisma.sellerApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    })
  }

  findSellerProfileById(sellerProfileId: string): Promise<Pick<SellerProfile, 'id' | 'userId'> | null> {
    this.logger.debug('PrismaSellerOnboardingRepository.findSellerProfileById', { sellerProfileId })
    return this.prisma.sellerProfile.findUnique({
      where: { id: sellerProfileId },
      select: { id: true, userId: true },
    })
  }

  findShopBySlug(slug: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'slug' | 'status'> | null> {
    this.logger.debug('PrismaSellerOnboardingRepository.findShopBySlug', { slug })
    return this.prisma.shop.findFirst({
      where: { slug },
      select: { id: true, ownerId: true, slug: true, status: true },
    })
  }

  findUploadForUser(uploadId: string, userId: string): Promise<Pick<Upload, 'id' | 'userId' | 'usage' | 'status'> | null> {
    this.logger.debug('PrismaSellerOnboardingRepository.findUploadForUser', { uploadId, userId })
    return this.prisma.upload.findFirst({
      where: { id: uploadId, userId },
      select: { id: true, userId: true, usage: true, status: true },
    })
  }

  async upsertDraft(userId: string, input: SellerApplicationWriteInput, documents?: SellerKycDocumentInput[]): Promise<SellerApplicationRecord> {
    this.logger.info('PrismaSellerOnboardingRepository.upsertDraft', { userId, shopSlug: input.shopSlug })
    const application = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sellerApplication.findFirst({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })
      const sellerProfile = await this.ensureSellerProfileWithTx(tx, userId, input, 'UNVERIFIED')
      const data = {
        ...this.toApplicationData(input),
        sellerProfileId: sellerProfile.id,
        status: 'DRAFT' as const,
        rejectionReason: null,
        reviewedAt: null,
        reviewedById: null,
      }
      const saved = existing
        ? await tx.sellerApplication.update({
            where: { id: existing.id },
            data,
          })
        : await tx.sellerApplication.create({
            data: {
              userId,
              ...data,
            },
          })
      if (documents) await this.replaceDocumentsWithTx(tx, saved.id, documents)
      return saved
    })
    return this.findApplicationById(application.id) as Promise<SellerApplicationRecord>
  }

  async submitApplication(userId: string, input: SellerApplicationWriteInput, documents: SellerKycDocumentInput[]): Promise<SellerApplicationRecord> {
    this.logger.info('PrismaSellerOnboardingRepository.submitApplication', { userId, shopSlug: input.shopSlug })
    const submitted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sellerApplication.findFirst({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      })
      const sellerProfile = await this.ensureSellerProfileWithTx(tx, userId, input, 'PENDING')
      const shopId = existing?.shopId ?? (await tx.shop.create({
        data: {
          ownerId: userId,
          sellerProfileId: sellerProfile.id,
          sellerIdentityHash: input.nationalIdHash ?? null,
          name: input.shopName,
          slug: input.shopSlug,
          contactEmail: input.shopContactEmail,
          contactPhone: input.shopContactPhone,
          status: 'PENDING',
          rejectedReason: null,
        },
        select: { id: true },
      })).id

      if (existing?.shopId) {
        await tx.shop.update({
          where: { id: existing.shopId },
          data: {
            sellerProfileId: sellerProfile.id,
            sellerIdentityHash: input.nationalIdHash ?? null,
            name: input.shopName,
            slug: input.shopSlug,
            contactEmail: input.shopContactEmail,
            contactPhone: input.shopContactPhone,
            status: 'PENDING',
            rejectedReason: null,
            approvedAt: null,
            approvedById: null,
          },
        })
      }

      const application = existing
        ? await tx.sellerApplication.update({
            where: { id: existing.id },
            data: {
              ...this.toApplicationData(input),
              sellerProfileId: sellerProfile.id,
              shopId,
              status: 'SUBMITTED',
              submittedAt: new Date(),
              reviewedAt: null,
              reviewedById: null,
              rejectionReason: null,
            },
          })
        : await tx.sellerApplication.create({
            data: {
              userId,
              shopId,
              sellerProfileId: sellerProfile.id,
              ...this.toApplicationData(input),
              status: 'SUBMITTED',
              submittedAt: new Date(),
            },
          })

      await this.replaceDocumentsWithTx(tx, application.id, documents)
      await tx.shopActivityLog.create({
        data: {
          shopId,
          actorUserId: userId,
          action: 'SELLER_APPLICATION_SUBMITTED',
          entityType: 'SellerApplication',
          entityId: application.id,
          after: { status: 'SUBMITTED' },
        },
      })
      return application
    })

    return this.findApplicationById(submitted.id) as Promise<SellerApplicationRecord>
  }

  listApplications(filters: SellerApplicationListFilters): Promise<SellerApplicationRecord[]> {
    this.logger.debug('PrismaSellerOnboardingRepository.listApplications', { status: filters.status })
    return this.prisma.sellerApplication.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: applicationInclude,
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })
  }

  async approveApplication(applicationId: string, reviewerId: string): Promise<SellerApplicationRecord> {
    this.logger.info('PrismaSellerOnboardingRepository.approveApplication', { applicationId, reviewerId })
    await this.prisma.$transaction(async (tx) => {
      const application = await tx.sellerApplication.findUniqueOrThrow({ where: { id: applicationId } })
      const sellerProfile = application.sellerProfileId
        ? await tx.sellerProfile.update({
            where: { id: application.sellerProfileId },
            data: {
              ...this.toSellerProfileData(application),
              verificationStatus: 'VERIFIED',
              verifiedAt: new Date(),
              rejectedReason: null,
            },
          })
        : await this.ensureSellerProfileWithTx(tx, application.userId, application, 'VERIFIED')
      const shopId = application.shopId ?? (await tx.shop.create({
        data: {
          ownerId: application.userId,
          sellerProfileId: sellerProfile.id,
          sellerIdentityHash: application.nationalIdHash ?? null,
          name: application.shopName,
          slug: application.shopSlug,
          contactEmail: application.shopContactEmail,
          contactPhone: application.shopContactPhone,
          status: 'ACTIVE',
          approvedById: reviewerId,
          approvedAt: new Date(),
        },
        select: { id: true },
      })).id

      await tx.shop.update({
        where: { id: shopId },
        data: {
          sellerProfileId: sellerProfile.id,
          sellerIdentityHash: application.nationalIdHash ?? null,
          name: application.shopName,
          slug: application.shopSlug,
          contactEmail: application.shopContactEmail,
          contactPhone: application.shopContactPhone,
          status: 'ACTIVE',
          approvedById: reviewerId,
          approvedAt: new Date(),
          rejectedReason: null,
        },
      })
      await tx.shopWallet.upsert({
        where: { shopId },
        create: { shopId },
        update: {},
      })
      await tx.shopSetting.upsert({
        where: { shopId },
        create: { shopId },
        update: {},
      })
      const defaultPickupAddress = await tx.shopAddress.findFirst({
        where: { shopId, type: 'PICKUP', isDefault: true },
        select: { id: true },
      })
      const pickupAddressData = this.toPickupAddressData(shopId, application)
      if (defaultPickupAddress) {
        await tx.shopAddress.update({
          where: { id: defaultPickupAddress.id },
          data: pickupAddressData,
        })
      } else {
        await tx.shopAddress.create({ data: pickupAddressData })
      }
      await tx.sellerApplication.update({
        where: { id: application.id },
        data: {
          shopId,
          sellerProfileId: sellerProfile.id,
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          rejectionReason: null,
        },
      })
      await tx.auditLog.create({
        data: {
          actorUserId: reviewerId,
          actorRole: 'ADMIN',
          action: 'SELLER_APPLICATION_STATUS_CHANGED',
          entityType: 'SellerApplication',
          entityId: application.id,
          before: { status: application.status },
          after: { status: 'APPROVED', shopId, sellerProfileId: sellerProfile.id },
        },
      })
      await tx.shopActivityLog.create({
        data: {
          shopId,
          actorUserId: reviewerId,
          action: 'SELLER_APPLICATION_APPROVED',
          entityType: 'SellerApplication',
          entityId: application.id,
          before: { status: application.status },
          after: { status: 'APPROVED', shopStatus: 'ACTIVE' },
        },
      })
    })
    return this.findApplicationById(applicationId) as Promise<SellerApplicationRecord>
  }

  async rejectApplication(applicationId: string, reviewerId: string, rejectionReason: string): Promise<SellerApplicationRecord> {
    this.logger.info('PrismaSellerOnboardingRepository.rejectApplication', { applicationId, reviewerId })
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.sellerApplication.findUniqueOrThrow({ where: { id: applicationId } })
      const application = await tx.sellerApplication.update({
        where: { id: applicationId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedById: reviewerId,
          rejectionReason,
        },
      })
      if (application.sellerProfileId) {
        await tx.sellerProfile.update({
          where: { id: application.sellerProfileId },
          data: {
            verificationStatus: 'REJECTED',
            rejectedReason: rejectionReason,
          },
        })
      }
      if (application.shopId) {
        await tx.shop.update({
          where: { id: application.shopId },
          data: {
            status: 'REJECTED',
            rejectedReason: rejectionReason,
            approvedAt: null,
            approvedById: null,
          },
        })
        await tx.shopActivityLog.create({
          data: {
            shopId: application.shopId,
            actorUserId: reviewerId,
            action: 'SELLER_APPLICATION_REJECTED',
            entityType: 'SellerApplication',
            entityId: application.id,
            before: { status: before.status },
            after: { status: 'REJECTED', shopStatus: 'REJECTED', rejectionReason },
          },
        })
      }
      await tx.auditLog.create({
        data: {
          actorUserId: reviewerId,
          actorRole: 'ADMIN',
          action: 'SELLER_APPLICATION_STATUS_CHANGED',
          entityType: 'SellerApplication',
          entityId: application.id,
          before: { status: before.status },
          after: { status: 'REJECTED', rejectionReason },
        },
      })
    })
    return this.findApplicationById(applicationId) as Promise<SellerApplicationRecord>
  }

  private async replaceDocumentsWithTx(
    tx: PrismaClient | Prisma.TransactionClient,
    applicationId: string,
    documents: SellerKycDocumentInput[],
  ): Promise<void> {
    await tx.sellerKycDocument.deleteMany({ where: { applicationId } })
    if (documents.length === 0) return
    await tx.sellerKycDocument.createMany({
      data: documents.map((document) => ({
        applicationId,
        uploadId: document.uploadId,
        documentType: document.documentType,
        side: document.side ?? 'FRONT',
        sortOrder: document.sortOrder ?? 0,
      })),
    })
  }

  private ensureSellerProfileWithTx(
    tx: PrismaClient | Prisma.TransactionClient,
    userId: string,
    input: SellerApplicationWriteInput,
    verificationStatus: SellerVerificationStatus,
  ): Promise<Pick<SellerProfile, 'id'>> {
    return tx.sellerProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...this.toSellerProfileData(input),
        verificationStatus,
      },
      update: {
        ...this.toSellerProfileData(input),
        verificationStatus,
        rejectedReason: verificationStatus === 'REJECTED' ? undefined : null,
      },
      select: { id: true },
    })
  }

  private toApplicationData(input: SellerApplicationWriteInput) {
    return {
      businessType: input.businessType,
      shopName: input.shopName,
      shopSlug: input.shopSlug,
      shopContactEmail: input.shopContactEmail,
      shopContactPhone: input.shopContactPhone,
      legalName: input.legalName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      nationalIdHash: input.nationalIdHash ?? null,
      nationalIdEncrypted: input.nationalIdEncrypted ?? null,
      nationalIdLast4: input.nationalIdLast4 ?? null,
      companyRegistrationEncrypted: input.companyRegistrationEncrypted ?? null,
      companyRegistrationLast4: input.companyRegistrationLast4 ?? null,
      taxIdEncrypted: input.taxIdEncrypted ?? null,
      taxIdLast4: input.taxIdLast4 ?? null,
      bankName: input.bankName,
      bankAccountName: input.bankAccountName,
      bankAccountNumberEncrypted: input.bankAccountNumberEncrypted,
      bankAccountNumberLast4: input.bankAccountNumberLast4,
      pickupName: input.pickupName,
      pickupPhone: input.pickupPhone ?? null,
      pickupLine1: input.pickupLine1,
      pickupLine2: input.pickupLine2 ?? null,
      pickupCity: input.pickupCity,
      pickupRegion: input.pickupRegion ?? null,
      pickupPostalCode: input.pickupPostalCode,
      pickupCountry: input.pickupCountry,
    }
  }

  private toSellerProfileData(input: SellerApplicationWriteInput | SellerApplication) {
    return {
      businessType: input.businessType,
      legalName: input.legalName,
      displayName: input.shopName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      nationalIdHash: input.nationalIdHash ?? null,
      nationalIdEncrypted: input.nationalIdEncrypted ?? null,
      nationalIdLast4: input.nationalIdLast4 ?? null,
      companyName: input.businessType === 'COMPANY' ? input.legalName : null,
      companyRegistrationEncrypted: input.companyRegistrationEncrypted ?? null,
      companyRegistrationLast4: input.companyRegistrationLast4 ?? null,
      taxIdEncrypted: input.taxIdEncrypted ?? null,
      taxIdLast4: input.taxIdLast4 ?? null,
      bankName: input.bankName,
      bankAccountName: input.bankAccountName,
      bankAccountNumberEncrypted: input.bankAccountNumberEncrypted,
      bankAccountNumberLast4: input.bankAccountNumberLast4,
    }
  }

  private toPickupAddressData(shopId: string, application: SellerApplication) {
    return {
      shopId,
      type: 'PICKUP' as const,
      contactName: application.pickupName,
      phone: application.pickupPhone,
      line1: application.pickupLine1,
      line2: application.pickupLine2,
      city: application.pickupCity,
      region: application.pickupRegion,
      postalCode: application.pickupPostalCode,
      country: application.pickupCountry,
      isDefault: true,
    }
  }
}
