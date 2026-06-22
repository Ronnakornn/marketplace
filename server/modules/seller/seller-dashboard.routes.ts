import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { SellerDashboardServiceError } from './seller-dashboard.errors.ts'

const DashboardQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
})

const DashboardReviewQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 25 })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  status: t.Optional(t.Union([
    t.Literal('PENDING'),
    t.Literal('PUBLISHED'),
    t.Literal('REJECTED'),
    t.Literal('HIDDEN'),
  ])),
})

export function createSellerDashboardRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof SellerDashboardServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/seller/dashboard', ({ authContext, query }: any) =>
      container.sellerDashboardService.getDashboard(authContext!.user, query.limit, query.shopId), {
      withAuth: true,
      withSellerOperational: true,
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/sales-summary', ({ authContext, query }: any) =>
      container.sellerDashboardService.getSalesSummary(authContext!.user, query.shopId), {
      withAuth: true,
      withSellerOperational: true,
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/recent-orders', ({ authContext, query }: any) =>
      container.sellerDashboardService.getRecentOrders(authContext!.user, query.limit, query.shopId), {
      withAuth: true,
      withSellerOperational: true,
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/low-stock', ({ authContext, query }: any) =>
      container.sellerDashboardService.getLowStock(authContext!.user, query.shopId), {
      withAuth: true,
      withSellerOperational: true,
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/shop-reviews', ({ authContext, query }: any) =>
      container.sellerDashboardService.getShopReviews(authContext!.user, {
        limit: query.limit,
        shopId: query.shopId,
        status: query.status,
      }), {
      withAuth: true,
      withSellerOperational: true,
      query: DashboardReviewQuerySchema,
    })
}
