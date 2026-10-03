import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { InventoryServiceError } from './inventory.errors.ts'
import { MAX_INVENTORY_QUANTITY } from './inventory.service.ts'

const VariantParamsSchema = t.Object({
  variantId: t.String({ format: 'uuid' }),
})

const UpdateInventoryBodySchema = t.Object({
  quantityOnHand: t.Optional(t.Integer({ minimum: 0, maximum: MAX_INVENTORY_QUANTITY })),
  reorderLevel: t.Optional(t.Integer({ minimum: 0, maximum: MAX_INVENTORY_QUANTITY })),
  reason: t.Optional(t.String({ minLength: 1 })),
})

const MovementQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
})

export function createInventoryRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof InventoryServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/seller/inventory', ({ authContext }: any) =>
      container.inventoryService.listSellerInventory(authContext!.user), {
      withAuth: true,
      withSellerOperational: true,
    })
    .get('/api/seller/variants/:variantId/inventory', ({ authContext, params }: any) =>
      container.inventoryService.getSellerInventory(authContext!.user, params.variantId), {
      withAuth: true,
      withSellerOperational: true,
      params: VariantParamsSchema,
    })
    .patch('/api/seller/variants/:variantId/inventory', ({ authContext, params, body }: any) =>
      container.inventoryService.updateSellerInventory(authContext!.user, params.variantId, body), {
      withAuth: true,
      withSellerOperational: true,
      params: VariantParamsSchema,
      body: UpdateInventoryBodySchema,
    })
    .get('/api/seller/variants/:variantId/inventory/movements', ({ authContext, params, query }: any) =>
      container.inventoryService.listSellerMovements(authContext!.user, params.variantId, query.limit), {
      withAuth: true,
      withSellerOperational: true,
      params: VariantParamsSchema,
      query: MovementQuerySchema,
    })
}
