import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRedisCacheClient, getCacheConfigFromEnv } from './cache.client.ts'

const redisInstances: Array<{
  status: string
  connect: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
  scan: ReturnType<typeof vi.fn>
  quit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
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
      scan: vi.fn(async (): Promise<[string, string[]]> => ['0', []]),
      quit: vi.fn(async () => 'OK'),
      on: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
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

  it('requests a bounded matching page after connecting', async () => {
    const client = createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))
    redisInstances[0]?.scan.mockResolvedValue(['27', ['v1:product:1']])

    await expect(client?.scan('12', 'v1:product:*', 200)).resolves.toEqual(['27', ['v1:product:1']])
    expect(redisInstances[0]?.connect).toHaveBeenCalledTimes(1)
    expect(redisInstances[0]?.scan).toHaveBeenCalledWith('12', 'MATCH', 'v1:product:*', 'COUNT', 200)
  })

  it('shares one connection attempt across concurrent commands', async () => {
    const client = createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))
    const redis = redisInstances[0]!
    let finish!: () => void
    redis.connect.mockImplementation(() => {
      redis.status = 'connecting'
      return new Promise<void>(resolve => { finish = resolve })
    })
    const work = Promise.all(Array.from({ length: 100 }, (_, index) => client!.get(`key:${index}`)))
    expect(redis.connect).toHaveBeenCalledTimes(1)
    expect(redis.get).not.toHaveBeenCalled()
    redis.status = 'ready'
    finish()

    await work
    expect(redis.get).toHaveBeenCalledTimes(100)
    expect(redis.once).not.toHaveBeenCalled()
  })

  it('removes both temporary listeners after an existing connection becomes ready', async () => {
    const client = createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))
    const redis = redisInstances[0]!
    redis.status = 'connecting'
    const work = Promise.all([client!.get('first'), client!.get('second')])
    const onReady = redis.once.mock.calls.find(call => call[0] === 'ready')?.[1]
    if (typeof onReady !== 'function') throw new Error('Missing readiness listener')
    redis.status = 'ready'
    onReady()

    await work
    expect(redis.once).toHaveBeenCalledTimes(2)
    expect(redis.removeListener).toHaveBeenCalledWith('ready', onReady)
    expect(redis.removeListener).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('releases failed shared connection waits and allows a later retry', async () => {
    const client = createRedisCacheClient(getCacheConfigFromEnv({ REDIS_URL: 'redis://localhost:6379' }))
    const redis = redisInstances[0]!
    redis.status = 'connecting'
    const work = Promise.allSettled([client!.get('first'), client!.get('second')])
    const onError = redis.once.mock.calls.find(call => call[0] === 'error')?.[1]
    if (typeof onError !== 'function') throw new Error('Missing error listener')
    const error = new Error('Connection interrupted')
    onError(error)

    expect(await work).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ])
    expect(redis.removeListener).toHaveBeenCalledWith('error', onError)
    expect(redis.removeListener).toHaveBeenCalledWith('ready', expect.any(Function))
    redis.status = 'wait'
    await client!.get('retry')
    expect(redis.connect).toHaveBeenCalledTimes(1)
    expect(redis.get).toHaveBeenCalledTimes(1)
  })
})
