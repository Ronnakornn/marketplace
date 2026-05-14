export interface QueueConfig {
  redisUrl: string
  concurrency: number
  attempts: number
}

const defaultConcurrency = 5
const defaultAttempts = 3

export function getQueueConfigFromEnv(env: Record<string, string | undefined> = process.env): QueueConfig | null {
  const redisUrl = env['REDIS_URL']?.trim()
  if (!redisUrl) return null

  return {
    redisUrl,
    concurrency: parsePositiveInteger(env['JOB_CONCURRENCY'], defaultConcurrency),
    attempts: parsePositiveInteger(env['JOB_ATTEMPTS'], defaultAttempts),
  }
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
