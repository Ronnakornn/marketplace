import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { PromotionServiceError } from './promotion.errors.ts'
import { FlashSalePlainInputCreate } from '#generated/prismabox/FlashSale.ts'
import { FlashSaleItemPlainInputCreate } from '#generated/prismabox/FlashSaleItem.ts'

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
  discountType: t.Union([t.Literal('fixed'), t.Literal('percent'), t.Literal('free_shipping')]),
  discountValueCents: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))),
  discountPercentBps: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: 10_000 }))),
  minOrderCents: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))),
  maxDiscountCents: t.Optional(t.Nullable(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))),
  startsAt: t.Optional(t.Nullable(t.String())),
  endsAt: t.Optional(t.Nullable(t.String())),
  usageLimit: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 2_147_483_647 }))),
  perUserLimit: t.Optional(t.Nullable(t.Integer({ minimum: 1, maximum: 2_147_483_647 }))),
  isActive: t.Optional(t.Boolean()),
})

const UpdateCouponBodySchema = t.Partial(CouponBodySchema)

const FlashSaleParamsSchema = t.Object({ flashSaleId: t.String({ format: 'uuid' }) })
const FlashSaleItemParamsSchema = t.Object({ itemId: t.String({ format: 'uuid' }) })
const FlashSaleBodySchema = t.Composite([t.Pick(FlashSalePlainInputCreate, ['title', 'description', 'status']), t.Object({
  startsAt: t.String({ format: 'date-time' }),
  endsAt: t.String({ format: 'date-time' }),
})])
const FlashSaleItemBodySchema = t.Composite([t.Pick(FlashSaleItemPlainInputCreate, ['stockLimit', 'perUserLimit']), t.Object({
  productId: t.String({ format: 'uuid' }),
  variantId: t.String({ format: 'uuid' }),
  salePriceBaht: t.Union([t.Number({ exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER / 100 }), t.String({ pattern: '^\\d+(?:\\.\\d{1,2})?$' })]),
})])

