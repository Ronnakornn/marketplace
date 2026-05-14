import type { ChatMessageType, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeService } from '#server/modules/realtime'
import { ChatServiceError } from './chat.errors.ts'
import type { ChatMessageRecord, ChatRoomRecord, IChatRepository } from './chat.repository.ts'
import type {
  ChatActor,
  ChatMessageKind,
  ChatMessageResponse,
  ChatPaginationInput,
  ChatRoomResponse,
  CreateChatRoomInput,
  NormalizedChatPagination,
  SendChatMessageInput,
} from './chat.types.ts'

export class ChatService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IChatRepository,
    private realtimeService?: RealtimeService,
  ) {
    this.logger = appContext.logger
  }

  async listRooms(actor: ChatActor): Promise<ChatRoomResponse[]> {
    this.assertSupportedRole(actor.role)
    const rooms = actor.role === 'SELLER'
      ? await this.repo.listSellerRooms(actor.id)
      : await this.repo.listBuyerRooms(actor.id)
    return Promise.all(rooms.map((room) => this.toRoomResponse(room, actor)))
  }

  async getRoom(actor: ChatActor, roomId: string, input: ChatPaginationInput = {}): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId)
    const pagination = this.normalizePagination(input)
    const messagePage = await this.repo.listMessages(room.id, pagination)
    return this.toRoomResponse(room, actor, messagePage.items, {
      page: pagination.page,
      limit: pagination.limit,
      total: messagePage.total,
      totalPages: messagePage.total === 0 ? 0 : Math.ceil(messagePage.total / pagination.limit),
    })
  }

  async createRoom(actor: ChatActor, input: CreateChatRoomInput): Promise<ChatRoomResponse> {
    if (actor.role !== 'USER') {
      throw new ChatServiceError('Only buyers can create chat rooms', 403, 'CHAT_FORBIDDEN')
    }
    const shop = await this.repo.findShopById(input.shopId)
    if (!shop) throw new ChatServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    if (shop.ownerId === actor.id) {
      throw new ChatServiceError('Buyer cannot create chat with own shop', 403, 'CHAT_FORBIDDEN')
    }

    await this.assertOptionalContext(actor, input)
    const existing = await this.repo.findRoomByBuyerAndShop(actor.id, input.shopId)
    if (existing) return this.toRoomResponse(existing, actor)

    this.logger.info('ChatService.createRoom', { buyerId: actor.id, shopId: input.shopId })
    const room = await this.repo.createRoom({
      buyerId: actor.id,
      shopId: input.shopId,
      productId: input.productId,
      orderId: input.orderId,
    })
    return this.toRoomResponse(room, actor)
  }

  async sendMessage(actor: ChatActor, roomId: string, input: SendChatMessageInput): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId)
    const normalized = this.normalizeMessageInput(input)
    const message = await this.repo.createMessage({
      roomId: room.id,
      senderId: actor.id,
      messageType: normalized.messageType,
      body: normalized.body,
      attachments: normalized.attachments,
    })
    const updated = await this.repo.findRoomById(room.id)
    if (!updated) throw new ChatServiceError('Chat room not found', 404, 'CHAT_ROOM_NOT_FOUND')
    const response = await this.toRoomResponse(updated, actor)
    this.publishChatMessage(updated, message)
    return response
  }

  async markRead(actor: ChatActor, roomId: string): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId)
    const readAt = new Date()
    const updated = actor.role === 'SELLER'
      ? await this.repo.markSellerRead(room.id, readAt)
      : await this.repo.markBuyerRead(room.id, readAt)
    const response = await this.toRoomResponse(updated, actor)
    this.realtimeService?.publish('chat.room.read', `chat:${updated.id}`, {
      roomId: updated.id,
      readerId: actor.id,
      readerRole: actor.role,
      readAt,
    })
    return response
  }

  private async assertOptionalContext(actor: ChatActor, input: CreateChatRoomInput): Promise<void> {
    if (input.productId) {
      const product = await this.repo.findProductById(input.productId)
      if (!product || product.shopId !== input.shopId) {
        throw new ChatServiceError('Invalid product context', 400, 'INVALID_MESSAGE')
      }
    }
    if (input.orderId) {
      const order = await this.repo.findOrderContext(input.orderId)
      const orderIncludesShop = order?.items.some((item) => item.shopId === input.shopId) ?? false
      if (!order || order.userId !== actor.id || !orderIncludesShop) {
        throw new ChatServiceError('Invalid order context', 400, 'INVALID_MESSAGE')
      }
    }
  }

  private async findAccessibleRoom(actor: ChatActor, roomId: string): Promise<ChatRoomRecord> {
    const room = await this.repo.findRoomById(roomId)
    if (!room) throw new ChatServiceError('Chat room not found', 404, 'CHAT_ROOM_NOT_FOUND')
    if (actor.role === 'USER' && room.buyerId === actor.id) return room
    if (actor.role === 'SELLER' && room.shop.ownerId === actor.id) return room
    throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
  }

  private normalizeMessageInput(input: SendChatMessageInput): {
    messageType: ChatMessageType
    body: string | null
    attachments: string[]
  } {
    if (input.messageType !== 'text' && input.messageType !== 'image') {
      throw new ChatServiceError('Invalid message type', 400, 'INVALID_MESSAGE')
    }
    const body = input.body?.trim() ?? ''
    const attachments = input.attachments?.map((item) => item.trim()).filter(Boolean) ?? []

    if (input.messageType === 'text' && !body) {
      throw new ChatServiceError('Text message body is required', 400, 'MESSAGE_BODY_REQUIRED')
    }
    if (input.messageType === 'image' && attachments.length === 0) {
      throw new ChatServiceError('Image message attachments are required', 400, 'ATTACHMENT_REQUIRED')
    }

    return {
      messageType: input.messageType === 'text' ? 'TEXT' : 'IMAGE',
      body: body || null,
      attachments,
    }
  }

  private normalizePagination(input: ChatPaginationInput): NormalizedChatPagination {
    const page = Number(input.page ?? 1)
    const requestedLimit = Number(input.limit ?? 20)
    const limit = Math.min(requestedLimit, 50)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new ChatServiceError('Invalid message pagination', 400, 'INVALID_MESSAGE')
    }
    return { page, limit }
  }

  private assertSupportedRole(role: Role): void {
    if (role !== 'USER' && role !== 'SELLER') {
      throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
    }
  }

  private async toRoomResponse(
    room: ChatRoomRecord,
    actor: ChatActor,
    messages?: ChatMessageRecord[],
    pagination?: ChatRoomResponse['pagination'],
  ): Promise<ChatRoomResponse> {
    const readAt = actor.role === 'SELLER' ? room.sellerReadAt : room.buyerReadAt
    const unreadCount = await this.repo.countUnreadMessages(room.id, actor.id, readAt)
    return {
      roomId: room.id,
      shop: room.shop,
      buyer: room.buyer,
      product: room.product,
      order: room.order,
      lastMessage: room.messages[0] ? this.toMessageResponse(room.messages[0]) : null,
      unreadCount,
      ...(messages ? { messages: messages.map((message) => this.toMessageResponse(message)) } : {}),
      ...(pagination ? { pagination } : {}),
    }
  }

  private toMessageResponse(message: ChatMessageRecord): ChatMessageResponse {
    return {
      id: message.id,
      sender: message.sender,
      messageType: this.toPublicMessageType(message.messageType),
      body: message.body,
      attachments: message.attachments,
      createdAt: message.createdAt,
    }
  }

  private toPublicMessageType(messageType: ChatMessageType): ChatMessageKind {
    return messageType === 'IMAGE' ? 'image' : 'text'
  }

  private publishChatMessage(room: ChatRoomRecord, message: ChatMessageRecord): void {
    const payload = {
      roomId: room.id,
      shopId: room.shopId,
      buyerId: room.buyerId,
      message: this.toMessageResponse(message),
    }
    this.realtimeService?.publish('chat.message.created', `chat:${room.id}`, payload)
    this.realtimeService?.publish('chat.message.created', `seller:${room.shopId}:chats`, payload)
  }
}
