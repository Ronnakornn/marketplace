import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaReviewRepository } from './review.repository.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createRepository(prisma: unknown) {
  return new PrismaReviewRepository(
    {
      logger: createLogger(),
      config: { environment: 'test' },
    } as any,
    prisma as any,
  )
}

describe('PrismaReviewRepository public visibility filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only published product reviews', async () => {
    const prisma = {
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
      review: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    }
    const repository = createRepository(prisma)

    await repository.listProductReviews('product-1')

    expect(prisma.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        productId: 'product-1',
        status: 'PUBLISHED',
        product: {
          status: 'ACTIVE',
        },
      },
      include: expect.objectContaining({
        user: expect.any(Object),
        orderItem: expect.any(Object),
        media: expect.any(Object),
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 5,
    }))
    expect(prisma.review.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        productId: 'product-1',
        status: 'PUBLISHED',
      }),
    }))
  })

  it('builds rating distribution from only published reviews', async () => {
    const rows = [{ rating: 5, _count: { rating: 2 } }]
    const prisma = {
      review: {
        groupBy: vi.fn().mockResolvedValue(rows),
      },
    }
    const repository = createRepository(prisma)

    await expect(repository.getRatingDistribution('product-1')).resolves.toBe(rows)
    expect(prisma.review.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['rating'],
      where: {
        productId: 'product-1',
        status: 'PUBLISHED',
      },
      _count: {
        rating: true,
      },
    }))
  })
})
