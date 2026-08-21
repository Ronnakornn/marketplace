import { afterEach, describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from '#server/config/production-env.ts'
import { encryptKycValue, hashKycValue, maskLast4 } from './kyc-encryption.ts'

function productionEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/marketplace',
    BETTER_AUTH_SECRET: 'production-auth-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'https://marketplace.example.com',
    NEXT_PUBLIC_APP_URL: 'https://marketplace.example.com',
    API_BASE_URL: 'http://api:3001',
    REDIS_URL: 'redis://redis:6379',
    TRUST_PROXY: 'true',
    QUEUE_SKIP_REDIS_VERSION_CHECK: 'false',
    OPENAPI_ENABLED: 'false',
    PAYMENT_WEBHOOK_SECRET: 'production-payment-secret-at-least-32-characters',
    OTP_HASH_SECRET: 'production-otp-secret-at-least-32-characters',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_production_key_at_least_20_chars',
    EMAIL_FROM: 'Marketplace <no-reply@example.com>',
    PAYMENT_PROVIDER: 'gateway',
    PAYMENT_MOCK_ENABLED: 'false',
    PAYMENT_CHECKOUT_BASE_URL: 'https://payments.example.com/checkout',
    PAYMENT_CHECKOUT_SECRET: 'production-checkout-secret-at-least-32-characters',
    KYC_ENCRYPTION_KEY: 'production-kyc-secret-at-least-32-characters',
    UPLOAD_STORAGE: 's3',
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
  }
}

describe('KYC encryption helpers', () => {
  const mutableEnv = process.env as Record<string, string | undefined>
  const originalNodeEnv = process.env['NODE_ENV']
  const originalKycKey = process.env['KYC_ENCRYPTION_KEY']

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete mutableEnv['NODE_ENV']
    } else {
      mutableEnv['NODE_ENV'] = originalNodeEnv
    }
    if (originalKycKey === undefined) {
      delete mutableEnv['KYC_ENCRYPTION_KEY']
    } else {
      mutableEnv['KYC_ENCRYPTION_KEY'] = originalKycKey
    }
  })

  it('encrypts KYC values without returning plaintext', () => {
    mutableEnv['NODE_ENV'] = 'test'
    delete mutableEnv['KYC_ENCRYPTION_KEY']

    const encrypted = encryptKycValue('1101700206789')
    const hash = hashKycValue('1101700206789')

    expect(encrypted).toMatch(/^v1:/)
    expect(encrypted).not.toContain('1101700206789')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain('1101700206789')
    expect(maskLast4('1101700206789')).toBe('6789')
  })

  it('requires a non-placeholder KYC key in production runtime', () => {
    const env = productionEnv({
      KYC_ENCRYPTION_KEY: 'your-kyc-encryption-key-at-least-32-chars',
    })

    expect(() => validateProductionRuntimeEnv(env)).toThrow(/KYC_ENCRYPTION_KEY/)
  })

  it('allows explicit HTTP public URLs for IP-based production deployments', () => {
    const env = productionEnv({
      ALLOW_INSECURE_HTTP: 'true',
      BETTER_AUTH_URL: 'http://165.245.191.63',
      NEXT_PUBLIC_APP_URL: 'http://165.245.191.63',
      API_BASE_URL: 'http://127.0.0.1:3001',
      S3_PUBLIC_BASE_URL: 'http://165.245.191.63/uploads',
    })

    expect(() => validateProductionRuntimeEnv(env)).not.toThrow()
  })
})
