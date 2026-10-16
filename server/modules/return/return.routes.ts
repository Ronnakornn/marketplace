import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin, type AuthContext } from '#server/modules/auth'
import { ReturnServiceError } from './return.errors.ts'
import { ListPageQuery } from '#server/lib/list-page.ts'

const ReturnListQuery = t.Object({
  ...ListPageQuery,
  q: t.Optional(t.String({ maxLength: 200 })),
  status: t.Optional(t.String({ minLength: 1, maxLength: 30 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
})

const ReturnParamsSchema = t.Object({
  returnId: t.String({ format: 'uuid' }),
})

const CreateReturnBodySchema = t.Object({
  orderId: t.String({ format: 'uuid' }),
  orderItemId: t.String({ format: 'uuid' }),
  quantity: t.Optional(t.Integer({ minimum: 1, maximum: 2147483647 })),
  reason: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  uploadIds: t.Optional(t.Array(t.String({ format: 'uuid' }), { maxItems: 5 })),
})

export function createReturnRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof ReturnServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .post('/api/returns', ({ authContext, body }: any) =>
      moneyResponse(container.returnService.createReturn(authContext!.user, body)), {
      withAuth: true,
      body: CreateReturnBodySchema,
    })
    .get('/api/returns', ({ authContext, query }: { authContext?: AuthContext; query: typeof ReturnListQuery.static }) =>
      moneyResponse(container.returnService.listBuyerReturns(authContext!.user, query)), {
      withAuth: true,
      query: ReturnListQuery,
    })
    .get('/api/returns/:returnId', ({ authContext, params }: any) =>
      moneyResponse(container.returnService.getBuyerReturn(authContext!.user, params.returnId)), {
      withAuth: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/returns/:returnId/cancel', ({ authContext, params }: any) =>
      moneyResponse(container.returnService.cancelBuyerReturn(authContext!.user, params.returnId)), {
      withAuth: true,
      params: ReturnParamsSchema,
    })
    .get('/api/seller/returns', ({ authContext, query }: { authContext?: AuthContext; query: typeof ReturnListQuery.static }) =>
      moneyResponse(container.returnService.listSellerReturns(authContext!.user, query)), {
      withAuth: true,
      withSellerOperational: true,
      query: ReturnListQuery,
    })
    .get('/api/seller/returns/:returnId', ({ authContext, params }: any) =>
      moneyResponse(container.returnService.getSellerReturn(authContext!.user, params.returnId)), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/seller/returns/:returnId/approve', ({ authContext, params }: any) =>
      moneyResponse(container.returnService.approveSellerReturn(authContext!.user, params.returnId)), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/seller/returns/:returnId/reject', ({ authContext, params }: any) =>
      moneyResponse(container.returnService.rejectSellerReturn(authContext!.user, params.returnId)), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
}
