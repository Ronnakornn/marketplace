import { Elysia } from 'elysia'
import IORedis from 'ioredis'
import type { AppContext } from '#server/context/app-context.ts'
import { SecurityError } from '#server/modules/security/security.errors.ts'
import { SecurityService } from '#server/modules/security/security.service.ts'
import type { SecurityConfig } from '#server/modules/security/security.config.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'

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
  const rateLimitStore = createRateLimitStore(appContext)

  return new Elysia({ name: 'security' })
    .onRequest(async ({ request, set, server }) => {
      set.headers['x-content-type-options'] = 'nosniff'
      set.headers['x-frame-options'] = 'DENY'
      set.headers['referrer-policy'] = 'no-referrer'
      set.headers['permissions-policy'] = 'camera=(), microphone=(), geolocation=()'
      if (isSensitivePath(new URL(request.url).pathname)) {
        set.headers['cache-control'] = 'no-store'
      }

      const remoteAddress = server?.requestIP(request)?.address
      enforceRequestSize(request, config, securityService, remoteAddress)
      await enforceRateLimit(request, config, securityService, rateLimitStore, remoteAddress)
    })
    .onError(({ error, set }) => {
      const formatted = securityService.formatError(error, appContext.config.environment)
      set.status = formatted.status
      return formatted.body
    })
    .as('global')
}

function enforceRequestSize(
  request: Request,
  config: SecurityConfig,
  securityService: SecurityService,
  remoteAddress?: string,
): void {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) {
    if (config.requireContentLength && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      throw new SecurityError('Content-Length is required', 411, 'CONTENT_LENGTH_REQUIRED')
    }
    return
  }

  const size = Number(contentLength)
  if (Number.isFinite(size) && size > config.requestBodyLimitBytes) {
    securityService.logSuspiciousActivity({
      type: 'REQUEST_BODY_TOO_LARGE',
      severity: 'medium',
      ipAddress: getClientIp(request, config, remoteAddress),
      userAgent: request.headers.get('user-agent'),
      path: new URL(request.url).pathname,
      metadata: { size, limit: config.requestBodyLimitBytes },
    })
    throw new SecurityError('Request payload is too large', 413, 'PAYLOAD_TOO_LARGE')
  }
}

async function enforceRateLimit(
  request: Request,
  config: SecurityConfig,
  securityService: SecurityService,
  store: RateLimitStore,
  remoteAddress?: string,
): Promise<void> {
  if (!config.rateLimitEnabled) return

  const url = new URL(request.url)
  const category = getRateLimitCategory(url.pathname, request.method)
  const limit = getLimitForCategory(category, config)
  const subject = await getRateLimitSubject(request, category, config, remoteAddress)
  const key = `${category}:${subject}`
  const count = await store.increment(key, config.rateLimitWindowSeconds * 1000)

  if (count > limit) {
    securityService.logSuspiciousActivity({
      type: 'RATE_LIMIT_EXCEEDED',
      severity: 'medium',
      ipAddress: getClientIp(request, config, remoteAddress),
      userAgent: request.headers.get('user-agent'),
      path: url.pathname,
      metadata: { category, limit },
    })
    throw new SecurityError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED')
  }
}

type RateLimitCategory = 'auth' | 'checkout' | 'admin' | 'public' | 'sellerRead' | 'sellerWrite' | 'sellerMedia' | 'sellerReview'

function getRateLimitCategory(pathname: string, method: string): RateLimitCategory {
  if (pathname.startsWith('/api/auth') || pathname.includes('/login') || pathname.includes('/signup')) return 'auth'
  if (pathname.startsWith('/api/checkout') || pathname.startsWith('/api/payment')) return 'checkout'
  if (pathname.startsWith('/api/admin')) return 'admin'
  if (pathname.startsWith('/api/seller/products/') && pathname.endsWith('/submit-review')) return 'sellerReview'
  if (pathname.startsWith('/api/seller/products/') && (pathname.includes('/images') || pathname.endsWith('/video')) && method !== 'GET') return 'sellerMedia'
  if (pathname.startsWith('/api/seller/products') || pathname.startsWith('/api/seller/variants/')) {
    return method === 'GET' ? 'sellerRead' : 'sellerWrite'
  }
  return 'public'
}

function getLimitForCategory(category: RateLimitCategory, config: SecurityConfig): number {
  if (category === 'auth') return config.authMaxRequests
  if (category === 'checkout') return config.checkoutMaxRequests
  if (category === 'admin') return config.adminMaxRequests
  if (category === 'sellerRead') return config.sellerReadMaxRequests
  if (category === 'sellerWrite') return config.sellerWriteMaxRequests
  if (category === 'sellerMedia') return config.sellerMediaMaxRequests
  if (category === 'sellerReview') return config.sellerReviewMaxRequests
  return config.publicMaxRequests
}

async function getRateLimitSubject(
  request: Request,
  category: RateLimitCategory,
  config: SecurityConfig,
  remoteAddress?: string,
): Promise<string> {
  if (!category.startsWith('seller')) return `ip:${getClientIp(request, config, remoteAddress)}`

  const authContext = await getAuthContext(request.headers)
  return authContext ? `user:${authContext.user.id}` : `ip:${getClientIp(request, config, remoteAddress)}`
}

function getClientIp(request: Request, config: SecurityConfig, remoteAddress?: string): string {
  if (config.trustProxy) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || remoteAddress
      || 'unknown'
  }
  return remoteAddress || 'unknown'
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<number>
}

class MemoryRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number): Promise<number> {
    const now = Date.now()
    const existing = buckets.get(key)
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs }
    bucket.count += 1
    buckets.set(key, bucket)
    return bucket.count
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private redis: IORedis
  private readonly fallback = new MemoryRateLimitStore()
  private fallbackWarningLogged = false

  constructor(redisUrl: string, private appContext: AppContext) {
    this.redis = new IORedis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
    this.redis.on('error', () => undefined)
  }

  async increment(key: string, windowMs: number): Promise<number> {
    try {
      return Number(await this.redis.eval(
        "local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return current",
        1,
        `rate-limit:${key}`,
        windowMs,
      ))
    } catch (error) {
      if (this.appContext.config.environment !== 'production') {
        if (!this.fallbackWarningLogged) {
          this.appContext.logger.warn('Redis rate limit unavailable; using in-memory development fallback', {
            error: error instanceof Error ? error.message : String(error),
          })
          this.fallbackWarningLogged = true
        }
        return this.fallback.increment(key, windowMs)
      }
      this.appContext.logger.error('Redis rate limit failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw new SecurityError('Rate limit service unavailable', 503, 'RATE_LIMIT_UNAVAILABLE')
    }
  }
}

function createRateLimitStore(appContext: AppContext): RateLimitStore {
  const redisUrl = process.env['REDIS_URL']?.trim()
  return redisUrl ? new RedisRateLimitStore(redisUrl, appContext) : new MemoryRateLimitStore()
}

function isSensitivePath(pathname: string): boolean {
  return pathname.startsWith('/api/auth')
    || pathname.startsWith('/api/checkout')
    || pathname.startsWith('/api/payment')
    || pathname.startsWith('/api/admin')
    || pathname.startsWith('/api/seller')
}
