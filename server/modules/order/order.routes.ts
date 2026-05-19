import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { OrderServiceError } from './order.errors.ts'

const OrderParamsSchema = t.Object({
  orderId: t.String({ format: 'uuid' }),
})

export function createOrderRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof OrderServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/orders', ({ authContext }: any) => container.orderService.listBuyerOrders(authContext!.user), {
      withAuth: true,
    })
    .get('/api/orders/:orderId', ({ authContext, params }: any) =>
      container.orderService.getBuyerOrder(authContext!.user, params.orderId), {
      withAuth: true,
      params: OrderParamsSchema,
    })
    .get('/api/orders/:orderId/tracking', ({ authContext, params }: any) =>
      container.orderService.getBuyerOrderTracking(authContext!.user, params.orderId), {
      withAuth: true,
      params: OrderParamsSchema,
    })
    .get('/api/seller/orders', ({ authContext }: any) => container.orderService.listSellerOrders(authContext!.user), {
      withAuth: true,
    })
    .get('/api/seller/orders/:orderId', ({ authContext, params }: any) =>
      container.orderService.getSellerOrder(authContext!.user, params.orderId), {
      withAuth: true,
      params: OrderParamsSchema,
    })
}
