import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { DiscoveryServiceError } from './discovery.errors.ts'

const DiscoveryHomeQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
  locale: t.Optional(t.Union([t.Literal('th'), t.Literal('en')])),
})

export function createDiscoveryRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof DiscoveryServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/discovery/home', ({ query }: any) =>
      container.discoveryService.getHome(query), {
      query: DiscoveryHomeQuerySchema,
    })
}
