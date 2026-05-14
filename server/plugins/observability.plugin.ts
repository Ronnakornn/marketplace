import crypto from 'node:crypto'
import { Elysia } from 'elysia'
import type { AppContext } from '#server/context/app-context.ts'
import type { MetricsCollector } from '#server/modules/observability'
import type { ObservabilityConfig } from '#server/modules/observability/observability.config.ts'

const requestStartTimes = new WeakMap<Request, number>()

export function createObservabilityPlugin(
  appContext: AppContext,
  metrics: MetricsCollector,
  config: ObservabilityConfig,
) {
  return new Elysia({ name: 'observability' })
    .derive(({ request, set }) => {
      const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
      set.headers['x-request-id'] = requestId
      requestStartTimes.set(request, performance.now())
      return { requestId }
    })
    .onAfterHandle(({ request, requestId, set }: any) => {
      const durationMs = getDurationMs(request)
      const statusCode = Number(set.status ?? 200)
      metrics.recordRequest(durationMs, statusCode, config.slowRequestMs)

      if (config.requestLoggingEnabled) {
        appContext.logger.info('HTTP request completed', {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          statusCode,
          durationMs,
        })
      }

      if (durationMs >= config.slowRequestMs) {
        appContext.logger.warn('Slow HTTP request', {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          statusCode,
          durationMs,
        })
      }
    })
    .onError(({ error, request, requestId, set }: any) => {
      const durationMs = getDurationMs(request)
      metrics.recordError()
      appContext.logger.error('HTTP request failed', {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      })

      if (!set.headers) set.headers = {}
      set.headers['x-request-id'] = requestId

      return {
        error: {
          code: 'INVALID_REQUEST',
          message: appContext.config.environment === 'production' ? 'Request failed' : safeErrorMessage(error),
          requestId,
        },
      }
    })
    .as('global')
}

function getDurationMs(request: Request): number {
  const start = requestStartTimes.get(request) ?? performance.now()
  return Number((performance.now() - start).toFixed(2))
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|token|secret|authorization)=([^&\s]+)/gi, '$1=[REDACTED]')
}
