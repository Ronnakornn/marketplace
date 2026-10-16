import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter, RealtimeService } from '#server/modules/realtime'
import { ChatServiceError } from './chat.errors.ts'
import type { IChatRepository } from './chat.repository.ts'
import { ChatService } from './chat.service.ts'

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const appContext = {
  logger,
  config: { environment: 'test' },
} satisfies AppContext

function failingRealtime() {
  const adapter = new InMemoryRealtimeAdapter(appContext)
  const service = new RealtimeService(appContext, {
    findLiveSession: vi.fn(), findChatRoomAccess: vi.fn(), findShopOwnerId: vi.fn(),
  }, adapter)
  vi.spyOn(adapter, 'publish').mockRejectedValue(new Error('transport failure'))
  return service
}

function user(id = 'buyer-1') {
  return { id, role: 'USER' as const }
}

function seller(id = 'seller-1') {
  return { id, role: 'USER' as const }
}

function createMessage(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'message-1',
    threadId: overrides.threadId ?? 'room-1',
    productId: overrides.productId ?? null,
    orderId: overrides.orderId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    contentVersion: overrides.contentVersion ?? 0, replyToMessageId: null, replyToAttachmentId: null, replyToMessage: null,
    product: overrides.product ?? null,
    order: overrides.order ?? null,
    senderId: overrides.senderId ?? 'buyer-1',
    messageType: overrides.messageType ?? 'TEXT',
    body: overrides.body ?? 'Hello',
    attachments: overrides.attachments ?? [],
    files: overrides.files ?? [],
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    sender: overrides.sender ?? {
      id: overrides.senderId ?? 'buyer-1',
      name: 'Buyer',
      email: 'buyer@example.com',
      role: 'USER',
    },
  }
}

function createRoom(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'room-1',
    contentRevision: overrides.contentRevision ?? 0n,
    buyerId: overrides.buyerId ?? 'buyer-1',
    shopId: overrides.shopId ?? 'shop-1',
    productId: overrides.productId ?? null,
    orderId: overrides.orderId ?? null,
    buyerReadAt: overrides.buyerReadAt ?? null,
    buyerReadMessageId: overrides.buyerReadMessageId ?? null,
    sellerReadMessageId: overrides.sellerReadMessageId ?? null,
    lastMessageAt: overrides.lastMessageAt ?? null,
    sellerReadAt: overrides.sellerReadAt ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    buyer: overrides.buyer ?? {
      id: overrides.buyerId ?? 'buyer-1',
      name: 'Buyer',
      email: 'buyer@example.com',
      role: 'USER',
    },
    shop: overrides.shop ?? {
      id: overrides.shopId ?? 'shop-1',
      name: 'Shop',
      slug: 'shop',
      ownerId: 'seller-1',
      status: 'ACTIVE',
      settings: null,
    },
    product: overrides.product ?? null,
    order: overrides.order ?? null,
    messages: overrides.messages ?? [],
  }
}

function createRepo(overrides: Partial<Record<keyof IChatRepository, any>> = {}) {
  const repo: IChatRepository = {
    refreshMessages: vi.fn(), deleteContent: vi.fn(),
    findReplay: vi.fn().mockResolvedValue(null),
    findAttachment: vi.fn().mockResolvedValue(null),
    referencedStorageKeys: vi.fn().mockResolvedValue([]),
    findShopById: vi.fn().mockResolvedValue({ id: 'shop-1', name: 'Shop', slug: 'shop', ownerId: 'seller-1', status: 'ACTIVE', settings: null }),
    findProductById: vi.fn().mockResolvedValue(null),
    findOrderContext: vi.fn().mockResolvedValue(null),
    findRoomByBuyerAndShop: vi.fn().mockResolvedValue(null),
    findRoomById: vi.fn().mockResolvedValue(createRoom()),
    createRoom: vi.fn().mockResolvedValue(createRoom()),
    listRooms: vi.fn().mockResolvedValue({ items: [{ room: createRoom(), unreadCount: 3 }], hasMore: false }),
    countUnread: vi.fn().mockResolvedValue(75),
    createMessage: vi.fn().mockResolvedValue({ message: createMessage(), created: true }),
    listMessages: vi.fn().mockResolvedValue({ items: [createMessage({ id: 'message-2' })], total: 2, hasMore: true }),
    countUnreadMessages: vi.fn().mockResolvedValue(0),
    markRead: vi.fn().mockResolvedValue(createRoom({ buyerReadAt: new Date('2026-01-02T00:00:00.000Z') })),
    ...overrides,
  }
  return repo
}

