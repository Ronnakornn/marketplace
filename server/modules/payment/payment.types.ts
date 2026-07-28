import type { Static } from 'elysia'
import { t } from 'elysia'

export const PaymentWebhookEventTypes = ['payment.paid', 'payment.failed', 'payment.expired'] as const

export const PaymentWebhookBodySchema = t.Object({
  provider: t.String({ minLength: 1 }),
  providerRef: t.String({ minLength: 1 }),
  eventType: t.String({ minLength: 1 }),
  paymentId: t.String({ format: 'uuid' }),
  orderId: t.String({ format: 'uuid' }),
  amount: t.Number(),
})

export const PaymentWebhookResponseSchema = t.Object({
  ok: t.Boolean(),
  code: t.String(),
})

export const MockPaymentEventBodySchema = t.Object({
  eventType: t.Union([t.Literal('payment.paid'), t.Literal('payment.failed')]),
})

const BuyerPaymentStatusSchema = t.Union([
  t.Literal('PENDING'),
  t.Literal('REQUIRES_ACTION'),
  t.Literal('SUCCEEDED'),
  t.Literal('FAILED'),
  t.Literal('CANCELED'),
  t.Literal('REFUNDED'),
])

export const BuyerMockPaymentDetailSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  orderId: t.String({ format: 'uuid' }),
  orderNo: t.String(),
  amountCents: t.Number(),
  currency: t.String(),
  status: BuyerPaymentStatusSchema,
})

export type PaymentWebhookEventType = typeof PaymentWebhookEventTypes[number]
export type PaymentWebhookBody = Static<typeof PaymentWebhookBodySchema>
export type PaymentWebhookResponse = Static<typeof PaymentWebhookResponseSchema>
export type MockPaymentEventBody = Static<typeof MockPaymentEventBodySchema>
export type BuyerMockPaymentDetail = Static<typeof BuyerMockPaymentDetailSchema>
