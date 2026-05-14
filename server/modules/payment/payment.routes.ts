import { Elysia, status as httpStatus } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { PaymentServiceError } from './payment.errors.ts'
import { PaymentWebhookBodySchema, PaymentWebhookResponseSchema } from './payment.types.ts'

export function createPaymentRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof PaymentServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/payment/webhook', ({ body }) => container.paymentService.handleWebhook(body), {
      body: PaymentWebhookBodySchema,
      response: PaymentWebhookResponseSchema,
    })
}
