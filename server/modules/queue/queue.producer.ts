import { Queue, type JobsOptions } from 'bullmq'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { QueueConfig } from './queue.config.ts'
import { createRedisConnection } from './queue.connection.ts'
import { QueueError } from './queue.errors.ts'

export interface QueueProducer {
  enqueue<TPayload extends object>(jobName: string, payload: TPayload, options?: JobsOptions): Promise<{ id?: string }>
  close(): Promise<void>
}

export class BullMqQueueProducer implements QueueProducer {
  private logger: ILogger
  private queue: Queue

  constructor(
    appContext: AppContext,
    config: QueueConfig,
    queueName = 'marketplace-jobs',
  ) {
    this.logger = appContext.logger
    this.queue = new Queue(queueName, {
      connection: createRedisConnection(config),
      defaultJobOptions: getDefaultJobOptions(config),
      skipVersionCheck: config.skipRedisVersionCheck,
    })
  }

  async enqueue<TPayload extends object>(
    jobName: string,
    payload: TPayload,
    options?: JobsOptions,
  ): Promise<{ id?: string }> {
    this.logger.info('BullMqQueueProducer.enqueue', { jobName })
    const job = await this.queue.add(jobName, payload, options)
    return { id: job.id }
  }

  async close(): Promise<void> {
    await this.queue.close()
  }
}

export class OptionalQueueProducer implements QueueProducer {
  constructor(private delegate: QueueProducer | null) {}

  enqueue<TPayload extends object>(jobName: string, payload: TPayload, options?: JobsOptions): Promise<{ id?: string }> {
    if (!this.delegate) {
      throw new QueueError('Redis queue is not configured', 'QUEUE_CONFIG_MISSING')
    }
    return this.delegate.enqueue(jobName, payload, options)
  }

  async close(): Promise<void> {
    await this.delegate?.close()
  }
}

export function getDefaultJobOptions(config: Pick<QueueConfig, 'attempts'>): JobsOptions {
  return {
    attempts: config.attempts,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
    removeOnComplete: 1000,
    removeOnFail: false,
  }
}
