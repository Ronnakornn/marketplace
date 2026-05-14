import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { SellerDashboardServiceError } from './seller-dashboard.errors.ts'

const DashboardQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
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
      container.sellerDashboardService.getDashboard(authContext!.user, query.limit), {
      withRole: 'SELLER',
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/sales-summary', ({ authContext }: any) =>
      container.sellerDashboardService.getSalesSummary(authContext!.user), {
      withRole: 'SELLER',
    })
    .get('/api/seller/dashboard/recent-orders', ({ authContext, query }: any) =>
      container.sellerDashboardService.getRecentOrders(authContext!.user, query.limit), {
      withRole: 'SELLER',
      query: DashboardQuerySchema,
    })
    .get('/api/seller/dashboard/low-stock', ({ authContext }: any) =>
      container.sellerDashboardService.getLowStock(authContext!.user), {
      withRole: 'SELLER',
    })
}
