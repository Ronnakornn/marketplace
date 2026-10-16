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
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
      productQuestion: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    }
    const repository = createRepository(prisma)

    await repository.listPublishedQuestions('product-1')

    expect(prisma.productQuestion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        productId: 'product-1',
        status: 'PUBLISHED',
        product: {
          status: 'ACTIVE',
          shop: {
            status: 'ACTIVE',
          },
        },
      },
      include: expect.objectContaining({
        _count: { select: { answers: { where: { status: 'PUBLISHED' } } } },
        user: expect.any(Object),
        answers: expect.objectContaining({
          where: {
            status: 'PUBLISHED',
          },
          include: expect.objectContaining({
            user: expect.any(Object),
          }),
          take: 3,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 5,
    }))
    expect(prisma.productQuestion.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        productId: 'product-1',
        status: 'PUBLISHED',
      }),
    }))
  })

  it('bounds answer continuation and excludes hidden parents with stable tie ordering', async () => {
    const prisma = { productAnswer: { findMany: vi.fn().mockResolvedValue([]) } }
    const cursor = { id: 'answer-1', createdAt: new Date('2026-01-01') }
    await createRepository(prisma).listPublishedAnswers('question-1', { cursor, limit: 11 })
    expect(prisma.productAnswer.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { questionId: 'question-1', status: 'PUBLISHED',
        question: { status: 'PUBLISHED', product: { status: 'ACTIVE', shop: { status: 'ACTIVE' } } },
        OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }],
      }, take: 11, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
