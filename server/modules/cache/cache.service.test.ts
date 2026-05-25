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
      keys.forEach((key) => store.delete(key))
      return keys.length
    }),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp(`^${pattern.replaceAll('*', '.*')}$`)
      return [...store.keys()].filter((key) => regex.test(key))
    }),
  }
}

describe('CacheService', () => {
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

  it('inventory update invalidates product/search cache', async () => {
    const service = new CacheService(createAppContext(), createConfig(), createClient())
    const invalidation = new CacheInvalidation(service)
    await service.set(service.keys.productDetail('product-1'), { id: 'product-1' })
    await service.set(service.keys.productSearch({ q: 'available' }), { items: [] })

    await invalidation.invalidateInventory('product-1')

    await expect(service.get(service.keys.productDetail('product-1'))).resolves.toBeNull()
    await expect(service.get(service.keys.productSearch({ q: 'available' }))).resolves.toBeNull()
  })

  it('no cart/checkout/payment data is cached by supported key builders', () => {
    const keys = Object.values(createCacheKeys('v1')).map((builder) => builder.toString()).join('\n')

    expect(keys).not.toContain('cart')
    expect(keys).not.toContain('checkout')
    expect(keys).not.toContain('payment')
  })
})
