import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { QueueConfig } from '#server/modules/queue'
import type { MetricsCollector, MetricsSnapshot } from './metrics.collector.ts'
import { ObservabilityError } from './observability.errors.ts'
import type { IHealthCheckRepository } from './observability.repository.ts'

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  uptime: number
  timestamp: string
  services: {
    api: 'ok'
    database: 'ok' | 'down'
    databaseSchema?: 'ok' | 'down'
    redis?: 'ok' | 'down'
    queue?: 'ok' | 'down'
  }
}

export interface ObservabilityOptions {
  metricsEnabled: boolean
  healthCheckTimeoutMs: number
  queueConfig?: QueueConfig | null
}

export class ObservabilityService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IHealthCheckRepository,
    private metrics: MetricsCollector,
    private options: ObservabilityOptions,
  ) {
    this.logger = appContext.logger
  }

  getHealth(): HealthResponse {
    const response: HealthResponse = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: 'ok',
      },
    }
    this.metrics.setHealthStatus(response.status)
    return response
  }

  getLiveness(): HealthResponse {
    return this.getHealth()
  }

  async getReadiness(): Promise<HealthResponse> {
    const databaseOk = await this.repo.checkDatabase(this.options.healthCheckTimeoutMs)
    const databaseSchemaOk = databaseOk
      ? await this.repo.checkDatabaseSchema(this.options.healthCheckTimeoutMs)
      : false
    const services: HealthResponse['services'] = {
      api: 'ok',
      database: databaseOk ? 'ok' : 'down',
      databaseSchema: databaseSchemaOk ? 'ok' : 'down',
    }

    if (this.options.queueConfig) {
      const redisOk = await this.repo.checkRedis(this.options.queueConfig.redisUrl, this.options.healthCheckTimeoutMs)
      services.redis = redisOk ? 'ok' : 'down'
      services.queue = redisOk ? 'ok' : 'down'
    }

    const status = this.calculateStatus(services)
    const response: HealthResponse = {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services,
    }
    this.metrics.setHealthStatus(status)
    if (status !== 'ok') {
      this.logger.warn('Readiness check is not healthy', { status, services })
    }
    return response
  }

  getMetrics(): MetricsSnapshot {
    if (!this.options.metricsEnabled) {
      throw new ObservabilityError('Metrics endpoint is disabled', 404, 'METRICS_DISABLED')
    }
    return this.metrics.snapshot()
  }

  private calculateStatus(services: HealthResponse['services']): HealthResponse['status'] {
    if (services.database === 'down' || services.databaseSchema === 'down') return 'down'
    if (services.redis === 'down' || services.queue === 'down') return 'degraded'
    return 'ok'
  }
}
