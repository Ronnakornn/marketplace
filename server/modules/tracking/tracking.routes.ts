import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { TrackingServiceError } from './tracking.errors.ts'

const TrackingEventSchema = t.Object({
  eventType: t.Union([
    t.Literal('product_viewed'),
    t.Literal('product_impression'),
    t.Literal('product_click'),
    t.Literal('search_submitted'),
    t.Literal('filter_applied'),
    t.Literal('category_viewed'),
    t.Literal('banner_clicked'),
    t.Literal('recommendation_clicked'),
    t.Literal('recently_viewed_update'),
  ]),
  productId: t.Optional(t.String()),
  shopId: t.Optional(t.String()),
  categoryId: t.Optional(t.String()),
  bannerId: t.Optional(t.String()),
  recommendationId: t.Optional(t.String()),
  query: t.Optional(t.String()),
  filters: t.Optional(t.Record(t.String(), t.Unknown())),
  source: t.Optional(t.String()),
  position: t.Optional(t.Number({ minimum: 0 })),
  resultCount: t.Optional(t.Number({ minimum: 0 })),
  sessionId: t.Optional(t.String()),
  referrer: t.Optional(t.String()),
  timestamp: t.Optional(t.String()),
}, { additionalProperties: false })

const RecentlyViewedQuerySchema = t.Object({
  sessionId: t.Optional(t.String()),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
})

export function createTrackingRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof TrackingServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/discovery/track', ({ body, authContext }: any) =>
      container.trackingService.trackEvent({ userId: authContext?.user?.id }, body), {
      body: TrackingEventSchema,
    })
    .get('/api/discovery/recently-viewed', ({ query, authContext }: any) =>
      container.trackingService.getRecentlyViewedProducts({
        userId: authContext?.user?.id,
        sessionId: query.sessionId,
        limit: query.limit,
      }), {
      query: RecentlyViewedQuerySchema,
    })
}
