import { createHmac } from 'node:crypto'

const defaultLocale = 'th'
const supportedLocales = new Set(['th', 'en'])

export interface PaymentProviderConfig {
  provider: string
  mockEnabled: boolean
  checkoutBaseUrl?: string
  checkoutSecret?: string
}

export interface PaymentCheckoutLinkInput {
  paymentId: string
  orderId: string
  amount: number
  currency: string
  expiresAt: Date
  locale?: string
  issuedAt?: Date
}

export function getPaymentProviderConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): PaymentProviderConfig {
  const productionRuntime = env['NODE_ENV'] === 'production' && env['NEXT_PHASE'] !== 'phase-production-build'
  const allowInsecureHttp = env['ALLOW_INSECURE_HTTP'] === 'true'
  const mockEnabled = parseBoolean(env['PAYMENT_MOCK_ENABLED'], !productionRuntime)
  const provider = env['PAYMENT_PROVIDER']?.trim() || (mockEnabled ? 'mock' : '')
  const checkoutBaseUrl = env['PAYMENT_CHECKOUT_BASE_URL']?.trim()
  const checkoutSecret = env['PAYMENT_CHECKOUT_SECRET']?.trim()

  if (!provider) throw new Error('PAYMENT_PROVIDER is required when mock payments are disabled')
  if (productionRuntime && (mockEnabled || provider === 'mock')) {
    throw new Error('Mock payments must be disabled in production')
  }
  if (provider !== 'mock') {
    assertExternalCheckoutConfig(checkoutBaseUrl, checkoutSecret, productionRuntime && !allowInsecureHttp)
  }

  return {
    provider,
    mockEnabled,
    ...(checkoutBaseUrl ? { checkoutBaseUrl } : {}),
    ...(checkoutSecret ? { checkoutSecret } : {}),
  }
}

export function createPaymentCheckoutUrl(
  config: PaymentProviderConfig,
  input: PaymentCheckoutLinkInput,
): string {
  const locale = input.locale && supportedLocales.has(input.locale) ? input.locale : defaultLocale
  if (config.provider === 'mock') {
    if (!config.mockEnabled) throw new Error('Mock payments are disabled')
    return `/${locale}/payment/mock/${input.paymentId}`
  }

  if (!config.checkoutBaseUrl || !config.checkoutSecret) {
    throw new Error('External payment checkout is not configured')
  }

  const url = new URL(config.checkoutBaseUrl)
  const issuedAt = Math.floor((input.issuedAt ?? new Date()).getTime() / 1000).toString()
  const expiresAt = input.expiresAt.toISOString()
  const values = {
    provider: config.provider,
    paymentId: input.paymentId,
    orderId: input.orderId,
    amount: String(input.amount),
    currency: input.currency,
    expiresAt,
    issuedAt,
    locale,
  }
  const signature = createHmac('sha256', config.checkoutSecret)
    .update(canonicalCheckoutPayload(values))
    .digest('hex')

  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value)
  url.searchParams.set('signature', signature)
  return url.toString()
}

export function canonicalCheckoutPayload(values: Record<string, string>): string {
  return Object.keys(values)
    .sort()
    .map((key) => `${key}=${values[key]}`)
    .join('\n')
}

function assertExternalCheckoutConfig(
  checkoutBaseUrl: string | undefined,
  checkoutSecret: string | undefined,
  requireHttps: boolean,
): void {
  if (!checkoutBaseUrl) throw new Error('PAYMENT_CHECKOUT_BASE_URL is required for external payments')
  let url: URL
  try {
    url = new URL(checkoutBaseUrl)
  } catch {
    throw new Error('PAYMENT_CHECKOUT_BASE_URL must be a valid URL')
  }
  if (requireHttps && url.protocol !== 'https:') {
    throw new Error('PAYMENT_CHECKOUT_BASE_URL must use https in production')
  }
  if (!checkoutSecret || checkoutSecret.length < 32) {
    throw new Error('PAYMENT_CHECKOUT_SECRET must be at least 32 characters')
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === 'true' || value === '1'
}
