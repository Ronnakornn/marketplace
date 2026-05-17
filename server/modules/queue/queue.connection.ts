import Redis from 'ioredis'
import type { QueueConfig } from './queue.config.ts'

export function createRedisConnection(config: QueueConfig): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  })
}