import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ProductAnalyticsServiceError } from './product-analytics.errors.ts'

const AnalyticsQuerySchema = t.Object({
  range: t.Optional(t.Union([t.Literal('7d'), t.Literal('30d'), t.Literal('90d'), t.Literal('custom')])),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  productId: t.Optional(t.String({ format: 'uuid' })),
  q: t.Optional(t.String()),
  sort: t.Optional(t.String()),
  page: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
})

export function createProductAnalyticsRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ProductAnalyticsServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/seller/analytics/products/summary', ({ authContext, query }: any) =>
      container.productAnalyticsService.getSummary(authContext!.user, query), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products/daily', ({ authContext, query }: any) =>
      container.productAnalyticsService.getDaily(authContext!.user, query), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products', ({ authContext, query }: any) =>
      container.productAnalyticsService.getProducts(authContext!.user, query), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products/skus', ({ authContext, query }: any) =>
      container.productAnalyticsService.getSkus(authContext!.user, query), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
}
