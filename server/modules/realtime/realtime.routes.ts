import { Elysia, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { RealtimeServiceError } from './realtime.errors.ts'

const RealtimeMessageSchema = t.Object({
  action: t.Union([t.Literal('subscribe'), t.Literal('unsubscribe')]),
  channel: t.String({ minLength: 1 }),
})

function realtimeActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createRealtimeRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .ws('/api/realtime', {
      withAuth: true,
      body: RealtimeMessageSchema,
      open(ws: any) {
        const actor = realtimeActor(ws.data.authContext)
        container.realtimeService.addConnection({
          id: ws.id,
          userId: actor.id,
          send: (data) => {
            ws.send(data)
          },
        })
        ws.send(JSON.stringify({ event: 'realtime.connected', channel: `user:${actor.id}`, createdAt: new Date().toISOString() }))
      },
      async message(ws: any, message: { action: 'subscribe' | 'unsubscribe'; channel: string }) {
        const actor = realtimeActor(ws.data.authContext)
        try {
          const result = message.action === 'subscribe'
            ? await container.realtimeService.subscribe(actor, ws.id, message.channel)
            : await container.realtimeService.unsubscribe(actor, ws.id, message.channel)
          ws.send(JSON.stringify({
            event: `realtime.${message.action}d`,
            channel: result.channel,
            createdAt: new Date().toISOString(),
          }))
        } catch (error) {
          container.realtimeService.logConnectionError(error, { userId: actor.id, channel: message.channel })
          if (error instanceof RealtimeServiceError) {
            ws.send(JSON.stringify({
              event: 'realtime.error',
              channel: message.channel,
              error: { code: error.code, message: error.message },
              createdAt: new Date().toISOString(),
            }))
            return
          }
          throw error
        }
      },
      close(ws: any) {
        container.realtimeService.removeConnection(ws.id)
      },
      error({ error }: any) {
        container.realtimeService.logConnectionError(error)
      },
    })
}
