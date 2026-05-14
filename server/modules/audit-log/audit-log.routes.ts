import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { AuditLogServiceError } from './audit-log.errors.ts'

const AuditLogQuerySchema = t.Object({
  actorUserId: t.Optional(t.String()),
  action: t.Optional(t.String()),
  entityType: t.Optional(t.String()),
  entityId: t.Optional(t.String()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})

const AuditLogParamsSchema = t.Object({
  auditLogId: t.String({ format: 'uuid' }),
})

function adminActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createAuditLogRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof AuditLogServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/admin/audit-logs', ({ authContext, query }: any) =>
      container.auditLogService.listAuditLogs(adminActor(authContext), query), {
      withRole: 'ADMIN',
      query: AuditLogQuerySchema,
    })
    .get('/api/admin/audit-logs/:auditLogId', ({ authContext, params }: any) =>
      container.auditLogService.getAuditLog(adminActor(authContext), params.auditLogId), {
      withRole: 'ADMIN',
      params: AuditLogParamsSchema,
    })
}
