import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRedisCacheClient, getCacheConfigFromEnv } from './cache.client.ts'
import { CacheService } from './cache.service.ts'
import { CacheInvalidation } from './cache.invalidation.ts'

const redisUrl = process.env.CACHE_TEST_REDIS_URL

describe.skipIf(!redisUrl)('incremental cache invalidation on Redis', () => {
  let client: NonNullable<ReturnType<typeof createRedisCacheClient>>
  let cache: CacheService
  const prefix = `scan-test-${randomUUID()}`

  beforeAll(() => {
    const url = new URL(redisUrl!)
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.port || url.port === '6379' || !/^\/[1-9]\d*$/.test(url.pathname)) {
      throw new Error('Use an isolated local Redis port and nonzero database')
    }
    const config = getCacheConfigFromEnv({ REDIS_URL: redisUrl, CACHE_KEY_PREFIX: prefix })
    const connection = createRedisCacheClient(config)
    if (!connection) throw new Error('Redis cache connection is required')
    client = connection
    cache = new CacheService({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, config, client)
  })

  afterAll(async () => {
    await cache?.deleteByPattern(`${prefix}:*`)
    await client?.quit?.()
  })

  it('deletes matching entries across multiple pages without deleting unrelated keys', async () => {
    const keys = Array.from({ length: 501 }, (_, index) => `${prefix}:target:${index}`)
    await Promise.all(keys.map(key => cache.set(key, key)))
    await cache.set(`${prefix}:keep`, 'untouched')

    await expect(cache.deleteByPattern(`${prefix}:target:*`)).resolves.toBe(501)
    const values = await Promise.all(keys.map(key => client.get(key)))
    expect(values).toEqual(Array.from({ length: 501 }, () => null))
    await expect(cache.get(`${prefix}:keep`)).resolves.toBe('untouched')
    await expect(cache.deleteByPattern(`${prefix}:target:*`)).resolves.toBe(0)
  })

  it('deletes grouped patterns in a single cursor chain and preserves other cache entries', async () => {
    const productKeys = Array.from({ length: 251 }, (_, index) => `${prefix}:money-v2:product:list:${index}`)
    const searchKeys = Array.from({ length: 251 }, (_, index) => `${prefix}:money-v2:search:products:${index}`)
    await Promise.all([...productKeys, ...searchKeys].map(key => cache.set(key, 1)))
    await cache.set(`${prefix}:money-v2:seller:keep:dashboard`, 'untouched')
    const scan = vi.spyOn(client, 'scan')

    try {
      const invalidation = new CacheInvalidation(cache)
      await expect(invalidation.invalidateProductListsAndSearch()).resolves.toBe(502)
      expect(scan.mock.calls.filter(([cursor]) => cursor === '0')).toHaveLength(1)
      for (let index = 1; index < scan.mock.calls.length; index++) {
        const previous = await scan.mock.results[index - 1]!.value
        expect(scan.mock.calls[index]![0]).toBe(previous[0])
      }
      const values = await Promise.all([...productKeys, ...searchKeys].map(key => client.get(key)))
      expect(values).toEqual(Array.from({ length: 502 }, () => null))
      await expect(cache.get(`${prefix}:money-v2:seller:keep:dashboard`)).resolves.toBe('untouched')
    } finally {
      scan.mockRestore()
    }
  })
})
