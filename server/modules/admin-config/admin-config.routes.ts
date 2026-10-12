import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import type { AdminConfigService } from './admin-config.service.ts'
import {
  FeatureKeySchema,
  SettingWriteSchema,
  TemplateWriteSchema,
  ToggleWriteSchema,
} from './admin-config.schemas.ts'

async function actor(request: Request) {
  const auth = await getAuthContext(request.headers)
  if (!auth)
    throw new AdminAccessError(
      'Authentication is required',
      401,
      'AUTH_REQUIRED',
    )
  return auth.user
}
export function createAdminConfigRoutes(container: {
  adminConfigService: AdminConfigService
}) {
  const service = container.adminConfigService
  return new Elysia({ name: 'admin-config-routes' })
    .use(authPlugin)
    .onError(({ error, status }) => {
      if (error instanceof AdminAccessError)
        return status(error.status, {
          error: { code: error.code, message: error.message },
        })
    })
    .get(
      '/api/admin/config/toggles',
      async ({ request }) => service.listToggles(await actor(request)),
      { withRole: 'ADMIN' },
    )
    .put(
      '/api/admin/config/toggles/:key',
      async ({ request, params, body }) =>
        service.saveToggle(await actor(request), params.key, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ key: FeatureKeySchema }),
        body: ToggleWriteSchema,
      },
    )
    .get(
      '/api/admin/config/settings',
      async ({ request }) => service.listSettings(await actor(request)),
      { withRole: 'ADMIN' },
    )
    .put(
      '/api/admin/config/settings',
      async ({ request, body }) =>
        service.saveSetting(await actor(request), body),
      { withRole: 'ADMIN', body: SettingWriteSchema },
    )
    .get(
      '/api/admin/config/templates',
      async ({ request, query }) =>
        service.listTemplates(await actor(request), query.page, query.limit),
      {
        withRole: 'ADMIN',
        query: t.Object({
          page: t.Optional(t.Numeric({ minimum: 1 })),
          limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
      },
    )
    .post(
      '/api/admin/config/templates',
      async ({ request, body }) =>
        service.saveTemplate(await actor(request), null, body),
      { withRole: 'ADMIN', body: TemplateWriteSchema },
    )
    .put(
      '/api/admin/config/templates/:id',
      async ({ request, params, body }) =>
        service.saveTemplate(await actor(request), params.id, body),
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: TemplateWriteSchema,
      },
    )
}
