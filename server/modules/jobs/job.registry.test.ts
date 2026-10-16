import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeepJobs } from 'bullmq'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { MetricsCollector } from '#server/modules/observability/metrics.collector.ts'

const fake = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  schedulers: vi.fn().mockResolvedValue(undefined),
  queueOptions: vi.fn(),
}))

vi.mock('bullmq', () => ({
  Worker: class { on(event: string, listener: (...args: unknown[]) => void) { fake.listeners.set(event, listener); return this } },
  Queue: class {
    constructor(_name: string, options: unknown) { fake.queueOptions(options) }
    upsertJobScheduler = fake.schedulers
  },
  QueueEvents: class { on() { return this } },
}))
vi.mock('#server/modules/queue/queue.connection.ts', () => ({ createRedisConnection: vi.fn(() => ({})) }))

import { createJobWorker, ensureRecurringJobSchedulers } from './job.registry.ts'

describe('job worker observability and recurring recovery', () => {
  beforeEach(() => { fake.listeners.clear(); fake.schedulers.mockClear() })

  it('counts each completion and failed attempt through the worker event boundary', () => {
    const metricsCollector = new MetricsCollector()
    const logger = { info: vi.fn(), error: vi.fn() }
    const container = { appContext: { logger }, metricsCollector } as unknown as ServiceContainer
    createJobWorker(container, { redisUrl: 'redis://localhost:6381/1', concurrency: 1, attempts: 2, skipRedisVersionCheck: false })
    const job = { id: 'job-1', name: 'send_email', opts: { attempts: 2 }, attemptsMade: 1 }

    fake.listeners.get('completed')!(job)
    fake.listeners.get('failed')!(job, new Error('temporary error'))
    fake.listeners.get('failed')!({ ...job, attemptsMade: 2 }, new Error('permanent error'))

    expect(metricsCollector.snapshot().queueJobs).toEqual({ success: 1, failure: 2 })
    expect(logger.error).toHaveBeenLastCalledWith('Job worker failed job', expect.objectContaining({ exhausted: true, code: 'JOB_RETRY_EXHAUSTED' }))
  })

  it('installs durable earnings recovery every minute alongside existing schedulers', async () => {
    await ensureRecurringJobSchedulers({ redisUrl: 'redis://localhost:6381/1', concurrency: 1, attempts: 2, skipRedisVersionCheck: false })
    expect(fake.schedulers).toHaveBeenCalledWith('reconcile-seller-earnings', { every: 60_000 }, { name: 'reconcile_seller_earnings', data: { limit: 100 } })
    expect(fake.schedulers).toHaveBeenCalledWith('process-admin-report-schedules', { every: 60_000 }, { name: 'process_admin_report_schedules', data: {} })
    expect(fake.schedulers).toHaveBeenCalledWith('prepare-admin-payouts', { every: 60_000 }, { name: 'prepare_admin_payouts', data: {} })
    expect(fake.schedulers).toHaveBeenCalledTimes(5)
    expect(fake.queueOptions).toHaveBeenLastCalledWith(expect.objectContaining({ defaultJobOptions: { removeOnComplete: 1000 } }))
  })

  it('the installed BullMQ merges success retention into every scheduler and preserves failure retention', async () => {
    const { Queue, Scripts } = await vi.importActual<typeof import('bullmq')>('bullmq')
    class RetentionScripts extends Scripts {
      public override getKeepJobs(shouldRemove: undefined | boolean | number | KeepJobs, workerKeepJobs: undefined | KeepJobs) {
        return super.getKeepJobs(shouldRemove, workerKeepJobs)
      }
    }
    await ensureRecurringJobSchedulers({ redisUrl: 'redis://unused', concurrency: 1, attempts: 2, skipRedisVersionCheck: false })
    const capture = vi.fn()
    for (const [id, repeat, template] of fake.schedulers.mock.calls) {
      const queue = {
        jobsOpts: fake.queueOptions.mock.calls.at(-1)?.[0].defaultJobOptions,
        jobScheduler: Promise.resolve({ upsertJobScheduler: capture }),
      }
      await Reflect.apply(Queue.prototype.upsertJobScheduler, queue, [id, repeat, template])
    }
    expect(capture).toHaveBeenCalledTimes(5)
    for (const call of capture.mock.calls) {
      expect(call[4]).toEqual({ removeOnComplete: 1000 })
      expect(RetentionScripts.prototype.getKeepJobs(call[4].removeOnComplete, undefined)).toEqual({ count: 1000 })
      expect(RetentionScripts.prototype.getKeepJobs(call[4].removeOnFail, undefined)).toEqual({ count: -1 })
    }
  })
})
