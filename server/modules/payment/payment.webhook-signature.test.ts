import { describe, expect, it } from 'vitest'
import {
  signPaymentWebhookBody,
  verifyPaymentWebhookSignature,
} from './payment.webhook-signature.ts'
import type { PaymentWebhookBody } from './payment.types.ts'

const secret = 'test-payment-webhook-secret-32-bytes'
const now = new Date('2026-05-17T05:00:00.000Z')
const body: PaymentWebhookBody = {
  provider: 'mock',
  providerRef: 'evt_1',
  eventType: 'payment.paid',
  paymentId: '14141414-1414-4141-8141-141414141414',
  orderId: '13131313-1313-4131-8131-131313131313',
  amount: 2900,
}

function signedHeaders(overrides: Record<string, string> = {}) {
  const timestamp = String(Math.floor(now.getTime() / 1000))
  return new Headers({
    'x-payment-timestamp': timestamp,
    'x-payment-signature': `sha256=${signPaymentWebhookBody(body, secret, now)}`,
    ...overrides,
  })
}

describe('payment webhook signature', () => {
  it('accepts a valid timestamped HMAC signature', () => {
    expect(() => verifyPaymentWebhookSignature({
      body,
      headers: signedHeaders(),
      secret,
      now,
    })).not.toThrow()
  })

  it('rejects missing, stale, and invalid signatures', () => {
    expect(() => verifyPaymentWebhookSignature({
      body,
      headers: new Headers(),
      secret,
      now,
    })).toThrow('signature is required')

    expect(() => verifyPaymentWebhookSignature({
      body,
      headers: signedHeaders({ 'x-payment-timestamp': '1770000000' }),
      secret,
      now,
    })).toThrow('outside the allowed window')

    expect(() => verifyPaymentWebhookSignature({
      body,
      headers: signedHeaders({ 'x-payment-signature': `sha256=${'0'.repeat(64)}` }),
      secret,
      now,
    })).toThrow('signature is invalid')
  })

  it('allows unsigned webhooks only when no secret is configured', () => {
    expect(() => verifyPaymentWebhookSignature({
      body,
      headers: new Headers(),
      now,
    })).not.toThrow()
  })
})
