import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { PaymentServiceError } from './payment.errors.ts'
import {
  BuyerMockPaymentDetailSchema,
  MockPaymentEventBodySchema,
  PaymentWebhookBodySchema,
  PaymentWebhookResponseSchema,
} from './payment.types.ts'
import { getPaymentWebhookSecretFromEnv, verifyPaymentWebhookSignature } from './payment.webhook-signature.ts'

const PaymentParamsSchema = t.Object({
  paymentId: t.String({ format: 'uuid' }),
})

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
    .use(authPlugin)
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
    .get('/api/payments/mock/:paymentId', ({ authContext, params }: any) =>
      container.paymentService.getBuyerMockPaymentDetail(authContext!.user, params.paymentId), {
      withAuth: true,
      params: PaymentParamsSchema,
      response: BuyerMockPaymentDetailSchema,
    })
    .post('/api/payments/mock/:paymentId/events', ({ authContext, params, body }: any) =>
      container.paymentService.handleMockPaymentEvent(authContext!.user, params.paymentId, body), {
      withAuth: true,
      params: PaymentParamsSchema,
      body: MockPaymentEventBodySchema,
      response: PaymentWebhookResponseSchema,
    })
}
