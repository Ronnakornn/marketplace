import { describe, expect, it } from 'vitest'
import { getWorkerMetricsPortFromEnv } from './worker.config.ts'

describe('worker metrics listener port', () => {
  it('uses the default and explicit port only when metrics are enabled', () => {
    expect(getWorkerMetricsPortFromEnv({ NODE_ENV: 'production', METRICS_ENABLED: 'true' })).toBe(3002)
    expect(getWorkerMetricsPortFromEnv({ METRICS_ENABLED: 'true', METRICS_WORKER_PORT: '65535' })).toBe(65535)
    expect(getWorkerMetricsPortFromEnv({ METRICS_ENABLED: 'false', METRICS_WORKER_PORT: 'invalid' })).toBeNull()
    expect(getWorkerMetricsPortFromEnv({ NODE_ENV: 'production' })).toBeNull()
  })

  it.each(['', '0', '-1', '65536', '1.5', 'invalid', '0xbbb', ' 3002 '])('fails startup for invalid configured port %s', (value) => {
    expect(() => getWorkerMetricsPortFromEnv({ METRICS_ENABLED: 'true', METRICS_WORKER_PORT: value })).toThrow('METRICS_WORKER_PORT')
  })
})
