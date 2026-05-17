import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'

const AiSearchBodySchema = t.Object({
  query: t.String(),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

const ShoppingAssistantBodySchema = t.Object({
  messages: t.Array(t.Object({
    role: t.Union([t.Literal('user'), t.Literal('assistant')]),
    content: t.String(),
  })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createAiSearchRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof AiSearchServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/ai-search', ({ body }) =>
      container.aiSearchService.search(body), {
      body: AiSearchBodySchema,
    })
    .post('/api/shopping-assistant', ({ body }) =>
      container.shoppingAssistantService.answer(body), {
      body: ShoppingAssistantBodySchema,
    })
}
