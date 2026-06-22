import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRedisCacheClient, getCacheConfigFromEnv } from './cache.client.ts'

const redisInstances: Array<{
  status: string
  connect: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  keys: ReturnType<typeof vi.fn>
  quit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
}> = []

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function RedisMock() {
    const instance = {
      status: 'wait',
      connect: vi.fn(async () => {
        instance.status = 'ready'
      }),
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 1),
      keys: vi.fn(async () => []),
      quit: vi.fn(async () => 'OK'),
      on: vi.fn(),
      once: vi.fn(),
    }
    redisInstances.push(instance)
    return instance
  }),
}))

describe('cache client config', () => {
  beforeEach(() => {
    redisInstances.length = 0
    vi.clearAllMocks()
  })

  it('enables cache automatically when REDIS_URL is present', () => {
    const config = getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' })

    expect(config.enabled).toBe(true)
    expect(config.redisUrl).toBe('redis://localhost:6379')
  })

  it('connects lazy redis before issuing commands', async () => {
    const client = createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))

    await client?.get('v1:test')

    expect(redisInstances[0]?.connect).toHaveBeenCalledTimes(1)
    expect(redisInstances[0]?.get).toHaveBeenCalledWith('v1:test')
  })

  it('registers an error listener so redis failures are handled by cache service', () => {
    createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))

    expect(redisInstances[0]?.on).toHaveBeenCalledWith('error', expect.any(Function))
  })
})
