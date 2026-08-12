import { describe, expect, it } from 'vitest'
import { canonicalCheckoutPayload, createPaymentCheckoutUrl, getPaymentProviderConfigFromEnv } from './payment.config.ts'

describe('payment provider config', () => {
  it('keeps mock checkout local outside production', () => {
    const config = getPaymentProviderConfigFromEnv({ NODE_ENV: 'test' })
    expect(createPaymentCheckoutUrl(config, {
      paymentId: 'payment-1',
      orderId: 'order-1',
      amount: 1500,
      currency: 'THB',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      locale: 'en',
    })).toBe('/en/payment/mock/payment-1')
  })

  it('rejects mock payments in production', () => {
    expect(() => getPaymentProviderConfigFromEnv({
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_MOCK_ENABLED: 'true',
    })).toThrow('Mock payments must be disabled in production')
  })

  it('allows explicit HTTP checkout endpoints only when insecure HTTP is acknowledged', () => {
    const production = {
      NODE_ENV: 'production',
      PAYMENT_PROVIDER: 'gateway',
      PAYMENT_MOCK_ENABLED: 'false',
      PAYMENT_CHECKOUT_BASE_URL: 'http://165.245.191.63/checkout',
      PAYMENT_CHECKOUT_SECRET: 'a'.repeat(32),
    }
    expect(() => getPaymentProviderConfigFromEnv(production)).toThrow(/must use https/)
    expect(() => getPaymentProviderConfigFromEnv({ ...production, ALLOW_INSECURE_HTTP: 'true' })).not.toThrow()
  })

  it('creates a signed external checkout URL', () => {
    const url = new URL(createPaymentCheckoutUrl({
      provider: 'gateway',
      mockEnabled: false,
      checkoutBaseUrl: 'https://payments.example.com/checkout',
      checkoutSecret: 'a'.repeat(32),
    }, {
      paymentId: 'payment-1',
      orderId: 'order-1',
      amount: 1500,
      currency: 'THB',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      issuedAt: new Date('2029-12-31T23:45:00.000Z'),
      locale: 'th',
    }))

    const signature = url.searchParams.get('signature')
    const values = Object.fromEntries([...url.searchParams.entries()].filter(([key]) => key !== 'signature'))
    expect(url.origin).toBe('https://payments.example.com')
    expect(values.provider).toBe('gateway')
    expect(values.amount).toBe('1500')
    expect(canonicalCheckoutPayload(values)).toContain('paymentId=payment-1')
    expect(signature).toMatch(/^[a-f0-9]{64}$/)
  })
})
