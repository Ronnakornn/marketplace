import type { CacheService } from './cache.service.ts'

export class CacheInvalidation {
  private inventoryInvalidationDueAt = 0
  private inventoryInvalidationTimer?: ReturnType<typeof setTimeout>

  constructor(private cache: CacheService) {}

  async invalidateProductListsAndSearch(): Promise<number> {
    const prefix = this.prefix()
    return this.cache.deleteByPatterns([
      `${prefix}:product:list:*`,
      `${prefix}:search:products:*`,
      `${prefix}:search:suggestions:*`,
    ])
  }

  async invalidateCatalogDiscoveryAndSearch(): Promise<number> {
    const prefix = this.prefix()
    return this.cache.deleteByPatterns([
      `${prefix}:category:list:*`,
      `${prefix}:product:list:*`,
      `${prefix}:search:products:*`,
      `${prefix}:search:suggestions:*`,
      `${prefix}:ai-search:products:*`,
      `${prefix}:recommendations:*`,
    ])
  }

  async invalidateProduct(productId: string): Promise<number> {
    const prefix = this.prefix()
    return this.cache.deleteByPatterns([
      `${prefix}:product:detail:*:${productId}`,
      `${prefix}:product:list:*`,
      `${prefix}:search:products:*`,
      `${prefix}:search:suggestions:*`,
    ])
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
    return this.cache.deleteByPatterns([
      this.cache.keys.sellerDashboard(shopId),
      `${prefix}:seller:${shopId}:dashboard:insights:*`,
    ])
  }

  private prefix(): string {
    return this.cache.keys.categoryList().split(':category:list')[0]!
  }
}
