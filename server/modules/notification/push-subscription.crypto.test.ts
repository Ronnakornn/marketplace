import { afterEach, describe, expect, it } from 'vitest'
import {
  decryptPushSubscriptionValue,
  encryptPushSubscriptionValue,
  hashPushEndpoint,
} from './push-subscription.crypto.ts'

const originalKey = process.env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY']

afterEach(() => {
  if (originalKey === undefined) delete process.env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY']
  else process.env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY'] = originalKey
})

describe('push subscription crypto', () => {
  it('round-trips encrypted values without storing plaintext', () => {
    process.env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY'] = 'test-push-subscription-encryption-key-1234'
    const endpoint = 'https://push.example/subscription/secret'
    const encrypted = encryptPushSubscriptionValue(endpoint)

    expect(encrypted).not.toContain(endpoint)
    expect(decryptPushSubscriptionValue(encrypted)).toBe(endpoint)
    expect(hashPushEndpoint(endpoint)).toMatch(/^[a-f0-9]{64}$/)
  })
})
