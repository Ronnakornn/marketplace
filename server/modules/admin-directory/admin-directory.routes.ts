import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import { SupportTicketPlain } from '#generated/prismabox/SupportTicket.ts'
import { TicketMessagePlain } from '#generated/prismabox/TicketMessage.ts'
import type { AdminDirectoryService } from './admin-directory.service.ts'

export async function directoryActor(request: Request) {
  const context = await getAuthContext(request.headers)
  if (!context)
    throw new AdminAccessError('Authentication required', 401, 'AUTH_REQUIRED')
  return context.user
}
const query = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})
export const adminDirectoryPermissions = {
  buyer: 'users.read',
  shop: 'shops.read',
  notice: 'shops.write',
} as const
export function createAdminDirectoryRoutes(container: {
  adminDirectoryService: AdminDirectoryService
}) {
  const service = container.adminDirectoryService
  return new Elysia({ name: 'admin-directory-routes' })
    .use(authPlugin)
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .get(
      '/api/admin/directory/users/:userId',
      async ({ request, params, query }) =>
        service.buyer(
          await directoryActor(request),
          params.userId,
          query.page,
          query.limit,
        ),
      {
        withRole: 'ADMIN',
        params: t.Object({ userId: t.String({ format: 'uuid' }) }),
        query,
      },
    )
    .get(
      '/api/admin/directory/shops/:shopId',
      async ({ request, params, query }) =>
        service.shop(
          await directoryActor(request),
          params.shopId,
          query.page,
          query.limit,
        ),
      {
        withRole: 'ADMIN',
        params: t.Object({ shopId: t.String({ format: 'uuid' }) }),
        query,
      },
    )
    .post(
      '/api/admin/directory/shops/:shopId/notices',
      async ({ request, params, body }) =>
        service.notice(await directoryActor(request), params.shopId, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ shopId: t.String({ format: 'uuid' }) }),
        body: t.Object({
          ...t.Pick(SupportTicketPlain, ['subject']).properties,
          ...t.Pick(TicketMessagePlain, ['body']).properties,
        }),
      },
    )
}
