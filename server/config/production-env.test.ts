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
    UPLOAD_STORAGE: 'local',
    S3_ENDPOINT: 'https://s3.example.com',
    S3_REGION: 'ap-southeast-1',
    S3_BUCKET: 'marketplace-production',
    S3_ACCESS_KEY_ID: 'production-access-key',
    S3_SECRET_ACCESS_KEY: 'production-secret-access-key',
    S3_PUBLIC_BASE_URL: 'https://cdn.example.com',
    MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED: 'true',
    AFFILIATE_ENABLED: 'false',
    AI_SEARCH_ENABLED: 'false',
    PHONE_OTP_ENABLED: 'false',
    ...overrides,
  } as NodeJS.ProcessEnv
}

describe('production environment', () => {
  const localProductionEnv: NodeJS.ProcessEnv = {
    ...productionEnv(),
    NODE_ENV: 'production',
    LOCAL_PRODUCTION: 'true',
    HOST: '127.0.0.1',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    BETTER_AUTH_URL: 'http://localhost:3000',
    API_BASE_URL: 'http://127.0.0.1:3001',
    DATABASE_URL: 'postgresql://postgres:password@localhost:5432/sming',
    REDIS_URL: 'redis://localhost:6379',
    ALLOW_INSECURE_HTTP: 'true',
    TRUST_PROXY: 'false',
    PAYMENT_PROVIDER: 'disabled',
    MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED: undefined,
  }

  it('accepts an explicit production preview restricted to this machine', () => {
    expect(() => validateProductionRuntimeEnv(localProductionEnv)).not.toThrow()
    expect(() => validateProductionRuntimeEnv({
      ...localProductionEnv,
      DATABASE_URL: 'postgres://postgres:password@[::1]:5432/sming',
      REDIS_URL: 'rediss://127.0.0.1:6379',
    })).not.toThrow()
  })

  it.each([
    ['HOST', '0.0.0.0'],
    ['NODE_ENV', 'development'],
    ['DATABASE_URL', 'postgresql://app:secret@db.example.com/marketplace'],
    ['REDIS_URL', 'redis://redis.example.com:6379'],
    ['NEXT_PUBLIC_APP_URL', 'https://marketplace.example.com'],
    ['BETTER_AUTH_URL', 'https://marketplace.example.com'],
    ['API_BASE_URL', 'https://api.example.com'],
    ['DATABASE_URL', 'https://localhost/database'],
    ['REDIS_URL', 'http://localhost:6379'],
    ['BETTER_AUTH_URL', undefined],
  ])('rejects unsafe local preview %s even during a build phase', (name, value) => {
    expect(() => validateProductionRuntimeEnv({
      ...localProductionEnv,
      NEXT_PHASE: 'phase-production-build',
      [name]: value,
    })).toThrow(new RegExp(name))
  })

  it('keeps rejecting demo database credentials without the local preview flag', () => {
    expect(() => validateProductionRuntimeEnv({
      ...localProductionEnv,
      LOCAL_PRODUCTION: undefined,
    })).toThrow(/DATABASE_URL/)
  })

  it.each([
    ['BETTER_AUTH_SECRET', 'short'],
    ['QUEUE_SKIP_REDIS_VERSION_CHECK', 'true'],
    ['PAYMENT_PROVIDER', 'mock'],
    ['RATE_LIMIT_ENABLED', 'false'],
    ['PAYMENT_MOCK_ENABLED', 'true'],
  ])('retains production guardrails for local preview %s', (name, value) => {
    expect(() => validateProductionRuntimeEnv({ ...localProductionEnv, [name]: value })).toThrow(new RegExp(name))
  })

  it('still requires manual finance acknowledgement when local payments are enabled', () => {
    expect(() => validateProductionRuntimeEnv({ ...localProductionEnv, PAYMENT_PROVIDER: 'gateway' })).toThrow(/MANUAL_FINANCE/)
  })

  it('preserves existing local session and encryption keys for the explicit loopback preview', () => {
    expect(() => validateProductionRuntimeEnv({
      ...localProductionEnv,
      BETTER_AUTH_SECRET: 'your-secret-here-change-in-production',
      KYC_ENCRYPTION_KEY: 'development-kyc-encryption-key-change-before-production',
    })).not.toThrow()
  })

  it('does not let the Next build phase bypass local preview secret checks', () => {
    expect(() => validateProductionRuntimeEnv({
      ...localProductionEnv,
      NEXT_PHASE: 'phase-production-build',
      BETTER_AUTH_SECRET: undefined,
    })).toThrow(/BETTER_AUTH_SECRET/)
  })

  it.each([
    ['BETTER_AUTH_SECRET', 'your-secret-here-change-in-production'],
    ['KYC_ENCRYPTION_KEY', 'development-kyc-encryption-key-change-before-production'],
  ])('still rejects development %s for deployed production', (name, value) => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ [name]: value }))).toThrow(new RegExp(name))
  })

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

  it('allows unavailable integrations to be explicitly disabled', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({
      EMAIL_PROVIDER: 'disabled',
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
      PAYMENT_PROVIDER: 'disabled',
      PAYMENT_CHECKOUT_BASE_URL: undefined,
      PAYMENT_CHECKOUT_SECRET: undefined,
    }))).not.toThrow()
  })

  it('uses local upload storage by default in production', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({
      UPLOAD_STORAGE: undefined,
      S3_ENDPOINT: undefined,
      S3_REGION: undefined,
      S3_BUCKET: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined,
      S3_PUBLIC_BASE_URL: undefined,
    }))).not.toThrow()
  })

  it('requires complete S3 configuration only when S3 is selected', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({
      UPLOAD_STORAGE: 's3',
      S3_BUCKET: undefined,
    }))).toThrow(/S3_BUCKET/)
  })

  it('keeps affiliate commissions disabled until settlement is available', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ AFFILIATE_ENABLED: 'true' }))).toThrow(/AFFILIATE_ENABLED/)
  })

  it('keeps pgvector-backed AI search disabled while its storage is omitted', () => {
    expect(() => validateProductionRuntimeEnv(productionEnv({ AI_SEARCH_ENABLED: 'true' }))).toThrow(/AI_SEARCH_ENABLED/)
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
