export interface SecurityConfig {
  rateLimitEnabled: boolean
  rateLimitWindowSeconds: number
  publicMaxRequests: number
  authMaxRequests: number
  checkoutMaxRequests: number
  adminMaxRequests: number
  requestBodyLimitBytes: number
}

export function getSecurityConfigFromEnv(env: Record<string, string | undefined> = process.env): SecurityConfig {
  const publicMaxRequests = parsePositiveInteger(env['RATE_LIMIT_MAX_REQUESTS'], 100)
  const authMaxRequests = parsePositiveInteger(env['RATE_LIMIT_AUTH_MAX_REQUESTS'], 20)
  const checkoutMaxRequests = parsePositiveInteger(env['RATE_LIMIT_CHECKOUT_MAX_REQUESTS'], 10)

  return {
    rateLimitEnabled: env['RATE_LIMIT_ENABLED'] !== 'false',
    rateLimitWindowSeconds: parsePositiveInteger(env['RATE_LIMIT_WINDOW_SECONDS'], 60),
    publicMaxRequests,
    authMaxRequests,
    checkoutMaxRequests,
    adminMaxRequests: parsePositiveInteger(env['RATE_LIMIT_ADMIN_MAX_REQUESTS'], authMaxRequests),
    requestBodyLimitBytes: parsePositiveInteger(env['REQUEST_BODY_LIMIT_BYTES'], 1024 * 1024),
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
