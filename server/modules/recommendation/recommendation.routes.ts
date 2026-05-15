import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { RecommendationServiceError } from './recommendation.errors.ts'

const RecommendationQuerySchema = t.Object({
  page: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
})

export function createRecommendationRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof RecommendationServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/recommendations/trending', ({ query }: any) =>
      container.recommendationService.getTrending(query), {
      query: RecommendationQuerySchema,
    })
    .get('/api/recommendations/related/:productId', ({ params, query }: any) =>
      container.recommendationService.getRelated(params.productId, query), {
      query: RecommendationQuerySchema,
      params: t.Object({
        productId: t.String({ format: 'uuid' }),
      }),
    })
    .get('/api/recommendations/similar/:productId', ({ params, query }: any) =>
      container.recommendationService.getSimilar(params.productId, query), {
      query: RecommendationQuerySchema,
      params: t.Object({
        productId: t.String({ format: 'uuid' }),
      }),
    })
    .get('/api/recommendations/home-feed', ({ query }: any) =>
      container.recommendationService.getHomeFeed(query), {
      query: RecommendationQuerySchema,
    })
}
