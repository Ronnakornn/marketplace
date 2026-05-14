import { Elysia } from 'elysia'
import type { AppContext } from '#server/context/app-context.ts'
import { SecurityError } from '#server/modules/security/security.errors.ts'
import { SecurityService } from '#server/modules/security/security.service.ts'
import type { SecurityConfig } from '#server/modules/security/security.config.ts'

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()

export function resetSecurityRateLimitBuckets(): void {
  buckets.clear()
}

export function createSecurityPlugin(appContext: AppContext, config: SecurityConfig) {
  const securityService = new SecurityService(appContext)

  return new Elysia({ name: 'security' })
    .onRequest(({ request, set }) => {
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['x-frame-options'] = 'DENY'
      set.headers['referrer-policy'] = 'no-referrer'
      set.headers['permissions-policy'] = 'camera=(), microphone=(), geolocation=()'

      enforceRequestSize(request, config, securityService)
      enforceRateLimit(request, config, securityService)
    })
    .onError(({ error, set }) => {
      const formatted = securityService.formatError(error, appContext.config.environment)
      set.status = formatted.status
      return formatted.body
    })
    .as('global')
}

function enforceRequestSize(request: Request, config: SecurityConfig, securityService: SecurityService): void {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) return

  const size = Number(contentLength)
  if (Number.isFinite(size) && size > config.requestBodyLimitBytes) {
    securityService.logSuspiciousActivity({
      type: 'REQUEST_BODY_TOO_LARGE',
      severity: 'medium',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      path: new URL(request.url).pathname,
      metadata: { size, limit: config.requestBodyLimitBytes },
    })
    throw new SecurityError('Request payload is too large', 413, 'PAYLOAD_TOO_LARGE')
  }
}

function enforceRateLimit(request: Request, config: SecurityConfig, securityService: SecurityService): void {
  if (!config.rateLimitEnabled) return

  const url = new URL(request.url)
  const category = getRateLimitCategory(url.pathname)
  const limit = getLimitForCategory(category, config)
  const ip = getClientIp(request)
  const key = `${category}:${ip}`
  const now = Date.now()
  const existing = buckets.get(key)
  const resetAt = existing && existing.resetAt > now ? existing.resetAt : now + config.rateLimitWindowSeconds * 1000
  const bucket = existing && existing.resetAt > now ? existing : { count: 0, resetAt }
  bucket.count += 1
  buckets.set(key, bucket)

  if (bucket.count > limit) {
    securityService.logSuspiciousActivity({
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'medium',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
      path: url.pathname,
      metadata: { category, limit },
    })
    throw new SecurityError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
  }
}

function getRateLimitCategory(pathname: string): 'auth' | 'checkout' | 'admin' | 'public' {
  if (pathname.startsWith('/api/auth') || pathname.includes('/login') || pathname.includes('/signup')) return 'auth'
  if (pathname.startsWith('/api/checkout') || pathname.startsWith('/api/payments')) return 'checkout'
  if (pathname.startsWith('/api/admin')) return 'admin'
  return 'public'
}

function getLimitForCategory(category: ReturnType<typeof getRateLimitCategory>, config: SecurityConfig): number {
  if (category === 'auth') return config.authMaxRequests
  if (category === 'checkout') return config.checkoutMaxRequests
  if (category === 'admin') return config.adminMaxRequests
  return config.publicMaxRequests
}

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}
