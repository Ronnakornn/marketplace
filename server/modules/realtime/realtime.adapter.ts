import { randomUUID } from 'node:crypto'
import IORedis from 'ioredis'
import type { AppContext } from '#server/context/app-context.ts'
import type { RealtimeConnection, RealtimeDeliveryAuthorizer, RealtimeEvent } from './realtime.types.ts'

const redisRealtimeChannel = 'marketplace:realtime'
export const maxPendingRealtimeDeliveries = 64

export interface RealtimeAdapter {
  setDeliveryAuthorizer(authorize: RealtimeDeliveryAuthorizer): void
  getConnection(connectionId: string): RealtimeConnection | undefined
  addConnection(connection: RealtimeConnection): void
  removeConnection(connectionId: string): void
  subscribe(connectionId: string, channel: string): void
  unsubscribe(connectionId: string, channel: string): void
  publish(event: RealtimeEvent): Promise<number>
}

export class InMemoryRealtimeAdapter implements RealtimeAdapter {
  private connections = new Map<string, RealtimeConnection>()
  private channelSubscribers = new Map<string, Map<string, symbol>>()
  private deliveryQueues = new Map<RealtimeConnection, Promise<void>>()
  private pendingDeliveries = new WeakMap<RealtimeConnection, number>()
  private authorize?: RealtimeDeliveryAuthorizer

  constructor(private appContext: AppContext) {}

  setDeliveryAuthorizer(authorize: RealtimeDeliveryAuthorizer): void {
    if (this.authorize) throw new Error('Realtime delivery authorizer already installed')
    this.authorize = authorize
  }

  getConnection(connectionId: string): RealtimeConnection | undefined {
    return this.connections.get(connectionId)
  }

  addConnection(connection: RealtimeConnection): void {
    this.removeConnection(connection.id)
    this.connections.set(connection.id, connection)
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) this.deliveryQueues.delete(connection)
    this.connections.delete(connectionId)
    for (const [channel, subscribers] of this.channelSubscribers) {
      subscribers.delete(connectionId)
      if (!subscribers.size) this.channelSubscribers.delete(channel)
    }
  }

  subscribe(connectionId: string, channel: string): void {
    if (!this.connections.has(connectionId)) return
    const subscribers = this.channelSubscribers.get(channel) ?? new Map<string, symbol>()
    subscribers.set(connectionId, Symbol())
    this.channelSubscribers.set(channel, subscribers)
  }

  unsubscribe(connectionId: string, channel: string): void {
    const subscribers = this.channelSubscribers.get(channel)
    subscribers?.delete(connectionId)
    if (!subscribers?.size) this.channelSubscribers.delete(channel)
  }

  async publish(event: RealtimeEvent): Promise<number> {
    const subscribers = this.channelSubscribers.get(event.channel)
    if (!this.authorize || !subscribers?.size) return 0
    const data = JSON.stringify(event)
    const deliveries: Array<Promise<number>> = []
    for (const [connectionId, subscription] of subscribers) {
      const connection = this.connections.get(connectionId)
      if (!connection) continue
      const pending = this.pendingDeliveries.get(connection) ?? 0
      if (pending >= maxPendingRealtimeDeliveries) {
        this.removeConnection(connectionId)
        connection.close()
        continue
      }
      this.pendingDeliveries.set(connection, pending + 1)
      const previous = this.deliveryQueues.get(connection) ?? Promise.resolve()
      const delivery = previous.then(() => this.deliver(connection, subscription, event.channel, data))
      const tail = delivery.then(() => undefined, () => undefined)
      this.deliveryQueues.set(connection, tail)
      void tail.then(() => {
        const remaining = (this.pendingDeliveries.get(connection) ?? 1) - 1
        if (remaining) this.pendingDeliveries.set(connection, remaining)
        else this.pendingDeliveries.delete(connection)
        if (this.deliveryQueues.get(connection) === tail) this.deliveryQueues.delete(connection)
      })
      deliveries.push(delivery)
    }
    const results = await Promise.allSettled(deliveries)
    return results.reduce((count, result) => count + (result.status === 'fulfilled' ? result.value : 0), 0)
  }

  private isSubscribed(connection: RealtimeConnection, channel: string, subscription: symbol): boolean {
    return this.connections.get(connection.id) === connection
      && this.channelSubscribers.get(channel)?.get(connection.id) === subscription
  }

  private async deliver(connection: RealtimeConnection, subscription: symbol, channel: string, data: string): Promise<number> {
    if (!this.authorize || !this.isSubscribed(connection, channel, subscription)) return 0
    try {
      const decision = await this.authorize(connection, channel)
      if (!this.isSubscribed(connection, channel, subscription)) return 0
      if (decision.status === 'drop-connection'
        || (decision.status === 'allowed' && decision.expiresAt.getTime() <= Date.now())) {
        this.removeConnection(connection.id)
        connection.close()
        return 0
      }
      if (decision.status === 'drop-channel') {
        this.unsubscribe(connection.id, channel)
        return 0
      }
      if (decision.status !== 'allowed') return 0
      connection.send(data)
      return 1
    } catch {
      this.appContext.logger.warn('Realtime recipient delivery failed', { userId: connection.userId, channel })
      return 0
    }
  }
}

