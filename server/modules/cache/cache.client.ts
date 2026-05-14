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

  return new IORedis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  })
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
