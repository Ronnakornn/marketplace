import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { ProductQuestionServiceError } from './product-question.errors.ts'
import { createProductQuestionRoutes } from './product-question.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
  getSocialProviderAvailability: () => ({}),
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createContainer() {
  return {
    productQuestionService: {
      listProductQuestions: vi.fn().mockResolvedValue({ items: [] }),
      createQuestion: vi.fn().mockResolvedValue({ id: 'question-1' }),
      createAnswer: vi.fn().mockResolvedValue({ id: 'answer-1' }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createProductQuestionRoutes(container))
}

function mockAuth() {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: 'buyer-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
    },
  } as any)
}

describe('product question routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows public product question listing', async () => {
    const container = createContainer()
    const response = await createApp(container).handle(
      new Request('http://localhost/api/products/22222222-2222-4222-8222-222222222222/questions'),
    )

    expect(response.status).toBe(200)
    expect(container.productQuestionService.listProductQuestions)
      .toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', {})
  })

  it('passes public product question discovery query controls to the service', async () => {
    const container = createContainer()
    const response = await createApp(container).handle(
      new Request('http://localhost/api/products/22222222-2222-4222-8222-222222222222/questions?answerStatus=answered&sort=oldest&page=2&limit=10'),
    )

    expect(response.status).toBe(200)
    expect(container.productQuestionService.listProductQuestions)
      .toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', {
        answerStatus: 'answered',
        sort: 'oldest',
        page: 2,
        limit: 10,
      })
  })

  it('rejects invalid public product question discovery query controls', async () => {
    const response = await createApp().handle(
      new Request('http://localhost/api/products/22222222-2222-4222-8222-222222222222/questions?answerStatus=maybe&limit=30'),
    )

    expect(response.status).toBe(422)
  })

  it('requires auth for buyer question creation', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const container = createContainer()
    const response = await createApp(container).handle(new Request(
      'http://localhost/api/products/22222222-2222-4222-8222-222222222222/questions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'Does it fit?' }),
      },
    ))

    expect(response.status).toBe(401)
    expect(container.productQuestionService.createQuestion).not.toHaveBeenCalled()
  })

  it('passes buyer question creation to the service', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request(
      'http://localhost/api/products/22222222-2222-4222-8222-222222222222/questions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: 'Does it fit?' }),
      },
    ))

    expect(response.status).toBe(200)
    expect(container.productQuestionService.createQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'buyer-1' }),
      '22222222-2222-4222-8222-222222222222',
      { question: 'Does it fit?' },
    )
  })

  it('requires auth for seller answer creation', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const container = createContainer()
    const response = await createApp(container).handle(new Request(
      'http://localhost/api/products/questions/11111111-1111-4111-8111-111111111111/answers',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'Yes' }),
      },
    ))

    expect(response.status).toBe(401)
    expect(container.productQuestionService.createAnswer).not.toHaveBeenCalled()
  })

  it('maps service errors to stable error responses', async () => {
    mockAuth()
    const container = createContainer()
    container.productQuestionService.createAnswer.mockRejectedValue(
      new ProductQuestionServiceError('Question not found', 404, 'QUESTION_NOT_FOUND'),
    )

    const response = await createApp(container).handle(new Request(
      'http://localhost/api/products/questions/11111111-1111-4111-8111-111111111111/answers',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'Yes' }),
      },
    ))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({
      error: {
        code: 'QUESTION_NOT_FOUND',
        message: 'Question not found',
        details: {},
      },
    })
  })
})
