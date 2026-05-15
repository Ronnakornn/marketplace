import type { CacheService } from './cache.service.ts'

export class CacheInvalidation {
  constructor(private cache: CacheService) {}

  async invalidateProductListsAndSearch(): Promise<number> {
    const prefix = this.prefix()
    const deleted = await Promise.all([
      this.cache.deleteByPattern(`${prefix}:product:list:*`),
      this.cache.deleteByPattern(`${prefix}:search:products:*`),
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
    return this.invalidateProductListsAndSearch()
  }

  async invalidateSellerDashboard(shopId: string): Promise<number> {
    return this.cache.delete(this.cache.keys.sellerDashboard(shopId))
  }

  private prefix(): string {
    return this.cache.keys.categoryList().split(':category:list')[0]!
  }
}
