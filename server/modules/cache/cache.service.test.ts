import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { CacheInvalidation } from './cache.invalidation.ts'
import { createCacheKeys } from './cache.keys.ts'
import { CacheService } from './cache.service.ts'
import type { CacheClient, CacheConfig } from './cache.types.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createConfig(overrides: Partial<CacheConfig> = {}): CacheConfig {
  return {
    enabled: true,
    redisUrl: 'redis://localhost:6379',
    defaultTtlSeconds: 300,
    productTtlSeconds: 120,
    searchTtlSeconds: 60,
    sellerDashboardTtlSeconds: 30,
    keyPrefix: 'v1',
    ...overrides,
  }
}

function createClient(): CacheClient {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys: string[]) => {
      return keys.filter((key) => store.delete(key)).length
    }),
    scan: vi.fn(async (_cursor: string, pattern: string): Promise<[string, string[]]> => {
      const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`)
      return ['0', [...store.keys()].filter((key) => regex.test(key))]
    }),
  }
}

describe('CacheService', () => {
  it('continues through empty scan pages, removes duplicate keys once and preserves unrelated entries', async () => {
    const client = createClient()
    const service = new CacheService(createAppContext(), createConfig(), client)
    await service.set('target:1', 1)
    await service.set('target:2', 2)
    await service.set('other:1', 3)
    vi.mocked(client.scan)
      .mockResolvedValueOnce(['7', []])
      .mockResolvedValueOnce(['19', ['target:1', 'target:1']])
      .mockResolvedValueOnce(['0', ['target:1', 'target:2']])

    await expect(service.deleteByPattern('target:*')).resolves.toBe(2)
    await expect(service.get('target:1')).resolves.toBeNull()
    await expect(service.get('target:2')).resolves.toBeNull()
    await expect(service.get('other:1')).resolves.toBe(3)
    expect(client.scan).toHaveBeenNthCalledWith(1, '0', 'target:*', 200)
    expect(client.scan).toHaveBeenNthCalledWith(2, '7', 'target:*', 200)
    expect(client.scan).toHaveBeenNthCalledWith(3, '19', 'target:*', 200)
  })

  it('bounds deletion commands even when Redis returns more keys than the scan count hint', async () => {
    const client = createClient()
    const service = new CacheService(createAppContext(), createConfig(), client)
    const keys = Array.from({ length: 450 }, (_, index) => `target:${index}`)
    await Promise.all(keys.map(key => service.set(key, 1)))
    vi.mocked(client.scan).mockResolvedValueOnce(['0', keys])

    await expect(service.deleteByPattern('target:*')).resolves.toBe(450)
    expect(vi.mocked(client.del).mock.calls.map(batch => batch.length)).toEqual([200, 200, 50])
    await expect(service.get('target:449')).resolves.toBeNull()
  })

  it('fails open and bypasses Redis temporarily if scanning fails partway through', async () => {
    const client = createClient()
    const context = createAppContext()
    const service = new CacheService(context, createConfig(), client)
    await service.set('target:1', 1)
    vi.mocked(client.scan)
      .mockResolvedValueOnce(['7', ['target:1']])
      .mockRejectedValueOnce(new Error('Redis unavailable'))

    await expect(service.deleteByPattern('target:*')).resolves.toBe(0)
    expect(context.logger.warn).toHaveBeenCalledWith('Cache invalidation failed', expect.objectContaining({ code: 'CACHE_INVALIDATION_FAILED' }))
    await expect(service.remember('new', async () => 2)).resolves.toBe(2)
    expect(client.get).not.toHaveBeenCalled()
  })

  it('shares concurrent cold reads instead of exhausting database connections', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const fetcher = vi.fn(async () => ({ items: [1] }))
    const results = await Promise.all(Array.from({ length: 1000 }, () => service.remember('cold', fetcher)))
    expect(results).toHaveLength(1000)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('shares failures only while in flight and allows the next request to retry', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce(2)
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.remember('retry', fetcher)))
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(service.remember('retry', fetcher)).resolves.toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not publish an in-flight stale result after invalidation', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    let finish!: (value: number) => void
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const oldRead = service.remember('cold', () => { started(); return new Promise<number>(resolve => { finish = resolve }) })
    await ready
    await service.deleteByPattern('*')
    await expect(service.remember('cold', async () => 2)).resolves.toBe(2)
    finish(1)
    await oldRead
    await expect(service.get('cold')).resolves.toBe(2)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cache set/get works with safe JSON date revival', async () => {
    const client = createClient()
    const service = new CacheService(createAppContext(), createConfig(), client)

    await service.set('v1:test', { id: '1', createdAt: new Date('2026-05-14T00:00:00.000Z') })
    const value = await service.get<{ id: string; createdAt: Date }>('v1:test')

    expect(value).toEqual({ id: '1', createdAt: new Date('2026-05-14T00:00:00.000Z') })
    expect(client.set).toHaveBeenCalledWith('v1:test', expect.any(String), 'EX', 300)
  })

  it('cache miss fallback works', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const fetcher = vi.fn(async () => ({ ok: true }))

    await expect(service.remember('v1:miss', fetcher)).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('cache disabled fallback works without touching redis', async () => {
    const client = createClient()
    const service = new CacheService(createAppContext(), createConfig({ enabled: false }), client)
    const fetcher = vi.fn(async () => ({ ok: true }))

    await service.remember('v1:disabled', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(client.get).not.toHaveBeenCalled()
    expect(client.set).not.toHaveBeenCalled()
  })

  it('cache connection failure does not break request', async () => {
    const client = createClient()
    vi.mocked(client.get).mockRejectedValue(new Error('redis down'))
    vi.mocked(client.set).mockRejectedValue(new Error('redis down'))
    const service = new CacheService(createAppContext(), createConfig(), client)

    await expect(service.remember('v1:fails-open', async () => ({ ok: true }))).resolves.toEqual({ ok: true })
  })

  it('temporarily bypasses cache after a connection failure', async () => {
    const client = createClient()
    vi.mocked(client.get).mockRejectedValueOnce(new Error('redis down'))
    const service = new CacheService(createAppContext(), createConfig(), client)
    const firstFetcher = vi.fn(async () => ({ ok: true }))
    const secondFetcher = vi.fn(async () => ({ ok: 'again' }))

    await service.remember('v1:fails-open', firstFetcher)
    await expect(service.remember('v1:skipped', secondFetcher)).resolves.toEqual({ ok: 'again' })

    expect(firstFetcher).toHaveBeenCalledTimes(1)
    expect(secondFetcher).toHaveBeenCalledTimes(1)
    expect(client.get).toHaveBeenCalledTimes(1)
  })

  it('search cache key changes by query params and seller dashboard cache is shop-scoped', () => {
    const keys = createCacheKeys('v1')

    expect(keys.productSearch({ q: 'shirt', page: 1 })).not.toBe(keys.productSearch({ q: 'shirt', page: 2 }))
    expect(keys.productSearch({
      locale: 'th',
      q: 'phone',
      categoryId: 'electronics',
      minPrice: 100,
      maxPrice: 1000,
      rating: 4,
      sort: 'newest',
      page: 1,
      limit: 40,
    })).not.toBe(keys.productSearch({
      locale: 'th',
      q: 'phone',
      categoryId: 'electronics',
      minPrice: 100,
      maxPrice: 1000,
      rating: 4,
      sort: 'newest',
      page: 2,
      limit: 40,
    }))
    expect(keys.searchSuggestions({ locale: 'th', q: 'phone', limit: 8 }))
      .not.toBe(keys.searchSuggestions({ locale: 'en', q: 'phone', limit: 8 }))
    expect(keys.searchSuggestions({ locale: 'th', q: 'phone', limit: 8 }))
      .not.toBe(keys.searchSuggestions({ locale: 'th', q: 'phone', limit: 10 }))
    expect(keys.sellerDashboard('shop-1')).toBe('v1:seller:shop-1:dashboard')
    expect(keys.sellerDashboard('shop-1')).not.toBe(keys.sellerDashboard('shop-2'))
    expect(keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 10 }))
      .not.toBe(keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 20 }))
    expect(keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 10 }))
      .not.toBe(keys.sellerDashboardInsights('shop-2', { kind: 'reviews', limit: 10 }))
  })

  it('seller dashboard invalidation clears dashboard and insights cache keys for a shop', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const invalidation = new CacheInvalidation(service)

    await service.set(service.keys.sellerDashboard('shop-1'), { ok: true })
    await service.set(service.keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 5 }), { items: [] })
    await service.set(service.keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 10 }), { items: [] })
    await service.set(service.keys.sellerDashboardInsights('shop-2', { kind: 'reviews', limit: 5 }), { items: [] })

    await invalidation.invalidateSellerDashboard('shop-1')

    await expect(service.get(service.keys.sellerDashboard('shop-1'))).resolves.toBeNull()
    await expect(service.get(service.keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 5 }))).resolves.toBeNull()
    await expect(service.get(service.keys.sellerDashboardInsights('shop-1', { kind: 'reviews', limit: 10 }))).resolves.toBeNull()
    await expect(service.get(service.keys.sellerDashboardInsights('shop-2', { kind: 'reviews', limit: 5 }))).resolves.toEqual({ items: [] })
  })

  it('product update invalidates related cache keys', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const invalidation = new CacheInvalidation(service)
    await service.set(service.keys.productDetail('product-1'), { id: 'product-1' })
    await service.set(service.keys.productList({ page: 1 }), { data: [] })
    await service.set(service.keys.productSearch({ q: 'tee' }), { items: [] })
    await service.set(service.keys.searchSuggestions({ q: 'tee', locale: 'th', limit: 8 }), { productTitles: [] })

    await invalidation.invalidateProduct('product-1')

    await expect(service.get(service.keys.productDetail('product-1'))).resolves.toBeNull()
    await expect(service.get(service.keys.productList({ page: 1 }))).resolves.toBeNull()
    await expect(service.get(service.keys.productSearch({ q: 'tee' }))).resolves.toBeNull()
    await expect(service.get(service.keys.searchSuggestions({ q: 'tee', locale: 'th', limit: 8 }))).resolves.toBeNull()
  })

  it('category mutation invalidates catalog discovery and search cache keys', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const invalidation = new CacheInvalidation(service)
    await service.set(service.keys.categoryList('th'), { data: [] })
    await service.set(service.keys.productList({ categoryId: 'fashion' }), { data: [] })
    await service.set(service.keys.productSearch({ categoryId: 'fashion' }), { items: [] })
    await service.set(service.keys.searchSuggestions({ q: 'dress' }), { productTitles: [] })
    await service.set(service.keys.aiSearch({ q: 'dress' }), { items: [] })
    await service.set(service.keys.recommendations('home', { categoryId: 'fashion' }), { items: [] })

    await invalidation.invalidateCatalogDiscoveryAndSearch()

    await expect(service.get(service.keys.categoryList('th'))).resolves.toBeNull()
    await expect(service.get(service.keys.productList({ categoryId: 'fashion' }))).resolves.toBeNull()
    await expect(service.get(service.keys.productSearch({ categoryId: 'fashion' }))).resolves.toBeNull()
    await expect(service.get(service.keys.searchSuggestions({ q: 'dress' }))).resolves.toBeNull()
    await expect(service.get(service.keys.aiSearch({ q: 'dress' }))).resolves.toBeNull()
    await expect(service.get(service.keys.recommendations('home', { categoryId: 'fashion' }))).resolves.toBeNull()
  })

  it('inventory update invalidates product/search cache', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const invalidation = new CacheInvalidation(service)
    await service.set(service.keys.productDetail('product-1'), { id: 'product-1' })
    await service.set(service.keys.productSearch({ q: 'available' }), { items: [] })

    await invalidation.invalidateInventory('product-1')

    await expect(service.get(service.keys.productDetail('product-1'))).resolves.toBeNull()
    await expect(service.get(service.keys.productSearch({ q: 'available' }))).resolves.toBeNull()
  })

  it('batches rapid global inventory invalidations and keeps a trailing refresh', async () => {
    vi.useFakeTimers()
    try {
      const service = new CacheService(createAppContext(), createConfig(), createClient())
      const deleteByPattern = vi.spyOn(service, 'deleteByPattern')
      const invalidation = new CacheInvalidation(service)
      await invalidation.invalidateInventory()
      await Promise.all(Array.from({ length: 20 }, () => invalidation.invalidateInventory()))
      expect(deleteByPattern).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(deleteByPattern).toHaveBeenCalledTimes(6)
    } finally {
      vi.useRealTimers()
    }
  })

  it('no cart/checkout/payment data is cached by supported key builders', () => {
    const keys = Object.values(createCacheKeys('v1')).map((builder) => builder.toString()).join('\n')

    expect(keys).not.toContain('cart')
    expect(keys).not.toContain('checkout')
    expect(keys).not.toContain('payment')
  })
})
