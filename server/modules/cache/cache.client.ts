import IORedis from 'ioredis'
import type { CacheClient, CacheConfig } from './cache.types.ts'

const DEFAULT_TTL_SECONDS = 300
const DEFAULT_PRODUCT_TTL_SECONDS = 300
const DEFAULT_SEARCH_TTL_SECONDS = 120
const DEFAULT_SELLER_DASHBOARD_TTL_SECONDS = 60
const DEFAULT_KEY_PREFIX = 'v1'

export function getCacheConfigFromEnv(env: Record<string, string | undefined> = process.env): CacheConfig {
  return {
    enabled: parseBoolean(env['CACHE_ENABLED'], Boolean(env['REDIS_URL']?.trim())),
    redisUrl: env['REDIS_URL']?.trim() || null,
    defaultTtlSeconds: parsePositiveInteger(env['CACHE_DEFAULT_TTL_SECONDS'], DEFAULT_TTL_SECONDS),
    productTtlSeconds: parsePositiveInteger(env['CACHE_PRODUCT_TTL_SECONDS'], DEFAULT_PRODUCT_TTL_SECONDS),
    searchTtlSeconds: parsePositiveInteger(env['CACHE_SEARCH_TTL_SECONDS'], DEFAULT_SEARCH_TTL_SECONDS),
    sellerDashboardTtlSeconds: parsePositiveInteger(
      env['CACHE_SELLER_DASHBOARD_TTL_SECONDS'],
      DEFAULT_SELLER_DASHBOARD_TTL_SECONDS,
    ),
    keyPrefix: env['CACHE_KEY_PREFIX']?.trim() || DEFAULT_KEY_PREFIX,
  }
}

export function createRedisCacheClient(config: CacheConfig): CacheClient | null {
  if (!config.enabled) return null
  if (!config.redisUrl) return null

  const redis = new IORedis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  })
  redis.on('error', () => {
    // Cache failures are handled by CacheService; keep Redis connection errors from escaping as noisy stderr output.
  })

  return {
    async get(key) {
      await ensureConnected(redis)
      return redis.get(key)
    },
    async set(key, value, mode, ttlSeconds) {
      await ensureConnected(redis)
      return redis.set(key, value, mode, ttlSeconds)
    },
    async del(...keys) {
      await ensureConnected(redis)
      return redis.del(...keys)
    },
    async keys(pattern) {
      await ensureConnected(redis)
      return redis.keys(pattern)
    },
    async quit() {
      return redis.quit()
    },
  }
}

async function ensureConnected(redis: IORedis): Promise<void> {
  if (redis.status === 'ready') return
  if (redis.status === 'connect' || redis.status === 'connecting') {
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', resolve)
      redis.once('error', reject)
    })
    return
  }
  await redis.connect()
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
