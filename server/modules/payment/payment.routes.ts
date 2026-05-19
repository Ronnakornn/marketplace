import { Elysia, status as httpStatus } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { PaymentServiceError } from './payment.errors.ts'
import { PaymentWebhookBodySchema, PaymentWebhookResponseSchema } from './payment.types.ts'
import { getPaymentWebhookSecretFromEnv, verifyPaymentWebhookSignature } from './payment.webhook-signature.ts'

export function createPaymentRoutes(container: ServiceContainer) {
  const webhookSecret = getPaymentWebhookSecretFromEnv()
  const handleWebhook = ({ body, request }: any) => {
    verifyPaymentWebhookSignature({
      body,
      headers: request.headers,
      secret: webhookSecret,
    })
    return container.paymentService.handleWebhook(body)
  }
  const webhookOptions = {
    body: PaymentWebhookBodySchema,
    response: PaymentWebhookResponseSchema,
  }

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
    .post('/api/payment/webhook', handleWebhook, webhookOptions)
    .post('/api/payments/webhook', handleWebhook, webhookOptions)
}
