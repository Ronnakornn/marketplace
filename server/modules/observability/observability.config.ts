export interface ObservabilityConfig {
  requestLoggingEnabled: boolean
  successfulRequestSampleRate: number
  slowRequestMs: number
  metricsEnabled: boolean
  healthCheckTimeoutMs: number
}

export function getObservabilityConfigFromEnv(env: Record<string, string | undefined> = process.env): ObservabilityConfig {
  return {
    requestLoggingEnabled: env['REQUEST_LOGGING_ENABLED'] !== 'false',
    successfulRequestSampleRate: parseRate(
      env['SUCCESSFUL_REQUEST_LOG_SAMPLE_RATE'],
      env['NODE_ENV'] === 'production' ? 0.01 : 1,
    ),
    slowRequestMs: parsePositiveInteger(env['SLOW_REQUEST_MS'], 500),
    metricsEnabled: parseBoolean(env['METRICS_ENABLED'], env['NODE_ENV'] !== 'production'),
    healthCheckTimeoutMs: parsePositiveInteger(env['HEALTH_CHECK_TIMEOUT_MS'], 1000),
  }
}

function parseRate(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
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
