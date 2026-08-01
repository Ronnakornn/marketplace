import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { CheckoutServiceError } from './checkout.errors.ts'

const CreateCheckoutBodySchema = t.Object({
  cartId: t.String({ format: 'uuid' }),
  addressId: t.String({ format: 'uuid' }),
  couponCode: t.Optional(t.String({ minLength: 1 })),
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
  totalCents: t.Number(),
})

const QuoteCheckoutBodySchema = t.Object({
  cartId: t.String({ format: 'uuid' }),
  couponCode: t.Optional(t.String({ minLength: 1 })),
})

const CouponOutcomeSchema = t.Union([
  t.Object({ code: t.String(), applied: t.Literal(true) }),
  t.Object({ code: t.String(), applied: t.Literal(false), reason: t.String() }),
])

const CheckoutQuoteResponseSchema = t.Object({
  subtotal: t.Number(),
  discountTotal: t.Number(),
  shippingTotal: t.Number(),
  taxTotal: t.Number(),
  grandTotal: t.Number(),
  currency: t.String(),
  coupon: t.Union([CouponOutcomeSchema, t.Null()]),
})

export function createCheckoutRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof CheckoutServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/checkout', ({ authContext, body }: any) =>
      container.checkoutService.createCheckout(authContext!.user, body), {
      withAuth: true,
      body: CreateCheckoutBodySchema,
      response: CheckoutResponseSchema,
    })
    .post('/api/checkout/quote', ({ authContext, body }: any) =>
      container.checkoutService.quoteCheckout(authContext!.user, body), {
      withAuth: true,
      body: QuoteCheckoutBodySchema,
      response: CheckoutQuoteResponseSchema,
    })
}
