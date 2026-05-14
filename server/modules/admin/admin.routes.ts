import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { AdminServiceError } from './admin.errors.ts'

const PaginationQuery = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
const StatusBody = t.Object({ status: t.String({ minLength: 1 }) })

function adminActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createAdminRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof AdminServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        })
      }
    })
    .get('/api/admin/dashboard', ({ authContext }: any) => container.adminService.getDashboard(adminActor(authContext)), {
      withRole: 'ADMIN',
    })
    .get('/api/admin/users', ({ authContext, query }: any) => container.adminService.listUsers(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          role: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
      ]),
    })
    .patch(
      '/api/admin/users/:userId/status',
      ({ authContext, params: { userId }, body }: any) => container.adminService.updateUserStatus(adminActor(authContext), userId, body.status),
      {
        withRole: 'ADMIN',
        params: t.Object({ userId: t.String() }),
        body: StatusBody,
      },
    )
    .get('/api/admin/shops', ({ authContext, query }: any) => container.adminService.listShops(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get('/api/admin/shops/:shopId', ({ authContext, params: { shopId } }: any) => container.adminService.getShop(adminActor(authContext), shopId), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
    })
    .patch(
      '/api/admin/shops/:shopId/status',
      ({ authContext, params: { shopId }, body }: any) => container.adminService.updateShopStatus(adminActor(authContext), shopId, body.status),
      {
        withRole: 'ADMIN',
        params: t.Object({ shopId: t.String() }),
        body: StatusBody,
      },
    )
    .get('/api/admin/products', ({ authContext, query }: any) => container.adminService.listProducts(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/products/:productId',
      ({ authContext, params: { productId } }: any) => container.adminService.getProduct(adminActor(authContext), productId),
      {
        withRole: 'ADMIN',
        params: t.Object({ productId: t.String() }),
      },
    )
    .patch(
      '/api/admin/products/:productId/status',
      ({ authContext, params: { productId }, body }: any) => container.adminService.updateProductStatus(adminActor(authContext), productId, body.status),
      {
        withRole: 'ADMIN',
        params: t.Object({ productId: t.String() }),
        body: StatusBody,
      },
    )
    .get('/api/admin/orders', ({ authContext, query }: any) => container.adminService.listOrders(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/orders/:orderId',
      ({ authContext, params: { orderId } }: any) => container.adminService.getOrder(adminActor(authContext), orderId),
      {
        withRole: 'ADMIN',
        params: t.Object({ orderId: t.String() }),
      },
    )
    .get('/api/admin/refunds', ({ authContext, query }: any) => container.adminService.listRefunds(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/refunds/:refundId',
      ({ authContext, params: { refundId } }: any) => container.adminService.getRefund(adminActor(authContext), refundId),
      {
        withRole: 'ADMIN',
        params: t.Object({ refundId: t.String() }),
      },
    )
    .patch(
      '/api/admin/refunds/:refundId/status',
      ({ authContext, params: { refundId }, body }: any) => container.adminService.updateRefundStatus(adminActor(authContext), refundId, body.status),
      {
        withRole: 'ADMIN',
        params: t.Object({ refundId: t.String() }),
        body: StatusBody,
      },
    )
}
