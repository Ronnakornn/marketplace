import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { PromotionServiceError } from './promotion.errors.ts'

const CouponParamsSchema = t.Object({
  couponId: t.String({ format: 'uuid' }),
})

const ValidateCouponBodySchema = t.Object({
  couponCode: t.String({ minLength: 1 }),
  cartId: t.String({ format: 'uuid' }),
})

const CouponBodySchema = t.Object({
  code: t.String({ minLength: 1 }),
  titleTh: t.Optional(t.Nullable(t.String())),
  titleEn: t.Optional(t.Nullable(t.String())),
  descriptionTh: t.Optional(t.Nullable(t.String())),
  descriptionEn: t.Optional(t.Nullable(t.String())),
  discountType: t.Union([t.Literal('fixed'), t.Literal('percent')]),
  discountValueCents: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  discountPercentBps: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 10_000 }))),
  minOrderCents: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  maxDiscountCents: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
  startsAt: t.Optional(t.Nullable(t.String())),
  endsAt: t.Optional(t.Nullable(t.String())),
  usageLimit: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  perUserLimit: t.Optional(t.Nullable(t.Number({ minimum: 1 }))),
  isActive: t.Optional(t.Boolean()),
})

const UpdateCouponBodySchema = t.Partial(CouponBodySchema)

export function createPromotionRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof PromotionServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/coupons', ({ query }: any) => container.promotionService.listPublicCoupons(query.locale), {
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .post('/api/coupons/validate', ({ authContext, body }: any) =>
      container.promotionService.validateCoupon(authContext!.user, body), {
      withAuth: true,
      body: ValidateCouponBodySchema,
    })
    .get('/api/admin/coupons', ({ authContext }: any) =>
      container.promotionService.listAdminCoupons(authContext!.user), {
      withRole: 'ADMIN',
    })
    .post('/api/admin/coupons', ({ authContext, body }: any) =>
      container.promotionService.createCoupon(authContext!.user, body), {
      withRole: 'ADMIN',
      body: CouponBodySchema,
    })
    .patch('/api/admin/coupons/:couponId', ({ authContext, params, body }: any) =>
      container.promotionService.updateCoupon(authContext!.user, params.couponId, body), {
      withRole: 'ADMIN',
      params: CouponParamsSchema,
      body: UpdateCouponBodySchema,
    })
    .delete('/api/admin/coupons/:couponId', ({ authContext, params }: any) =>
      container.promotionService.deleteCoupon(authContext!.user, params.couponId), {
      withRole: 'ADMIN',
      params: CouponParamsSchema,
    })
}
