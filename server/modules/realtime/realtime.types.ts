import type { Role } from '#generated/client/enums.ts'

export type RealtimeEventName =
  | 'chat.message.created'
  | 'chat.room.read'
  | 'notification.created'
  | 'notification.read'

export interface RealtimeActor {
  id: string
  role: Role
}

export interface RealtimeEvent<TPayload = unknown> {
  event: RealtimeEventName
  channel: string
  payload: TPayload
  createdAt: string
}

export interface RealtimeConnection {
  id: string
  userId: string
  send(data: string): void
}

export interface RealtimeSubscribeMessage {
  action: 'subscribe' | 'unsubscribe'
  channel: string
}
