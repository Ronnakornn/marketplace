import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { ChatServiceError } from './chat.errors.ts'

const RoomParamsSchema = t.Object({
  roomId: t.String({ minLength: 1 }),
})

const PaginationQuerySchema = t.Object({
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
  scope: t.Optional(t.Union([t.Literal('buyer'), t.Literal('seller')])),
  shopId: t.Optional(t.String({ minLength: 1 })),
})

const CreateChatRoomSchema = t.Object({
  shopId: t.String({ minLength: 1 }),
  productId: t.Optional(t.String({ minLength: 1 })),
  orderId: t.Optional(t.String({ minLength: 1 })),
})

const SendMessageSchema = t.Object({
  messageType: t.Union([t.Literal('text'), t.Literal('image')]),
  body: t.Optional(t.String()),
  attachments: t.Optional(t.Array(t.String())),
  scope: t.Optional(t.Union([t.Literal('buyer'), t.Literal('seller')])),
})

function chatActor(authContext: any) {
  return { id: authContext!.user.id, role: authContext!.user.role }
}

export function createChatRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof ChatServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        })
      }
    })
    .get('/api/chats', ({ authContext, query }: any) =>
      container.chatService.listRooms(chatActor(authContext), query.scope, query.shopId), {
      withAuth: true,
    })
    .get('/api/chats/:roomId', ({ authContext, params, query }: any) =>
      container.chatService.getRoom(chatActor(authContext), params.roomId, query), {
      withAuth: true,
      params: RoomParamsSchema,
      query: PaginationQuerySchema,
    })
    .post('/api/chats', ({ authContext, body }: any) =>
      container.chatService.createRoom(chatActor(authContext), body), {
      withAuth: true,
      body: CreateChatRoomSchema,
    })
    .post('/api/chats/:roomId/messages', ({ authContext, params, body }: any) =>
      container.chatService.sendMessage(chatActor(authContext), params.roomId, body), {
      withAuth: true,
      params: RoomParamsSchema,
      body: SendMessageSchema,
    })
    .patch('/api/chats/:roomId/read', ({ authContext, params, query }: any) =>
      container.chatService.markRead(chatActor(authContext), params.roomId, query.scope), {
      withAuth: true,
      params: RoomParamsSchema,
      query: PaginationQuerySchema,
    })
}
