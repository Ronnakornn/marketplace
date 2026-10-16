import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin, type AuthContext } from '#server/modules/auth'
import { InventoryServiceError } from './inventory.errors.ts'
import { MAX_INVENTORY_QUANTITY } from './inventory.service.ts'
import { ListPageQuery } from '#server/lib/list-page.ts'

const InventoryListQuerySchema = t.Object({
  ...ListPageQuery,
  q: t.Optional(t.String({ maxLength: 200 })),
  status: t.Optional(t.Union([t.Literal('low'), t.Literal('out')])),
  shopId: t.Optional(t.String({ format: 'uuid' })),
})

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
    .get('/api/seller/inventory', ({ authContext, query }: { authContext?: AuthContext; query: typeof InventoryListQuerySchema.static }) =>
      container.inventoryService.listSellerInventory(authContext!.user, query), {
      withAuth: true,
      withSellerOperational: true,
      query: InventoryListQuerySchema,
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
