import IORedis from 'ioredis'
import type { QueueConfig } from './queue.config.ts'

export function createRedisConnection(config: QueueConfig): IORedis {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  })
}
