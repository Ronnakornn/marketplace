import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaProductAnalyticsRepository } from './product-analytics.repository.ts'

const context: AppContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe('Analytics ranking candidate queries', () => {
  it('returns all scoped product IDs for global ranking without loading page details', async () => {
    const findMany = vi.fn(async () => [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }])
    const db = { product: { findMany } } as unknown as PrismaClient
    const repository = new PrismaProductAnalyticsRepository(context, db)

    const result = await repository.findProductRankingCandidates(['shop-a'], 'tee')

    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(findMany).toHaveBeenCalledWith({
      where: { shopId: { in: ['shop-a'] }, deletedAt: null, OR: [
        { title: { contains: 'tee', mode: 'insensitive' } },
        { slug: { contains: 'tee', mode: 'insensitive' } },
      ] },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
      take: 500,
    })
  })

  it('returns all scoped SKU IDs and preserves the selected product filter', async () => {
    const findMany = vi.fn(async () => [{ id: 'a', sku: 'A' }, { id: 'b', sku: 'B' }, { id: 'c', sku: 'C' }])
    const db = { productVariant: { findMany } } as unknown as PrismaClient
    const repository = new PrismaProductAnalyticsRepository(context, db)

    const result = await repository.findVariantRankingCandidates(['shop-a'], 'product-a')

    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(findMany).toHaveBeenCalledWith({
      where: { productId: 'product-a', product: { shopId: { in: ['shop-a'] }, deletedAt: null } },
      select: { id: true, sku: true },
      orderBy: { id: 'asc' },
      take: 500,
    })
  })

  it('reads candidates beyond the first database batch without dropping or duplicating IDs', async () => {
    const firstBatch = Array.from({ length: 500 }, (_, index) => ({ id: `product-${String(index).padStart(3, '0')}`, title: 'Tee' }))
    const findMany = vi.fn()
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([{ id: 'product-500', title: 'Last tee' }])
    const db = { product: { findMany } } as unknown as PrismaClient
    const repository = new PrismaProductAnalyticsRepository(context, db)

    const result = await repository.findProductRankingCandidates(['shop-a'])

    expect(result).toHaveLength(501)
    expect(result.at(-1)).toEqual({ id: 'product-500', title: 'Last tee' })
    expect(new Set(result.map((item) => item.id)).size).toBe(501)
    expect(findMany.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ cursor: { id: 'product-499' }, skip: 1, take: 500 }))
  })
})
