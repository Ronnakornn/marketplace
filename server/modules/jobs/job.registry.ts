import { QueueEvents, Worker, type Job } from 'bullmq'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { createRedisConnection } from '#server/modules/queue/queue.connection.ts'
import type { QueueConfig } from '#server/modules/queue/queue.config.ts'
import { jobNames, type AnyJobPayload, type JobName } from './job.types.ts'

export const queueName = 'marketplace-jobs'

export function isJobName(value: string): value is JobName {
  return (jobNames as readonly string[]).includes(value)
}

export function createJobWorker(container: ServiceContainer, config: QueueConfig): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job<AnyJobPayload>) => {
      if (!isJobName(job.name)) {
        throw new Error(`INVALID_JOB_PAYLOAD: unknown job ${job.name}`)
      }
      return container.jobService.process(job.name, job.data)
    },
    {
      connection: createRedisConnection(config),
      concurrency: config.concurrency,
    },
  )

  worker.on('active', (job) => {
    container.appContext.logger.info('Job worker started job', { jobName: job.name, jobId: job.id })
  })
  worker.on('completed', (job) => {
    container.appContext.logger.info('Job worker completed job', { jobName: job.name, jobId: job.id })
  })
  worker.on('failed', (job, error) => {
    const attemptsMade = job?.attemptsMade ?? 0
    const attemptsAllowed = job?.opts.attempts ?? config.attempts
    container.appContext.logger.error('Job worker failed job', {
      jobName: job?.name,
      jobId: job?.id,
      attemptsMade,
      attemptsAllowed,
      exhausted: attemptsMade >= attemptsAllowed,
      code: attemptsMade >= attemptsAllowed ? 'JOB_RETRY_EXHAUSTED' : 'JOB_FAILED',
      error: error.message,
    })
  })
  worker.on('error', (error) => {
    container.appContext.logger.error('Job worker error', { error: error.message })
  })

  return worker
}

export function createJobQueueEvents(container: ServiceContainer, config: QueueConfig): QueueEvents {
  const events = new QueueEvents(queueName, {
    connection: createRedisConnection(config),
  })
  events.on('failed', ({ jobId, failedReason }) => {
    container.appContext.logger.error('Job queue recorded failed job', {
      jobId,
      failedReason,
      code: 'JOB_FAILED',
    })
  })
  return events
}
