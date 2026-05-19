import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeAdapter } from './realtime.adapter.ts'
import { RealtimeServiceError } from './realtime.errors.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import type { RealtimeActor, RealtimeConnection, RealtimeEvent, RealtimeEventName } from './realtime.types.ts'

export class RealtimeService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IRealtimeRepository,
    private adapter: RealtimeAdapter,
  ) {
    this.logger = appContext.logger
  }

  addConnection(connection: RealtimeConnection): void {
    this.adapter.addConnection(connection)
  }

  removeConnection(connectionId: string): void {
    this.adapter.removeConnection(connectionId)
  }

  async subscribe(actor: RealtimeActor, connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    await this.assertCanSubscribe(actor, channel)
    this.adapter.subscribe(connectionId, channel)
    return { ok: true, channel }
  }

  async unsubscribe(actor: RealtimeActor, connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    await this.assertCanSubscribe(actor, channel)
    this.adapter.unsubscribe(connectionId, channel)
    return { ok: true, channel }
  }

  publish<TPayload>(event: RealtimeEventName, channel: string, payload: TPayload): number {
    const realtimeEvent: RealtimeEvent<TPayload> = {
      event,
      channel,
      payload,
      createdAt: new Date().toISOString(),
    }
    return this.adapter.publish(realtimeEvent)
  }

  async assertCanSubscribe(actor: RealtimeActor, channel: string): Promise<void> {
    if (!actor?.id) {
      throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
    }
    if (channel === `user:${actor.id}:notifications`) return
    if (channel.startsWith('user:') && channel.endsWith(':notifications')) {
      throw new RealtimeServiceError('Notification channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    if (channel.startsWith('chat:')) {
      const roomId = channel.slice('chat:'.length)
      if (!roomId) throw new RealtimeServiceError('Invalid realtime channel', 400, 'REALTIME_INVALID_CHANNEL')
      const room = await this.repo.findChatRoomAccess(roomId)
      if (!room) throw new RealtimeServiceError('Chat room not found', 404, 'REALTIME_CHANNEL_NOT_FOUND')
      if (room.buyerId === actor.id) return
      if (room.shop.ownerId === actor.id && room.shop.status === 'ACTIVE') return
      throw new RealtimeServiceError('Chat channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    if (channel.startsWith('seller:') && channel.endsWith(':chats')) {
      const shopId = channel.slice('seller:'.length, -':chats'.length)
      if (!shopId) throw new RealtimeServiceError('Invalid realtime channel', 400, 'REALTIME_INVALID_CHANNEL')
      const ownerId = await this.repo.findShopOwnerId(shopId)
      if (!ownerId) throw new RealtimeServiceError('Seller channel not found', 404, 'REALTIME_CHANNEL_NOT_FOUND')
      if (ownerId === actor.id) return
      throw new RealtimeServiceError('Seller chat channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    throw new RealtimeServiceError('Invalid realtime channel', 400, 'REALTIME_INVALID_CHANNEL')
  }

  logConnectionError(error: unknown, metadata?: Record<string, unknown>): void {
    this.logger.warn('Realtime connection error', {
      ...metadata,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
