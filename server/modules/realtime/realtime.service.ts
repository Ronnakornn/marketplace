import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeAdapter } from './realtime.adapter.ts'
import { RealtimeServiceError } from './realtime.errors.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import type { RealtimeActor, RealtimeConnection, RealtimeDeliveryDecision, RealtimeEvent, RealtimeEventName } from './realtime.types.ts'

export class RealtimeService {
  private logger: ILogger
  private pendingSubscriptions = new Map<RealtimeConnection, Map<string, symbol>>()

  constructor(
    appContext: AppContext,
    private repo: IRealtimeRepository,
    private adapter: RealtimeAdapter,
  ) {
    this.logger = appContext.logger
    this.adapter.setDeliveryAuthorizer((connection, channel) => this.authorizeDelivery(connection, channel))
  }

  addConnection(connection: RealtimeConnection): void {
    this.removeConnection(connection.id)
    this.adapter.addConnection(connection)
  }

  removeConnection(connectionId: string): void {
    const connection = this.adapter.getConnection(connectionId)
    if (connection) this.pendingSubscriptions.delete(connection)
    this.adapter.removeConnection(connectionId)
  }

  async subscribe(connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    const connection = this.adapter.getConnection(connectionId)
    if (!connection) throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
    const requests = this.pendingSubscriptions.get(connection) ?? new Map<string, symbol>()
    const request = Symbol()
    requests.set(channel, request)
    this.pendingSubscriptions.set(connection, requests)
    try {
      const decision = await this.authorizeDelivery(connection, channel)
      if (this.adapter.getConnection(connectionId) !== connection || requests.get(channel) !== request) {
        throw new RealtimeServiceError('Subscription is no longer active', 401, 'REALTIME_UNAUTHENTICATED')
      }
      if (decision.status === 'drop-connection'
        || (decision.status === 'allowed' && decision.expiresAt.getTime() <= Date.now())) {
        this.removeConnection(connectionId)
        connection.close()
        throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
      }
      if (decision.status === 'deny') {
        throw new RealtimeServiceError('Realtime authorization unavailable', 503, 'REALTIME_UNAVAILABLE')
      }
      if (decision.status !== 'allowed') throw new RealtimeServiceError('Realtime channel forbidden', 403, 'REALTIME_FORBIDDEN')
      this.adapter.subscribe(connectionId, channel)
      return { ok: true, channel }
    } finally {
      if (requests.get(channel) === request) requests.delete(channel)
      if (!requests.size && this.pendingSubscriptions.get(connection) === requests) this.pendingSubscriptions.delete(connection)
    }
  }

  async unsubscribe(connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    const connection = this.adapter.getConnection(connectionId)
    if (connection) this.pendingSubscriptions.get(connection)?.delete(channel)
    this.adapter.unsubscribe(connectionId, channel)
    return { ok: true, channel }
  }

  async publish<TPayload>(event: RealtimeEventName, channel: string, payload: TPayload): Promise<number> {
    const realtimeEvent: RealtimeEvent<TPayload> = {
      event,
      channel,
      payload,
      createdAt: new Date().toISOString(),
    }
    try {
      return await this.adapter.publish(realtimeEvent)
    } catch {
      this.logger.warn('Realtime publication failed', { event, channel })
      return 0
    }
  }

  private async authorizeDelivery(connection: RealtimeConnection, channel: string): Promise<RealtimeDeliveryDecision> {
    try {
      const session = await this.repo.findLiveSession(connection.sessionId, connection.userId, new Date())
      if (!session) return { status: 'drop-connection' }
      await this.assertCanSubscribe(session.user, channel)
      return { status: 'allowed', expiresAt: session.expiresAt }
    } catch (error) {
      if (error instanceof RealtimeServiceError) return { status: 'drop-channel' }
      this.logger.warn('Realtime authorization failed', { userId: connection.userId, channel })
      return { status: 'deny' }
    }
  }

  async assertCanSubscribe(actor: RealtimeActor, channel: string): Promise<void> {
    if (!actor?.id) {
      throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
    }
    if (channel === `user:${actor.id}:notifications`) return
    if (channel.startsWith('user:') && channel.endsWith(':notifications')) {
      throw new RealtimeServiceError('Notification channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    if (channel.startsWith('user:') && channel.endsWith(':chats')) {
      if (channel === `user:${actor.id}:chats` && actor.role !== 'ADMIN') return
      throw new RealtimeServiceError('Chat inbox channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    if (channel.startsWith('chat:')) {
      if (actor.role === 'ADMIN') throw new RealtimeServiceError('Chat channel forbidden', 403, 'REALTIME_FORBIDDEN')
      const roomId = channel.slice('chat:'.length)
      if (!roomId) throw new RealtimeServiceError('Invalid realtime channel', 400, 'REALTIME_INVALID_CHANNEL')
      const room = await this.repo.findChatRoomAccess(roomId)
      if (!room) throw new RealtimeServiceError('Chat room not found', 404, 'REALTIME_CHANNEL_NOT_FOUND')
      if (room.buyerId === actor.id) return
      if (room.shop.ownerId === actor.id && room.shop.status === 'ACTIVE') return
      throw new RealtimeServiceError('Chat channel forbidden', 403, 'REALTIME_FORBIDDEN')
    }

    if (channel.startsWith('seller:') && channel.endsWith(':chats')) {
      if (actor.role === 'ADMIN') throw new RealtimeServiceError('Seller chat channel forbidden', 403, 'REALTIME_FORBIDDEN')
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
      code: error instanceof RealtimeServiceError ? error.code : 'REALTIME_CONNECTION_ERROR',
    })
  }
}
