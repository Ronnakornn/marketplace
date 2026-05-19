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
    metricsEnabled: parseBoolean(env['METRICS_ENABLED'], env['NODE_ENV'] !== 'production'),
    healthCheckTimeoutMs: parsePositiveInteger(env['HEALTH_CHECK_TIMEOUT_MS'], 1000),
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}
