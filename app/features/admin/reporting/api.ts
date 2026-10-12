import { treaty } from '@elysiajs/eden'
import type { createAdminReportingRoutes } from '#server/modules/admin-reporting/reporting.routes.ts'
import type { createCatalogImportRoutes } from '#server/modules/catalog-import/catalog-import.routes.ts'

const origin =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    : window.location.origin
export const reportingApi = treaty<
  ReturnType<typeof createAdminReportingRoutes>
>(origin, { parseDate: false, fetch: { credentials: 'include' } })
export const importApi = treaty<ReturnType<typeof createCatalogImportRoutes>>(
  origin,
  { fetch: { credentials: 'include' } },
)
export async function requireData<T>(
  request: Promise<{ data: T | null; error: unknown }>,
): Promise<NonNullable<T>> {
  const { data, error } = await request
  if (error || data === null || data === undefined) {
    const detail =
      error && typeof error === 'object' && 'value' in error
        ? error.value
        : null
    const body =
      detail && typeof detail === 'object' && 'error' in detail
        ? detail.error
        : null
    throw new Error(
      body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : 'Request failed',
    )
  }
  return data
}
