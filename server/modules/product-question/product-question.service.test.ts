import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecurityError } from '#server/modules/security'
import { ProductQuestionServiceError } from './product-question.errors.ts'
import { ProductQuestionService } from './product-question.service.ts'
import type { IProductQuestionRepository } from './product-question.repository.ts'

const appContext = {
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  config: { environment: 'test' },
} as any

function createQuestion(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    shopId: '33333333-3333-4333-8333-333333333333',
    userId: 'buyer-1',
    question: 'Does it fit?',
    status: 'PUBLISHED',
    createdAt: now,
    updatedAt: now,
    user: { id: 'buyer-1', name: 'Buyer' },
    _count: { answers: 0 },
    answers: [],
    ...overrides,
  } as any
}

function createProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    shopId: '33333333-3333-4333-8333-333333333333',
    status: 'ACTIVE',
    shop: {
      id: '33333333-3333-4333-8333-333333333333',
      ownerId: 'seller-1',
      status: 'ACTIVE',
    },
    ...overrides,
  } as any
}

function createQuestionContext(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    productId: '22222222-2222-4222-8222-222222222222',
    shopId: '33333333-3333-4333-8333-333333333333',
    userId: 'buyer-1',
    question: 'Does it fit?',
    status: 'PUBLISHED',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    product: createProduct(),
    ...overrides,
  } as any
}

function createRepo(overrides: Partial<IProductQuestionRepository> = {}) {
  return {
    findActiveProductWithActiveShop: vi.fn().mockResolvedValue(createProduct()),
    listPublishedQuestions: vi.fn().mockResolvedValue({ items: [createQuestion()], totalCount: 1 }),
    listPublishedAnswers: vi.fn().mockResolvedValue([]),
    createPublishedQuestion: vi.fn(async (input: any) => createQuestion(input)),
    findPublishedQuestionWithContext: vi.fn().mockResolvedValue(createQuestionContext()),
    createPublishedAnswer: vi.fn(async (input: any) => ({
      id: '44444444-4444-4444-8444-444444444444',
      questionId: input.questionId,
      userId: input.userId,
      answer: input.answer,
      status: 'PUBLISHED',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      user: { id: input.userId, name: 'Seller' },
    })),
    ...overrides,
  } as unknown as IProductQuestionRepository
}

function createOwnershipGuards() {
  return {
    assertSellerOwnsShop: vi.fn().mockResolvedValue(undefined),
  } as any
}

function createService(repo = createRepo(), ownershipGuards = createOwnershipGuards()) {
  return new ProductQuestionService(appContext, repo, ownershipGuards)
}

