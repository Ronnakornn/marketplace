import { randomUUID } from 'node:crypto'
import IORedis from 'ioredis'
import type { AppContext } from '#server/context/app-context.ts'
import type { RealtimeConnection, RealtimeEvent } from './realtime.types.ts'

const redisRealtimeChannel = 'marketplace:realtime'

export interface RealtimeAdapter {
  addConnection(connection: RealtimeConnection): void
  removeConnection(connectionId: string): void
  subscribe(connectionId: string, channel: string): void
  unsubscribe(connectionId: string, channel: string): void
  publish(event: RealtimeEvent): number
}

export class InMemoryRealtimeAdapter implements RealtimeAdapter {
  private connections = new Map<string, RealtimeConnection>()
  private channelSubscribers = new Map<string, Set<string>>()

  addConnection(connection: RealtimeConnection): void {
    this.connections.set(connection.id, connection)
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId)
    for (const subscribers of this.channelSubscribers.values()) {
      subscribers.delete(connectionId)
    }
  }

  subscribe(connectionId: string, channel: string): void {
    if (!this.connections.has(connectionId)) return
    const subscribers = this.channelSubscribers.get(channel) ?? new Set<string>()
    subscribers.add(connectionId)
    this.channelSubscribers.set(channel, subscribers)
  }

  unsubscribe(connectionId: string, channel: string): void {
    this.channelSubscribers.get(channel)?.delete(connectionId)
  }

  publish(event: RealtimeEvent): number {
    const subscribers = this.channelSubscribers.get(event.channel)
    if (!subscribers?.size) return 0
    const data = JSON.stringify(event)
    let delivered = 0
    for (const connectionId of subscribers) {
      const connection = this.connections.get(connectionId)
      if (!connection) continue
      connection.send(data)
      delivered += 1
    }
    return delivered
  }
}

export class RedisRealtimeAdapter implements RealtimeAdapter {
  private local = new InMemoryRealtimeAdapter()
  private publisher: IORedis
  private subscriber: IORedis
  private instanceId = randomUUID()

  constructor(private appContext: AppContext, redisUrl: string) {
    this.publisher = new IORedis(redisUrl, { maxRetriesPerRequest: 1 })
    this.subscriber = new IORedis(redisUrl, { maxRetriesPerRequest: 1 })
    this.subscriber.on('message', (_channel, raw) => this.handleRemoteMessage(raw))
    this.subscriber.on('error', (error) => this.logError('subscriber', error))
    this.publisher.on('error', (error) => this.logError('publisher', error))
    void this.subscriber.subscribe(redisRealtimeChannel).catch((error) => this.logError('subscribe', error))
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

  publish(event: RealtimeEvent): number {
    const delivered = this.local.publish(event)
    void this.publisher.publish(redisRealtimeChannel, JSON.stringify({
      source: this.instanceId,
      event,
    })).catch((error) => this.logError('publish', error))
    return delivered
  }

  private handleRemoteMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as { source?: string; event?: RealtimeEvent }
      if (message.source === this.instanceId || !message.event) return
      this.local.publish(message.event)
    } catch (error) {
      this.logError('message', error)
    }
  }

  private logError(operation: string, error: unknown): void {
    this.appContext.logger.warn('Redis realtime adapter error', {
      operation,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function createRealtimeAdapter(
  appContext: AppContext,
  env: NodeJS.ProcessEnv = process.env,
): RealtimeAdapter {
  const redisUrl = env['REDIS_URL']?.trim()
  return redisUrl ? new RedisRealtimeAdapter(appContext, redisUrl) : new InMemoryRealtimeAdapter()
}