export class RedisRealtimeAdapter implements RealtimeAdapter {
  private local: InMemoryRealtimeAdapter
  private publisher: IORedis
  private subscriber: IORedis
  private instanceId = randomUUID()

  constructor(private appContext: AppContext, redisUrl: string) {
    this.local = new InMemoryRealtimeAdapter(appContext)
    this.publisher = new IORedis(redisUrl, { maxRetriesPerRequest: 1 })
    this.subscriber = new IORedis(redisUrl, { maxRetriesPerRequest: 1 })
    this.subscriber.on('message', (_channel, raw) => {
      void this.handleRemoteMessage(raw).catch(() => this.logError('message'))
    })
    this.subscriber.on('error', () => this.logError('subscriber'))
    this.publisher.on('error', () => this.logError('publisher'))
    void this.subscriber.subscribe(redisRealtimeChannel).catch(() => this.logError('subscribe'))
  }

  setDeliveryAuthorizer(authorize: RealtimeDeliveryAuthorizer): void {
    this.local.setDeliveryAuthorizer(authorize)
  }

  getConnection(connectionId: string): RealtimeConnection | undefined {
    return this.local.getConnection(connectionId)
  }

  addConnection(connection: RealtimeConnection): void {
    this.local.addConnection(connection)
  }

  removeConnection(connectionId: string): void {
    this.local.removeConnection(connectionId)
  }

  subscribe(connectionId: string, channel: string): void {
    this.local.subscribe(connectionId, channel)
  }

  unsubscribe(connectionId: string, channel: string): void {
    this.local.unsubscribe(connectionId, channel)
  }

  async publish(event: RealtimeEvent): Promise<number> {
    const remote = this.publisher.publish(redisRealtimeChannel, JSON.stringify({ source: this.instanceId, event }))
      .catch(() => this.logError('publish'))
    const [delivered] = await Promise.all([this.local.publish(event), remote])
    return delivered
  }

  private async handleRemoteMessage(raw: string): Promise<void> {
    const message: unknown = JSON.parse(raw)
    if (!message || typeof message !== 'object') return
    const envelope = message as Record<string, unknown>
    if (envelope.source === this.instanceId || !isRealtimeEvent(envelope.event)) return
    await this.local.publish(envelope.event)
  }

  private logError(operation: string): void {
    this.appContext.logger.warn('Redis realtime adapter error', { operation })
  }
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return (event.event === 'chat.message.created' || event.event === 'chat.message.changed' || event.event === 'chat.room.read'
    || event.event === 'notification.created' || event.event === 'notification.read')
    && typeof event.channel === 'string' && typeof event.createdAt === 'string'
}

export function createRealtimeAdapter(
  appContext: AppContext,
  env: NodeJS.ProcessEnv = process.env,
): RealtimeAdapter {
  const redisUrl = env['REDIS_URL']?.trim()
  return redisUrl ? new RedisRealtimeAdapter(appContext, redisUrl) : new InMemoryRealtimeAdapter(appContext)
}
