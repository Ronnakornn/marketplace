import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { NotificationService } from '#server/modules/notification/notification.service.ts'
import type { RealtimeService } from '#server/modules/realtime'
import { ChatServiceError } from './chat.errors.ts'
import { validateChatFiles, type StoredChatFile } from './chat.attachments.ts'
import type { ChatPrivateObjectStore } from '#server/modules/upload/upload.types.ts'
import type { ChatMessageRecord, ChatMessageWrite, ChatRoomRecord, IChatRepository } from './chat.repository.ts'
import type { ChatActor, ChatAudience, ChatMessageResponse, ChatPaginationInput, ChatRoomResponse, CreateChatRoomInput, NormalizedChatPagination, SendChatMessageInput } from './chat.types.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class ChatService {
  private logger: ILogger
  constructor(appContext: AppContext, private repo: IChatRepository, private realtimeService?: RealtimeService, private notificationService?: NotificationService, private objects?: ChatPrivateObjectStore) {
    this.logger = appContext.logger
  }
  async listRooms(actor: ChatActor, scope?: ChatAudience, shopId?: string): Promise<ChatRoomResponse[]> {
    this.assertSupportedRole(actor.role)
    const [buyerRooms, sellerRooms] = await Promise.all([
      scope === 'seller' ? Promise.resolve([]) : this.repo.listBuyerRooms(actor.id),
      scope === 'buyer' ? Promise.resolve([]) : this.repo.listSellerRooms(actor.id),
    ])
    const rooms = [...new Map([...buyerRooms, ...sellerRooms].map((room) => [room.id, room])).values()]
      .filter((room) => !shopId || room.shopId === shopId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return Promise.all(rooms.map((room) => this.toRoomResponse(room, actor)))
  }
  async getRoom(actor: ChatActor, roomId: string, input: ChatPaginationInput = {}): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId, input.scope)
    if (input.shopId && room.shopId !== input.shopId) throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
    const pagination = this.normalizePagination(input)
    const page = await this.repo.listMessages(room.id, pagination)
    return this.toRoomResponse(room, actor, page.items, {
      page: pagination.page, limit: pagination.limit, total: page.total,
      totalPages: page.total ? Math.ceil(page.total / pagination.limit) : 0,
      hasMore: page.hasMore, beforeCursor: page.items[0]?.id ?? null, afterCursor: page.items.at(-1)?.id ?? null,
    })
  }
  async createRoom(actor: ChatActor, input: CreateChatRoomInput): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    const shop = await this.repo.findShopById(input.shopId)
    if (!shop) throw new ChatServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    if (shop.status !== 'ACTIVE') throw new ChatServiceError('Shop is unavailable', 403, 'SELLER_SHOP_NOT_ACTIVE')
    if (shop.settings?.chatEnabled === false) throw new ChatServiceError('Shop chat is disabled', 403, 'SHOP_CHAT_DISABLED')
    if (shop.ownerId === actor.id) throw new ChatServiceError('Buyer cannot create chat with own shop', 403, 'CHAT_FORBIDDEN')
    await this.assertOptionalContext(actor.id, input)
    const existing = await this.repo.findRoomByBuyerAndShop(actor.id, input.shopId)
    if (existing) return this.toRoomResponse(existing, actor)
    const room = await this.repo.createRoom({ buyerId: actor.id, shopId: input.shopId })
    return this.toRoomResponse(room, actor)
  }
  async sendMessage(actor: ChatActor, roomId: string, input: SendChatMessageInput): Promise<ChatRoomResponse & { sentMessage: ChatMessageResponse }> {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId, input.scope)
    this.assertCanSend(actor, room, input.scope)
    const body = this.normalizeMessageInput(input)
    await this.assertOptionalContext(room.buyerId, { shopId: room.shopId, productId: input.productId, orderId: input.orderId })
    const validated = await validateChatFiles(input.files ?? [])
    const prepared = validated.map(({ bytes, ...metadata }) => ({ bytes, file: { ...metadata, storageKey: `private/chat/${crypto.randomUUID()}` } satisfies StoredChatFile }))
    const files = prepared.map((entry) => entry.file)
    const write: ChatMessageWrite = {
      roomId: room.id, senderId: actor.id, clientMessageId: input.clientMessageId?.toLowerCase() ?? crypto.randomUUID(),
      body, productId: input.productId?.toLowerCase() ?? null, orderId: input.orderId?.toLowerCase() ?? null,
      messageType: files.length ? files.every((file) => file.kind === 'IMAGE') ? 'IMAGE' : 'FILE' : 'TEXT', files,
      replyToMessageId: input.replyToMessageId?.toLowerCase() ?? null, replyToAttachmentId: input.replyToAttachmentId?.toLowerCase() ?? null,
    }
    const authorize = (lockedRoom: ChatRoomRecord) => this.assertCanSend(actor, lockedRoom, input.scope)
    const replay = files.length ? await this.repo.findReplay(write, authorize) : null
    const ownedKeys: string[] = []
    let result: { message: ChatMessageRecord; created: boolean }
    if (replay) result = { message: replay, created: false }
    else {
      try {
        if (files.length && !this.objects) throw new ChatServiceError('Chat attachment storage unavailable', 503, 'CHAT_STORAGE_UNAVAILABLE')
        for (const { file, bytes } of prepared) {
          ownedKeys.push(file.storageKey)
          await this.objects?.putNew({ key: file.storageKey, bytes, contentType: file.contentType })
        }
      } catch (error) {
        await this.cleanupUnreferenced(ownedKeys)
        throw error
      }
      result = await this.repo.createMessage(write, authorize)
      if (!result.created) await this.cleanupUnreferenced(ownedKeys)
    }
    const { message, created } = result
    const updated = await this.repo.findRoomById(room.id)
    if (!updated) throw new ChatServiceError('Chat room not found', 404, 'CHAT_ROOM_NOT_FOUND')
    if (created) {
      await this.publishChatMessage(updated, message)
      await this.notifyRecipient(updated, message)
    }
    return { ...await this.toRoomResponse(updated, actor), sentMessage: this.toMessageResponse(message) }
  }
  async openAttachment(actor: ChatActor, roomId: string, attachmentId: string, scope?: ChatAudience, shopId?: string) {
    this.assertSupportedRole(actor.role)
    const room = await this.findAccessibleRoom(actor, roomId, scope)
    if (shopId && shopId !== room.shopId) throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
    const attachment = await this.repo.findAttachment(roomId, attachmentId)
    if (!attachment) throw new ChatServiceError('Attachment not found', 404, 'CHAT_ATTACHMENT_NOT_FOUND')
    if (!this.objects) throw new ChatServiceError('Chat attachment storage unavailable', 503, 'CHAT_STORAGE_UNAVAILABLE')
    return { attachment, stream: await this.objects.read(attachment.storageKey) }
  }
  async refreshMessages(actor: ChatActor, roomId: string, input: { messageIds: string[]; scope?: ChatAudience; shopId?: string }) {
    this.assertSupportedRole(actor.role)
    if (!input.messageIds.length || input.messageIds.length > 50 || new Set(input.messageIds.map((id) => id.toLowerCase())).size !== input.messageIds.length || input.messageIds.some((id) => !uuid.test(id))) {
      throw new ChatServiceError('Invalid message IDs', 400, 'INVALID_MESSAGE')
    }
    const { room, messages } = await this.repo.refreshMessages(roomId, input.messageIds, (room) => this.assertScopedParticipant(actor, room, input))
    return { contentRevision: room.contentRevision.toString(), messages: messages.map((message) => this.toMessageResponse(message)) }
  }
  async deleteContent(actor: ChatActor, roomId: string, messageId: string, input: { attachmentId?: string; scope?: ChatAudience; shopId?: string } = {}) {
    this.assertSupportedRole(actor.role)
    const result = await this.repo.deleteContent({ roomId, messageId, attachmentId: input.attachmentId, senderId: actor.id }, (room) => this.assertScopedParticipant(actor, room, input))
    if (result.changed) {
      const payload = { roomId, shopId: result.room.shopId, messageId, contentRevision: result.room.contentRevision.toString() }
      for (const channel of [`chat:${roomId}`, `user:${result.room.buyerId}:chats`, `seller:${result.room.shopId}:chats`]) {
        await this.realtimeService?.publish('chat.message.changed', channel, payload)
      }
    }
    return { ...await this.toRoomResponse(result.room, actor), changedMessage: this.toMessageResponse(result.message) }
  }
  private assertScopedParticipant(actor: ChatActor, room: ChatRoomRecord, input: { scope?: ChatAudience; shopId?: string }) {
    this.assertParticipant(actor, room, input.scope)
    if (input.shopId && input.shopId !== room.shopId) throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
  }
  private async cleanupUnreferenced(keys: string[]): Promise<void> {
    if (!keys.length || !this.objects) return
    try {
      const referenced = new Set(await this.repo.referencedStorageKeys(keys))
      for (const key of keys) if (!referenced.has(key)) await this.objects.remove(key)
    } catch (error) { this.logger.warn('Chat attachment cleanup deferred', { error: error instanceof Error ? error.message : String(error) }) }
  }
  async reconcileAttachments(input: { cursor?: string; limit?: number; now?: Date } = {}) {
    if (!this.objects) throw new Error('Chat attachment storage unavailable')
    const page = await this.objects.list({ cursor: input.cursor, limit: Math.max(1, Math.min(input.limit ?? 100, 100)) })
    const threshold = (input.now ?? new Date()).getTime() - 48 * 60 * 60 * 1000
    const candidates = page.items.filter((item) => item.createdAt.getTime() < threshold)
    const referenced = new Set(await this.repo.referencedStorageKeys(candidates.map((item) => item.key)))
    let removed = 0
    for (const item of candidates) if (!referenced.has(item.key)) { await this.objects.remove(item.key); removed++ }
    return { removed, examined: page.items.length, cursor: page.cursor }
  }
  async markRead(actor: ChatActor, roomId: string, scope?: ChatAudience, throughMessageId?: string): Promise<ChatRoomResponse> {
    this.assertSupportedRole(actor.role)
    if (throughMessageId && !uuid.test(throughMessageId)) throw new ChatServiceError('Invalid read boundary', 400, 'INVALID_READ_BOUNDARY')
    const room = await this.findAccessibleRoom(actor, roomId, scope)
    const audience = this.isSellerParticipant(actor, room) ? 'seller' : 'buyer'
    const updated = await this.repo.markRead(room.id, audience, throughMessageId, (lockedRoom) => this.assertParticipant(actor, lockedRoom, scope))
    const response = await this.toRoomResponse(updated, actor)
    const previousReadAt = audience === 'seller' ? room.sellerReadAt : room.buyerReadAt
    const previousReadId = audience === 'seller' ? room.sellerReadMessageId : room.buyerReadMessageId
    if (!response.readBoundary && !previousReadAt) return response
    if (response.readBoundary?.messageId === previousReadId
      && response.readBoundary?.createdAt === (previousReadAt ? new Date(previousReadAt).toISOString() : undefined)) return response
    const payload = { roomId: updated.id, shopId: updated.shopId, readerId: actor.id, readBoundary: response.readBoundary }
    await this.realtimeService?.publish('chat.room.read', `chat:${updated.id}`, payload)
    await this.realtimeService?.publish('chat.room.read', `user:${updated.buyerId}:chats`, payload)
    await this.realtimeService?.publish('chat.room.read', `seller:${updated.shopId}:chats`, payload)
    return response
  }
  private async assertOptionalContext(buyerId: string, input: CreateChatRoomInput): Promise<void> {
    if (input.productId) {
      const product = await this.repo.findProductById(input.productId)
      if (!product || product.shopId !== input.shopId) throw new ChatServiceError('Invalid product context', 400, 'INVALID_MESSAGE')
    }
    if (input.orderId) {
      const order = await this.repo.findOrderContext(input.orderId)
      if (!order || order.userId !== buyerId || !order.items.some((item) => item.shopId === input.shopId)) {
        throw new ChatServiceError('Invalid order context', 400, 'INVALID_MESSAGE')
      }
    }
  }
  private async findAccessibleRoom(actor: ChatActor, roomId: string, scope?: ChatAudience): Promise<ChatRoomRecord> {
    const room = await this.repo.findRoomById(roomId)
    if (!room) throw new ChatServiceError('Chat room not found', 404, 'CHAT_ROOM_NOT_FOUND')
    this.assertParticipant(actor, room, scope)
    return room
  }
  private assertParticipant(actor: ChatActor, room: ChatRoomRecord, scope?: ChatAudience): void {
    if (scope !== 'seller' && room.buyerId === actor.id) return
    if (scope !== 'buyer' && this.isSellerParticipant(actor, room)) return
    throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
  }
  private assertCanSend(actor: ChatActor, room: ChatRoomRecord, scope?: ChatAudience): void {
    this.assertParticipant(actor, room, scope)
    if (room.shop.status !== 'ACTIVE') throw new ChatServiceError('Shop is unavailable', 403, 'SELLER_SHOP_NOT_ACTIVE')
    if (room.shop.settings?.chatEnabled === false) throw new ChatServiceError('Shop chat is disabled', 403, 'SHOP_CHAT_DISABLED')
  }
  private normalizeMessageInput(input: SendChatMessageInput): string | null {
    if (input.replyToAttachmentId && !input.replyToMessageId || input.replyToMessageId && !uuid.test(input.replyToMessageId) || input.replyToAttachmentId && !uuid.test(input.replyToAttachmentId)) throw new ChatServiceError('Invalid reply target', 400, 'INVALID_MESSAGE')
    if (input.messageType !== 'text' && input.messageType !== 'image') throw new ChatServiceError('Invalid message type', 400, 'INVALID_MESSAGE')
    if (input.attachments?.length || input.messageType === 'image' && !input.files?.length) throw new ChatServiceError('Legacy attachment URLs are unsupported', 400, 'CHAT_ATTACHMENT_UNSUPPORTED')
    if (input.clientMessageId && !uuid.test(input.clientMessageId)) throw new ChatServiceError('Invalid message ID', 400, 'INVALID_MESSAGE')
    const body = input.body?.trim() ?? ''
    if (input.files?.length && !input.clientMessageId) throw new ChatServiceError('Attachment messages require a message ID', 400, 'INVALID_MESSAGE')
    if (!body && !input.files?.length) throw new ChatServiceError('Text message body is required', 400, 'MESSAGE_BODY_REQUIRED')
    if (body.length > 4000) throw new ChatServiceError('Message exceeds 4000 characters', 400, 'MESSAGE_TOO_LONG')
    return body || null
  }
  private normalizePagination(input: ChatPaginationInput): NormalizedChatPagination {
    const page = Number(input.page ?? 1)
    const requestedLimit = Number(input.limit ?? 30)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new ChatServiceError('Invalid message pagination', 400, 'INVALID_MESSAGE')
    }
    if (input.before && input.after || input.before && !uuid.test(input.before) || input.after && !uuid.test(input.after)) {
      throw new ChatServiceError('Invalid message cursor', 400, 'INVALID_MESSAGE_CURSOR')
    }
    return { page, limit: Math.min(requestedLimit, 50), ...(input.before ? { before: input.before } : {}), ...(input.after ? { after: input.after } : {}) }
  }
  private assertSupportedRole(role: Role): void {
    if (role === 'ADMIN') throw new ChatServiceError('Chat access forbidden', 403, 'CHAT_FORBIDDEN')
  }
  private isSellerParticipant(actor: ChatActor, room: ChatRoomRecord): boolean {
    return room.shop.ownerId === actor.id && room.shop.status === 'ACTIVE'
  }
  private async toRoomResponse(room: ChatRoomRecord, actor: ChatActor, messages?: ChatMessageRecord[], pagination?: ChatRoomResponse['pagination']): Promise<ChatRoomResponse> {
    const seller = this.isSellerParticipant(actor, room)
    const readAt = seller ? room.sellerReadAt : room.buyerReadAt
    const readId = seller ? room.sellerReadMessageId : room.buyerReadMessageId
    const otherReadAt = seller ? room.buyerReadAt : room.sellerReadAt
    const otherReadId = seller ? room.buyerReadMessageId : room.sellerReadMessageId
    return {
      contentRevision: room.contentRevision.toString(),
      roomId: room.id, shop: { id: room.shop.id, name: room.shop.name, slug: room.shop.slug, ownerId: room.shop.ownerId }, buyer: room.buyer,
      lastMessage: room.messages[0] ? this.toMessageResponse(room.messages[0]) : null,
      unreadCount: await this.repo.countUnreadMessages(room.id, actor.id, readAt, readId),
      chatEnabled: room.shop.settings?.chatEnabled !== false,
      canSend: room.shop.status === 'ACTIVE' && room.shop.settings?.chatEnabled !== false,
      readBoundary: readAt ? { messageId: readId, createdAt: new Date(readAt).toISOString() } : null,
      otherReadBoundary: otherReadAt ? { messageId: otherReadId, createdAt: new Date(otherReadAt).toISOString() } : null,
      ...(messages ? { messages: messages.map((message) => this.toMessageResponse(message)) } : {}),
      ...(pagination ? { pagination } : {}),
    }
  }
  private toMessageResponse(message: ChatMessageRecord): ChatMessageResponse {
    const fileDto = ({ id, fileName, contentType, byteSize, kind }: ChatMessageRecord['files'][number]) => ({ id, fileName, contentType, byteSize, kind, contentUrl: `/api/chats/${message.threadId}/attachments/${id}/content` })
    const files = message.deletedAt ? [] : message.files.filter((file) => !file.deletedAt).map(fileDto)
    const source = message.replyToMessage
    const image = source?.files.find((file) => file.id === message.replyToAttachmentId)
    const unavailable = !source || !!source.deletedAt || !!message.replyToAttachmentId && (!image || !!image.deletedAt)
    const reply = !message.deletedAt && source ? {
      messageId: source.id, attachmentId: message.replyToAttachmentId, contentVersion: source.contentVersion,
      unavailable, sender: source.sender, body: unavailable ? null : source.body,
      image: !unavailable && image ? fileDto(image) : null,
    } : null
    const messageType = files.length ? files.every((file) => file.kind === 'IMAGE') ? 'image' : 'file' : !message.deletedAt && !message.files.length && message.messageType === 'IMAGE' ? 'image' : 'text'
    return { id: message.id, sender: message.sender, contentVersion: message.contentVersion, deleted: !!message.deletedAt, reply, messageType,
      body: message.deletedAt ? null : message.body, files, attachments: message.deletedAt ? [] : message.attachments,
      createdAt: new Date(message.createdAt).toISOString(), product: message.deletedAt ? null : message.product, order: message.deletedAt ? null : message.order }
  }
  private async publishChatMessage(room: ChatRoomRecord, message: ChatMessageRecord): Promise<void> {
    const payload = { roomId: room.id, shopId: room.shopId, buyerId: room.buyerId, message: this.toMessageResponse(message) }
    await this.realtimeService?.publish('chat.message.created', `chat:${room.id}`, payload)
    await this.realtimeService?.publish('chat.message.created', `seller:${room.shopId}:chats`, payload)
    await this.realtimeService?.publish('chat.message.created', `user:${room.buyerId}:chats`, payload)
  }
  private async notifyRecipient(room: ChatRoomRecord, message: ChatMessageRecord): Promise<void> {
    if (!this.notificationService) return
    const recipientId = message.senderId === room.buyerId ? room.shop.ownerId : room.buyerId
    if (recipientId === message.senderId) return
    try {
      await this.notificationService.createNotification(recipientId, 'chat_message', 'New chat message', 'You received a new chat message.', {
        roomId: room.id, shopId: room.shopId, buyerId: room.buyerId, senderId: message.senderId,
        attachmentCount: message.files.length,
      })
    } catch (error) {
      this.logger.warn('ChatService chat notification failed', { roomId: room.id, messageId: message.id, recipientId, error: error instanceof Error ? error.message : String(error) })
    }
  }
}
