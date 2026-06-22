import { Elysia, status as httpStatus, t } from 'elysia'
import { ShopRatingPlainInputCreate } from '#generated/prismabox/ShopRating.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ShopReviewServiceError } from './shop-review.errors.ts'

const ShopParamsSchema = t.Object({
  shopId: t.String({ format: 'uuid' }),
})

const ShopRatingParamsSchema = t.Object({
  shopRatingId: t.String({ format: 'uuid' }),
})

const ListShopReviewsQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
})

const ListAdminShopReviewsQuerySchema = t.Object({
  status: t.Optional(t.Union([
    t.Literal('PENDING'),
    t.Literal('PUBLISHED'),
    t.Literal('REJECTED'),
    t.Literal('HIDDEN'),
  ])),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
})

const CreateShopReviewBodySchema = t.Intersect([
  t.Required(t.Pick(ShopRatingPlainInputCreate, ['rating'])),
  t.Object({
    shopOrderId: t.String({ format: 'uuid' }),
    comment: t.Optional(t.Nullable(t.String())),
  }),
])

const ModerateShopReviewBodySchema = t.Object({
  decision: t.Union([t.Literal('APPROVE'), t.Literal('REJECT'), t.Literal('HIDE')]),
  moderationReason: t.Optional(t.Nullable(t.String())),
})

function actor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createShopReviewRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ShopReviewServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/shops/:shopId/reviews', ({ params, query }: any) =>
      container.shopReviewService.listShopReviews(params.shopId, query.limit), {
      params: ShopParamsSchema,
      query: ListShopReviewsQuerySchema,
    })
    .get('/api/shops/:shopId/rating-summary', ({ params }: any) =>
      container.shopReviewService.getShopRatingSummary(params.shopId), {
      params: ShopParamsSchema,
    })
    .post('/api/shop-reviews', ({ authContext, body }: any) =>
      container.shopReviewService.createShopReview(actor(authContext), body), {
      withAuth: true,
      body: CreateShopReviewBodySchema,
    })
    .get('/api/admin/shop-reviews', ({ authContext, query }: any) =>
      container.shopReviewService.listAdminShopReviews(actor(authContext), query), {
      withRole: 'ADMIN',
      query: ListAdminShopReviewsQuerySchema,
    })
    .patch('/api/admin/shop-reviews/:shopRatingId/moderate', ({ authContext, params, body }: any) =>
      container.shopReviewService.moderateShopReview(actor(authContext), params.shopRatingId, body), {
      withRole: 'ADMIN',
      params: ShopRatingParamsSchema,
      body: ModerateShopReviewBodySchema,
    })
}
