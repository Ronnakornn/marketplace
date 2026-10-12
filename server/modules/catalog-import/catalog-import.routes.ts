import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { moneyResponse } from '#server/lib/money.ts'
import { reportingActor as actor } from '#server/modules/admin-reporting/reporting.actor.ts'
import type { CatalogImportService } from './catalog-import.service.ts'
import { reportingHttpError } from '#server/modules/admin-reporting/reporting.http.ts'
const mode = t.Union([
  t.Literal('PRICE'),
  t.Literal('STOCK'),
  t.Literal('CONTENT'),
  t.Literal('CREATE'),
  t.Literal('ARCHIVE'),
])
const format = t.Union([t.Literal('CSV'), t.Literal('XLSX')])
const download = (bytes: Uint8Array, name: string, format: 'CSV' | 'XLSX') =>
  new Response(new Uint8Array(bytes).buffer, {
    headers: {
      'Content-Type':
        format === 'CSV'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}.${format.toLowerCase()}"`,
      'Cache-Control': 'private, no-store',
    },
  })
export function createCatalogImportRoutes(service: CatalogImportService) {
  return new Elysia({ name: 'catalog-import' })
    .use(authPlugin)
    .onError(({ error }) => reportingHttpError(error))
    .get(
      '/api/admin/catalog/imports',
      (context) => moneyResponse(service.list(actor(context))),
      { withRole: 'ADMIN' },
    )
    .post(
      '/api/admin/catalog/imports/preview',
      (context) => moneyResponse(service.preview(actor(context), context.body)),
      {
        withRole: 'ADMIN',
        body: t.Object({
          shopId: t.String({ format: 'uuid' }),
          mode,
          format,
          contentBase64: t.String({ maxLength: 2_700_000 }),
          requestKey: t.String({ minLength: 8, maxLength: 120 }),
        }),
      },
    )
    .get(
      '/api/admin/catalog/imports/:id',
      (context) =>
        moneyResponse(service.get(actor(context), context.params.id)),
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
      },
    )
    .post(
      '/api/admin/catalog/imports/:id/commit',
      (context) =>
        moneyResponse(
          service.commit(
            actor(context),
            context.params.id,
            context.body.previewFingerprint,
          ),
        ),
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Object({
          previewFingerprint: t.String({ pattern: '^[a-f0-9]{64}$' }),
        }),
      },
    )
    .get(
      '/api/admin/catalog/import-template',
      async (context) =>
        download(
          await service.template(
            actor(context),
            context.query.mode,
            context.query.format,
          ),
          `catalog-${context.query.mode.toLowerCase()}-template`,
          context.query.format,
        ),
      { withRole: 'ADMIN', query: t.Object({ mode, format }) },
    )
    .get(
      '/api/admin/catalog/export',
      async (context) =>
        download(
          await service.export(
            actor(context),
            context.query.shopId,
            context.query.format,
          ),
          'catalog',
          context.query.format,
        ),
      {
        withRole: 'ADMIN',
        query: t.Object({ shopId: t.String({ format: 'uuid' }), format }),
      },
    )
}
