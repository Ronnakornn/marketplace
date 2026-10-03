import { MinorUnitString } from '#server/lib/money.ts'
import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { CheckoutServiceError } from './checkout.errors.ts'
import { TaxPolicyService } from './tax-policy.service.ts'
import { AdminServiceError } from '#server/modules/admin/admin.errors.ts'

const CreateCheckoutBodySchema = t.Object({
  cartId: t.String({ format: 'uuid' }),
  cartItemIds: t.Array(t.String({ format: 'uuid' }), { minItems: 1 }),
  addressId: t.String({ format: 'uuid' }),
  couponCode: t.Optional(t.String({ minLength: 1 })),
  shopCouponCode: t.Optional(t.String({ minLength: 1 })),
  platformCouponCode: t.Optional(t.String({ minLength: 1 })),
  acceptedQuoteFingerprint: t.Optional(t.String({ pattern: '^[a-f0-9]{64}$' })),
  acceptedTaxPolicyRevision: t.Optional(t.String({ minLength: 1 })),
  coinsToUse: t.Optional(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
  paymentMethod: t.String({ minLength: 1 }),
  shippingMethod: t.Optional(t.String({ minLength: 1 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

const CheckoutResponseSchema = t.Object({
  orderId: t.String(),
  orderNo: t.String(),
  paymentId: t.String(),
  paymentStatus: t.Literal('pending'),
  paymentUrl: t.String(),
  totalCents: MinorUnitString,
})

const QuoteCheckoutBodySchema = t.Object({
  cartId: t.String({ format: 'uuid' }),
  cartItemIds: t.Array(t.String({ format: 'uuid' }), { minItems: 1 }),
  couponCode: t.Optional(t.String({ minLength: 1 })),
  shopCouponCode: t.Optional(t.String({ minLength: 1 })),
  platformCouponCode: t.Optional(t.String({ minLength: 1 })),
  coinsToUse: t.Optional(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
})

const CouponOutcomeSchema = t.Union([
  t.Object({ code: t.String(), applied: t.Literal(true) }),
  t.Object({ code: t.String(), applied: t.Literal(false), reason: t.String() }),
])

const CheckoutQuoteResponseSchema = t.Object({
  subtotal: MinorUnitString,
  discountTotal: MinorUnitString,
  shippingTotal: MinorUnitString,
  taxTotal: MinorUnitString,
  includedTaxTotal: t.Optional(MinorUnitString),
  addedTaxTotal: t.Optional(MinorUnitString),
  reportedTaxTotal: t.Optional(MinorUnitString),
  taxMode: t.Optional(t.Union([t.Literal('INCLUSIVE'), t.Literal('EXCLUSIVE')])),
  taxPolicyRevision: t.Optional(t.String()),
  quoteFingerprint: t.Optional(t.String()),
  couponOutcomes: t.Optional(t.Array(CouponOutcomeSchema)),
  grandTotal: MinorUnitString,
  currency: t.String(),
  coupon: t.Union([CouponOutcomeSchema, t.Null()]),
  coinsApplied: t.Integer({ minimum: 0 }),
  items: t.Array(t.Object({
    id: t.String(),
    shopId: t.String(),
    unitPrice: MinorUnitString,
    lineTotal: MinorUnitString,
  })),
  shops: t.Array(t.Object({
    shopId: t.String(),
    subtotal: MinorUnitString,
  })),
})

export function createCheckoutRoutes(container: ServiceContainer) {
  const taxPolicy = new TaxPolicyService(container.adminService)
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof CheckoutServiceError || error instanceof AdminServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .post('/api/checkout', ({ authContext, body }: any) =>
      moneyResponse(container.checkoutService.createCheckout(authContext!.user, body)), {
      withVerifiedAuth: true,
      body: CreateCheckoutBodySchema,
      response: CheckoutResponseSchema,
    })
    .post('/api/checkout/quote', ({ authContext, body }: any) =>
      moneyResponse(container.checkoutService.quoteCheckout(authContext!.user, body)), {
      withAuth: true,
      body: QuoteCheckoutBodySchema,
      response: CheckoutQuoteResponseSchema,
    })
    .get('/api/admin/checkout/tax-policy', ({ authContext }: any) => moneyResponse(taxPolicy.get(authContext.user)), { withRole: 'ADMIN' })
    .put('/api/admin/checkout/tax-policy', ({ authContext, body }: any) => moneyResponse(taxPolicy.put(authContext.user, body)), {
      withRole: 'ADMIN',
      body: t.Object({ ratePpm: t.Integer({ minimum: 0, maximum: 1_000_000 }),
        mode: t.Optional(t.Union([t.Literal('INCLUSIVE'), t.Literal('EXCLUSIVE')])),
        fundingBasis: t.Optional(t.Union([t.Literal('BUYER_AFTER_ALL_DISCOUNTS'), t.Literal('SELLER_AFTER_SHOP_COUPON')])),
        taxableShipping: t.Optional(t.Boolean()), shippingBasis: t.Optional(t.Literal('SELLER_SHIPPING_AFTER_WAIVER')),
        rounding: t.Optional(t.Literal('LINE_HALF_UP')), custodian: t.Optional(t.Literal('SELLER')), exclusiveTaxFunding: t.Optional(t.Literal('BUYER')) }),
    })
}
