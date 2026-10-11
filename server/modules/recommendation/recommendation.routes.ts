import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { RecommendationServiceError } from './recommendation.errors.ts'

const RecommendationQuerySchema = t.Object({
  page: t.Optional(t.Integer({ minimum: 1, maximum: 2_147_483_647 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createRecommendationRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof RecommendationServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/recommendations/trending', ({ query }: any) =>
      moneyResponse(container.recommendationService.getTrending(query)), {
      query: RecommendationQuerySchema,
    })
    .get('/api/recommendations/related/:productId', ({ params, query }: any) =>
      moneyResponse(container.recommendationService.getRelated(params.productId, query)), {
      query: RecommendationQuerySchema,
      params: t.Object({
        productId: t.String({ format: 'uuid' }),
      }),
    })
    .get('/api/recommendations/similar/:productId', ({ params, query }: any) =>
      moneyResponse(container.recommendationService.getSimilar(params.productId, query)), {
      query: RecommendationQuerySchema,
      params: t.Object({
        productId: t.String({ format: 'uuid' }),
      }),
    })
    .get('/api/recommendations/home-feed', ({ query }: any) =>
      moneyResponse(container.recommendationService.getHomeFeed(query)), {
      query: RecommendationQuerySchema,
    })
}
