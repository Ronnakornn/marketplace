import { describe, expect, it } from 'vitest'
import { getQueueConfigFromEnv } from './queue.config.ts'
import { getDefaultJobOptions } from './queue.producer.ts'

describe('queue config', () => {
  it('builds retry config from environment defaults and overrides', () => {
    const config = getQueueConfigFromEnv({
      REDIS_URL: 'redis://localhost:6379',
      JOB_CONCURRENCY: '7',
      JOB_ATTEMPTS: '4',
    })

    expect(config).toEqual({
      redisUrl: 'redis://localhost:6379',
      concurrency: 7,
      attempts: 4,
    })
    expect(getDefaultJobOptions(config!)).toMatchObject({
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnFail: false,
    })
  })

  it('returns null when Redis is not configured', () => {
    expect(getQueueConfigFromEnv({})).toBeNull()
  })
})
