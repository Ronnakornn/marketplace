import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from './production-env.ts'

function productionEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/marketplace',
    BETTER_AUTH_SECRET: 'production-auth-secret-at-least-32-characters',
    OTP_HASH_SECRET: 'production-otp-secret-at-least-32-characters',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_production_key_at_least_20_chars',
    EMAIL_FROM: 'Marketplace <no-reply@example.com>',
    BETTER_AUTH_URL: 'https://marketplace.example.com',
    NEXT_PUBLIC_APP_URL: 'https://marketplace.example.com',
    API_BASE_URL: 'http://api:3001',
    REDIS_URL: 'redis://redis:6379',
    TRUST_PROXY: 'true',
    QUEUE_SKIP_REDIS_VERSION_CHECK: 'false',
    OPENAPI_ENABLED: 'false',
    PAYMENT_WEBHOOK_SECRET: 'production-payment-secret-at-least-32-characters',
    PAYMENT_PROVIDER: 'gateway',
    PAYMENT_MOCK_ENABLED: 'false',
    PAYMENT_CHECKOUT_BASE_URL: 'https://payments.example.com/checkout',
    PAYMENT_CHECKOUT_SECRET: 'production-checkout-secret-at-least-32-characters',
    KYC_ENCRYPTION_KEY: 'production-kyc-secret-at-least-32-characters',
    S3_ENDPOINT: 'https://s3.example.com',
    S3_REGION: 'ap-southeast-1',
    S3_BUCKET: 'marketplace-production',
    S3_ACCESS_KEY_ID: 'production-access-key',
    S3_SECRET_ACCESS_KEY: 'production-secret-access-key',
    S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
    MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED: 'true',
    PHONE_OTP_ENABLED: 'false',
    ...overrides,
  } as NodeJS.ProcessEnv
}

describe('production environment', () => {
  it('does not enforce production-only contracts during local development', () => {
    expect(() => validateProductionRuntimeEnv({
      NODE_ENV: 'development',
      TRUST_PROXY: 'false',
      RATE_LIMIT_ENABLED: 'false',
      PAYMENT_MOCK_ENABLED: 'true',
    } as NodeJS.ProcessEnv)).not.toThrow()
  })

  it('still requires a trusted reverse proxy in production', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ TRUST_PROXY: 'false' }))).toThrow(/TRUST_PROXY/)
  })

  it('pins local development scripts to development mode', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> }

    expect(packageJson.scripts['dev:frontend']).toMatch(/^cross-env NODE_ENV=development /)
    expect(packageJson.scripts['dev:server']).toMatch(/^cross-env NODE_ENV=development /)
  })

  it('requires push secrets only when push is enabled', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ PUSH_NOTIFICATIONS_ENABLED: 'false' }))).not.toThrow()
    expect(() => validateProductionRuntimeEnv(productionEnv({ PUSH_NOTIFICATIONS_ENABLED: 'true' }))).toThrow(/VAPID/)
  })

  it('accepts complete push configuration', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({
      PUSH_NOTIFICATIONS_ENABLED: 'true',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public-key',
      VAPID_PRIVATE_KEY: 'private-key',
      VAPID_SUBJECT: 'mailto:admin@example.com',
      PUSH_SUBSCRIPTION_ENCRYPTION_KEY: 'production-push-secret-at-least-32-characters',
    }))).not.toThrow()
  })

  it('requires an explicit production phone OTP operating mode', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ PHONE_OTP_ENABLED: undefined }))).toThrow(/PHONE_OTP_PROVIDER/)
    expect(() => validateProductionRuntimeEnv(productionEnv({
      PHONE_OTP_ENABLED: 'true',
      PHONE_OTP_PROVIDER: 'http',
      PHONE_OTP_HTTP_URL: 'https://sms.example.com/send',
    }))).not.toThrow()
  })
})
