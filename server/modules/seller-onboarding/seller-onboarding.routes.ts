import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { SellerOnboardingServiceError } from './seller-onboarding.errors.ts'

const DocumentSchema = t.Object({
  uploadId: t.String({ format: 'uuid' }),
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
  sellerProfileId: t.Nullable(t.String({ format: 'uuid' })),
  shopName: t.String({ minLength: 1 }),
  shopSlug: t.String({ minLength: 2 }),
  shopContactEmail: t.String({ format: 'email' }),
  shopContactPhone: t.String({ minLength: 1 }),
  legalName: t.String({ minLength: 1 }),
  contactEmail: t.String({ format: 'email' }),
  contactPhone: t.String({ minLength: 1 }),
  nationalId: t.Nullable(t.String()),
  companyRegistration: t.Nullable(t.String()),
  taxId: t.Nullable(t.String()),
  bankName: t.String({ minLength: 1 }),
  bankAccountName: t.String({ minLength: 1 }),
  bankAccountNumber: t.String({ minLength: 1 }),
  pickupName: t.String({ minLength: 1 }),
  pickupPhone: t.Nullable(t.String()),
  pickupLine1: t.String({ minLength: 1 }),
  pickupLine2: t.Nullable(t.String()),
  pickupCity: t.String({ minLength: 1 }),
  pickupRegion: t.Nullable(t.String()),
  pickupPostalCode: t.String({ minLength: 1 }),
  pickupCountry: t.String({ minLength: 2 }),
  documents: t.Array(DocumentSchema),
}))

const ReviewBodySchema = t.Object({
  decision: t.Union([t.Literal('APPROVED'), t.Literal('REJECTED')]),
  rejectionReason: t.Optional(t.String()),
})

const IdParamsSchema = t.Object({
  applicationId: t.String({ format: 'uuid' }),
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
}
