import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { SearchServiceError } from './search.errors.ts'

const SearchQuerySchema = t.Object({
  q: t.Optional(t.String()),
  categoryId: t.Optional(t.String()),
  brandId: t.Optional(t.String({ format: 'uuid' })),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  attributeFilters: t.Optional(t.String()),
  inStock: t.Optional(t.Boolean()),
  badges: t.Optional(t.String()),
  minPrice: t.Optional(t.Number({ minimum: 0 })),
  maxPrice: t.Optional(t.Number({ minimum: 0 })),
  rating: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
  sort: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  page: t.Optional(t.Number({ minimum: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

const SuggestionsQuerySchema = t.Object({
  q: t.Optional(t.String()),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createSearchRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof SearchServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/search/products', ({ query }: any) =>
      container.searchService.searchProducts(query), {
      query: SearchQuerySchema,
    })
    .get('/api/search/suggestions', ({ query }: any) =>
      container.searchService.getSuggestions(query), {
      query: SuggestionsQuerySchema,
    })
}
