import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ShipmentServiceError } from './shipment.errors.ts'

const ShipmentParamsSchema = t.Object({
  shipmentId: t.String({ format: 'uuid' }),
})

const ShipShipmentBodySchema = t.Object({
  carrier: t.String({ minLength: 1 }),
  trackingNo: t.String({ minLength: 1 }),
  service: t.Optional(t.String({ minLength: 1 })),
})

export function createShipmentRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ShipmentServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/seller/shipments', ({ authContext }: any) =>
      container.shipmentService.listSellerShipments(authContext!.user), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/seller/shipments/:shipmentId', ({ authContext, params }: any) =>
      container.shipmentService.getSellerShipment(authContext!.user, params.shipmentId), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
    })
    .get('/api/shipments/:shipmentId/tracking', ({ authContext, params }: any) =>
      container.shipmentService.getBuyerShipmentTracking(authContext!.user, params.shipmentId), {
      withAuth: true,
      params: ShipmentParamsSchema,
    })
    .patch('/api/seller/shipments/:shipmentId/pack', ({ authContext, params }: any) =>
      container.shipmentService.packSellerShipment(authContext!.user, params.shipmentId), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
    })
    .patch('/api/seller/shipments/:shipmentId/ship', ({ authContext, params, body }: any) =>
      container.shipmentService.shipSellerShipment(authContext!.user, params.shipmentId, body), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
      body: ShipShipmentBodySchema,
    })
    .patch('/api/seller/shipments/:shipmentId/deliver', ({ authContext, params }: any) =>
      container.shipmentService.deliverSellerShipment(authContext!.user, params.shipmentId), {
      withAuth: true,
      withSellerOperational: true,
      params: ShipmentParamsSchema,
    })
}
