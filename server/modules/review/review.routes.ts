import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ReviewServiceError } from './review.errors.ts'

const ProductParamsSchema = t.Object({
  productId: t.String({ format: 'uuid' }),
})

const ReviewParamsSchema = t.Object({
  reviewId: t.String({ format: 'uuid' }),
})

const CreateReviewBodySchema = t.Object({
  orderItemId: t.String({ format: 'uuid' }),
  rating: t.Number({ minimum: 1, maximum: 5 }),
  comment: t.Optional(t.String()),
  images: t.Optional(t.Array(t.String())),
})

const UpdateReviewBodySchema = t.Partial(t.Object({
  rating: t.Number({ minimum: 1, maximum: 5 }),
  comment: t.Union([t.String(), t.Null()]),
  images: t.Array(t.String()),
}))

export function createReviewRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ReviewServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/products/:productId/reviews', ({ params }: any) =>
      container.reviewService.listProductReviews(params.productId), {
      params: ProductParamsSchema,
    })
    .get('/api/products/:productId/rating-summary', ({ params }: any) =>
      container.reviewService.getRatingSummary(params.productId), {
      params: ProductParamsSchema,
    })
    .post('/api/reviews', ({ authContext, body }: any) =>
      container.reviewService.createReview(authContext!.user, body), {
      withAuth: true,
      body: CreateReviewBodySchema,
    })
    .patch('/api/reviews/:reviewId', ({ authContext, params, body }: any) =>
      container.reviewService.updateReview(authContext!.user, params.reviewId, body), {
      withAuth: true,
      params: ReviewParamsSchema,
      body: UpdateReviewBodySchema,
    })
    .delete('/api/reviews/:reviewId', ({ authContext, params }: any) =>
      container.reviewService.deleteReview(authContext!.user, params.reviewId), {
      withAuth: true,
      params: ReviewParamsSchema,
    })
}
