import { Prisma, type ChatAttachment, type ChatMessage, type ChatThread, type Order, type PrismaClient, type Product, type Shop, type User } from '#generated/client/client.ts'
import type { StoredChatFile } from './chat.attachments.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { ChatServiceError } from './chat.errors.ts'
import type { ChatAudience, NormalizedChatPagination } from './chat.types.ts'

export type ChatUserRecord = Pick<User, 'id' | 'name' | 'email' | 'role'>
export type ChatShopRecord = Pick<Shop, 'id' | 'name' | 'slug' | 'ownerId' | 'status'> & { settings: { chatEnabled: boolean } | null }
export type ChatProductRecord = Pick<Product, 'id' | 'title' | 'slug' | 'shopId'>
export type ChatOrderRecord = Pick<Order, 'id' | 'orderNumber' | 'status' | 'userId'>
export type ChatMessageRecord = Pick<ChatMessage, 'id' | 'threadId' | 'senderId' | 'messageType' | 'body' | 'attachments' | 'createdAt' | 'productId' | 'orderId' | 'deletedAt'> & {
  sender: ChatUserRecord
  product: Pick<Product, 'id' | 'title' | 'slug'> | null
  order: Pick<Order, 'id' | 'orderNumber' | 'status'> | null
  files: ChatAttachment[]
}
export type ChatRoomRecord = Pick<ChatThread, 'id' | 'buyerId' | 'shopId' | 'lastMessageAt' | 'buyerReadAt' | 'sellerReadAt' | 'buyerReadMessageId' | 'sellerReadMessageId' | 'createdAt' | 'updatedAt'> & {
  buyer: ChatUserRecord
  shop: ChatShopRecord
  messages: ChatMessageRecord[]
}
export interface ChatMessagePage { items: ChatMessageRecord[]; total: number; hasMore: boolean }
export interface ChatMessageWrite {
  roomId: string
  senderId: string
  clientMessageId: string
  body: string | null
  messageType: ChatMessage['messageType']
  files: StoredChatFile[]
  productId: string | null
  orderId: string | null
}
export interface IChatRepository {
  findReplay(input: ChatMessageWrite, authorize: (room: ChatRoomRecord) => void): Promise<ChatMessageRecord | null>
  findAttachment(roomId: string, attachmentId: string): Promise<ChatAttachment | null>
  referencedStorageKeys(keys: string[]): Promise<string[]>
  findShopById(shopId: string): Promise<ChatShopRecord | null>
  findProductById(productId: string): Promise<ChatProductRecord | null>
  findOrderContext(orderId: string): Promise<(ChatOrderRecord & { items: Array<{ shopId: string }> }) | null>
  findRoomByBuyerAndShop(buyerId: string, shopId: string): Promise<ChatRoomRecord | null>
  findRoomById(roomId: string): Promise<ChatRoomRecord | null>
  createRoom(input: { buyerId: string; shopId: string }): Promise<ChatRoomRecord>
  listBuyerRooms(buyerId: string): Promise<ChatRoomRecord[]>
  listSellerRooms(ownerId: string): Promise<ChatRoomRecord[]>
  createMessage(input: ChatMessageWrite, authorize: (room: ChatRoomRecord) => void): Promise<{ message: ChatMessageRecord; created: boolean }>
  listMessages(roomId: string, pagination: NormalizedChatPagination): Promise<ChatMessagePage>
  countUnreadMessages(roomId: string, userId: string, readAt: Date | null, readMessageId: string | null): Promise<number>
  markRead(roomId: string, audience: ChatAudience, throughMessageId: string | undefined, authorize: (room: ChatRoomRecord) => void): Promise<ChatRoomRecord>
}

const userSelect = { id: true, name: true, email: true, role: true } as const
const shopSelect = { id: true, name: true, slug: true, ownerId: true, status: true, settings: { select: { chatEnabled: true } } } as const
const messageInclude = {
  files: { orderBy: { ordinal: 'asc' } },
  sender: { select: userSelect },
  product: { select: { id: true, title: true, slug: true } },
  order: { select: { id: true, orderNumber: true, status: true } },
} as const
const descending = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.ChatMessageOrderByWithRelationInput[]
const ascending = [{ createdAt: 'asc' }, { id: 'asc' }] satisfies Prisma.ChatMessageOrderByWithRelationInput[]
const roomInclude = {
  buyer: { select: userSelect },
  shop: { select: shopSelect },
  messages: { where: { deletedAt: null }, include: messageInclude, orderBy: descending, take: 1 },
} as const

