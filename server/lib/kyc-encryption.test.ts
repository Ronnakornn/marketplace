import { afterEach, describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from '#server/config/production-env.ts'
import { encryptKycValue, hashKycValue, maskLast4 } from './kyc-encryption.ts'

describe('KYC encryption helpers', () => {
  const originalNodeEnv = process.env['NODE_ENV']
  const originalKycKey = process.env['KYC_ENCRYPTION_KEY']

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV']
    } else {
      process.env['NODE_ENV'] = originalNodeEnv
    }
    if (originalKycKey === undefined) {
      delete process.env['KYC_ENCRYPTION_KEY']
    } else {
      process.env['KYC_ENCRYPTION_KEY'] = originalKycKey
    }
  })

  it('encrypts KYC values without returning plaintext', () => {
    process.env['NODE_ENV'] = 'test'
    delete process.env['KYC_ENCRYPTION_KEY']

    const encrypted = encryptKycValue('1101700206789')
    const hash = hashKycValue('1101700206789')

    expect(encrypted).toMatch(/^v1:/)
    expect(encrypted).not.toContain('1101700206789')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toContain('1101700206789')
    expect(maskLast4('1101700206789')).toBe('6789')
  })

  it('requires a non-placeholder KYC key in production runtime', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:password@db.example.com:5432/sming',
      BETTER_AUTH_SECRET: 'production-auth-secret-at-least-32-chars',
      BETTER_AUTH_URL: 'https://marketplace.example.com',
      NEXT_PUBLIC_APP_URL: 'https://marketplace.example.com',
      API_BASE_URL: 'https://api.marketplace.example.com',
      PAYMENT_WEBHOOK_SECRET: 'production-payment-secret-at-least-32-chars',
      KYC_ENCRYPTION_KEY: 'your-kyc-encryption-key-at-least-32-chars',
    }

    expect(() => validateProductionRuntimeEnv(env)).toThrow(/KYC_ENCRYPTION_KEY/)
  })
})