export function createPromotionRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof PromotionServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/coupons', ({ query }: any) => moneyResponse(container.promotionService.listPublicCoupons(query.locale)), {
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .get('/api/me/coupons', ({ authContext, query }: any) =>
      moneyResponse(container.promotionService.listBuyerCoupons(authContext!.user, query.locale)), {
      withAuth: true,
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .get('/api/me/coins', ({ authContext, query }: any) =>
      moneyResponse(container.promotionService.getBuyerCoins(authContext!.user, query.limit, query.cursor)), {
      withAuth: true,
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        cursor: t.Optional(t.String({ format: 'uuid' })),
      }),
    })
    .post('/api/coupons/:couponId/claim', ({ authContext, params, query }: any) =>
      moneyResponse(container.promotionService.claimCoupon(authContext!.user, params.couponId, query.locale)), {
      withAuth: true,
      params: CouponParamsSchema,
      query: t.Object({ locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])) }),
    })
    .post('/api/coupons/validate', ({ authContext, body }: any) =>
      moneyResponse(container.promotionService.validateCoupon(authContext!.user, body)), {
      withAuth: true,
      body: ValidateCouponBodySchema,
    })
    .get('/api/admin/coupons', ({ authContext }: any) =>
      moneyResponse(container.promotionService.listAdminCoupons(authContext!.user)), {
      withRole: 'ADMIN',
    })
    .get('/api/admin/flash-sales', ({ authContext }: any) => moneyResponse(container.promotionService.listAdminFlashSales(authContext!.user)), { withRole: 'ADMIN' })
    .post('/api/admin/flash-sales', ({ authContext, body }: any) => moneyResponse(container.promotionService.createFlashSale(authContext!.user, body)), { withRole: 'ADMIN', body: FlashSaleBodySchema })
    .patch('/api/admin/flash-sales/:flashSaleId', ({ authContext, params, body }: any) => moneyResponse(container.promotionService.updateFlashSale(authContext!.user, params.flashSaleId, body)), { withRole: 'ADMIN', params: FlashSaleParamsSchema, body: t.Partial(FlashSaleBodySchema) })
    .post('/api/admin/flash-sales/:flashSaleId/items', ({ authContext, params, body }: any) => moneyResponse(container.promotionService.addFlashSaleItem(authContext!.user, params.flashSaleId, body)), { withRole: 'ADMIN', params: FlashSaleParamsSchema, body: FlashSaleItemBodySchema })
    .patch('/api/admin/flash-sale-items/:itemId', ({ authContext, params, body }: any) => moneyResponse(container.promotionService.updateFlashSaleItem(authContext!.user, params.itemId, body)), { withRole: 'ADMIN', params: FlashSaleItemParamsSchema, body: t.Partial(t.Pick(FlashSaleItemBodySchema, ['salePriceBaht', 'stockLimit', 'perUserLimit'])) })
    .delete('/api/admin/flash-sale-items/:itemId', ({ authContext, params }: any) => moneyResponse(container.promotionService.deleteFlashSaleItem(authContext!.user, params.itemId)), { withRole: 'ADMIN', params: FlashSaleItemParamsSchema })
    .get('/api/seller/flash-sales', ({ authContext }: any) => moneyResponse(container.promotionService.listSellerFlashSales(authContext!.user)), { withAuth: true, withSellerOperational: true })
    .post('/api/seller/flash-sales/:flashSaleId/items', ({ authContext, params, body }: any) => moneyResponse(container.promotionService.addSellerFlashSaleItem(authContext!.user, params.flashSaleId, body)), { withAuth: true, withSellerOperational: true, params: FlashSaleParamsSchema, body: FlashSaleItemBodySchema })
    .patch('/api/seller/flash-sale-items/:itemId', ({ authContext, params, body }: any) => moneyResponse(container.promotionService.updateSellerFlashSaleItem(authContext!.user, params.itemId, body)), { withAuth: true, withSellerOperational: true, params: FlashSaleItemParamsSchema, body: t.Partial(t.Pick(FlashSaleItemBodySchema, ['salePriceBaht', 'stockLimit', 'perUserLimit'])) })
    .delete('/api/seller/flash-sale-items/:itemId', ({ authContext, params }: any) => moneyResponse(container.promotionService.deleteSellerFlashSaleItem(authContext!.user, params.itemId)), { withAuth: true, withSellerOperational: true, params: FlashSaleItemParamsSchema })
    .get('/api/seller/coupons', ({ authContext }: any) =>
      moneyResponse(container.promotionService.listSellerCoupons(authContext!.user)), {
      withAuth: true,
      withSellerOperational: true,
    })
    .post('/api/seller/coupons', ({ authContext, body }: any) =>
      moneyResponse(container.promotionService.createSellerCoupon(authContext!.user, body)), {
      withAuth: true,
      withSellerOperational: true,
      body: CouponBodySchema,
    })
    .patch('/api/seller/coupons/:couponId', ({ authContext, params, body }: any) =>
      moneyResponse(container.promotionService.updateSellerCoupon(authContext!.user, params.couponId, body)), {
      withAuth: true,
      withSellerOperational: true,
      params: CouponParamsSchema,
      body: UpdateCouponBodySchema,
    })
    .delete('/api/seller/coupons/:couponId', ({ authContext, params }: any) =>
      moneyResponse(container.promotionService.deleteSellerCoupon(authContext!.user, params.couponId)), {
      withAuth: true,
      withSellerOperational: true,
      params: CouponParamsSchema,
    })
    .post('/api/admin/coupons', ({ authContext, body }: any) =>
      moneyResponse(container.promotionService.createCoupon(authContext!.user, body)), {
      withRole: 'ADMIN',
      body: CouponBodySchema,
    })
    .patch('/api/admin/coupons/:couponId', ({ authContext, params, body }: any) =>
      moneyResponse(container.promotionService.updateCoupon(authContext!.user, params.couponId, body)), {
      withRole: 'ADMIN',
      params: CouponParamsSchema,
      body: UpdateCouponBodySchema,
    })
    .delete('/api/admin/coupons/:couponId', ({ authContext, params }: any) =>
      moneyResponse(container.promotionService.deleteCoupon(authContext!.user, params.couponId)), {
      withRole: 'ADMIN',
      params: CouponParamsSchema,
    })
}
