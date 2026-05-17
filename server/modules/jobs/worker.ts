import { createContainer } from '#server/context/app-context.ts'
import { createJobQueueEvents, createJobWorker } from '#server/modules/jobs'
import { getQueueConfigFromEnv } from '#server/modules/queue'

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
  ])
}

process.on('SIGINT', () => void shutdown('SIGINT').then(() => process.exit(0)))
process.on('SIGTERM', () => void shutdown('SIGTERM').then(() => process.exit(0)))
