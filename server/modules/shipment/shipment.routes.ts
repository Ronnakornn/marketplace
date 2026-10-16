import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin, type AuthContext } from '#server/modules/auth'
import { ShipmentServiceError } from './shipment.errors.ts'
import { ShipmentStatus } from '#generated/client/enums.ts'
import { ListPageQuery } from '#server/lib/list-page.ts'

const ShipmentListQuerySchema = t.Object({
  ...ListPageQuery,
  q: t.Optional(t.String({ maxLength: 200 })),
  status: t.Optional(t.Enum(ShipmentStatus)),
  shopId: t.Optional(t.String({ format: 'uuid' })),
})

const ShipmentParamsSchema = t.Object({
  shipmentId: t.String({ format: 'uuid' }),
})

const ShipShipmentBodySchema = t.Object({
  carrier: t.String({ minLength: 1 }),
  trackingNo: t.String({ minLength: 1 }),
  service: t.Optional(t.String({ minLength: 1 })),
})

const DeliverShipmentBodySchema = t.Object({
  evidenceReference: t.String({ minLength: 1, maxLength: 200 }),
})

export function createShipmentRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof ShipmentServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/seller/shipments', ({ authContext, query }: { authContext?: AuthContext; query: typeof ShipmentListQuerySchema.static }) =>
      moneyResponse(container.shipmentService.listSellerShipments(authContext!.user, query)), {
      withAuth: true,
      withSellerOperational: true,
      query: ShipmentListQuerySchema,
    })
    .get('/api/seller/shipments/:shipmentId', ({ authContext, params }: any) =>
      moneyResponse(container.shipmentService.getSellerShipment(authContext!.user, params.shipmentId)), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
    })
    .get('/api/shipments/:shipmentId/tracking', ({ authContext, params }: any) =>
      moneyResponse(container.shipmentService.getBuyerShipmentTracking(authContext!.user, params.shipmentId)), {
      withAuth: true,
      params: ShipmentParamsSchema,
    })
    .patch('/api/seller/shipments/:shipmentId/pack', ({ authContext, params }: any) =>
      moneyResponse(container.shipmentService.packSellerShipment(authContext!.user, params.shipmentId)), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
    })
    .patch('/api/seller/shipments/:shipmentId/ship', ({ authContext, params, body }: any) =>
      moneyResponse(container.shipmentService.shipSellerShipment(authContext!.user, params.shipmentId, body)), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
      body: ShipShipmentBodySchema,
    })
    .patch('/api/admin/shipments/:shipmentId/deliver', ({ authContext, params, body }: any) =>
      moneyResponse(container.shipmentService.deliverAdminShipment(authContext!.user, params.shipmentId, body)), {
      withRole: 'ADMIN',
      params: ShipmentParamsSchema,
      body: DeliverShipmentBodySchema,
    })
}
