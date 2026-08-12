import { describe, expect, it } from 'vitest'
import { validateProductionRuntimeEnv } from './production-env.ts'

function productionEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/marketplace',
    BETTER_AUTH_SECRET: 'production-auth-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'https://marketplace.example.com',
    NEXT_PUBLIC_APP_URL: 'https://marketplace.example.com',
    API_BASE_URL: 'http://api:3001',
    PAYMENT_WEBHOOK_SECRET: 'production-payment-secret-at-least-32-characters',
    KYC_ENCRYPTION_KEY: 'production-kyc-secret-at-least-32-characters',
    ...overrides,
  } as NodeJS.ProcessEnv
}

describe('push production environment', () => {
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
})
