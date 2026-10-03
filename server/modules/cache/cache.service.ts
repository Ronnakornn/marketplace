import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { createCacheKeys } from './cache.keys.ts'
import type { CacheClient, CacheConfig, CacheKeyBuilder, CacheSetOptions } from './cache.types.ts'
import { encodeCacheValue, decodeCacheValue } from './cache.codec.ts'

export class CacheService {
  private logger: ILogger
  private unavailableUntilMs = 0
  private readonly pending = new Map<string, Promise<unknown>>()
  private invalidationVersion = 0
  readonly keys: CacheKeyBuilder

  constructor(
    appContext: AppContext,
    private config: CacheConfig,
    private client: CacheClient | null,
  ) {
    this.logger = appContext.logger
    this.keys = createCacheKeys(`${config.keyPrefix}:money-v2`)

    if (config.enabled && !config.redisUrl) {
      this.logger.warn('CACHE_CONFIG_MISSING', { code: 'CACHE_CONFIG_MISSING' })
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && Boolean(this.client) && Date.now() >= this.unavailableUntilMs
  }

  ttl() {
    return {
      default: this.config.defaultTtlSeconds,
      product: this.config.productTtlSeconds,
      search: this.config.searchTtlSeconds,
      sellerDashboard: this.config.sellerDashboardTtlSeconds,
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) return null

    try {
      const raw = await this.client!.get(key)
      if (raw === null) return null
      return decodeCacheValue(raw) as T
    } catch (error) {
      this.markTemporarilyUnavailable()
      this.logger.warn('Cache get failed', {
        code: 'CACHE_CONNECTION_FAILED',
        key,
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async set<T>(key: string, value: T, options: CacheSetOptions = {}): Promise<void> {
    if (!this.isEnabled()) return

    try {
      const ttlSeconds = options.ttlSeconds ?? this.config.defaultTtlSeconds
      await this.client!.set(key, encodeCacheValue(value), 'EX', ttlSeconds)
    } catch (error) {
      this.markTemporarilyUnavailable()
      this.logger.warn('Cache set failed', {
        code: 'CACHE_CONNECTION_FAILED',
        key,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  remember<T>(key: string, fetcher: () => Promise<T>, options: CacheSetOptions = {}): Promise<T> {
    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>
    const version = this.invalidationVersion
    const work = (async () => {
      const cached = await this.get<T>(key)
      if (cached !== null) return cached
      const value = await fetcher()
      // A mutation may have invalidated this read while its query was running.
      if (version === this.invalidationVersion) await this.set(key, value, options)
      return value
    })().finally(() => {
      if (this.pending.get(key) === work) this.pending.delete(key)
    })
    this.pending.set(key, work)
    return work
  }

  async delete(key: string): Promise<number> {
    this.invalidationVersion++
    this.pending.clear()
    if (!this.isEnabled()) return 0
    try {
      await this.client!.del(key)
      return 1
    } catch (error) {
      this.markTemporarilyUnavailable()
      this.logger.warn('Cache delete failed', {
        code: 'CACHE_INVALIDATION_FAILED',
        key,
        message: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  async deleteByPattern(pattern: string): Promise<number> {
    this.invalidationVersion++
    this.pending.clear()
    if (!this.isEnabled()) return 0

    try {
      const keys = await this.client!.keys(pattern)
      if (keys.length === 0) return 0
      await this.client!.del(...keys)
      return keys.length
    } catch (error) {
      this.markTemporarilyUnavailable()
      this.logger.warn('Cache invalidation failed', {
        code: 'CACHE_INVALIDATION_FAILED',
        pattern,
        message: error instanceof Error ? error.message : String(error),
      })
      return 0
    }
  }

  private markTemporarilyUnavailable(): void {
    this.unavailableUntilMs = Date.now() + 30_000
  }
}
