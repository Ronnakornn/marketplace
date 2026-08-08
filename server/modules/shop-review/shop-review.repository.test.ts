import { describe, expect, it, vi } from 'vitest'
import { PrismaShopReviewRepository } from './shop-review.repository.ts'

describe('PrismaShopReviewRepository public feed', () => {
  it('filters to published reviews and uses stable newest-first pagination', async () => {
    const findMany = vi.fn(() => Promise.resolve([]))
    const count = vi.fn(() => Promise.resolve(0))
    const prisma = {
      shopRating: { findMany, count },
      $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    }
    const repo = new PrismaShopReviewRepository({ logger: { debug: vi.fn() } } as never, prisma as never)
    await repo.listPublishedShopRatingsPage('shop-1', 2, 10)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { shopId: 'shop-1', status: 'PUBLISHED' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    }))
    expect(count).toHaveBeenCalledWith({ where: { shopId: 'shop-1', status: 'PUBLISHED' } })
  })
})
