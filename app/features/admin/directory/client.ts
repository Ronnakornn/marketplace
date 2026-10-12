import { treaty } from '@elysiajs/eden'
import type { createAdminDirectoryRoutes } from '#server/modules/admin-directory/admin-directory.routes'

export const directoryApi = treaty<
  ReturnType<typeof createAdminDirectoryRoutes>
>(
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    : window.location.origin,
  { fetch: { credentials: 'include' } },
)
