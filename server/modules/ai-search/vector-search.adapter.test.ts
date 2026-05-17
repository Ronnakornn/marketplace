import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { PgVectorSearchAdapter } from './vector-search.adapter.ts'

function createAppContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

describe('PgVectorSearchAdapter', () => {
  it('rejoins live active product data and excludes inactive public records through Prisma constraints', async () => {
    const prisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ productId: 'p1', score: 0.9 }]),
      product: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    const adapter = new PgVectorSearchAdapter(createAppContext(), prisma as any)

    await adapter.searchProducts({
      embedding: [0.1, 0.2],
      limit: 5,
      locale: 'en',
      model: 'text-embedding-3-small',
    })

    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['p1'] },
        status: 'ACTIVE',
        shop: { status: 'ACTIVE' },
        variants: { some: { status: 'ACTIVE' } },
        OR: [
          { categoryId: null },
          { category: { isActive: true } },
        ],
      }),
    }))
  })
})
