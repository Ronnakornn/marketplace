export interface ObservabilityConfig {
  requestLoggingEnabled: boolean
  slowRequestMs: number
  metricsEnabled: boolean
  healthCheckTimeoutMs: number
}

export function getObservabilityConfigFromEnv(env: Record<string, string | undefined> = process.env): ObservabilityConfig {
  return {
    requestLoggingEnabled: env['REQUEST_LOGGING_ENABLED'] !== 'false',
    slowRequestMs: parsePositiveInteger(env['SLOW_REQUEST_MS'], 500),
    metricsEnabled: env['METRICS_ENABLED'] !== 'false',
    healthCheckTimeoutMs: parsePositiveInteger(env['HEALTH_CHECK_TIMEOUT_MS'], 1000),
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
