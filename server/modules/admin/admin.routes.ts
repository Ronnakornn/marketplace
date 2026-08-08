import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { AdminServiceError } from './admin.errors.ts'

const PaginationQuery = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
const StatusBody = t.Object({ status: t.String({ minLength: 1 }) })
const UserWriteBody = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 }),
  role: t.Optional(t.String()),
})
const UserUpdateBody = t.Partial(t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: 'email' }),
  role: t.String(),
  status: t.String(),
}))
const RoleBody = t.Object({ role: t.String({ minLength: 1 }) })
const ShopWriteBody = t.Object({
  ownerId: t.Optional(t.String()),
  ownerEmail: t.Optional(t.String()),
  name: t.String({ minLength: 1 }),
  slug: t.Optional(t.String()),
  status: t.Optional(t.String()),
})
const ShopUpdateBody = t.Object({
  ownerId: t.Optional(t.String()),
  ownerEmail: t.Optional(t.String()),
  name: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  status: t.Optional(t.String()),
})
const BrandWriteBody = t.Object({
  name: t.String({ minLength: 1 }),
  nameTh: t.Optional(t.Nullable(t.String())),
  nameEn: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.String()),
  code: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  descriptionTh: t.Optional(t.Nullable(t.String())),
  descriptionEn: t.Optional(t.Nullable(t.String())),
  logoUrl: t.Optional(t.Nullable(t.String())),
  websiteUrl: t.Optional(t.Nullable(t.String())),
  countryCode: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Optional(t.Number({ minimum: 0 })),
  isFeatured: t.Optional(t.Boolean()),
  isActive: t.Optional(t.Boolean()),
})
const BrandUpdateBody = t.Partial(BrandWriteBody)

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
    .get('/api/admin/reports', ({ authContext }: any) => container.adminService.getReports(adminActor(authContext)), {
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
    .get('/api/admin/brands', ({ authContext, query }: any) => container.adminService.listBrands(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          q: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean()),
        }),
      ]),
    })
    .post('/api/admin/brands', ({ authContext, body }: any) => container.adminService.createBrand(adminActor(authContext), body), {
      withRole: 'ADMIN',
      body: BrandWriteBody,
    })
    .patch('/api/admin/brands/:brandId', ({ authContext, params: { brandId }, body }: any) => container.adminService.updateBrand(adminActor(authContext), brandId, body), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
      body: BrandUpdateBody,
    })
    .patch('/api/admin/brands/:brandId/deactivate', ({ authContext, params: { brandId } }: any) => container.adminService.deactivateBrand(adminActor(authContext), brandId), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/brands/:brandId/reactivate', ({ authContext, params: { brandId } }: any) => container.adminService.reactivateBrand(adminActor(authContext), brandId), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
    })
    .post('/api/admin/users', ({ authContext, body }: any) => container.adminService.createUser(adminActor(authContext), body), {
      withRole: 'ADMIN',
      body: UserWriteBody,
    })
    .patch('/api/admin/users/:userId', ({ authContext, params: { userId }, body }: any) => container.adminService.updateUser(adminActor(authContext), userId, body), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: UserUpdateBody,
    })
    .patch('/api/admin/users/:userId/role', ({ authContext, params: { userId }, body }: any) => container.adminService.updateUserRole(adminActor(authContext), userId, body.role), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: RoleBody,
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
    .delete('/api/admin/users/:userId', ({ authContext, params: { userId } }: any) => container.adminService.deleteUser(adminActor(authContext), userId), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
    })
    .get('/api/admin/shops', ({ authContext, query }: any) => container.adminService.listShops(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .post('/api/admin/shops', ({ authContext, body }: any) => container.adminService.createShop(adminActor(authContext), body), {
      withRole: 'ADMIN',
      body: ShopWriteBody,
    })
    .get('/api/admin/shops/:shopId', ({ authContext, params: { shopId } }: any) => container.adminService.getShop(adminActor(authContext), shopId), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
    })
    .patch('/api/admin/shops/:shopId', ({ authContext, params: { shopId }, body }: any) => container.adminService.updateShop(adminActor(authContext), shopId, body), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
      body: ShopUpdateBody,
    })
    .delete('/api/admin/shops/:shopId', ({ authContext, params: { shopId } }: any) => container.adminService.deleteShop(adminActor(authContext), shopId), {
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
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()), shopId: t.Optional(t.String()) })]),
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
    .get('/api/admin/returns', ({ authContext, query }: any) => container.adminService.listReturns(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/returns/:returnId',
      ({ authContext, params: { returnId } }: any) => container.adminService.getReturn(adminActor(authContext), returnId),
      {
        withRole: 'ADMIN',
        params: t.Object({ returnId: t.String() }),
      },
    )
    .patch(
      '/api/admin/returns/:returnId/status',
      ({ authContext, params: { returnId }, body }: any) => container.adminService.updateReturnStatus(adminActor(authContext), returnId, body.status),
      {
        withRole: 'ADMIN',
        params: t.Object({ returnId: t.String() }),
        body: StatusBody,
      },
    )
}
