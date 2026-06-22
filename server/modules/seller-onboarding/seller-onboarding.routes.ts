import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { SellerOnboardingServiceError } from './seller-onboarding.errors.ts'

const DocumentSchema = t.Object({
  uploadId: t.String(),
  documentType: t.Union([
    t.Literal('ID_CARD'),
    t.Literal('BUSINESS_CERTIFICATE'),
    t.Literal('BANK_BOOK'),
    t.Literal('TAX_DOCUMENT'),
  ]),
  side: t.Optional(t.Union([
    t.Literal('FRONT'),
    t.Literal('BACK'),
    t.Literal('EXTRA'),
  ])),
  sortOrder: t.Optional(t.Integer({ minimum: 0 })),
})

const ApplicationBodySchema = t.Partial(t.Object({
  businessType: t.Union([t.Literal('INDIVIDUAL'), t.Literal('COMPANY')]),
  sellerProfileId: t.Nullable(t.String()),
  shopName: t.String(),
  shopSlug: t.String(),
  shopContactEmail: t.String(),
  shopContactPhone: t.String(),
  legalName: t.String(),
  contactEmail: t.String(),
  contactPhone: t.String(),
  nationalId: t.Nullable(t.String()),
  companyRegistration: t.Nullable(t.String()),
  taxId: t.Nullable(t.String()),
  bankName: t.String(),
  bankAccountName: t.String(),
  bankAccountNumber: t.String(),
  pickupName: t.String(),
  pickupPhone: t.Nullable(t.String()),
  pickupLine1: t.String(),
  pickupLine2: t.Nullable(t.String()),
  pickupCity: t.String(),
  pickupRegion: t.Nullable(t.String()),
  pickupPostalCode: t.String(),
  pickupCountry: t.String(),
  documents: t.Array(DocumentSchema),
}))

const ReviewBodySchema = t.Object({
  decision: t.Union([t.Literal('APPROVED'), t.Literal('REJECTED')]),
  rejectionReason: t.Optional(t.String()),
})

const DocumentReviewBodySchema = t.Object({
  decision: t.Union([t.Literal('APPROVED'), t.Literal('REJECTED')]),
  rejectionReason: t.Optional(t.String()),
})

const IdParamsSchema = t.Object({
  applicationId: t.String({ format: 'uuid' }),
})

const DocumentReviewParamsSchema = t.Object({
  applicationId: t.String({ format: 'uuid' }),
  documentId: t.String({ format: 'uuid' }),
})

const ListQuerySchema = t.Object({
  status: t.Optional(t.Union([
    t.Literal('DRAFT'),
    t.Literal('SUBMITTED'),
    t.Literal('APPROVED'),
    t.Literal('REJECTED'),
    t.Literal('CANCELLED'),
  ])),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createSellerOnboardingRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof SellerOnboardingServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/seller/application', ({ authContext }: any) =>
      container.sellerOnboardingService.getApplication(actor(authContext)), {
      withAuth: true,
    })
    .post('/api/seller/application/draft', ({ authContext, body }: any) =>
      container.sellerOnboardingService.saveDraft(actor(authContext), body), {
      withAuth: true,
      body: ApplicationBodySchema,
    })
    .post('/api/seller/application/submit', ({ authContext, body }: any) =>
      container.sellerOnboardingService.submitApplication(actor(authContext), body), {
      withAuth: true,
      body: ApplicationBodySchema,
    })
    .get('/api/admin/seller-applications', ({ authContext, query }: any) =>
      container.sellerOnboardingService.listApplications(actor(authContext), query.status), {
      withRole: 'ADMIN',
      query: ListQuerySchema,
    })
    .get('/api/admin/seller-applications/:applicationId', ({ authContext, params }: any) =>
      container.sellerOnboardingService.getAdminApplication(actor(authContext), params.applicationId), {
      withRole: 'ADMIN',
      params: IdParamsSchema,
    })
    .patch('/api/admin/seller-applications/:applicationId/review', ({ authContext, params, body }: any) =>
      container.sellerOnboardingService.reviewApplication(actor(authContext), params.applicationId, body), {
      withRole: 'ADMIN',
      params: IdParamsSchema,
      body: ReviewBodySchema,
    })
    .patch('/api/admin/seller-applications/:applicationId/documents/:documentId/review', ({ authContext, params, body }: any) =>
      container.sellerOnboardingService.reviewDocument(actor(authContext), params.applicationId, params.documentId, body), {
      withRole: 'ADMIN',
      params: DocumentReviewParamsSchema,
      body: DocumentReviewBodySchema,
    })
}
