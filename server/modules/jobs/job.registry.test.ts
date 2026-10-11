import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { MetricsCollector } from '#server/modules/observability/metrics.collector.ts'

const fake = vi.hoisted(() => ({
  listeners: new Map<string, (...args: unknown[]) => void>(),
  schedulers: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bullmq', () => ({
  Worker: class { on(event: string, listener: (...args: unknown[]) => void) { fake.listeners.set(event, listener); return this } },
  Queue: class { upsertJobScheduler = fake.schedulers },
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
    expect(fake.schedulers).toHaveBeenCalledTimes(3)
  })
})
