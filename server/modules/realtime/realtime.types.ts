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
  sessionId: string
  send(data: string): void
  close(): void
}

export type RealtimeDeliveryDecision =
  | { status: 'allowed'; expiresAt: Date }
  | { status: 'drop-connection' | 'drop-channel' | 'deny' }

export type RealtimeDeliveryAuthorizer = (
  connection: RealtimeConnection,
  channel: string,
) => Promise<RealtimeDeliveryDecision>

export interface RealtimeSubscribeMessage {
  action: 'subscribe' | 'unsubscribe'
  channel: string
}
