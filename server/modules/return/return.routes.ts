import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ReturnServiceError } from './return.errors.ts'

const ReturnParamsSchema = t.Object({
  returnId: t.String({ format: 'uuid' }),
})

const CreateReturnBodySchema = t.Object({
  orderId: t.String({ format: 'uuid' }),
  orderItemId: t.String({ format: 'uuid' }),
  reason: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  uploadIds: t.Optional(t.Array(t.String({ format: 'uuid' }), { maxItems: 5 })),
})

export function createReturnRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ReturnServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/returns', ({ authContext, body }: any) =>
      container.returnService.createReturn(authContext!.user, body), {
      withAuth: true,
      body: CreateReturnBodySchema,
    })
    .get('/api/returns', ({ authContext }: any) =>
      container.returnService.listBuyerReturns(authContext!.user), {
      withAuth: true,
    })
    .get('/api/returns/:returnId', ({ authContext, params }: any) =>
      container.returnService.getBuyerReturn(authContext!.user, params.returnId), {
      withAuth: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/returns/:returnId/cancel', ({ authContext, params }: any) =>
      container.returnService.cancelBuyerReturn(authContext!.user, params.returnId), {
      withAuth: true,
      params: ReturnParamsSchema,
    })
    .get('/api/seller/returns', ({ authContext }: any) =>
      container.returnService.listSellerReturns(authContext!.user), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/seller/returns/:returnId', ({ authContext, params }: any) =>
      container.returnService.getSellerReturn(authContext!.user, params.returnId), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/seller/returns/:returnId/approve', ({ authContext, params }: any) =>
      container.returnService.approveSellerReturn(authContext!.user, params.returnId), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
    .patch('/api/seller/returns/:returnId/reject', ({ authContext, params }: any) =>
      container.returnService.rejectSellerReturn(authContext!.user, params.returnId), {
      withAuth: true,
      withSellerOperational: true,
      params: ReturnParamsSchema,
    })
}
