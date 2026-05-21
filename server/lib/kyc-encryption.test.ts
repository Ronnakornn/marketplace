import { afterEach, describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from '#server/config/production-env.ts'
import { encryptKycValue, hashKycValue, maskLast4 } from './kyc-encryption.ts'

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
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:password@db.example.com:5432/sming',
      BETTER_AUTH_SECRET: 'production-auth-secret-at-least-32-chars',
      BETTER_AUTH_URL: 'https://marketplace.example.com',
      NEXT_PUBLIC_APP_URL: 'https://marketplace.example.com',
      API_BASE_URL: 'https://api.marketplace.example.com',
      PAYMENT_WEBHOOK_SECRET: 'production-payment-secret-at-least-32-chars',
      KYC_ENCRYPTION_KEY: 'your-kyc-encryption-key-at-least-32-chars',
    } as const

    expect(() => validateProductionRuntimeEnv(env)).toThrow(/KYC_ENCRYPTION_KEY/)
  })
})
