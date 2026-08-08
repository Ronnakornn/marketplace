import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
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
    senderId: overrides.senderId ?? 'buyer-1',
    messageType: overrides.messageType ?? 'TEXT',
    body: overrides.body ?? 'Hello',
    attachments: overrides.attachments ?? [],
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
    buyerId: overrides.buyerId ?? 'buyer-1',
    shopId: overrides.shopId ?? 'shop-1',
    productId: overrides.productId ?? null,
    orderId: overrides.orderId ?? null,
    buyerReadAt: overrides.buyerReadAt ?? null,
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
    },
    product: overrides.product ?? null,
    order: overrides.order ?? null,
    messages: overrides.messages ?? [],
  }
}

function createRepo(overrides: Partial<Record<keyof IChatRepository, any>> = {}) {
  const repo: IChatRepository = {
    findShopById: vi.fn().mockResolvedValue({ id: 'shop-1', name: 'Shop', slug: 'shop', ownerId: 'seller-1', status: 'ACTIVE' }),
    findProductById: vi.fn().mockResolvedValue(null),
    findOrderContext: vi.fn().mockResolvedValue(null),
    findRoomByBuyerAndShop: vi.fn().mockResolvedValue(null),
    findRoomById: vi.fn().mockResolvedValue(createRoom()),
    createRoom: vi.fn().mockResolvedValue(createRoom()),
    listBuyerRooms: vi.fn().mockResolvedValue([createRoom()]),
    listSellerRooms: vi.fn().mockResolvedValue([createRoom()]),
    createMessage: vi.fn().mockResolvedValue(createMessage()),
    listMessages: vi.fn().mockResolvedValue({ items: [createMessage({ id: 'message-2' })], total: 2 }),
    countUnreadMessages: vi.fn().mockResolvedValue(0),
    markBuyerRead: vi.fn().mockResolvedValue(createRoom({ buyerReadAt: new Date('2026-01-02T00:00:00.000Z') })),
    markSellerRead: vi.fn().mockResolvedValue(createRoom({ sellerReadAt: new Date('2026-01-02T00:00:00.000Z') })),
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

  it('lets a buyer create chat with a shop', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    const result = await service.createRoom(user(), { shopId: 'shop-1' })

    expect(repo.createRoom).toHaveBeenCalledWith({ buyerId: 'buyer-1', shopId: 'shop-1' })
    expect(result.roomId).toBe('room-1')
    expect(result.shop.id).toBe('shop-1')
  })

  it('sorts rooms when Prisma returns serialized date strings', async () => {
    const olderRoom = createRoom({
      id: 'older-room',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const newerRoom = createRoom({
      id: 'newer-room',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    const repo = createRepo({
      listBuyerRooms: vi.fn().mockResolvedValue([olderRoom]),
      listSellerRooms: vi.fn().mockResolvedValue([newerRoom]),
    })
    const service = new ChatService(appContext, repo)

    const result = await service.listRooms(user())

    expect(result.map((room) => room.roomId)).toEqual(['newer-room', 'older-room'])
  })

  it('deduplicates buyer and seller rooms before sorting', async () => {
    const sharedRoom = createRoom({
      id: 'shared-room',
      updatedAt: '2026-01-02T00:00:00.000Z',
    })
    const repo = createRepo({
      listBuyerRooms: vi.fn().mockResolvedValue([sharedRoom]),
      listSellerRooms: vi.fn().mockResolvedValue([sharedRoom]),
    })
    const service = new ChatService(appContext, repo)

    const result = await service.listRooms(user())

    expect(result.map((room) => room.roomId)).toEqual(['shared-room'])
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

    expect(repo.listBuyerRooms).toHaveBeenCalledWith('buyer-2')
    expect(repo.listSellerRooms).toHaveBeenCalledWith('buyer-2')
  })

  it('lets sellers list only rooms from their shops', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    await service.listRooms(seller('seller-2'))

    expect(repo.listSellerRooms).toHaveBeenCalledWith('seller-2')
    expect(repo.listBuyerRooms).toHaveBeenCalledWith('seller-2')
  })

  it('keeps seller-scoped inboxes separate from buyer rooms', async () => {
    const repo = createRepo({
      listBuyerRooms: vi.fn().mockResolvedValue([createRoom({ id: 'buyer-room' })]),
      listSellerRooms: vi.fn().mockResolvedValue([
        createRoom({ id: 'seller-room', shopId: 'shop-1' }),
        createRoom({ id: 'other-shop-room', shopId: 'shop-2' }),
      ]),
    })
    const service = new ChatService(appContext, repo)

    const result = await service.listRooms(seller('seller-1'), 'seller', 'shop-1')

    expect(repo.listBuyerRooms).not.toHaveBeenCalled()
    expect(repo.listSellerRooms).toHaveBeenCalledWith('seller-1')
    expect(result.map((room) => room.roomId)).toEqual(['seller-room'])
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

  it('requires attachments for image messages', async () => {
    const service = new ChatService(appContext, createRepo())

    await expect(service.sendMessage(user(), 'room-1', { messageType: 'image', attachments: [] })).rejects.toMatchObject({
      code: 'ATTACHMENT_REQUIRED',
      status: 400,
    } satisfies Partial<ChatServiceError>)
  })

  it('supports message pagination', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    const result = await service.getRoom(user(), 'room-1', { page: 2, limit: 1 })

    expect(repo.listMessages).toHaveBeenCalledWith('room-1', { page: 2, limit: 1 })
    expect(result.messages).toHaveLength(1)
    expect(result.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 })
  })

  it('marks buyer rooms as read', async () => {
    const repo = createRepo()
    const service = new ChatService(appContext, repo)

    await service.markRead(user(), 'room-1')

    expect(repo.markBuyerRead).toHaveBeenCalledWith('room-1', expect.any(Date))
    expect(repo.markSellerRead).not.toHaveBeenCalled()
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
      createMessage: vi.fn().mockResolvedValue(createMessage({ senderId: 'buyer-1', body: 'Hello seller' })),
    })
    const service = new ChatService(appContext, repo, undefined, notificationService as any)

    await service.sendMessage(user('buyer-1'), 'room-1', { messageType: 'text', body: 'Hello seller' })

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      'seller-1',
      'chat_message',
      'New chat message',
      'Hello seller',
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
      createMessage: vi.fn().mockResolvedValue(createMessage({ senderId: 'seller-1', body: 'We are packing your order' })),
    })
    const service = new ChatService(appContext, repo, undefined, notificationService as any)

    await service.sendMessage(seller('seller-1'), 'room-1', { messageType: 'text', body: 'We are packing your order' })

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      'buyer-1',
      'chat_message',
      'New chat message',
      'We are packing your order',
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
