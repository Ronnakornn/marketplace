import { Elysia, status as httpStatus } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { ObservabilityError } from './observability.errors.ts'

export function createObservabilityRoutes(container: ServiceContainer) {
  return new Elysia()
    .onError(({ error }) => {
      if (error instanceof ObservabilityError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/health', () => container.observabilityService.getHealth())
    .get('/api/health/live', () => container.observabilityService.getLiveness())
    .get('/api/health/ready', () => container.observabilityService.getReadiness())
    .get('/api/metrics', () => container.observabilityService.getMetrics())
}