function createNotificationService(overrides: Record<string, any> = {}) {
  return {
    createNotification: vi.fn().mockResolvedValue({ id: 'notification-1' }),
    ...overrides,
  }
}

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns committed message and read results when realtime transport rejects', async () => {
    const repo = createRepo({ findRoomById: vi.fn().mockResolvedValue(createRoom({ messages: [createMessage()] })) })
    const service = new ChatService(appContext, repo, failingRealtime())

    await expect(service.sendMessage(user(), 'room-1', { messageType: 'text', body: 'Hello' })).resolves.toMatchObject({
      roomId: 'room-1', lastMessage: { id: 'message-1', body: 'Hello' },
    })
    await expect(service.markRead(user(), 'room-1')).resolves.toMatchObject({ roomId: 'room-1' })
    expect(repo.createMessage).toHaveBeenCalledOnce()
    expect(repo.markRead).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith('Realtime publication failed', expect.any(Object))
  })

  it('lets a buyer create chat with a shop', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    const result = await service.createRoom(user(), { shopId: 'shop-1' })

    expect(repo.createRoom).toHaveBeenCalledWith({ buyerId: 'buyer-1', shopId: 'shop-1' })
    expect(result.roomId).toBe('room-1')
    expect(result.shop.id).toBe('shop-1')
  })

  it('returns bounded rooms with grouped unread counts and a stable date and ID cursor', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const repo = createRepo({ listRooms: vi.fn().mockResolvedValue({ items: [{ room: createRoom({ id, updatedAt: '2026-01-02T00:00:00.000Z' }), unreadCount: 7 }], hasMore: true }) })
    const service = new ChatService(appContext, repo)
    const result = await service.listRooms(user(), { limit: 1 })
    expect(result.items.map((room) => [room.roomId, room.unreadCount])).toEqual([[id, 7]])
    expect(repo.countUnreadMessages).not.toHaveBeenCalled()
    expect(result.pagination).toEqual({ limit: 1, hasMore: true, nextCursor: Buffer.from(`2026-01-02T00:00:00.000Z|${id}`).toString('base64url') })
    await service.listRooms(user(), { cursor: result.pagination.nextCursor ?? undefined })
    expect(repo.listRooms).toHaveBeenLastCalledWith('buyer-1', expect.objectContaining({ cursor: { updatedAt: new Date('2026-01-02T00:00:00.000Z'), id } }))
  })

  it('returns whole-scope unread totals independently from the current page', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)
    expect(await service.unreadCount(user(), { scope: 'buyer' })).toEqual({ unreadCount: 75 })
    expect(repo.countUnread).toHaveBeenCalledWith('buyer-1', { scope: 'buyer' })
    expect(repo.listRooms).not.toHaveBeenCalled()
  })

  it.each(['not a cursor', '', 'a'.repeat(201), Buffer.from('2026-01-01|not-a-uuid').toString('base64url')])('rejects invalid inbox cursor %s', async (cursor) => {
    const repo = createRepo()
    await expect(new ChatService(appContext, repo).listRooms(user(), { cursor })).rejects.toMatchObject({ code: 'INVALID_MESSAGE_CURSOR', status: 400 })
    expect(repo.listRooms).not.toHaveBeenCalled()
  })

  it('returns an existing room for duplicate buyer and shop', async () => {
    const existing = createRoom({ id: 'existing-room' })
    const repo = createRepo({ findRoomByBuyerAndShop: vi.fn().mockResolvedValue(existing) })
    const service = new ChatService(appContext, repo)

    const result = await service.createRoom(user(), { shopId: 'shop-1' })

    expect(repo.createRoom).not.toHaveBeenCalled()
    expect(result.roomId).toBe('existing-room')
  })

  it('lets buyers list only their own rooms', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    await service.listRooms(user('buyer-2'))

    expect(repo.listRooms).toHaveBeenCalledWith('buyer-2', expect.objectContaining({ limit: 30 }))
  })

  it('lets sellers list only rooms from their shops', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    await service.listRooms(seller('seller-2'))

    expect(repo.listRooms).toHaveBeenCalledWith('seller-2', expect.objectContaining({ limit: 30 }))
  })

  it('keeps seller-scoped inboxes separate from buyer rooms', async () => {
    const repo = createRepo({ listRooms: vi.fn().mockResolvedValue({ items: [{ room: createRoom({ id: 'seller-room' }), unreadCount: 0 }], hasMore: false }) })
    const service = new ChatService(appContext, repo)

    const result = await service.listRooms(seller('seller-1'), { scope: 'seller', shopId: 'shop-1', q: ' Buyer ', unreadOnly: true })

    expect(repo.listRooms).toHaveBeenCalledWith('seller-1', expect.objectContaining({ scope: 'seller', shopId: 'shop-1', q: 'Buyer', unreadOnly: true }))
    expect(result.items.map((room) => room.roomId)).toEqual(['seller-room'])
  })

  it('blocks a buyer from reading another buyer room', async () => {
    const repo = createRepo({ findRoomById: vi.fn().mockResolvedValue(createRoom({ buyerId: 'buyer-2' })) })
    const service = new ChatService(appContext, repo)

    await expect(service.getRoom(user('buyer-1'), 'room-1')).rejects.toMatchObject({
      code: 'CHAT_FORBIDDEN',
      status: 403,
    } satisfies Partial<ChatServiceError>)
  })

  it('blocks a seller from reading another shop room', async () => {
    const repo = createRepo({ findRoomById: vi.fn().mockResolvedValue(createRoom({ shop: { id: 'shop-2', name: 'Other', slug: 'other', ownerId: 'seller-2' } })) })
    const service = new ChatService(appContext, repo)

    await expect(service.getRoom(seller('seller-1'), 'room-1')).rejects.toMatchObject({
      code: 'CHAT_FORBIDDEN',
      status: 403,
    } satisfies Partial<ChatServiceError>)
  })

  it('requires body for text messages', async () => {
    const service = new ChatService(appContext, createRepo())

    await expect(service.sendMessage(user(), 'room-1', { messageType: 'text', body: '   ' })).rejects.toMatchObject({
      code: 'MESSAGE_BODY_REQUIRED',
      status: 400,
    } satisfies Partial<ChatServiceError>)
  })

  it('rejects unsupported image writes', async () => {
    const service = new ChatService(appContext, createRepo())

    await expect(service.sendMessage(user(), 'room-1', { messageType: 'image', attachments: [] })).rejects.toMatchObject({
      code: 'CHAT_ATTACHMENT_UNSUPPORTED',
      status: 400,
    } satisfies Partial<ChatServiceError>)
  })

  it('supports message pagination', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    const result = await service.getRoom(user(), 'room-1', { page: 2, limit: 1 })

    expect(repo.listMessages).toHaveBeenCalledWith('room-1', { page: 2, limit: 1 })
    expect(result.messages).toHaveLength(1)
    expect(result.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2, hasMore: true, beforeCursor: 'message-2', afterCursor: 'message-2' })
  })

  it('marks buyer rooms as read', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    await service.markRead(user(), 'room-1')

    expect(repo.markRead).toHaveBeenCalledWith('room-1', 'buyer', undefined, expect.any(Function))
  })

  it('publishes chat message and read events', async () => {
    const realtimeService = {
      publish: vi.fn(),
    }
    const repo = createRepo({
      findRoomById: vi
        .fn()
        .mockResolvedValueOnce(createRoom())
        .mockResolvedValueOnce(createRoom({ messages: [createMessage({ id: 'message-new' })] }))
        .mockResolvedValueOnce(createRoom()),
    })
    const service = new ChatService(appContext, repo, realtimeService as any)

    await service.sendMessage(user(), 'room-1', { messageType: 'text', body: 'Hello' })
    await service.markRead(user(), 'room-1')

    expect(realtimeService.publish).toHaveBeenCalledWith('chat.message.created', 'chat:room-1', expect.objectContaining({ roomId: 'room-1' }))
    expect(realtimeService.publish).toHaveBeenCalledWith('chat.message.created', 'seller:shop-1:chats', expect.objectContaining({ roomId: 'room-1' }))
    expect(realtimeService.publish).toHaveBeenCalledWith('chat.room.read', 'chat:room-1', expect.objectContaining({ readerId: 'buyer-1' }))
  })

  it('notifies the seller when a buyer sends a message', async () => {
    const notificationService = createNotificationService()
    const repo = createRepo({
      findRoomById: vi
        .fn()
        .mockResolvedValueOnce(createRoom({ productId: 'product-1', orderId: 'order-1' }))
        .mockResolvedValueOnce(createRoom({ productId: 'product-1', orderId: 'order-1', messages: [createMessage()] })),
      createMessage: vi.fn().mockResolvedValue({ message: createMessage({ senderId: 'buyer-1', body: 'Hello seller' }), created: true }),
    })
    const service = new ChatService(appContext, repo, undefined, notificationService as any)

    await service.sendMessage(user('buyer-1'), 'room-1', { messageType: 'text', body: 'Hello seller' })

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      'seller-1',
      'chat_message',
      'New chat message',
      'You received a new chat message.',
      expect.objectContaining({
        roomId: 'room-1',
        shopId: 'shop-1',
        buyerId: 'buyer-1',
        senderId: 'buyer-1',
      }),
    )
    expect(notificationService.createNotification).not.toHaveBeenCalledWith(
      'buyer-1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('notifies the buyer when a seller sends a message', async () => {
    const notificationService = createNotificationService()
    const repo = createRepo({
      findRoomById: vi
        .fn()
        .mockResolvedValueOnce(createRoom())
        .mockResolvedValueOnce(createRoom({ messages: [createMessage({ senderId: 'seller-1' })] })),
      createMessage: vi.fn().mockResolvedValue({ message: createMessage({ senderId: 'seller-1', body: 'We are packing your order' }), created: true }),
    })
    const service = new ChatService(appContext, repo, undefined, notificationService as any)

    await service.sendMessage(seller('seller-1'), 'room-1', { messageType: 'text', body: 'We are packing your order' })

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      'buyer-1',
      'chat_message',
      'New chat message',
      'You received a new chat message.',
      expect.objectContaining({
        roomId: 'room-1',
        senderId: 'seller-1',
      }),
    )
    expect(notificationService.createNotification).not.toHaveBeenCalledWith(
      'seller-1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('keeps sending messages when chat notification creation fails', async () => {
    const notificationService = createNotificationService({
      createNotification: vi.fn().mockRejectedValue(new Error('notification down')),
    })
    const repo = createRepo({
      findRoomById: vi
        .fn()
        .mockResolvedValueOnce(createRoom())
        .mockResolvedValueOnce(createRoom({ messages: [createMessage()] })),
    })
    const service = new ChatService(appContext, repo, undefined, notificationService as any)

    const result = await service.sendMessage(user(), 'room-1', { messageType: 'text', body: 'Hello' })

    expect(result.roomId).toBe('room-1')
    expect(logger.warn).toHaveBeenCalledWith('ChatService chat notification failed', expect.objectContaining({
      roomId: 'room-1',
      recipientId: 'seller-1',
    }))
  })

  it('validates optional product and order context', async () => {
    const repo = createRepo({
      findProductById: vi.fn().mockResolvedValue({ id: 'product-1', title: 'Product', slug: 'product', shopId: 'shop-1' }),
      findOrderContext: vi.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORDER-1',
        status: 'PAID',
        userId: 'buyer-1',
        items: [{ shopId: 'shop-1' }],
      }),
    })
    const service = new ChatService(appContext, repo)

    await service.createRoom(user(), { shopId: 'shop-1', productId: 'product-1', orderId: 'order-1' })

    expect(repo.findProductById).toHaveBeenCalledWith('product-1')
    expect(repo.findOrderContext).toHaveBeenCalledWith('order-1')
  })
})
