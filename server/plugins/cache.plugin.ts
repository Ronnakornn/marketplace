import { Elysia } from 'elysia'
import type { CacheService } from '#server/modules/cache'

export function createCachePlugin(cacheService: CacheService) {
  return new Elysia({ name: 'cache-plugin' }).decorate('cache', cacheService)
}
