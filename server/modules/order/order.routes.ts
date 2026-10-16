import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import type { AuthContext } from '#server/modules/auth'
import { OrderServiceError } from './order.errors.ts'
import { PaymentServiceError } from '#server/modules/payment/payment.errors.ts'
import { CartServiceError } from '#server/modules/cart/cart.errors.ts'
import { ListPageQuery } from '#server/lib/list-page.ts'
import { OrderStatus, PaymentStatus } from '#generated/client/enums.ts'

const OrderListQuerySchema = t.Object({
  ...ListPageQuery,
  q: t.Optional(t.String({ maxLength: 200 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.Enum({ ...OrderStatus, ...PaymentStatus })),
})

const OrderParamsSchema = t.Object({
  orderId: t.String({ format: 'uuid' }),
})

const CancelOrderResponseSchema = t.Object({ ok: t.Literal(true) })

export function createOrderRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof OrderServiceError || error instanceof PaymentServiceError || error instanceof CartServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/orders', ({ authContext, query }: { authContext?: AuthContext; query: typeof OrderListQuerySchema.static }) => moneyResponse(container.orderService.listBuyerOrders(authContext!.user, query)), {
      withAuth: true,
      query: OrderListQuerySchema,
    })
    .get('/api/orders/:orderId', ({ authContext, params }: any) =>
      moneyResponse(container.orderService.getBuyerOrder(authContext!.user, params.orderId)), {
      withAuth: true,
      params: OrderParamsSchema,
    })
    .get('/api/orders/:orderId/tracking', ({ authContext, params }: any) =>
      moneyResponse(container.orderService.getBuyerOrderTracking(authContext!.user, params.orderId)), {
      withAuth: true,
      params: OrderParamsSchema,
    })
    .post('/api/orders/:orderId/cancel', ({ authContext, params }: any) =>
      moneyResponse(container.paymentService.cancelBuyerOrder(authContext!.user, params.orderId)), {
      withAuth: true,
      params: OrderParamsSchema,
      response: CancelOrderResponseSchema,
    })
    .post('/api/orders/:orderId/buy-again', ({ authContext, params }: { authContext?: AuthContext; params: { orderId: string } }) =>
      moneyResponse(container.cartService.buyAgain(authContext!.user, params.orderId)), {
      withAuth: true,
      params: OrderParamsSchema,
    })
    .get('/api/seller/orders', ({ authContext, query }: { authContext?: AuthContext; query: typeof OrderListQuerySchema.static }) => moneyResponse(container.orderService.listSellerOrders(authContext!.user, query)), {
      withAuth: true,
      withSellerOperational: true,
      query: OrderListQuerySchema,
    })
    .get('/api/seller/orders/:orderId', ({ authContext, params }: any) =>
      moneyResponse(container.orderService.getSellerOrder(authContext!.user, params.orderId)), {
      withAuth: true,
      withSellerOperational: true,
      params: OrderParamsSchema,
    })
}
