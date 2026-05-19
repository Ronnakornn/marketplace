import { createHmac, timingSafeEqual } from 'node:crypto'
import { requireProductionEnv } from '#server/config/production-env.ts'
import { PaymentServiceError } from './payment.errors.ts'
import type { PaymentWebhookBody } from './payment.types.ts'

const signatureHeader = 'x-payment-signature'
const timestampHeader = 'x-payment-timestamp'
const maxTimestampSkewMs = 5 * 60 * 1000

export function getPaymentWebhookSecretFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return requireProductionEnv('PAYMENT_WEBHOOK_SECRET', env['PAYMENT_WEBHOOK_SECRET'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-payment-webhook-secret'],
  }, env)?.trim()
}

export function verifyPaymentWebhookSignature(input: {
  body: PaymentWebhookBody
  headers: Headers
  secret?: string
  now?: Date
}): void {
  if (!input.secret) return

  const timestamp = parseTimestamp(input.headers.get(timestampHeader))
  const signature = normalizeSignature(input.headers.get(signatureHeader))
  if (!timestamp || !signature) {
    throw new PaymentServiceError('Payment webhook signature is required', 401, 'INVALID_WEBHOOK_SIGNATURE')
  }

  const nowMs = input.now?.getTime() ?? Date.now()
  if (Math.abs(nowMs - timestamp.getTime()) > maxTimestampSkewMs) {
    throw new PaymentServiceError('Payment webhook timestamp is outside the allowed window', 401, 'INVALID_WEBHOOK_SIGNATURE')
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${Math.floor(timestamp.getTime() / 1000)}.${stableStringify(input.body)}`)
    .digest('hex')

  if (!secureEqual(signature, expected)) {
    throw new PaymentServiceError('Payment webhook signature is invalid', 401, 'INVALID_WEBHOOK_SIGNATURE')
  }
}

export function signPaymentWebhookBody(body: PaymentWebhookBody, secret: string, timestamp: Date = new Date()): string {
  return createHmac('sha256', secret)
    .update(`${Math.floor(timestamp.getTime() / 1000)}.${stableStringify(body)}`)
    .digest('hex')
}

function parseTimestamp(value: string | null): Date | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const milliseconds = parsed > 1_000_000_000_000 ? parsed : parsed * 1000
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeSignature(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.startsWith('sha256=') ? trimmed.slice('sha256='.length) : trimmed
}

function secureEqual(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (receivedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(receivedBuffer, expectedBuffer)
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}
