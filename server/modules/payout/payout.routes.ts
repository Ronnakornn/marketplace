import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { WalletServiceError } from '#server/modules/wallet'

const PayoutRequestBody = t.Object({
  amount: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
})

const RejectBody = t.Object({
  reason: t.Optional(t.String()),
})

const MarkPaidBody = t.Object({
  externalReference: t.String({ minLength: 1, maxLength: 200 }),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createPayoutRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof WalletServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: { code: error.code, message: error.message, details: error.details ?? {} },
        }))
      }
    })
    .post('/api/seller/payouts', ({ authContext, body }: any) =>
      moneyResponse(container.payoutService.createSellerPayout(actor(authContext), body)), {
      withAuth: true,
      withSellerOperational: true,
      body: PayoutRequestBody,
    })
    .get('/api/seller/payouts', ({ authContext }: any) =>
      moneyResponse(container.payoutService.listSellerPayouts(actor(authContext))), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/admin/payouts', ({ authContext, query }: any) =>
      moneyResponse(container.payoutService.listAdminPayouts(actor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Object({ status: t.Optional(t.String()) }),
    })
    .get('/api/admin/payouts/:payoutId', ({ authContext, params }: any) =>
      moneyResponse(container.payoutService.getAdminPayout(actor(authContext), params.payoutId)), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/payouts/:payoutId/approve', ({ authContext, params }: any) =>
      moneyResponse(container.payoutService.approveAdminPayout(actor(authContext), params.payoutId)), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/payouts/:payoutId/reject', ({ authContext, params, body }: any) =>
      moneyResponse(container.payoutService.rejectAdminPayout(actor(authContext), params.payoutId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
      body: RejectBody,
    })
    .patch('/api/admin/payouts/:payoutId/mark-paid', ({ authContext, params, body }: any) =>
      moneyResponse(container.payoutService.markAdminPayoutPaid(actor(authContext), params.payoutId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ payoutId: t.String({ format: 'uuid' }) }),
      body: MarkPaidBody,
    })
}