describe('ProductQuestionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a bounded preview and walks every published answer across equal timestamps', async () => {
    const answers = Array.from({ length: 27 }, (_, index) => ({
      id: `44444444-4444-4444-8444-${String(index).padStart(12, '0')}`,
      answer: `Answer ${index}`, status: 'PUBLISHED', user: { id: 'seller', name: 'Seller' },
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    }))
    const repo = createRepo({
      listPublishedQuestions: vi.fn().mockResolvedValue({ items: [createQuestion({ answers: answers.slice(0, 3), _count: { answers: 27 } })], totalCount: 1 }),
      listPublishedAnswers: vi.fn(async (_questionId, input) => answers.filter(answer => !input.cursor || answer.id > input.cursor.id).slice(0, input.limit)) as never,
    })
    const service = createService(repo)
    const first = (await service.listProductQuestions('22222222-2222-4222-8222-222222222222')).items[0]
    expect(first.answerCount).toBe(27)
    expect(first.answers).toHaveLength(3)
    const seen = first.answers.map(answer => answer.id)
    let cursor = first.answersCursor
    while (cursor) {
      const page = await service.listQuestionAnswers(first.id, { cursor, limit: 5 })
      expect(page.items.length).toBeLessThanOrEqual(5)
      seen.push(...page.items.map(answer => answer.id))
      cursor = page.nextCursor
    }
    expect(seen).toEqual(answers.map(answer => answer.id))
    await expect(service.listQuestionAnswers(first.id, { cursor: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_PAGINATION' })
  })

  it('rejects malformed cursor UUIDs before any repository read', async () => {
    const repo = createRepo()
    const cursor = Buffer.from(JSON.stringify(['------------------------------------', '2026-01-01T00:00:00.000Z'])).toString('base64url')
    await expect(createService(repo).listQuestionAnswers('question', { cursor })).rejects.toMatchObject({ code: 'INVALID_PAGINATION', status: 400 })
    expect(repo.findPublishedQuestionWithContext).not.toHaveBeenCalled()
    expect(repo.listPublishedAnswers).not.toHaveBeenCalled()
  })

  it('rejects answer reads for hidden questions and inactive products', async () => {
    const repo = createRepo({ findPublishedQuestionWithContext: vi.fn().mockResolvedValue(null) })
    await expect(createService(repo).listQuestionAnswers('hidden')).rejects.toMatchObject({ code: 'QUESTION_NOT_FOUND' })
    expect(repo.listPublishedAnswers).not.toHaveBeenCalled()
    vi.mocked(repo.findPublishedQuestionWithContext).mockResolvedValue(createQuestionContext())
    vi.mocked(repo.findActiveProductWithActiveShop).mockResolvedValue(null)
    await expect(createService(repo).listQuestionAnswers('inactive')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
    expect(repo.listPublishedAnswers).not.toHaveBeenCalled()
  })

  it('lists published questions only after active product and active shop validation', async () => {
    const repo = createRepo()
    const response = await createService(repo).listProductQuestions('22222222-2222-4222-8222-222222222222')

    expect(repo.findActiveProductWithActiveShop).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222')
    expect(repo.listPublishedQuestions).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', {
      answerStatus: 'all',
      sort: 'latest',
      page: 1,
      limit: 5,
    })
    expect(response.items).toHaveLength(1)
    expect(response.meta).toEqual({
      page: 1,
      limit: 5,
      totalCount: 1,
      hasNextPage: false,
    })
    expect(response.items[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      status: 'PUBLISHED',
      user: { id: 'buyer-1', name: 'Buyer' },
    })
  })

  it('rejects public list when product is not active or shop is not active', async () => {
    const repo = createRepo({ findActiveProductWithActiveShop: vi.fn().mockResolvedValue(null) })

    await expect(createService(repo).listProductQuestions('22222222-2222-4222-8222-222222222222'))
      .rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND', status: 404 })
    expect(repo.listPublishedQuestions).not.toHaveBeenCalled()
  })

  it('trims and creates a published buyer question', async () => {
    const repo = createRepo()
    const response = await createService(repo).createQuestion(
      { id: 'buyer-1', role: 'USER' },
      '22222222-2222-4222-8222-222222222222',
      { question: '  Does it fit?  ' },
    )

    expect(repo.createPublishedQuestion).toHaveBeenCalledWith({
      productId: '22222222-2222-4222-8222-222222222222',
      shopId: '33333333-3333-4333-8333-333333333333',
      userId: 'buyer-1',
      question: 'Does it fit?',
    })
    expect(response.question).toBe('Does it fit?')
  })

  it('rejects blank buyer question text', async () => {
    const repo = createRepo()

    await expect(createService(repo).createQuestion(
      { id: 'buyer-1', role: 'USER' },
      '22222222-2222-4222-8222-222222222222',
      { question: '   ' },
    )).rejects.toMatchObject({ code: 'QUESTION_REQUIRED', status: 400 })
    expect(repo.findActiveProductWithActiveShop).not.toHaveBeenCalled()
  })

  it('enforces seller ownership before creating an answer', async () => {
    const repo = createRepo()
    const ownershipGuards = createOwnershipGuards()

    await createService(repo, ownershipGuards).createAnswer(
      { id: 'seller-1', role: 'USER' },
      '11111111-1111-4111-8111-111111111111',
      { answer: '  Yes, it fits.  ' },
    )

    expect(ownershipGuards.assertSellerOwnsShop).toHaveBeenCalledWith(
      'seller-1',
      '33333333-3333-4333-8333-333333333333',
    )
    expect(repo.createPublishedAnswer).toHaveBeenCalledWith({
      questionId: '11111111-1111-4111-8111-111111111111',
      userId: 'seller-1',
      answer: 'Yes, it fits.',
    })
  })

  it('rejects answer creation for non-owning sellers', async () => {
    const repo = createRepo()
    const ownershipGuards = createOwnershipGuards()
    ownershipGuards.assertSellerOwnsShop.mockRejectedValue(
      new SecurityError('Active seller shop access required', 403, 'FORBIDDEN'),
    )

    await expect(createService(repo, ownershipGuards).createAnswer(
      { id: 'seller-2', role: 'USER' },
      '11111111-1111-4111-8111-111111111111',
      { answer: 'No' },
    )).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 })
    expect(repo.createPublishedAnswer).not.toHaveBeenCalled()
  })

  it('rejects missing published question during answer creation', async () => {
    const repo = createRepo({ findPublishedQuestionWithContext: vi.fn().mockResolvedValue(null) })

    await expect(createService(repo).createAnswer(
      { id: 'seller-1', role: 'USER' },
      '11111111-1111-4111-8111-111111111111',
      { answer: 'Yes' },
    )).rejects.toMatchObject({ code: 'QUESTION_NOT_FOUND', status: 404 })
  })

  it('rejects blank seller answer text', async () => {
    const repo = createRepo()

    await expect(createService(repo).createAnswer(
      { id: 'seller-1', role: 'USER' },
      '11111111-1111-4111-8111-111111111111',
      { answer: '   ' },
    )).rejects.toBeInstanceOf(ProductQuestionServiceError)
    expect(repo.findPublishedQuestionWithContext).not.toHaveBeenCalled()
  })
})
