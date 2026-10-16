import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { RealtimeAdapter } from './realtime.adapter.ts'
import { RealtimeServiceError } from './realtime.errors.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import type { RealtimeActor, RealtimeConnection, RealtimeDeliveryDecision, RealtimeEvent, RealtimeEventName } from './realtime.types.ts'

export const realtimeCommandLimits = {
  windowMs: 10_000,
  perConnection: 20,
  perUser: 60,
  inFlightPerConnection: 2,
  inFlightPerUser: 8,
  inFlightTotal: 256,
  retainedUsers: 10_000,
  subscriptionsPerConnection: 32,
} as const

type CommandBudget = { used: number; resetsAt: number; inFlight: number }

export class RealtimeService {
  private logger: ILogger
  private pendingSubscriptions = new Map<RealtimeConnection, Map<string, symbol>>()
  private connectionBudgets = new WeakMap<RealtimeConnection, CommandBudget>()
  private userBudgets = new Map<string, CommandBudget>()
  private subscriptions = new WeakMap<RealtimeConnection, Set<string>>()
  private commandsInFlight = 0
  private nextBudgetSweep = 0

  constructor(
    appContext: AppContext,
    private repo: IRealtimeRepository,
    private adapter: RealtimeAdapter,
    private now: () => number = () => performance.now(),
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
    if (connection) {
      this.pendingSubscriptions.delete(connection)
      this.connectionBudgets.delete(connection)
      this.subscriptions.delete(connection)
    }
    this.adapter.removeConnection(connectionId)
  }

  async subscribe(connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    const connection = this.adapter.getConnection(connectionId)
    if (!connection) throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
    const release = this.admitCommand(connection)
    const requests = this.pendingSubscriptions.get(connection) ?? new Map<string, symbol>()
    const request = Symbol()
    requests.set(channel, request)
    this.pendingSubscriptions.set(connection, requests)
    try {
      this.validateChannel(channel)
      const subscriptions = this.subscriptions.get(connection) ?? new Set<string>()
      if (new Set([...subscriptions, ...requests.keys()]).size > realtimeCommandLimits.subscriptionsPerConnection) {
        throw new RealtimeServiceError('Subscription limit reached', 429, 'REALTIME_RATE_LIMITED')
      }
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
      subscriptions.add(channel)
      this.subscriptions.set(connection, subscriptions)
      return { ok: true, channel }
    } finally {
      release()
      if (requests.get(channel) === request) requests.delete(channel)
      if (!requests.size && this.pendingSubscriptions.get(connection) === requests) this.pendingSubscriptions.delete(connection)
    }
  }

  async unsubscribe(connectionId: string, channel: string): Promise<{ ok: true; channel: string }> {
    const connection = this.adapter.getConnection(connectionId)
    if (!connection) throw new RealtimeServiceError('Authentication required', 401, 'REALTIME_UNAUTHENTICATED')
    const release = this.admitCommand(connection)
    try {
      this.validateChannel(channel)
      this.pendingSubscriptions.get(connection)?.delete(channel)
      this.subscriptions.get(connection)?.delete(channel)
      this.adapter.unsubscribe(connectionId, channel)
      return { ok: true, channel }
    } finally { release() }
  }

  private validateChannel(channel: string): void {
    if (channel.length > 256 || !/^(?:chat:[\w-]+|user:[\w-]+:(?:notifications|chats)|seller:[\w-]+:chats)$/.test(channel)) {
      throw new RealtimeServiceError('Invalid realtime channel', 400, 'REALTIME_INVALID_CHANNEL')
    }
  }

  private admitCommand(connection: RealtimeConnection): () => void {
    const now = this.now()
    if (now >= this.nextBudgetSweep) {
      for (const [userId, budget] of this.userBudgets) {
        if (budget.resetsAt <= now && budget.inFlight === 0) this.userBudgets.delete(userId)
      }
      this.nextBudgetSweep = now + realtimeCommandLimits.windowMs
    }
    let user = this.userBudgets.get(connection.userId)
    if (!user) {
      if (this.userBudgets.size >= realtimeCommandLimits.retainedUsers) this.rejectCommand()
      user = { used: 0, resetsAt: now + realtimeCommandLimits.windowMs, inFlight: 0 }
      this.userBudgets.set(connection.userId, user)
    }
    let socket = this.connectionBudgets.get(connection)
    if (!socket) {
      socket = { used: 0, resetsAt: now + realtimeCommandLimits.windowMs, inFlight: 0 }
      this.connectionBudgets.set(connection, socket)
    }
    for (const budget of [socket, user]) {
      if (budget.resetsAt <= now) {
        budget.used = 0
        budget.resetsAt = now + realtimeCommandLimits.windowMs
      }
    }
    if (socket.used >= realtimeCommandLimits.perConnection || user.used >= realtimeCommandLimits.perUser
      || socket.inFlight >= realtimeCommandLimits.inFlightPerConnection
      || user.inFlight >= realtimeCommandLimits.inFlightPerUser
      || this.commandsInFlight >= realtimeCommandLimits.inFlightTotal) this.rejectCommand()
    socket.used++
    user.used++
    socket.inFlight++
    user.inFlight++
    this.commandsInFlight++
    return () => { socket.inFlight--; user.inFlight--; this.commandsInFlight-- }
  }

  private rejectCommand(): never {
    throw new RealtimeServiceError('Realtime command limit reached', 429, 'REALTIME_RATE_LIMITED')
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
      if (error instanceof RealtimeServiceError) {
        this.subscriptions.get(connection)?.delete(channel)
        return { status: 'drop-channel' }
      }
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
