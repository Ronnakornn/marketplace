import { Elysia, ParseError, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin, getAuthContext } from '#server/modules/auth'
import { ChatServiceError } from './chat.errors.ts'
import { parseChatMessage } from './chat.multipart.ts'
import { chatContentDisposition } from './chat.attachments.ts'

const uuid = () => t.String({ format: 'uuid' })
const audience = t.Optional(t.Union([t.Literal('buyer'), t.Literal('seller')]))
const RoomParamsSchema = t.Object({ roomId: uuid() })
const InboxQuerySchema = t.Object({ scope: audience, shopId: t.Optional(uuid()) })
const PaginationQuerySchema = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, maximum: 2_147_483_647 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  before: t.Optional(uuid()), after: t.Optional(uuid()), scope: audience, shopId: t.Optional(uuid()),
})
const CreateChatRoomSchema = t.Object({ shopId: uuid(), productId: t.Optional(uuid()), orderId: t.Optional(uuid()) })
const SendMessageSchema = t.Object({
  messageType: t.Union([t.Literal('text'), t.Literal('image')]), body: t.Optional(t.String({ maxLength: 4000 })),
  attachments: t.Optional(t.Array(t.String(), { maxItems: 5 })), clientMessageId: t.Optional(uuid()),
  productId: t.Optional(uuid()), orderId: t.Optional(uuid()), scope: audience,
  files: t.Optional(t.Array(t.File(), { maxItems: 5 })),
})
const ReadQuerySchema = t.Object({ scope: audience, throughMessageId: t.Optional(uuid()) })

async function requestActor(request: Request) {
  const context = await getAuthContext(request.headers)
  if (!context) throw new ChatServiceError('Authentication required', 401, 'AUTH_REQUIRED')
  return { id: context.user.id, role: context.user.role }
}

async function chatResponse<T>(operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof ChatServiceError)) throw error
    const body = { error: { code: error.code, message: error.message, details: error.details } }
    switch (error.status) {
      case 400: return httpStatus(400, body)
      case 401: return httpStatus(401, body)
      case 403: return httpStatus(403, body)
      case 404: return httpStatus(404, body)
      case 409: return httpStatus(409, body)
      case 413: return httpStatus(413, body)
      case 503: return httpStatus(503, body)
      default: throw error
    }
  }
}

export function createChatRoutes(container: Pick<ServiceContainer, 'chatService'>) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      const cause = error instanceof ParseError ? error.cause : error
      if (cause instanceof ChatServiceError) return chatResponse(async () => { throw cause })
    })
    .get('/api/chats', ({ request, query }) => chatResponse(async () => container.chatService.listRooms(await requestActor(request), query.scope, query.shopId)), {
      withAuth: true, query: InboxQuerySchema,
    })
    .get('/api/chats/:roomId', ({ request, params, query }) => chatResponse(async () => container.chatService.getRoom(await requestActor(request), params.roomId, query)), {
      withAuth: true, params: RoomParamsSchema, query: PaginationQuerySchema,
    })
    .post('/api/chats', ({ request, body }) => chatResponse(async () => container.chatService.createRoom(await requestActor(request), body)), {
      withAuth: true, body: CreateChatRoomSchema,
    })
    .post('/api/chats/:roomId/messages', ({ request, params, body }) => chatResponse(async () => container.chatService.sendMessage(await requestActor(request), params.roomId, body)), {
      withAuth: true, params: RoomParamsSchema, body: SendMessageSchema, parse: async ({ request }) => { await requestActor(request); return parseChatMessage(request) },
    })
    .get('/api/chats/:roomId/attachments/:attachmentId/content', ({ request, params, query }) => chatResponse(async () => {
      const { attachment, stream } = await container.chatService.openAttachment(await requestActor(request), params.roomId, params.attachmentId, query.scope, query.shopId)
      return new Response(stream, { headers: {
        'content-type': attachment.contentType, 'content-length': String(attachment.byteSize),
        'content-disposition': chatContentDisposition(attachment.fileName, attachment.kind === 'IMAGE' && query.mode !== 'download'),
        'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
      } })
    }), { withAuth: true, params: t.Object({ roomId: uuid(), attachmentId: uuid() }),
      query: t.Object({ scope: audience, shopId: t.Optional(uuid()), mode: t.Optional(t.Union([t.Literal('preview'), t.Literal('download')])) }) })
    .patch('/api/chats/:roomId/read', ({ request, params, query }) => chatResponse(async () => container.chatService.markRead(await requestActor(request), params.roomId, query.scope, query.throughMessageId)), {
      withAuth: true, params: RoomParamsSchema, query: ReadQuerySchema,
    })
}
