import { treaty } from '@elysiajs/eden'
import { Elysia, ParseError } from 'elysia'
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { MetricsCollector } from '#server/modules/observability/metrics.collector.ts'
import { getObservabilityConfigFromEnv } from '#server/modules/observability/observability.config.ts'
import { getSecurityConfigFromEnv } from '#server/modules/security/security.config.ts'
import { createObservabilityPlugin } from '#server/plugins/observability.plugin.ts'
import { createSecurityPlugin } from '#server/plugins/security.plugin.ts'
import { ChatServiceError, isChatParserError } from './chat.errors.ts'
import { getChatRequestBodyLimit } from './chat.multipart.ts'
import type { ChatRoomRecord, IChatRepository } from './chat.repository.ts'
import { createChatRoutes } from './chat.routes.ts'
import { ChatService } from './chat.service.ts'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import type { ChatPrivateObjectStore } from '#server/modules/upload/upload.types.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: { handler: () => new Response(null, { status: 404 }) },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

const buyerId = '11111111-1111-4111-8111-111111111111'
const sellerId = '22222222-2222-4222-8222-222222222222'
const roomId = '33333333-3333-4333-8333-333333333333'
const shopId = '44444444-4444-4444-8444-444444444444'
const messageId = '55555555-5555-4555-8555-555555555555'
const headers = { 'content-type': 'application/json', 'x-request-id': 'chat-error-test' }

function createRoom(): ChatRoomRecord {
  return {
    id: roomId, contentRevision: 0n, buyerId, shopId, lastMessageAt: null,
    buyerReadAt: null, sellerReadAt: null, buyerReadMessageId: null, sellerReadMessageId: null,
    createdAt: new Date('2026-10-13T00:00:00Z'), updatedAt: new Date('2026-10-13T00:00:00Z'),
    buyer: { id: buyerId, name: 'Buyer', email: 'buyer@example.com', role: 'USER' },
    shop: { id: shopId, name: 'Shop', slug: 'shop', ownerId: sellerId, status: 'ACTIVE', settings: { chatEnabled: true } },
    messages: [],
  }
}

function createApp(objects?: ChatPrivateObjectStore) {
  const context = {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    config: { environment: 'production' },
  } satisfies AppContext
  const room = createRoom()
  const repo = {
    refreshMessages: vi.fn(), deleteContent: vi.fn(),
    findReplay: vi.fn<IChatRepository['findReplay']>().mockResolvedValue(null),
    findAttachment: vi.fn<IChatRepository['findAttachment']>().mockResolvedValue(null),
    referencedStorageKeys: vi.fn<IChatRepository['referencedStorageKeys']>().mockResolvedValue([]),
    findShopById: vi.fn<IChatRepository['findShopById']>().mockResolvedValue(room.shop),
    findProductById: vi.fn<IChatRepository['findProductById']>().mockResolvedValue(null),
    findOrderContext: vi.fn<IChatRepository['findOrderContext']>().mockResolvedValue(null),
    findRoomByBuyerAndShop: vi.fn<IChatRepository['findRoomByBuyerAndShop']>().mockResolvedValue(room),
    findRoomById: vi.fn<IChatRepository['findRoomById']>().mockResolvedValue(room),
    createRoom: vi.fn<IChatRepository['createRoom']>().mockResolvedValue(room),
    listRooms: vi.fn<IChatRepository['listRooms']>().mockResolvedValue({ items: [{ room, unreadCount: 2 }], hasMore: false }),
    countUnread: vi.fn<IChatRepository['countUnread']>().mockResolvedValue(75),
    createMessage: vi.fn<IChatRepository['createMessage']>(),
    listMessages: vi.fn<IChatRepository['listMessages']>().mockResolvedValue({ items: [], total: 0, hasMore: false }),
    countUnreadMessages: vi.fn<IChatRepository['countUnreadMessages']>().mockResolvedValue(0),
    markRead: vi.fn<IChatRepository['markRead']>().mockResolvedValue(room),
  } satisfies IChatRepository
  const chatService = new ChatService(context, repo, undefined, undefined, objects)
  const app = new Elysia()
    .use(createObservabilityPlugin(context, new MetricsCollector(), getObservabilityConfigFromEnv({}), isChatParserError))
    .use(createSecurityPlugin(context, getSecurityConfigFromEnv({ RATE_LIMIT_ENABLED: 'false' }), isChatParserError, getChatRequestBodyLimit))
    .use(createChatRoutes({ chatService }))
  return { app, chatService, repo, room, context }
}

