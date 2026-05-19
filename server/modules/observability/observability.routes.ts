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
    .get('/api/metrics', ({ request }) => {
      assertMetricsAccess(request)
      return container.observabilityService.getMetrics()
    })
}

function assertMetricsAccess(request: Request): void {
  const token = process.env['METRICS_AUTH_TOKEN']?.trim()
  if (!token) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ObservabilityError('Metrics endpoint is unavailable', 404, 'METRICS_DISABLED')
    }
    return
  }

  const authorization = request.headers.get('authorization')?.trim()
  const headerToken = request.headers.get('x-metrics-token')?.trim()
  if (authorization === `Bearer ${token}` || headerToken === token) return
  throw new ObservabilityError('Metrics credentials are invalid', 401, 'METRICS_FORBIDDEN')
}
