import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaProductQuestionRepository } from './product-question.repository.ts'

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
  return new PrismaProductQuestionRepository(
    {
      logger: createLogger(),
      config: { environment: 'test' },
    } as any,
    prisma as any,
  )
}

describe('PrismaProductQuestionRepository public visibility filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only published questions with only published answers', async () => {
    const prisma = {
      productQuestion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }
    const repository = createRepository(prisma)

    await repository.listPublishedQuestions('product-1')

    expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        productId: 'product-1',
        status: 'PUBLISHED',
      },
      include: expect.objectContaining({
        user: expect.any(Object),
        answers: expect.objectContaining({
          where: {
            status: 'PUBLISHED',
          },
          include: expect.objectContaining({
            user: expect.any(Object),
          }),
          orderBy: {
            createdAt: 'asc',
          },
        }),
      }),
      orderBy: {
        createdAt: 'desc',
      },
    }))
  })

  it('finds answerable questions only when the question is published', async () => {
    const prisma = {
      productQuestion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }
    const repository = createRepository(prisma)

    await repository.findPublishedQuestionWithContext('question-1')

    expect(prisma.productQuestion.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'question-1',
        status: 'PUBLISHED',
      },
      include: expect.objectContaining({
        product: expect.any(Object),
      }),
    }))
  })
})
