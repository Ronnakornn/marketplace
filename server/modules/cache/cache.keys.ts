import { createHash } from 'node:crypto'
import type { CacheKeyBuilder } from './cache.types.ts'

const VERSION_PREFIX = 'v1'

export function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 24)
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

export function createCacheKeys(prefix: string): CacheKeyBuilder {
  const normalizedPrefix = prefix.trim() || VERSION_PREFIX
  return {
    productList: (query) => `${normalizedPrefix}:product:list:${stableHash(query)}`,
    productDetail: (productId) => `${normalizedPrefix}:product:detail:${productId}`,
    categoryList: () => `${normalizedPrefix}:category:list`,
    productSearch: (query) => `${normalizedPrefix}:search:products:${stableHash(query)}`,
    sellerDashboard: (shopId) => `${normalizedPrefix}:seller:${shopId}:dashboard`,
  }
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) sorted[key] = sortValue(item)
      return sorted
    }, {})
}
