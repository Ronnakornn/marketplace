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

const NotificationPageQuerySchema = t.Composite([NotificationQuerySchema, t.Object({
  cursor: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, multipleOf: 1 })),
  category: t.Optional(t.Union([t.Literal('all'), t.Literal('order'), t.Literal('payment'), t.Literal('refund'), t.Literal('chat'), t.Literal('promotion')])),
})])
const NotificationCountQuerySchema = t.Composite([NotificationQuerySchema, t.Object({
  excludeChat: t.Optional(t.BooleanString()),
})])

const PushSubscriptionSchema = t.Object({
  endpoint: t.String({ minLength: 1, maxLength: 4096, format: 'uri' }),
  locale: t.Union([t.Literal('th'), t.Literal('en')]),
  expirationTime: t.Optional(t.Union([t.Number({ minimum: 0 }), t.Null()])),
  keys: t.Object({
    p256dh: t.String({ minLength: 1, maxLength: 1024 }),
    auth: t.String({ minLength: 1, maxLength: 1024 }),
  }),
})

const PushUnsubscribeSchema = t.Pick(PushSubscriptionSchema, ['endpoint'])

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
      container.notificationService.listNotifications(authContext!.user, query.scope ?? 'all', query), {
      withAuth: true,
      query: NotificationPageQuerySchema,
    })
    .get('/api/notifications/unread-count', ({ authContext, query }: any) =>
      container.notificationService.getUnreadCount(authContext!.user, query.scope ?? 'all', query.excludeChat ?? false), {
      withAuth: true,
      query: NotificationCountQuerySchema,
    })
    .get('/api/notifications/push/config', () => container.pushService.getConfig(), {
      withAuth: true,
    })
    .post('/api/notifications/push/subscribe', ({ authContext, body }: any) =>
      container.pushService.subscribe(authContext!.user, body), {
      withAuth: true,
      body: PushSubscriptionSchema,
    })
    .post('/api/notifications/push/unsubscribe', ({ authContext, body }: any) =>
      container.pushService.unsubscribe(authContext!.user, body.endpoint), {
      withAuth: true,
      body: PushUnsubscribeSchema,
    })
    .post('/api/notifications/push/test', ({ authContext }: any) =>
      container.pushService.sendTest(authContext!.user), {
      withAuth: true,
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
