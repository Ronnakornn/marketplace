import type { ChatMessage, ChatThread, Order, Prisma, PrismaClient, Product, Shop, User } from '#generated/client/client.ts'
import type { ChatMessageType } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type ChatUserRecord = Pick<User, 'id' | 'name' | 'email' | 'role'>
export type ChatShopRecord = Pick<Shop, 'id' | 'name' | 'slug' | 'ownerId' | 'status'>
export type ChatProductRecord = Pick<Product, 'id' | 'title' | 'slug' | 'shopId'>
export type ChatOrderRecord = Pick<Order, 'id' | 'orderNumber' | 'status' | 'userId'>

export type ChatMessageRecord = Pick<ChatMessage, 'id' | 'threadId' | 'senderId' | 'messageType' | 'body' | 'attachments' | 'createdAt'> & {
  sender: ChatUserRecord
}

export type ChatRoomRecord = Pick<ChatThread, 'id' | 'buyerId' | 'shopId' | 'lastMessageAt' | 'buyerReadAt' | 'sellerReadAt' | 'createdAt' | 'updatedAt'> & {
  buyer: ChatUserRecord
  shop: ChatShopRecord
  messages: ChatMessageRecord[]
}

export interface ChatMessagePage {
  items: ChatMessageRecord[]
  total: number
}

export interface IChatRepository {
  findShopById(shopId: string): Promise<ChatShopRecord | null>
  findProductById(productId: string): Promise<ChatProductRecord | null>
  findOrderContext(orderId: string): Promise<(ChatOrderRecord & { items: Array<{ shopId: string }> }) | null>
  findRoomByBuyerAndShop(buyerId: string, shopId: string): Promise<ChatRoomRecord | null>
  findRoomById(roomId: string): Promise<ChatRoomRecord | null>
  createRoom(input: { buyerId: string; shopId: string; productId?: string; orderId?: string }): Promise<ChatRoomRecord>
  listBuyerRooms(buyerId: string): Promise<ChatRoomRecord[]>
  listSellerRooms(ownerId: string): Promise<ChatRoomRecord[]>
  createMessage(input: { roomId: string; senderId: string; messageType: ChatMessageType; body: string | null; attachments: string[] }): Promise<ChatMessageRecord>
  listMessages(roomId: string, pagination: { page: number; limit: number }): Promise<ChatMessagePage>
  countUnreadMessages(roomId: string, userId: string, readAt: Date | null): Promise<number>
  markBuyerRead(roomId: string, readAt: Date): Promise<ChatRoomRecord>
  markSellerRead(roomId: string, readAt: Date): Promise<ChatRoomRecord>
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const

const messageInclude = {
  sender: { select: userSelect },
} as const

const roomInclude = {
  buyer: { select: userSelect },
  shop: { select: { id: true, name: true, slug: true, ownerId: true, status: true } },
  messages: {
    include: messageInclude,
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} as const

export class PrismaChatRepository implements IChatRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findShopById(shopId: string): Promise<ChatShopRecord | null> {
    this.logger.debug('PrismaChatRepository.findShopById', { shopId })
    return this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, slug: true, ownerId: true, status: true },
    })
  }

  findProductById(productId: string): Promise<ChatProductRecord | null> {
    this.logger.debug('PrismaChatRepository.findProductById', { productId })
    return this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, slug: true, shopId: true },
    })
  }

  findOrderContext(orderId: string): Promise<(ChatOrderRecord & { items: Array<{ shopId: string }> }) | null> {
    this.logger.debug('PrismaChatRepository.findOrderContext', { orderId })
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        userId: true,
        items: { select: { shopId: true } },
      },
    })
  }

  findRoomByBuyerAndShop(buyerId: string, shopId: string): Promise<ChatRoomRecord | null> {
    this.logger.debug('PrismaChatRepository.findRoomByBuyerAndShop', { buyerId, shopId })
    return this.prisma.chatThread.findUnique({
      where: { buyerId_shopId: { buyerId, shopId } },
      include: roomInclude,
    })
  }

  findRoomById(roomId: string): Promise<ChatRoomRecord | null> {
    this.logger.debug('PrismaChatRepository.findRoomById', { roomId })
    return this.prisma.chatThread.findUnique({
      where: { id: roomId },
      include: roomInclude,
    })
  }

  createRoom(input: { buyerId: string; shopId: string }): Promise<ChatRoomRecord> {
    this.logger.info('PrismaChatRepository.createRoom', { buyerId: input.buyerId, shopId: input.shopId })
    return this.prisma.chatThread.create({
      data: {
        buyerId: input.buyerId,
        shopId: input.shopId,
      },
      include: roomInclude,
    })
  }

  listBuyerRooms(buyerId: string): Promise<ChatRoomRecord[]> {
    this.logger.debug('PrismaChatRepository.listBuyerRooms', { buyerId })
    return this.prisma.chatThread.findMany({
      where: { buyerId },
      include: roomInclude,
      orderBy: { updatedAt: 'desc' },
    })
  }

  listSellerRooms(ownerId: string): Promise<ChatRoomRecord[]> {
    this.logger.debug('PrismaChatRepository.listSellerRooms', { ownerId })
    return this.prisma.chatThread.findMany({
      where: { shop: { ownerId, status: 'ACTIVE' } },
      include: roomInclude,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createMessage(input: { roomId: string; senderId: string; messageType: ChatMessageType; body: string | null; attachments: string[] }): Promise<ChatMessageRecord> {
    this.logger.info('PrismaChatRepository.createMessage', { roomId: input.roomId, senderId: input.senderId, messageType: input.messageType })
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          threadId: input.roomId,
          senderId: input.senderId,
          messageType: input.messageType,
          body: input.body,
          attachments: input.attachments,
        },
        include: messageInclude,
      })
      await tx.chatThread.update({
        where: { id: input.roomId },
        data: { updatedAt: new Date() },
      })
      return message
    })
  }

  async listMessages(roomId: string, pagination: { page: number; limit: number }): Promise<ChatMessagePage> {
    const where: Prisma.ChatMessageWhereInput = { threadId: roomId }
    const [items, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.chatMessage.count({ where }),
    ])
    return { items: items.reverse(), total }
  }

  countUnreadMessages(roomId: string, userId: string, readAt: Date | null): Promise<number> {
    return this.prisma.chatMessage.count({
      where: {
        threadId: roomId,
        senderId: { not: userId },
        ...(readAt ? { createdAt: { gt: readAt } } : {}),
      },
    })
  }

  markBuyerRead(roomId: string, readAt: Date): Promise<ChatRoomRecord> {
    return this.prisma.chatThread.update({
      where: { id: roomId },
      data: { buyerReadAt: readAt },
      include: roomInclude,
    })
  }

  markSellerRead(roomId: string, readAt: Date): Promise<ChatRoomRecord> {
    return this.prisma.chatThread.update({
      where: { id: roomId },
      data: { sellerReadAt: readAt },
      include: roomInclude,
    })
  }
}
