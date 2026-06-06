import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ContentModerationServiceError } from './content-moderation.errors.ts'

const PaginationQuery = t.Object({
  page: t.Optional(t.Union([t.Number(), t.String()])),
  limit: t.Optional(t.Union([t.Number(), t.String()])),
  status: t.Optional(t.String()),
  q: t.Optional(t.String()),
})

const StatusBody = t.Object({
  status: t.String({ minLength: 1 }),
  note: t.Optional(t.String()),
})

const ReviewParams = t.Object({
  reviewId: t.String({ format: 'uuid' }),
})

const ReviewReportParams = t.Object({
  reportId: t.String({ format: 'uuid' }),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createContentModerationRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ContentModerationServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/admin/content-moderation/reviews', ({ authContext, query }: any) =>
      container.contentModerationService.listReviews(actor(authContext), query), {
      withRole: 'ADMIN',
      query: PaginationQuery,
    })
    .get('/api/admin/content-moderation/review-reports', ({ authContext, query }: any) =>
      container.contentModerationService.listReviewReports(actor(authContext), query), {
      withRole: 'ADMIN',
      query: PaginationQuery,
    })
    .patch('/api/admin/content-moderation/reviews/:reviewId/status', ({ authContext, params, body }: any) =>
      container.contentModerationService.updateReviewStatus(actor(authContext), params.reviewId, body), {
      withRole: 'ADMIN',
      params: ReviewParams,
      body: StatusBody,
    })
    .patch('/api/admin/content-moderation/review-reports/:reportId/status', ({ authContext, params, body }: any) =>
      container.contentModerationService.updateReviewReportStatus(actor(authContext), params.reportId, body), {
      withRole: 'ADMIN',
      params: ReviewReportParams,
      body: StatusBody,
    })
}
