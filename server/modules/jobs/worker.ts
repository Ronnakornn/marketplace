import { Elysia } from 'elysia'
import { createContainer } from '#server/context/app-context.ts'
import { createJobQueueEvents, createJobWorker, ensureRecurringJobSchedulers } from '#server/modules/jobs'
import { getQueueConfigFromEnv } from '#server/modules/queue'
import { createObservabilityRoutes } from '#server/modules/observability'
import { getWorkerMetricsPortFromEnv } from './worker.config.ts'

const metricsPort = getWorkerMetricsPortFromEnv()
const container = createContainer()
const logger = container.appContext.logger
const config = getQueueConfigFromEnv()

if (!config) {
  logger.warn('Job worker not started because Redis is not configured', {
    code: 'QUEUE_CONFIG_MISSING',
  })
  process.exit(0)
}

const worker = createJobWorker(container, config)
const events = createJobQueueEvents(container, config)
const schedulerQueue = await ensureRecurringJobSchedulers(config)
const metricsServer = metricsPort === null ? null : new Elysia().use(createObservabilityRoutes(container)).listen({
  port: metricsPort,
  ...(process.env['LOCAL_PRODUCTION'] === 'true' ? { hostname: '127.0.0.1' } : {}),
})
if (metricsServer) {
  logger.info('Job worker metrics listening', { port: metricsPort })
}

logger.info('Job worker running', {
  concurrency: config.concurrency,
  attempts: config.attempts,
  skipRedisVersionCheck: config.skipRedisVersionCheck,
})

async function shutdown(signal: string): Promise<void> {
  logger.info('Job worker shutting down', { signal })
  await Promise.all([
    worker.close(),
    events.close(),
    schedulerQueue.close(),
    metricsServer?.stop(),
  ])
}

process.on('SIGINT', () => void shutdown('SIGINT').then(() => process.exit(0)))
process.on('SIGTERM', () => void shutdown('SIGTERM').then(() => process.exit(0)))
