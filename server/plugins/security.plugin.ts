import { Elysia } from 'elysia'
import IORedis from 'ioredis'
import type { AppContext } from '#server/context/app-context.ts'
import { SecurityError } from '#server/modules/security/security.errors.ts'
import { SecurityService } from '#server/modules/security/security.service.ts'
import type { SecurityConfig } from '#server/modules/security/security.config.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { MAX_IMPRESSION_BATCH_BYTES } from '#server/modules/tracking/tracking.limits.ts'

type RateLimitBucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitBucket>()
const MEMORY_SWEEP_LIMIT = 100
let bucketSweep: MapIterator<[string, RateLimitBucket]> | undefined

export function resetSecurityRateLimitBuckets(): void {
  buckets.clear()
  bucketSweep = undefined
}

function reclaimExpiredBuckets(now: number): void {
  bucketSweep ??= buckets.entries()
  for (let scanned = 0; scanned < MEMORY_SWEEP_LIMIT; scanned++) {
    const entry = bucketSweep.next()
    if (entry.done) { bucketSweep = undefined; return }
    if (entry.value[1].resetAt <= now) buckets.delete(entry.value[0])
  }
}

export function createSecurityPlugin(
  appContext: AppContext,
  config: SecurityConfig,
  deferError?: (error: unknown) => boolean,
  requestBodyLimit?: (request: Request) => number | undefined,
) {
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
      enforceRequestSize(request, config, securityService, remoteAddress, requestBodyLimit)
      await enforceRateLimit(request, config, securityService, rateLimitStore, remoteAddress)
    })
    .onBeforeHandle(async ({ request, body, server }) => {
      if (!isImpressionBatchRequest(request)) return
      if (!body || typeof body !== 'object' || !('events' in body) || !Array.isArray(body.events)) return
      const additionalEvents = body.events.length - 1
      if (additionalEvents > 0) {
        await enforceRateLimit(request, config, securityService, rateLimitStore, server?.requestIP(request)?.address, additionalEvents)
      }
    })
    .onError(({ error, set }) => {
      if (deferError?.(error)) return
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
  requestBodyLimit?: (request: Request) => number | undefined,
): void {
  const contentLength = request.headers.get('content-length')
  if (!contentLength) {
    if (config.requireContentLength && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      throw new SecurityError('Content-Length is required', 411, 'CONTENT_LENGTH_REQUIRED')
    }
    return
  }

  const size = Number(contentLength)
  const limit = requestBodyLimit?.(request)
    ?? (isImpressionBatchRequest(request) ? MAX_IMPRESSION_BATCH_BYTES : config.requestBodyLimitBytes)
  if (Number.isFinite(size) && size > limit) {
    securityService.logSuspiciousActivity({
      type: 'REQUEST_BODY_TOO_LARGE',
      severity: 'medium',
      ipAddress: getClientIp(request, config, remoteAddress),
      userAgent: request.headers.get('user-agent'),
      path: new URL(request.url).pathname,
      metadata: { size, limit },
    })
    throw new SecurityError('Request payload is too large', 413, 'PAYLOAD_TOO_LARGE')
  }
}

function isImpressionBatchRequest(request: Request): boolean {
  return request.method === 'POST' && new URL(request.url).pathname.replace(/\/+$/, '') === '/api/discovery/impressions'
}

async function enforceRateLimit(
  request: Request,
  config: SecurityConfig,
  securityService: SecurityService,
  store: RateLimitStore,
  remoteAddress?: string,
  cost = 1,
): Promise<void> {
  if (!config.rateLimitEnabled) return

  const url = new URL(request.url)
  const category = getRateLimitCategory(url.pathname, request.method)
  const limit = getLimitForCategory(category, config)
  const subject = await getRateLimitSubject(request, category, config, remoteAddress)
  const key = `${category}:${subject}`
  const count = await store.increment(key, config.rateLimitWindowSeconds * 1000, cost)

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
  if (pathname.startsWith('/api/seller/products/') && pathname.endsWith('/publish')) return 'sellerReview'
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
  increment(key: string, windowMs: number, cost: number): Promise<number>
}

class MemoryRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number, cost: number): Promise<number> {
    const now = Date.now()
    reclaimExpiredBuckets(now)
    const existing = buckets.get(key)
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowMs }
    bucket.count += cost
    buckets.set(key, bucket)
    return bucket.count
  }
}

class RedisRateLimitStore implements RateLimitStore {
  private redis: IORedis
  private connection: Promise<void> | null = null
  private readonly fallback = new MemoryRateLimitStore()
  private fallbackWarningLogged = false

  constructor(redisUrl: string, private appContext: AppContext) {
    this.redis = new IORedis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
    this.redis.on('error', () => undefined)
  }

  private ensureConnected(): Promise<void> {
    if (this.redis.status === 'ready') return Promise.resolve()
    this.connection ??= this.waitForConnection().finally(() => { this.connection = null })
    return this.connection
  }

  private async waitForConnection(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect()
      return
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.redis.removeListener('ready', onReady)
        this.redis.removeListener('error', onError)
      }
      const onReady = () => { cleanup(); resolve() }
      const onError = (error: Error) => { cleanup(); reject(error) }
      this.redis.once('ready', onReady)
      this.redis.once('error', onError)
    })
  }

  async increment(key: string, windowMs: number, cost: number): Promise<number> {
    try {
      await this.ensureConnected()
      return Number(await this.redis.eval(
        "local current = redis.call('INCRBY', KEYS[1], ARGV[2]); if current == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return current",
        1,
        `rate-limit:${key}`,
        windowMs,
        cost,
      ))
    } catch (error) {
      if (this.appContext.config.environment !== 'production') {
        if (!this.fallbackWarningLogged) {
          this.appContext.logger.warn('Redis rate limit unavailable; using in-memory development fallback', {
            error: error instanceof Error ? error.message : String(error),
          })
          this.fallbackWarningLogged = true
        }
        return this.fallback.increment(key, windowMs, cost)
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
