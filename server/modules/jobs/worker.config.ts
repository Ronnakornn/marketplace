import { getObservabilityConfigFromEnv } from '#server/modules/observability/observability.config.ts'

export function getWorkerMetricsPortFromEnv(env: Record<string, string | undefined> = process.env): number | null {
  if (!getObservabilityConfigFromEnv(env).metricsEnabled) return null
  const value = env['METRICS_WORKER_PORT'] ?? '3002'
  const port = Number(value)
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('METRICS_WORKER_PORT must be an integer between 1 and 65535')
  }
  return port
}
