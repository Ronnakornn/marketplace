import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { NotificationServiceError } from './notification.errors.ts'

const NotificationParamsSchema = t.Object({
  notificationId: t.String({ format: 'uuid' }),
})

const NotificationQuerySchema = t.Object({
  scope: t.Optional(t.Union([t.Literal('all'), t.Literal('seller')])),
})

export function createNotificationRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof NotificationServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .get('/api/notifications', ({ authContext, query }: any) =>
      container.notificationService.listNotifications(authContext!.user, query.scope ?? 'all'), {
      withAuth: true,
      query: NotificationQuerySchema,
    })
    .get('/api/notifications/unread-count', ({ authContext, query }: any) =>
      container.notificationService.getUnreadCount(authContext!.user, query.scope ?? 'all'), {
      withAuth: true,
      query: NotificationQuerySchema,
    })
    .patch('/api/notifications/:notificationId/read', ({ authContext, params }: any) =>
      container.notificationService.markNotificationAsRead(authContext!.user, params.notificationId), {
      withAuth: true,
      params: NotificationParamsSchema,
    })
    .patch('/api/notifications/read-all', ({ authContext, query }: any) =>
      container.notificationService.markAllNotificationsAsRead(authContext!.user, query.scope ?? 'all'), {
      withAuth: true,
      query: NotificationQuerySchema,
    })
}
