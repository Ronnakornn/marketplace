import type { Role } from '#generated/client/enums.ts'

export type ChatMessageKind = 'text' | 'image'
export type ChatAudience = 'buyer' | 'seller'

export interface ChatActor {
  id: string
  role: Role
}

export interface CreateChatRoomInput {
  shopId: string
  productId?: string
  orderId?: string
}

export interface SendChatMessageInput {
  messageType: ChatMessageKind
  body?: string
  attachments?: string[]
  scope?: ChatAudience
}

export interface ChatPaginationInput {
  page?: number | string
  limit?: number | string
  scope?: ChatAudience
  shopId?: string
}

export interface NormalizedChatPagination {
  page: number
  limit: number
}

export interface ChatUserSummary {
  id: string
  name: string
  email: string
  role: string
}

export interface ChatShopSummary {
  id: string
  name: string
  slug: string
  ownerId: string
}

export interface ChatMessageResponse {
  id: string
  sender: ChatUserSummary
  messageType: ChatMessageKind
  body: string | null
  attachments: string[]
  createdAt: Date
}

export interface ChatRoomResponse {
  roomId: string
  shop: ChatShopSummary
  buyer: ChatUserSummary
  product?: {
    id: string
    title: string
    slug: string
  } | null
  order?: {
    id: string
    orderNumber: string
    status: string
  } | null
  lastMessage: ChatMessageResponse | null
  unreadCount: number
  messages?: ChatMessageResponse[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
