import Redis from 'ioredis'
import type { QueueConfig } from './queue.config.ts'

export function createRedisConnection(config: QueueConfig): Redis {
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
  })
  redis.on('error', () => {
    // BullMQ surfaces queue/worker failures through its own error events; keep ioredis from writing raw ECONNREFUSED warnings.
  })
  return redis
}
