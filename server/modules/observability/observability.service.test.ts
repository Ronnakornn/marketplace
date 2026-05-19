import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { IHealthCheckRepository } from './observability.repository.ts'
import { MetricsCollector } from './metrics.collector.ts'
import { ObservabilityService } from './observability.service.ts'

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

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IHealthCheckRepository {
  return {
    checkDatabase: vi.fn(async () => true),
    checkRedis: vi.fn(async () => true),
  }
}

let appContext: AppContext
let repo: IHealthCheckRepository
let metrics: MetricsCollector
let service: ObservabilityService

describe('ObservabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    appContext = createAppContext()
    repo = createRepoMock()
    metrics = new MetricsCollector()
    service = new ObservabilityService(appContext, repo, metrics, {
      metricsEnabled: true,
      healthCheckTimeoutMs: 100,
      queueConfig: null,
    })
  })

  it('health endpoint returns ok', () => {
    const result = service.getHealth()

    expect(result.status).toBe('ok')
    expect(result.services).toEqual({ api: 'ok', database: 'ok' })
    expect(result.timestamp).toEqual(expect.any(String))
  })

  it('live endpoint returns ok', () => {
    expect(service.getLiveness().status).toBe('ok')
  })

  it('ready endpoint checks database', async () => {
    const result = await service.getReadiness()

    expect(repo.checkDatabase).toHaveBeenCalledWith(100)
    expect(result.status).toBe('ok')
    expect(result.services.database).toBe('ok')
  })

  it('ready endpoint returns down when database fails', async () => {
    vi.mocked(repo.checkDatabase).mockResolvedValue(false)

    const result = await service.getReadiness()

    expect(result.status).toBe('down')
    expect(result.services.database).toBe('down')
    expect(appContext.logger.warn).toHaveBeenCalled()
  })

  it('ready endpoint checks Redis and returns degraded when queue dependency fails', async () => {
    service = new ObservabilityService(appContext, repo, metrics, {
      metricsEnabled: true,
      healthCheckTimeoutMs: 100,
      queueConfig: {
        redisUrl: 'redis://localhost:6379',
        attempts: 3,
        concurrency: 1,
        skipRedisVersionCheck: true,
      },
    })
    vi.mocked(repo.checkRedis).mockResolvedValue(false)

    const result = await service.getReadiness()

    expect(repo.checkRedis).toHaveBeenCalledWith('redis://localhost:6379', 100)
    expect(result.status).toBe('degraded')
    expect(result.services.redis).toBe('down')
    expect(result.services.queue).toBe('down')
  })

  it('metrics endpoint returns basic metrics', () => {
    metrics.recordRequest(25, 200, 500)

    const result = service.getMetrics()

    expect(result.requests.total).toBe(1)
    expect(result.requests.averageDurationMs).toBe(25)
    expect(result.health.status).toBe('ok')
  })

  it('metrics can be disabled', () => {
    service = new ObservabilityService(appContext, repo, metrics, {
      metricsEnabled: false,
      healthCheckTimeoutMs: 100,
      queueConfig: null,
    })

    expect(() => service.getMetrics()).toThrow(expect.objectContaining({ code: 'METRICS_DISABLED' }))
  })
})
