import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { SecurityError } from '#server/modules/security'
import { ProductQuestionServiceError } from './product-question.errors.ts'

const ProductParamsSchema = t.Object({
  productId: t.String({ format: 'uuid' }),
})

const QuestionParamsSchema = t.Object({
  questionId: t.String({ format: 'uuid' }),
})

const ListProductQuestionsQuerySchema = t.Object({
  answerStatus: t.Optional(t.Union([
    t.Literal('all'),
    t.Literal('answered'),
    t.Literal('unanswered'),
  ])),
  sort: t.Optional(t.Union([
    t.Literal('latest'),
    t.Literal('oldest'),
  ])),
  page: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
})

const CreateQuestionBodySchema = t.Object({
  question: t.String(),
})

const CreateAnswerBodySchema = t.Object({
  answer: t.String(),
})

function productQuestionActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

function errorResponse(error: ProductQuestionServiceError | SecurityError) {
  return httpStatus(error.status, {
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? {},
    },
  })
}

export function createProductQuestionRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ProductQuestionServiceError || error instanceof SecurityError) {
        return errorResponse(error)
      }
    })
    .get('/api/products/:productId/questions', ({ params, query }: any) =>
      container.productQuestionService.listProductQuestions(params.productId, query), {
      params: ProductParamsSchema,
      query: ListProductQuestionsQuerySchema,
    })
    .post('/api/products/:productId/questions', ({ authContext, params, body }: any) =>
      container.productQuestionService.createQuestion(productQuestionActor(authContext), params.productId, body), {
      withAuth: true,
      params: ProductParamsSchema,
      body: CreateQuestionBodySchema,
    })
    .post('/api/products/questions/:questionId/answers', ({ authContext, params, body }: any) =>
      container.productQuestionService.createAnswer(productQuestionActor(authContext), params.questionId, body), {
      withAuth: true,
      params: QuestionParamsSchema,
      body: CreateAnswerBodySchema,
    })
}