function messageConflict(): never {
  throw new ChatServiceError('Message ID was already used for a different message', 409, 'MESSAGE_ID_CONFLICT')
}
function sameMessage(message: ChatMessageRecord, input: ChatMessageWrite): boolean {
  return !message.deletedAt && message.id === input.clientMessageId && message.threadId === input.roomId
    && message.senderId === input.senderId && message.messageType === input.messageType && message.body === input.body
    && message.productId === input.productId && message.orderId === input.orderId && message.attachments.length === 0
    && message.files.length === input.files.length && message.files.every((file, ordinal) => {
      const incoming = input.files[ordinal]
      return incoming && file.ordinal === incoming.ordinal && file.fileName === incoming.fileName
        && file.contentType === incoming.contentType && file.byteSize === incoming.byteSize
        && file.kind === incoming.kind && file.sha256 === incoming.sha256
    })
}
function tupleFilter(boundary: { createdAt: Date; id: string }, direction: 'gt' | 'lt'): Prisma.ChatMessageWhereInput {
  return { OR: [{ createdAt: { [direction]: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { [direction]: boundary.id } }] }
}

export class PrismaChatRepository implements IChatRepository {
  private logger: ILogger
  constructor(appContext: AppContext, private prisma: PrismaClient) { this.logger = appContext.logger }
  async findReplay(input: ChatMessageWrite, authorize: (room: ChatRoomRecord) => void): Promise<ChatMessageRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      authorize(await this.lockRoom(tx, input.roomId))
      const message = await tx.chatMessage.findUnique({ where: { id: input.clientMessageId }, include: messageInclude })
      if (message && !sameMessage(message, input)) messageConflict()
      return message
    })
  }
  findAttachment(roomId: string, attachmentId: string): Promise<ChatAttachment | null> {
    return this.prisma.chatAttachment.findFirst({ where: { id: attachmentId, message: { threadId: roomId, deletedAt: null } } })
  }
  async referencedStorageKeys(keys: string[]): Promise<string[]> {
    return (await this.prisma.chatAttachment.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } })).map((file) => file.storageKey)
  }
  findShopById(shopId: string): Promise<ChatShopRecord | null> {
    return this.prisma.shop.findUnique({ where: { id: shopId }, select: shopSelect })
  }
  findProductById(productId: string): Promise<ChatProductRecord | null> {
    return this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true, slug: true, shopId: true } })
  }
  findOrderContext(orderId: string): Promise<(ChatOrderRecord & { items: Array<{ shopId: string }> }) | null> {
    return this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true, userId: true, items: { select: { shopId: true } } } })
  }
  findRoomByBuyerAndShop(buyerId: string, shopId: string): Promise<ChatRoomRecord | null> {
    return this.prisma.chatThread.findUnique({ where: { buyerId_shopId: { buyerId, shopId } }, include: roomInclude })
  }
  findRoomById(roomId: string): Promise<ChatRoomRecord | null> {
    return this.prisma.chatThread.findUnique({ where: { id: roomId }, include: roomInclude })
  }
  async createRoom(input: { buyerId: string; shopId: string }): Promise<ChatRoomRecord> {
    try {
      return await this.prisma.chatThread.upsert({ where: { buyerId_shopId: input }, create: input, update: {}, include: roomInclude })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const existing = await this.findRoomByBuyerAndShop(input.buyerId, input.shopId)
      if (!existing) throw error
      return existing
    }
  }
  listBuyerRooms(buyerId: string): Promise<ChatRoomRecord[]> {
    return this.prisma.chatThread.findMany({ where: { buyerId }, include: roomInclude, orderBy: { updatedAt: 'desc' } })
  }
  listSellerRooms(ownerId: string): Promise<ChatRoomRecord[]> {
    return this.prisma.chatThread.findMany({ where: { shop: { ownerId, status: 'ACTIVE' } }, include: roomInclude, orderBy: { updatedAt: 'desc' } })
  }
  async createMessage(input: ChatMessageWrite, authorize: (room: ChatRoomRecord) => void): Promise<{ message: ChatMessageRecord; created: boolean }> {
    this.logger.info('PrismaChatRepository.createMessage', { roomId: input.roomId, senderId: input.senderId })
    try {
      return await this.prisma.$transaction(async (tx) => {
        const room = await this.lockRoom(tx, input.roomId)
        authorize(room)
        const existing = await tx.chatMessage.findUnique({ where: { id: input.clientMessageId }, include: messageInclude })
        if (existing) {
          if (!sameMessage(existing, input)) messageConflict()
          return { message: existing, created: false }
        }
        const latest = await tx.chatMessage.findFirst({ where: { threadId: input.roomId }, orderBy: descending, select: { createdAt: true } })
        const createdAt = new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1))
        const message = await tx.chatMessage.create({ data: {
          id: input.clientMessageId, threadId: input.roomId, senderId: input.senderId, messageType: input.messageType,
          body: input.body, attachments: [], productId: input.productId, orderId: input.orderId, createdAt,
          files: { create: input.files },
        }, include: messageInclude })
        await tx.chatThread.update({ where: { id: input.roomId }, data: { lastMessageAt: createdAt, updatedAt: createdAt } })
        return { message, created: true }
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const existing = await this.prisma.chatMessage.findUnique({ where: { id: input.clientMessageId }, include: messageInclude })
      if (!existing || !sameMessage(existing, input)) messageConflict()
      const room = await this.findRoomById(input.roomId)
      if (!room) throw error
      authorize(room)
      return { message: existing, created: false }
    }
  }
  async listMessages(roomId: string, pagination: NormalizedChatPagination): Promise<ChatMessagePage> {
    return this.prisma.$transaction(async (tx) => {
      const cursorId = pagination.before ?? pagination.after
      const cursor = cursorId ? await tx.chatMessage.findFirst({ where: { id: cursorId, threadId: roomId }, select: { id: true, createdAt: true } }) : null
      if (cursorId && !cursor) throw new ChatServiceError('Invalid message cursor', 400, 'INVALID_MESSAGE_CURSOR')
      const where: Prisma.ChatMessageWhereInput = {
        threadId: roomId, deletedAt: null,
        ...(cursor ? tupleFilter(cursor, pagination.after ? 'gt' : 'lt') : {}),
      }
      const rows = await tx.chatMessage.findMany({ where, include: messageInclude, orderBy: pagination.after ? ascending : descending,
        skip: cursor ? 0 : (pagination.page - 1) * pagination.limit, take: pagination.limit + 1 })
      const total = await tx.chatMessage.count({ where: { threadId: roomId, deletedAt: null } })
      const items = rows.slice(0, pagination.limit)
      return { items: pagination.after ? items : items.reverse(), total, hasMore: rows.length > pagination.limit }
    }, { isolationLevel: 'RepeatableRead' })
  }
  countUnreadMessages(roomId: string, userId: string, readAt: Date | null, readMessageId: string | null): Promise<number> {
    return this.prisma.chatMessage.count({ where: {
      threadId: roomId, senderId: { not: userId }, deletedAt: null,
      ...(readAt ? readMessageId ? tupleFilter({ createdAt: readAt, id: readMessageId }, 'gt') : { createdAt: { gt: readAt } } : {}),
    } })
  }
  async markRead(roomId: string, audience: ChatAudience, throughMessageId: string | undefined, authorize: (room: ChatRoomRecord) => void): Promise<ChatRoomRecord> {
    return this.prisma.$transaction(async (tx) => {
      const room = await this.lockRoom(tx, roomId)
      authorize(room)
      const requested = await tx.chatMessage.findFirst({ where: { threadId: roomId, deletedAt: null, ...(throughMessageId ? { id: throughMessageId } : {}) }, orderBy: descending, select: { id: true, createdAt: true } })
      if (!requested) {
        if (throughMessageId) throw new ChatServiceError('Invalid read boundary', 400, 'INVALID_READ_BOUNDARY')
        return room
      }
      const readAt = audience === 'seller' ? room.sellerReadAt : room.buyerReadAt
      const readId = audience === 'seller' ? room.sellerReadMessageId : room.buyerReadMessageId
      const newer = !readAt || requested.createdAt.getTime() > readAt.getTime()
        || (requested.createdAt.getTime() === readAt.getTime() && readId !== null && requested.id > readId)
      if (!newer) return room
      return tx.chatThread.update({ where: { id: roomId }, data: {
        ...(audience === 'seller' ? { sellerReadAt: requested.createdAt, sellerReadMessageId: requested.id } : { buyerReadAt: requested.createdAt, buyerReadMessageId: requested.id }),
        updatedAt: room.updatedAt,
      }, include: roomInclude })
    })
  }
  private async lockRoom(tx: Prisma.TransactionClient, roomId: string): Promise<ChatRoomRecord> {
    await tx.$queryRaw`SELECT "id" FROM "ChatThread" WHERE "id" = ${roomId}::uuid FOR UPDATE`
    const room = await tx.chatThread.findUnique({ where: { id: roomId }, include: roomInclude })
    if (!room) throw new ChatServiceError('Chat room not found', 404, 'CHAT_ROOM_NOT_FOUND')
    return room
  }
}
