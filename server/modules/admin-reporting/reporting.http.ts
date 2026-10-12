import { moneyHttpError } from '#server/lib/money.ts'
export function reportingHttpError(error: unknown) {
  if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    'code' in error &&
    typeof error.code === 'string'
  )
    return moneyHttpError(error.status, {
      error: { code: error.code, message: error.message },
    })
}
