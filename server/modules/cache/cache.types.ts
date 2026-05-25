export type CacheErrorCode =
  | 'CACHE_CONFIG_MISSING'
  | 'CACHE_CONNECTION_FAILED'
  | 'CACHE_INVALIDATION_FAILED'

export interface CacheConfig {
  enabled: boolean
  redisUrl: string | null
  defaultTtlSeconds: number
  productTtlSeconds: number
  searchTtlSeconds: number
  sellerDashboardTtlSeconds: number
  keyPrefix: string
}

export interface CacheClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>
  del(...keys: string[]): Promise<unknown>
  keys(pattern: string): Promise<string[]>
  quit?(): Promise<unknown>
}

export interface CacheSetOptions {
  ttlSeconds?: number
}

export interface CacheInvalidationResult {
  deletedKeys: number
}

export interface CacheKeyBuilder {
  productList(query: unknown): string
  productDetail(productId: string, locale?: string): string
  categoryList(locale?: string): string
  productSearch(query: unknown): string
  searchSuggestions(query: unknown): string
  aiSearch(query: unknown): string
  sellerDashboard(shopId: string): string
  recommendations(kind: string, query: unknown): string
}
