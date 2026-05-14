import type { RealtimeConnection, RealtimeEvent } from './realtime.types.ts'

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
