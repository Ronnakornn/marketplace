import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { NotificationServiceError } from './notification.errors.ts'

const NotificationParamsSchema = t.Object({
  notificationId: t.String({ format: 'uuid' }),
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
    .get('/api/notifications', ({ authContext }: any) =>
      container.notificationService.listNotifications(authContext!.user), {
      withAuth: true,
    })
    .get('/api/notifications/unread-count', ({ authContext }: any) =>
      container.notificationService.getUnreadCount(authContext!.user), {
      withAuth: true,
    })
    .patch('/api/notifications/:notificationId/read', ({ authContext, params }: any) =>
      container.notificationService.markNotificationAsRead(authContext!.user, params.notificationId), {
      withAuth: true,
      params: NotificationParamsSchema,
    })
    .patch('/api/notifications/read-all', ({ authContext }: any) =>
      container.notificationService.markAllNotificationsAsRead(authContext!.user), {
      withAuth: true,
    })
}
