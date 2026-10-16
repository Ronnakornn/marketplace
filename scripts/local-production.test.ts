import { describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from '../server/config/production-env.ts'
import { localProductionEnv } from './local-production.ts'

const developmentEnv = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/sming',
  BETTER_AUTH_SECRET: 'your-secret-here-change-in-production',
  PAYMENT_WEBHOOK_SECRET: 'local-payment-webhook-secret-at-least-32-characters',
}

describe('local production profile', () => {
  it('runs a local database in production with external integrations disabled', () => {
    const env = localProductionEnv(developmentEnv)
    expect(() => validateProductionRuntimeEnv(env)).not.toThrow()
    expect(env).toMatchObject({ NODE_ENV: 'production', HOST: '127.0.0.1', PAYMENT_PROVIDER: 'disabled', TRUST_PROXY: 'false' })
  })

  it('refuses to use a remote database from the inherited environment', () => {
    const env = localProductionEnv({ ...developmentEnv, DATABASE_URL: 'postgresql://app:secret@db.example.com/marketplace' })
    expect(() => validateProductionRuntimeEnv(env)).toThrow(/loopback DATABASE_URL/)
  })

  it('preserves encryption and signing secrets across restarts', () => {
    const env = localProductionEnv({ ...developmentEnv, KYC_ENCRYPTION_KEY: 'existing-kyc-secret-at-least-32-characters' })
    expect(env['BETTER_AUTH_SECRET']).toBe(developmentEnv.BETTER_AUTH_SECRET)
    expect(env['KYC_ENCRYPTION_KEY']).toBe('existing-kyc-secret-at-least-32-characters')
    expect(env['OTP_HASH_SECRET']).toBe(developmentEnv.BETTER_AUTH_SECRET)
  })
})
