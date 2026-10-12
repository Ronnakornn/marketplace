import { Elysia, t } from 'elysia'
import { authPlugin } from '#server/modules/auth'
import { moneyResponse } from '#server/lib/money.ts'
import { reportingActor as actor } from './reporting.actor.ts'
import { reportingHttpError } from './reporting.http.ts'
import type { AdminReportingService } from './reporting.service.ts'
import type { OrderDocumentsService } from './order-documents.service.ts'

const reportFiltersSchema = t.Object({
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  timeZone: t.Optional(t.Union([t.Literal('Asia/Bangkok'), t.Literal('UTC')])),
  group: t.Optional(
    t.Union([
      t.Literal('day'),
      t.Literal('month'),
      t.Literal('shop'),
      t.Literal('category'),
      t.Literal('product'),
      t.Literal('region'),
    ]),
  ),
  shopId: t.Optional(t.String({ format: 'uuid' })),
  categoryId: t.Optional(t.String({ format: 'uuid' })),
  productId: t.Optional(t.String({ format: 'uuid' })),
  region: t.Optional(t.String({ maxLength: 100 })),
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})
const format = t.Union([t.Literal('CSV'), t.Literal('XLSX')])
const scheduleSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  type: t.Literal('SALES'),
  format,
  filters: reportFiltersSchema,
  cadence: t.Union([
    t.Literal('DAILY'),
    t.Literal('WEEKLY'),
    t.Literal('MONTHLY'),
  ]),
  hour: t.Integer({ minimum: 0, maximum: 23 }),
  isActive: t.Optional(t.Boolean()),
})
export function createAdminReportingRoutes(
  service: AdminReportingService,
  documents: OrderDocumentsService,
) {
  return new Elysia({ name: 'admin-reporting' })
    .use(authPlugin)
    .onError(({ error }) => reportingHttpError(error))
    .get(
      '/api/admin/analytics',
      (context) => moneyResponse(service.query(actor(context), context.query)),
      { withRole: 'ADMIN', query: reportFiltersSchema },
    )
    .get(
      '/api/admin/report-exports',
      (context) => moneyResponse(service.listJobs(actor(context))),
      { withRole: 'ADMIN' },
    )
    .post(
      '/api/admin/report-exports',
      (context) =>
        moneyResponse(service.requestExport(actor(context), context.body)),
      {
        withRole: 'ADMIN',
        body: t.Object({
          type: t.Literal('SALES'),
          format,
          filters: reportFiltersSchema,
        }),
      },
    )
    .get(
      '/api/admin/report-exports/:id/download',
      async (context) => {
        const result = await service.download(actor(context), context.params.id)
        return new Response(new Uint8Array(result.bytes).buffer, {
          headers: {
            'Content-Type':
              result.format === 'CSV'
                ? 'text/csv; charset=utf-8'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${result.filename}"`,
            'Cache-Control': 'private, no-store',
          },
        })
      },
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
      },
    )
    .get(
      '/api/admin/report-schedules',
      (context) => moneyResponse(service.listSchedules(actor(context))),
      { withRole: 'ADMIN' },
    )
    .post(
      '/api/admin/report-schedules',
      (context) =>
        moneyResponse(service.saveSchedule(actor(context), context.body)),
      { withRole: 'ADMIN', body: scheduleSchema },
    )
    .put(
      '/api/admin/report-schedules/:id',
      (context) =>
        moneyResponse(
          service.saveSchedule(
            actor(context),
            context.body,
            context.params.id,
            context.body.expectedVersion,
          ),
        ),
      {
        withRole: 'ADMIN',
        params: t.Object({ id: t.String({ format: 'uuid' }) }),
        body: t.Composite([
          scheduleSchema,
          t.Object({ expectedVersion: t.Integer({ minimum: 1 }) }),
        ]),
      },
    )
    .get(
      '/api/admin/orders/:orderId/documents/:kind',
      async (context) => {
        const result = await documents.download(
          actor(context),
          context.params.orderId,
          context.params.kind,
          context.query.locale ?? 'en',
        )
        return new Response(result.html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Disposition': `attachment; filename="${result.number.replace(/[^a-zA-Z0-9-]/g, '_')}.html"`,
            'Cache-Control': 'private, no-store',
            'Content-Security-Policy':
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          },
        })
      },
      {
        withRole: 'ADMIN',
        params: t.Object({
          orderId: t.String({ format: 'uuid' }),
          kind: t.Union([t.Literal('INVOICE'), t.Literal('RECEIPT')]),
        }),
        query: t.Object({
          locale: t.Optional(t.Union([t.Literal('en'), t.Literal('th')])),
        }),
      },
    )
    .get(
      '/api/orders/:orderId/documents/:kind',
      async (context) => {
        const result = await documents.download(
          actor(context),
          context.params.orderId,
          context.params.kind,
          context.query.locale ?? 'en',
          true,
        )
        return new Response(result.html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'Content-Security-Policy':
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          },
        })
      },
      {
        withVerifiedAuth: true,
        params: t.Object({
          orderId: t.String({ format: 'uuid' }),
          kind: t.Union([t.Literal('INVOICE'), t.Literal('RECEIPT')]),
        }),
        query: t.Object({
          locale: t.Optional(t.Union([t.Literal('en'), t.Literal('th')])),
        }),
      },
    )
}
