import type { Role } from '#generated/client/enums.ts'

import type { ChatAttachment } from '#generated/client/client.ts'
export type ChatMessageKind = 'text' | 'image' | 'file'
export type ChatAudience = 'buyer' | 'seller'
export interface ChatActor { id: string; role: Role }
export interface CreateChatRoomInput { shopId: string; productId?: string; orderId?: string }
export interface SendChatMessageInput {
  messageType: 'text' | 'image'
  body?: string
  attachments?: string[]
  clientMessageId?: string
  productId?: string
  orderId?: string
  scope?: ChatAudience
  files?: File[]
  replyToMessageId?: string
  replyToAttachmentId?: string
}
export interface ChatPaginationInput {
  page?: number | string
  limit?: number | string
  before?: string
  after?: string
  scope?: ChatAudience
  shopId?: string
}
export interface NormalizedChatPagination { page: number; limit: number; before?: string; after?: string }
export interface ChatInboxInput { scope?: ChatAudience; shopId?: string; q?: string; unreadOnly?: boolean; limit?: number; cursor?: string }
export interface NormalizedChatInbox extends Omit<ChatInboxInput, 'cursor' | 'limit'> { limit: number; cursor?: { updatedAt: Date; id: string } }
export interface ChatInboxResponse { items: ChatRoomResponse[]; pagination: { limit: number; hasMore: boolean; nextCursor: string | null } }
export interface ChatUserSummary { id: string; name: string; email: string; role: string }
export interface ChatShopSummary { id: string; name: string; slug: string; ownerId: string }
export interface ChatReadBoundary { messageId: string | null; createdAt: string }
export interface ChatMessageResponse {
  contentVersion: number
  deleted: boolean
  reply: null | { messageId: string; attachmentId: string | null; contentVersion: number; unavailable: boolean; sender: ChatUserSummary; body: string | null; image: ChatMessageResponse['files'][number] | null }
  id: string
  sender: ChatUserSummary
  messageType: ChatMessageKind
  body: string | null
  attachments: string[]
  files: Array<Pick<ChatAttachment, 'id' | 'fileName' | 'contentType' | 'byteSize' | 'kind'> & { contentUrl: string }>
  createdAt: string
  product: { id: string; title: string; slug: string } | null
  order: { id: string; orderNumber: string; status: string } | null
}
export interface ChatRoomResponse {
  contentRevision: string
  roomId: string
  shop: ChatShopSummary
  buyer: ChatUserSummary
  lastMessage: ChatMessageResponse | null
  unreadCount: number
  canSend: boolean
  chatEnabled: boolean
  readBoundary: ChatReadBoundary | null
  otherReadBoundary: ChatReadBoundary | null
  messages?: ChatMessageResponse[]
  sentMessage?: ChatMessageResponse
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
    beforeCursor: string | null
    afterCursor: string | null
  }
}
