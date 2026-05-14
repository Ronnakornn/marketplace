import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { RefundServiceError } from './refund.errors.ts'

const RefundParamsSchema = t.Object({
  refundId: t.String({ format: 'uuid' }),
})

const ProcessRefundBodySchema = t.Optional(t.Object({
  status: t.Optional(t.Union([t.Literal('processing'), t.Literal('success'), t.Literal('failed')])),
}))

export function createRefundRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof RefundServiceError) {
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
    .patch('/api/admin/refunds/:refundId/process', ({ authContext, params, body }: any) =>
      container.refundService.processAdminRefund(authContext!.user, params.refundId, body?.status), {
      withRole: 'ADMIN',
      params: RefundParamsSchema,
      body: ProcessRefundBodySchema,
    })
}
