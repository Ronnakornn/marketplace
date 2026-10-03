import type { CacheService } from './cache.service.ts'

export class CacheInvalidation {
  private inventoryInvalidationDueAt = 0
  private inventoryInvalidationTimer?: ReturnType<typeof setTimeout>

  constructor(private cache: CacheService) {}

  async invalidateProductListsAndSearch(): Promise<number> {
    const prefix = this.prefix()
    const deleted = await Promise.all([
      this.cache.deleteByPattern(`${prefix}:product:list:*`),
      this.cache.deleteByPattern(`${prefix}:search:products:*`),
      this.cache.deleteByPattern(`${prefix}:search:suggestions:*`),
    ])
    return deleted.reduce((total, count) => total + count, 0)
  }

  async invalidateCatalogDiscoveryAndSearch(): Promise<number> {
    const prefix = this.prefix()
    const deleted = await Promise.all([
      this.cache.deleteByPattern(`${prefix}:category:list:*`),
      this.cache.deleteByPattern(`${prefix}:product:list:*`),
      this.cache.deleteByPattern(`${prefix}:search:products:*`),
      this.cache.deleteByPattern(`${prefix}:search:suggestions:*`),
      this.cache.deleteByPattern(`${prefix}:ai-search:products:*`),
      this.cache.deleteByPattern(`${prefix}:recommendations:*`),
    ])
    return deleted.reduce((total, count) => total + count, 0)
  }

  async invalidateProduct(productId: string): Promise<number> {
    const prefix = this.prefix()
    const deleted = await Promise.all([
      this.cache.deleteByPattern(`${prefix}:product:detail:*:${productId}`),
      this.invalidateProductListsAndSearch(),
    ])
    return deleted.reduce((total, count) => total + count, 0)
  }

  async invalidateVariant(productId: string): Promise<number> {
    return this.invalidateProduct(productId)
  }

  async invalidateInventory(productId?: string): Promise<number> {
    if (productId) return this.invalidateProduct(productId)
    const now = Date.now()
    if (now >= this.inventoryInvalidationDueAt) {
      this.inventoryInvalidationDueAt = now + 1_000
      return this.invalidateProductListsAndSearch()
    }
    // Reservations can arrive many times per second. One trailing invalidation
    // keeps cached availability at most one second behind without running KEYS
    // for every checkout. Checkout still validates stock from PostgreSQL.
    if (!this.inventoryInvalidationTimer) {
      const delay = this.inventoryInvalidationDueAt - now
      this.inventoryInvalidationTimer = setTimeout(() => {
        this.inventoryInvalidationTimer = undefined
        this.inventoryInvalidationDueAt = Date.now() + 1_000
        void this.invalidateProductListsAndSearch()
      }, delay)
      this.inventoryInvalidationTimer.unref?.()
    }
    return 0
  }

  async invalidateSellerDashboard(shopId: string): Promise<number> {
    const prefix = this.prefix()
    const deleted = await Promise.all([
      this.cache.delete(this.cache.keys.sellerDashboard(shopId)),
      this.cache.deleteByPattern(`${prefix}:seller:${shopId}:dashboard:insights:*`),
    ])
    return deleted.reduce((total, count) => total + count, 0)
  }

  private prefix(): string {
    return this.cache.keys.categoryList().split(':category:list')[0]!
  }
}
