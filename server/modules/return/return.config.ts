export interface ReturnConfig {
  windowDays: number
}

export function getReturnConfigFromEnv(env: Record<string, string | undefined> = process.env): ReturnConfig {
  const configured = env['RETURN_WINDOW_DAYS']
  if (configured === undefined) return { windowDays: 7 }
  const windowDays = Number(configured)
  if (!/^\d+$/.test(configured) || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) {
    throw new Error('RETURN_WINDOW_DAYS must be an integer between 1 and 365')
  }
  return { windowDays }
}
