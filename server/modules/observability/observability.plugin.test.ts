import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { createObservabilityPlugin } from '#server/plugins/observability.plugin.ts'
import { MetricsCollector } from './metrics.collector.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(environment = 'test'): AppContext {
  return {
    logger: createLogger(),
    config: { environment },
  }
}

function createApp(appContext = createAppContext(), metrics = new MetricsCollector(), slowRequestMs = 10_000) {
  return new Elysia()
    .use(createObservabilityPlugin(appContext, metrics, {
      requestLoggingEnabled: true,
      slowRequestMs,
      metricsEnabled: true,
      healthCheckTimeoutMs: 100,
    }))
    .get('/ok', ({ requestId }: any) => ({ requestId }))
    .get('/error', () => {
      throw new Error('boom token=secret')
    })
    .get('/slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return { ok: true }
    })
}

describe('observability plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds requestId to logs, response header, and context', async () => {
    const appContext = createAppContext()
    const response = await createApp(appContext).handle(new Request('http://localhost/ok', {
      headers: { 'x-request-id': 'req-test' },
    }))
    const body = await response.json()

    expect(response.headers.get('x-request-id')).toBe('req-test')
    expect(body.requestId).toBe('req-test')
    expect(appContext.logger.info).toHaveBeenCalledWith('HTTP request completed', expect.objectContaining({
      requestId: 'req-test',
      path: '/ok',
    }))
  })

  it('error response includes requestId and hides token in production', async () => {
    const appContext = createAppContext('production')
    const response = await createApp(appContext).handle(new Request('http://localhost/error', {
      headers: { 'x-request-id': 'req-error' },
    }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toMatchObject({
      code: 'INVALID_REQUEST',
      message: 'Request failed',
      requestId: 'req-error',
    })
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(appContext.logger.error).toHaveBeenCalledWith('HTTP request failed', expect.objectContaining({
      requestId: 'req-error',
      path: '/error',
    }))
  })

  it('logs slow requests when threshold is exceeded', async () => {
    const appContext = createAppContext()
    await createApp(appContext, new MetricsCollector(), 1).handle(new Request('http://localhost/slow', {
      headers: { 'x-request-id': 'req-slow' },
    }))

    expect(appContext.logger.warn).toHaveBeenCalledWith('Slow HTTP request', expect.objectContaining({
      requestId: 'req-slow',
      path: '/slow',
    }))
  })
})
