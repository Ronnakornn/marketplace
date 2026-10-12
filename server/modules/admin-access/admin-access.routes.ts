import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessError } from './admin-access.errors.ts'
import type { AdminAccessService } from './admin-access.service.ts'
import { RuleWriteSchema, TeamWriteSchema } from './admin-access.schemas.ts'
import { signedDeviceIdentity } from './request-identity.ts'

async function actor(request: Request) {
  const context = await getAuthContext(request.headers)
  if (!context)
    throw new AdminAccessError(
      'Authentication is required',
      401,
      'AUTH_REQUIRED',
    )
  return context.user
}
const pagination = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 10000 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})
export function createAdminAccessRoutes(container: {
  adminAccessService: AdminAccessService
}) {
  const service = container.adminAccessService
  return new Elysia({ name: 'admin-access-routes' })
    .use(authPlugin)
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .get(
      '/api/admin/me/access',
      async ({ request }) => ({
        ...(await service.access(await actor(request))),
        deviceHash:
          signedDeviceIdentity(request, process.env.BETTER_AUTH_SECRET)
            .deviceHash ?? null,
      }),
      { withRole: 'ADMIN' },
    )
    .get(
      '/api/admin/team',
      async ({ request, query }) =>
        service.list(await actor(request), query.page, query.limit),
      { withRole: 'ADMIN', query: pagination },
    )
    .put(
      '/api/admin/team/:userId',
      async ({ request, params, body }) =>
        service.saveMember(await actor(request), params.userId, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ userId: t.String({ format: 'uuid' }) }),
        body: TeamWriteSchema,
      },
    )
    .get(
      '/api/admin/access-rules',
      async ({ request, query }) =>
        service.listRules(await actor(request), query.page, query.limit),
      { withRole: 'ADMIN', query: pagination },
    )
    .post(
      '/api/admin/access-rules',
      async ({ request, body }) =>
        service.saveRule(await actor(request), null, body),
      { withRole: 'ADMIN', body: RuleWriteSchema },
    )
    .put(
      '/api/admin/access-rules/:id',
      async ({ request, params, body }) =>
        service.saveRule(await actor(request), params.id, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: RuleWriteSchema,
      },
    )
}
