export interface SecurityConfig {
  rateLimitEnabled: boolean
  rateLimitWindowSeconds: number
  publicMaxRequests: number
  authMaxRequests: number
  checkoutMaxRequests: number
  adminMaxRequests: number
  sellerReadMaxRequests: number
  sellerWriteMaxRequests: number
  sellerMediaMaxRequests: number
  sellerReviewMaxRequests: number
  requestBodyLimitBytes: number
  trustProxy: boolean
  requireContentLength: boolean
}

export function getSecurityConfigFromEnv(env: Record<string, string | undefined> = process.env): SecurityConfig {
  const publicMaxRequests = parsePositiveInteger(env['RATE_LIMIT_MAX_REQUESTS'], 600)
  const authMaxRequests = parsePositiveInteger(env['RATE_LIMIT_AUTH_MAX_REQUESTS'], 120)
  const checkoutMaxRequests = parsePositiveInteger(env['RATE_LIMIT_CHECKOUT_MAX_REQUESTS'], 180)
  const sellerWriteMaxRequests = parsePositiveInteger(env['RATE_LIMIT_SELLER_WRITE_MAX_REQUESTS'], 30)

  return {
    rateLimitEnabled: env['RATE_LIMIT_ENABLED'] !== 'false',
    rateLimitWindowSeconds: parsePositiveInteger(env['RATE_LIMIT_WINDOW_SECONDS'], 60),
    publicMaxRequests,
    authMaxRequests,
    checkoutMaxRequests,
    adminMaxRequests: parsePositiveInteger(env['RATE_LIMIT_ADMIN_MAX_REQUESTS'], 300),
    sellerReadMaxRequests: parsePositiveInteger(env['RATE_LIMIT_SELLER_READ_MAX_REQUESTS'], 180),
    sellerWriteMaxRequests,
    sellerMediaMaxRequests: parsePositiveInteger(env['RATE_LIMIT_SELLER_MEDIA_MAX_REQUESTS'], 10),
    sellerReviewMaxRequests: parsePositiveInteger(env['RATE_LIMIT_SELLER_REVIEW_MAX_REQUESTS'], 5),
    requestBodyLimitBytes: parsePositiveInteger(env['REQUEST_BODY_LIMIT_BYTES'], 1024 * 1024),
    trustProxy: env['TRUST_PROXY'] === 'true',
    requireContentLength: env['REQUIRE_CONTENT_LENGTH'] === 'true' || env['NODE_ENV'] === 'production',
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
