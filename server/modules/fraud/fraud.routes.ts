import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { FraudServiceError } from './fraud.errors.ts'

const FraudCaseQuerySchema = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
  status: t.Optional(t.String()),
  riskLevel: t.Optional(t.String()),
})

const ResolveBodySchema = t.Object({
  status: t.Optional(t.Union([t.Literal('RESOLVED'), t.Literal('DISMISSED')])),
})

function adminActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createFraudRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof FraudServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/admin/fraud/cases', ({ authContext, query }: any) =>
      container.fraudService.listFraudCases(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: FraudCaseQuerySchema,
    })
    .get('/api/admin/fraud/cases/:caseId', ({ authContext, params: { caseId } }: any) =>
      container.fraudService.getFraudCase(adminActor(authContext), caseId), {
      withRole: 'ADMIN',
      params: t.Object({ caseId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/fraud/cases/:caseId/review', ({ authContext, params: { caseId } }: any) =>
      container.fraudService.markFraudCaseReviewed(caseId, authContext!.user.id), {
      withRole: 'ADMIN',
      params: t.Object({ caseId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/fraud/cases/:caseId/resolve', ({ authContext, params: { caseId }, body }: any) =>
      container.fraudService.resolveFraudCase(caseId, authContext!.user.id, body.status), {
      withRole: 'ADMIN',
      params: t.Object({ caseId: t.String({ format: 'uuid' }) }),
      body: ResolveBodySchema,
    })
}
