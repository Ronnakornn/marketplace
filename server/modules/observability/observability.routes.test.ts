import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createObservabilityRoutes } from './observability.routes.ts'

function createContainer() {
  return {
    observabilityService: {
      getHealth: vi.fn(() => ({ status: 'ok', uptime: 1, timestamp: '2026-05-14T00:00:00.000Z', services: { api: 'ok', database: 'ok' } })),
      getLiveness: vi.fn(() => ({ status: 'ok', uptime: 1, timestamp: '2026-05-14T00:00:00.000Z', services: { api: 'ok', database: 'ok' } })),
      getReadiness: vi.fn(async () => ({ status: 'ok', uptime: 1, timestamp: '2026-05-14T00:00:00.000Z', services: { api: 'ok', database: 'ok' } })),
      getMetrics: vi.fn(() => ({ requests: { total: 1, errors: 0, averageDurationMs: 10, slow: 0 } })),
    },
  } as any
}

describe('observability routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/health returns health', async () => {
    const container = createContainer()
    const response = await new Elysia().use(createObservabilityRoutes(container))
      .handle(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
    expect(container.observabilityService.getHealth).toHaveBeenCalled()
  })

  it('GET /api/health/live returns liveness', async () => {
    const container = createContainer()
    const response = await new Elysia().use(createObservabilityRoutes(container))
      .handle(new Request('http://localhost/api/health/live'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
    expect(container.observabilityService.getLiveness).toHaveBeenCalled()
  })

  it('GET /api/health/ready returns readiness', async () => {
    const container = createContainer()
    const response = await new Elysia().use(createObservabilityRoutes(container))
      .handle(new Request('http://localhost/api/health/ready'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
    expect(container.observabilityService.getReadiness).toHaveBeenCalled()
  })

  it('GET /api/metrics returns metrics', async () => {
    const container = createContainer()
    const response = await new Elysia().use(createObservabilityRoutes(container))
      .handle(new Request('http://localhost/api/metrics'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ requests: { total: 1 } })
  })
})
