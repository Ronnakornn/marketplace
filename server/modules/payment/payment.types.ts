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

export type PaymentWebhookEventType = typeof PaymentWebhookEventTypes[number]
export type PaymentWebhookBody = Static<typeof PaymentWebhookBodySchema>
export type PaymentWebhookResponse = Static<typeof PaymentWebhookResponseSchema>
export type MockPaymentEventBody = Static<typeof MockPaymentEventBodySchema>
