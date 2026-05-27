import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { WalletServiceError } from '#server/modules/wallet'

const PayoutRequestBody = t.Object({
  amount: t.Number({ minimum: 1 }),
})

const RejectBody = t.Object({
  reason: t.Optional(t.String()),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createPayoutRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof WalletServiceError) {
        return httpStatus(error.status, {
          error: { code: error.code, message: error.message, details: error.details ?? {} },
        })
      }
    })
    .post('/api/seller/payouts', ({ authContext, body }: any) =>
      container.payoutService.createSellerPayout(actor(authContext), body), {
      withAuth: true,
      withSellerOperational: true,
      body: PayoutRequestBody,
    })
    .get('/api/seller/payouts', ({ authContext }: any) =>
      container.payoutService.listSellerPayouts(actor(authContext)), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/admin/payouts', ({ authContext, query }: any) =>
      container.payoutService.listAdminPayouts(actor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Object({ status: t.Optional(t.String()) }),
    })
    .get('/api/admin/payouts/:payoutId', ({ authContext, params }: any) =>
      container.payoutService.getAdminPayout(actor(authContext), params.payoutId), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/payouts/:payoutId/approve', ({ authContext, params }: any) =>
      container.payoutService.approveAdminPayout(actor(authContext), params.payoutId), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/payouts/:payoutId/reject', ({ authContext, params, body }: any) =>
      container.payoutService.rejectAdminPayout(actor(authContext), params.payoutId, body), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
      body: RejectBody,
    })
    .patch('/api/admin/payouts/:payoutId/mark-paid', ({ authContext, params }: any) =>
      container.payoutService.markAdminPayoutPaid(actor(authContext), params.payoutId), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
    })
}
