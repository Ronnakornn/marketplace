import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { RefundServiceError } from '#server/modules/refund/refund.errors.ts'
import { SettlementRefundPlanSchema } from '#server/modules/refund/settlement-refund.schema.ts'
import { AdminServiceError } from './admin.errors.ts'

const PaginationQuery = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
const StatusBody = t.Object({ status: t.String({ minLength: 1 }) })
const RefundStatusBody = t.Object({
  status: t.String({ minLength: 1 }),
  externalReference: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
  settlementPlan: t.Optional(SettlementRefundPlanSchema),
})
const CommissionStatusBody = t.Object({
  status: t.Union([t.Literal('APPROVED'), t.Literal('VOID')]),
  reason: t.String({ minLength: 3, maxLength: 500 }),
})
const SystemSettingWriteBody = t.Object({
  value: t.Unknown(),
  valueType: t.Union([t.Literal('STRING'), t.Literal('NUMBER'), t.Literal('BOOLEAN'), t.Literal('JSON')]),
  description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  isPublic: t.Optional(t.Boolean()),
})
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
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof AdminServiceError || error instanceof RefundServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        }))
      }
    })
    .get('/api/admin/dashboard', ({ authContext }: any) => moneyResponse(container.adminService.getDashboard(adminActor(authContext))), {
      withRole: 'ADMIN',
    })
    .get('/api/admin/reports', ({ authContext }: any) => moneyResponse(container.adminService.getReports(adminActor(authContext))), {
      withRole: 'ADMIN',
    })
    .get('/api/admin/commissions', ({ authContext, query }: any) => moneyResponse(container.adminService.listCommissions(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          status: t.Optional(t.String()),
          q: t.Optional(t.String({ maxLength: 200 })),
        }),
      ]),
    })
    .patch(
      '/api/admin/commissions/:commissionId/status',
      ({ authContext, params: { commissionId }, body }: any) => moneyResponse(container.adminService.updateCommissionStatus(adminActor(authContext), commissionId, body)),
      {
        withRole: 'ADMIN',
        params: t.Object({ commissionId: t.String({ format: 'uuid' }) }),
        body: CommissionStatusBody,
      },
    )
    .get('/api/admin/settings', ({ authContext }: any) => moneyResponse(container.adminService.listSystemSettings(adminActor(authContext))), {
      withRole: 'ADMIN',
    })
    .put(
      '/api/admin/settings/:key',
      ({ authContext, params: { key }, body }: any) => moneyResponse(container.adminService.upsertSystemSetting(adminActor(authContext), key, body)),
      {
        withRole: 'ADMIN',
        params: t.Object({ key: t.String({ minLength: 2, maxLength: 120 }) }),
        body: SystemSettingWriteBody,
      },
    )
    .get('/api/admin/users', ({ authContext, query }: any) => moneyResponse(container.adminService.listUsers(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          role: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
      ]),
    })
    .get('/api/admin/brands', ({ authContext, query }: any) => moneyResponse(container.adminService.listBrands(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          q: t.Optional(t.String()),
          isActive: t.Optional(t.Boolean()),
        }),
      ]),
    })
    .post('/api/admin/brands', ({ authContext, body }: any) => moneyResponse(container.adminService.createBrand(adminActor(authContext), body)), {
      withRole: 'ADMIN',
      body: BrandWriteBody,
    })
    .patch('/api/admin/brands/:brandId', ({ authContext, params: { brandId }, body }: any) => moneyResponse(container.adminService.updateBrand(adminActor(authContext), brandId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
      body: BrandUpdateBody,
    })
    .patch('/api/admin/brands/:brandId/deactivate', ({ authContext, params: { brandId } }: any) => moneyResponse(container.adminService.deactivateBrand(adminActor(authContext), brandId)), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
    })
    .patch('/api/admin/brands/:brandId/reactivate', ({ authContext, params: { brandId } }: any) => moneyResponse(container.adminService.reactivateBrand(adminActor(authContext), brandId)), {
      withRole: 'ADMIN',
      params: t.Object({ brandId: t.String({ format: 'uuid' }) }),
    })
    .post('/api/admin/users', ({ authContext, body }: any) => moneyResponse(container.adminService.createUser(adminActor(authContext), body)), {
      withRole: 'ADMIN',
      body: UserWriteBody,
    })
    .patch('/api/admin/users/:userId', ({ authContext, params: { userId }, body }: any) => moneyResponse(container.adminService.updateUser(adminActor(authContext), userId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: UserUpdateBody,
    })
    .patch('/api/admin/users/:userId/role', ({ authContext, params: { userId }, body }: any) => moneyResponse(container.adminService.updateUserRole(adminActor(authContext), userId, body.role)), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
      body: RoleBody,
    })
    .patch(
      '/api/admin/users/:userId/status',
      ({ authContext, params: { userId }, body }: any) => moneyResponse(container.adminService.updateUserStatus(adminActor(authContext), userId, body.status)),
      {
        withRole: 'ADMIN',
        params: t.Object({ userId: t.String() }),
        body: StatusBody,
      },
    )
    .delete('/api/admin/users/:userId', ({ authContext, params: { userId } }: any) => moneyResponse(container.adminService.deleteUser(adminActor(authContext), userId)), {
      withRole: 'ADMIN',
      params: t.Object({ userId: t.String() }),
    })
    .get('/api/admin/shops', ({ authContext, query }: any) => moneyResponse(container.adminService.listShops(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .post('/api/admin/shops', ({ authContext, body }: any) => moneyResponse(container.adminService.createShop(adminActor(authContext), body)), {
      withRole: 'ADMIN',
      body: ShopWriteBody,
    })
    .get('/api/admin/shops/:shopId', ({ authContext, params: { shopId } }: any) => moneyResponse(container.adminService.getShop(adminActor(authContext), shopId)), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
    })
    .patch('/api/admin/shops/:shopId', ({ authContext, params: { shopId }, body }: any) => moneyResponse(container.adminService.updateShop(adminActor(authContext), shopId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
      body: ShopUpdateBody,
    })
    .delete('/api/admin/shops/:shopId', ({ authContext, params: { shopId } }: any) => moneyResponse(container.adminService.deleteShop(adminActor(authContext), shopId)), {
      withRole: 'ADMIN',
      params: t.Object({ shopId: t.String() }),
    })
    .patch(
      '/api/admin/shops/:shopId/status',
      ({ authContext, params: { shopId }, body }: any) => moneyResponse(container.adminService.updateShopStatus(adminActor(authContext), shopId, body.status)),
      {
        withRole: 'ADMIN',
        params: t.Object({ shopId: t.String() }),
        body: StatusBody,
      },
    )
    .get('/api/admin/products', ({ authContext, query }: any) => moneyResponse(container.adminService.listProducts(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/products/:productId',
      ({ authContext, params: { productId } }: any) => moneyResponse(container.adminService.getProduct(adminActor(authContext), productId)),
      {
        withRole: 'ADMIN',
        params: t.Object({ productId: t.String() }),
      },
    )
    .get('/api/admin/orders', ({ authContext, query }: any) => moneyResponse(container.adminService.listOrders(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([
        PaginationQuery,
        t.Object({
          status: t.Optional(t.String()),
          shopId: t.Optional(t.String()),
          paymentState: t.Optional(t.String()),
          shipmentState: t.Optional(t.String()),
        }),
      ]),
    })
    .get(
      '/api/admin/orders/:orderId',
      ({ authContext, params: { orderId } }: any) => moneyResponse(container.adminService.getOrder(adminActor(authContext), orderId)),
      {
        withRole: 'ADMIN',
        params: t.Object({ orderId: t.String() }),
      },
    )
    .post('/api/admin/orders/:orderId/refunds', ({ authContext, params, body }: any) =>
      moneyResponse(container.adminService.createSettlementRefund(adminActor(authContext), params.orderId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ orderId: t.String({ format: 'uuid' }) }),
      body: SettlementRefundPlanSchema,
    })
    .get('/api/admin/refunds', ({ authContext, query }: any) => moneyResponse(container.adminService.listRefunds(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/refunds/:refundId',
      ({ authContext, params: { refundId } }: any) => moneyResponse(container.adminService.getRefund(adminActor(authContext), refundId)),
      {
        withRole: 'ADMIN',
        params: t.Object({ refundId: t.String() }),
      },
    )
    .patch('/api/admin/refunds/:refundId/plan', ({ authContext, params, body }: any) =>
      moneyResponse(container.adminService.prepareSettlementRefund(adminActor(authContext), params.refundId, body)), {
      withRole: 'ADMIN',
      params: t.Object({ refundId: t.String({ format: 'uuid' }) }),
      body: SettlementRefundPlanSchema,
    })
    .patch(
      '/api/admin/refunds/:refundId/status',
      ({ authContext, params: { refundId }, body }: any) => moneyResponse(container.adminService.updateRefundStatus(adminActor(authContext), refundId, body)),
      {
        withRole: 'ADMIN',
        params: t.Object({ refundId: t.String() }),
        body: RefundStatusBody,
      },
    )
    .get('/api/admin/returns', ({ authContext, query }: any) => moneyResponse(container.adminService.listReturns(adminActor(authContext), query)), {
      withRole: 'ADMIN',
      query: t.Composite([PaginationQuery, t.Object({ status: t.Optional(t.String()) })]),
    })
    .get(
      '/api/admin/returns/:returnId',
      ({ authContext, params: { returnId } }: any) => moneyResponse(container.adminService.getReturn(adminActor(authContext), returnId)),
      {
        withRole: 'ADMIN',
        params: t.Object({ returnId: t.String() }),
      },
    )
    .patch(
      '/api/admin/returns/:returnId/status',
      ({ authContext, params: { returnId }, body }: any) => moneyResponse(container.adminService.updateReturnStatus(adminActor(authContext), returnId, body.status)),
      {
        withRole: 'ADMIN',
        params: t.Object({ returnId: t.String() }),
        body: StatusBody,
      },
    )
}
