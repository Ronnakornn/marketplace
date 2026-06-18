import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRedisConnection } from './queue.connection.ts'

const redisInstances: Array<{
  on: ReturnType<typeof vi.fn>
}> = []

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function RedisMock() {
    const instance = {
      on: vi.fn(),
    }
    redisInstances.push(instance)
    return instance
  }),
}))

describe('queue redis connection', () => {
  beforeEach(() => {
    redisInstances.length = 0
    vi.clearAllMocks()
  })

  it('registers an error listener so redis connection failures are handled by queue events', () => {
    createRedisConnection({
      redisUrl: 'redis://localhost:6379',
      concurrency: 5,
      attempts: 3,
      skipRedisVersionCheck: true,
    })

    expect(redisInstances[0]?.on).toHaveBeenCalledWith('error', expect.any(Function))
  })
})
