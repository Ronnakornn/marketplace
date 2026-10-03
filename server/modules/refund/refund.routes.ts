import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { RefundServiceError } from './refund.errors.ts'
import { AdminServiceError } from '#server/modules/admin/admin.errors.ts'
import { SettlementRefundPlanSchema } from './settlement-refund.schema.ts'

const RefundParamsSchema = t.Object({
  refundId: t.String({ format: 'uuid' }),
})

const ProcessRefundBodySchema = t.Optional(t.Object({
  status: t.Optional(t.Union([t.Literal('processing'), t.Literal('success'), t.Literal('failed')])),
  externalReference: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  settlementPlan: t.Optional(SettlementRefundPlanSchema),
}))

export function createRefundRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof RefundServiceError || error instanceof AdminServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/admin/refunds', ({ authContext }: any) =>
      container.refundService.listAdminRefunds(authContext!.user), {
      withRole: 'ADMIN',
    })
    .get('/api/admin/refunds/:refundId', ({ authContext, params }: any) =>
      container.refundService.getAdminRefund(authContext!.user, params.refundId), {
      withRole: 'ADMIN',
      params: RefundParamsSchema,
    })
    .patch('/api/admin/refunds/:refundId/process', async ({ authContext, params, body }: any) => {
      await container.adminService.updateRefundStatus(authContext!.user, params.refundId, {
        status: (body?.status ?? 'processing').toUpperCase(),
        externalReference: body?.externalReference,
        settlementPlan: body?.settlementPlan,
      })
      return container.refundService.getAdminRefund(authContext!.user, params.refundId)
    }, {
      withRole: 'ADMIN',
      params: RefundParamsSchema,
      body: ProcessRefundBodySchema,
    })
}
