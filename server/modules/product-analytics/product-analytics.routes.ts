import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
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
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof ProductAnalyticsServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/seller/analytics/products/summary', ({ authContext, query }: any) =>
      moneyResponse(container.productAnalyticsService.getSummary(authContext!.user, query)), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products/daily', ({ authContext, query }: any) =>
      moneyResponse(container.productAnalyticsService.getDaily(authContext!.user, query)), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products', ({ authContext, query }: any) =>
      moneyResponse(container.productAnalyticsService.getProducts(authContext!.user, query)), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
    .get('/api/seller/analytics/products/skus', ({ authContext, query }: any) =>
      moneyResponse(container.productAnalyticsService.getSkus(authContext!.user, query)), {
      withAuth: true,
      query: AnalyticsQuerySchema,
    })
}