function request(path: string, method = 'GET', body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe('chat routes with global observability and security', () => {
  it('serves a compact whole-inbox unread count through the fixed authenticated route', async () => {
    const { app, repo } = createApp()
    const response = await app.handle(request('/api/chats/unread-count?scope=buyer'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ unreadCount: 75 })
    expect(repo.countUnread).toHaveBeenCalledWith(buyerId, { scope: 'buyer' })
    expect(repo.findRoomById).not.toHaveBeenCalled()
    expect(repo.listRooms).not.toHaveBeenCalled()
  })

  it('filters before bounded inbox pagination and rejects excessive pages', async () => {
    const { app, repo } = createApp()
    const response = await app.handle(request(`/api/chats?scope=seller&shopId=${shopId}&q=Buyer&unreadOnly=true&limit=50`))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ items: [{ roomId, unreadCount: 2 }], pagination: { limit: 50, hasMore: false, nextCursor: null } })
    expect(repo.listRooms).toHaveBeenCalledWith(buyerId, expect.objectContaining({ scope: 'seller', shopId, q: 'Buyer', unreadOnly: true, limit: 50 }))
    expect(repo.countUnreadMessages).not.toHaveBeenCalled()
    expect((await app.handle(request('/api/chats?limit=51'))).status).toBe(422)
  })

  it('blocks administrators and anonymous users from the global unread count', async () => {
    const { app, repo } = createApp()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    expect((await app.handle(request('/api/chats/unread-count'))).status).toBe(401)
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: buyerId, role: 'ADMIN', name: 'Admin', email: 'admin@example.com', status: 'ACTIVE', emailVerified: true }, session: { id: 'session' } })
    expect((await app.handle(request('/api/chats/unread-count'))).status).toBe(403)
    expect(repo.countUnread).not.toHaveBeenCalled()
  })

  it('defers only framework-wrapped chat parser errors', () => {
    const chatError = new ChatServiceError('Invalid message body', 400, 'INVALID_MESSAGE')
    expect(isChatParserError(new ParseError(chatError))).toBe(true)
    expect(isChatParserError(chatError)).toBe(false)
    expect(isChatParserError(new ParseError(new Error('storage secret')))).toBe(false)
    expect(isChatParserError(new Error('storage secret', { cause: chatError }))).toBe(false)
    expect(isChatParserError(null)).toBe(false)
  })
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthContext).mockResolvedValue({
      user: { id: buyerId, name: 'Buyer', email: 'buyer@example.com', role: 'USER', status: 'ACTIVE', emailVerified: true },
      session: { id: 'chat-session' },
    })
  })

  it('admits verified image bytes above 1 MiB only for multipart message POST', async () => {
    const objects = { putNew: vi.fn().mockResolvedValue(undefined), read: vi.fn(), remove: vi.fn(), list: vi.fn() } satisfies ChatPrivateObjectStore
    const { app, room, repo } = createApp(objects)
    repo.createMessage.mockImplementation(async (input) => ({ created: true, message: {
      id: input.clientMessageId, threadId: input.roomId, senderId: input.senderId,
      body: input.body, messageType: input.messageType, attachments: [], productId: null, orderId: null,
      product: null, order: null, sender: room.buyer, createdAt: new Date(), deletedAt: null, contentVersion: 0, replyToMessageId: null, replyToAttachmentId: null, replyToMessage: null,
      files: input.files.map((file) => ({ ...file, deletedAt: null, id: crypto.randomUUID(), messageId: input.clientMessageId, createdAt: new Date() })),
    } }))
    const png = await sharp(randomBytes(800 * 800 * 3), { raw: { width: 800, height: 800, channels: 3 } }).png().toBuffer()
    expect(png.length).toBeGreaterThan(1024 * 1024)
    const form = new FormData()
    form.append('clientMessageId', messageId)
    form.append('files', new File([new Uint8Array(png)], 'รูปภาพ.png', { type: 'image/png' }))
    const payloadSize = (await new Request('http://localhost', { method: 'POST', body: form }).arrayBuffer()).byteLength
    const response = await app.handle(new Request(`http://localhost/api/chats/${roomId}/messages`, { method: 'POST', body: form, headers: { 'content-length': String(payloadSize) } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ sentMessage: { messageType: 'image', files: [{ fileName: 'รูปภาพ.png', byteSize: png.length, contentUrl: expect.stringContaining(`/api/chats/${roomId}/attachments/`) }] } })
    expect(objects.putNew).toHaveBeenCalledTimes(1)
    const jsonResponse = await app.handle(new Request(`http://localhost/api/chats/${roomId}/messages`, { method: 'POST', body: JSON.stringify({ messageType: 'text', body: 'x'.repeat(1024 * 1024) }), headers: { 'content-type': 'application/json', 'content-length': String(1024 * 1024 + 100) } }))
    expect(jsonResponse.status).toBe(413)
  })

  it('preserves disabled-shop errors from sending and creating rooms', async () => {
    const { app, room, repo } = createApp()
    room.shop.settings = { chatEnabled: false }

    const send = await app.handle(request(`/api/chats/${roomId}/messages`, 'POST', { messageType: 'text', body: 'Hello' }))
    const create = await app.handle(request('/api/chats', 'POST', { shopId }))

    for (const response of [send, create]) {
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: { code: 'SHOP_CHAT_DISABLED', message: 'Shop chat is disabled' } })
      expect(response.headers.get('x-request-id')).toBe('chat-error-test')
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    }
    expect(repo.createMessage).not.toHaveBeenCalled()
    expect(repo.createRoom).not.toHaveBeenCalled()
  })

  it('preserves forbidden errors for room reads and read updates', async () => {
    const { app, room, repo } = createApp()
    room.buyerId = '66666666-6666-4666-8666-666666666666'

    for (const [path, method] of [[`/api/chats/${roomId}`, 'GET'], [`/api/chats/${roomId}/read`, 'PATCH']]) {
      const response = await app.handle(request(path, method))
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: { code: 'CHAT_FORBIDDEN', message: 'Chat access forbidden' } })
    }
    expect(repo.listMessages).not.toHaveBeenCalled()
    expect(repo.markRead).not.toHaveBeenCalled()
  })

  it('preserves conflict errors from the message repository', async () => {
    const { app, repo } = createApp()
    repo.createMessage.mockRejectedValue(new ChatServiceError('Message ID was already used for a different message', 409, 'MESSAGE_ID_CONFLICT'))

    const response = await app.handle(request(`/api/chats/${roomId}/messages`, 'POST', {
      messageType: 'text', body: 'Hello', clientMessageId: messageId,
    }))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: { code: 'MESSAGE_ID_CONFLICT', message: 'Message ID was already used for a different message' } })
  })

  it('preserves missing-room and invalid-message errors', async () => {
    const { app, repo } = createApp()
    const invalid = await app.handle(request(`/api/chats/${roomId}/messages`, 'POST', { messageType: 'text', body: '   ' }))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: { code: 'MESSAGE_BODY_REQUIRED', message: 'Text message body is required' } })

    repo.findRoomById.mockResolvedValue(null)
    const missing = await app.handle(request(`/api/chats/${roomId}`))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: { code: 'CHAT_ROOM_NOT_FOUND', message: 'Chat room not found' } })
  })

  it('catches requestActor failures after the auth macro resolves', async () => {
    const { app, repo } = createApp()
    vi.mocked(getAuthContext).mockResolvedValueOnce({
      user: { id: buyerId, name: 'Buyer', email: 'buyer@example.com', role: 'USER', status: 'ACTIVE', emailVerified: true },
      session: { id: 'chat-session' },
    }).mockResolvedValueOnce(null)

    const response = await app.handle(request('/api/chats'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } })
    expect(repo.listRooms).not.toHaveBeenCalled()
  })

  it('leaves unknown exceptions to the redacted global production fallback', async () => {
    const { app, repo, context } = createApp()
    repo.listRooms.mockRejectedValue(new Error('database password=private-secret'))

    const response = await app.handle(request('/api/chats'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: { code: 'INVALID_REQUEST', message: 'Request failed', requestId: 'chat-error-test' } })
    expect(context.logger.error).toHaveBeenCalledWith('HTTP request failed', expect.objectContaining({ requestId: 'chat-error-test' }))
  })

  it('keeps successful Eden data separate from domain errors', async () => {
    const { app } = createApp()
    const client = treaty(app)
    const result = await client.api.chats({ roomId }).get()

    expect(result.error).toBeNull()
    expect(result.data?.roomId).toBe(roomId)
    expectTypeOf<NonNullable<typeof result.data>>().not.toHaveProperty('error')
    expectTypeOf<NonNullable<typeof result.data>>().toHaveProperty('roomId').toEqualTypeOf<string>()
  })
})
