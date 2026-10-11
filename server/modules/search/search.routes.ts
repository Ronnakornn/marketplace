import { moneyHttpError, moneyResponse, toMoneyDto, MoneyAmountError } from '#server/lib/money.ts'
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
  minPrice: t.Optional(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
  maxPrice: t.Optional(t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
  rating: t.Optional(t.Number({ minimum: 1, maximum: 5 })),
  sort: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  page: t.Optional(t.Integer({ minimum: 1, maximum: 2_147_483_647 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

const SuggestionsQuerySchema = t.Object({
  q: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createSearchRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof MoneyAmountError) return httpStatus(409, { error: { code: 'INVALID_MONEY_AMOUNT', message: error.message } })
      if (error instanceof SearchServiceError) {
        return moneyHttpError(error.status, toMoneyDto({
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        }))
      }
    })
    .get('/api/search/products', ({ query }: any) =>
      moneyResponse(container.searchService.searchProducts(query)), {
      query: SearchQuerySchema,
    })
    .get('/api/search/suggestions', ({ query }: any) =>
      moneyResponse(container.searchService.getSuggestions(query)), {
      query: SuggestionsQuerySchema,
    })
}
