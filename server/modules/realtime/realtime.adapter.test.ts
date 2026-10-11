import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter, RedisRealtimeAdapter } from './realtime.adapter.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import { RealtimeService } from './realtime.service.ts'
import type { RealtimeConnection, RealtimeDeliveryDecision, RealtimeEvent } from './realtime.types.ts'

const redisClients = vi.hoisted(() => [] as Array<{
  emit(name: string, ...args: unknown[]): boolean
  publish: ReturnType<typeof vi.fn>
}>)

vi.mock('ioredis', () => ({
  default: class extends EventEmitter {
    publish = vi.fn().mockResolvedValue(1)
    subscribe = vi.fn().mockResolvedValue(1)
    constructor() {
      super()
      redisClients.push(this)
    }
  },
}))

const context: AppContext = {
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

function connection(id = 'receiver', userId = 'buyer'): RealtimeConnection {
  return { id, userId, sessionId: `private-session-${id}`, send: vi.fn(), close: vi.fn() }
}

function event(sequence = 1): RealtimeEvent {
  return { event: 'chat.message.created', channel: 'chat:room', createdAt: new Date().toISOString(), payload: { sequence } }
}

function allowed(): RealtimeDeliveryDecision {
  return { status: 'allowed', expiresAt: new Date(Date.now() + 60_000) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function drain(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

function repository(): IRealtimeRepository {
  return {
    findLiveSession: vi.fn(async (_sessionId: string, userId: string) => ({ userId, user: { id: userId, role: 'USER' as const }, expiresAt: new Date(Date.now() + 60_000) })),
    findChatRoomAccess: vi.fn(async () => ({ id: 'room', buyerId: 'buyer', shop: { id: 'shop', ownerId: 'seller', status: 'ACTIVE' } })),
    findShopOwnerId: vi.fn(async () => 'seller'),
  }
}

describe('InMemoryRealtimeAdapter delivery boundary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('cannot deliver before the service installs an authorizer', async () => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const receiver = connection()
    adapter.addConnection(receiver)
    adapter.subscribe(receiver.id, 'chat:room')

    expect(await adapter.publish(event())).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
  })

  it.each(['unsubscribe', 'remove', 'replace', 'resubscribe'] as const)('does not send after %s while authorization is pending', async (change) => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const pending = deferred<RealtimeDeliveryDecision>()
    const authorize = vi.fn().mockReturnValue(pending.promise)
    adapter.setDeliveryAuthorizer(authorize)
    const receiver = connection()
    const replacement = connection()
    adapter.addConnection(receiver)
    adapter.subscribe(receiver.id, 'chat:room')
    const publishing = adapter.publish(event())
    await drain()
    expect(authorize).toHaveBeenCalledOnce()

    if (change === 'unsubscribe' || change === 'resubscribe') adapter.unsubscribe(receiver.id, 'chat:room')
    else adapter.removeConnection(receiver.id)
    if (change === 'replace') {
      adapter.addConnection(replacement)
      adapter.subscribe(replacement.id, 'chat:room')
    }
    if (change === 'resubscribe') adapter.subscribe(receiver.id, 'chat:room')
    pending.resolve(allowed())

    expect(await publishing).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
    expect(replacement.send).not.toHaveBeenCalled()
  })

  it('preserves event order when an earlier authorization read is slow', async () => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const first = deferred<RealtimeDeliveryDecision>()
    const authorize = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(allowed())
    adapter.setDeliveryAuthorizer(authorize)
    const receiver = connection()
    adapter.addConnection(receiver)
    adapter.subscribe(receiver.id, 'chat:room')

    const firstDelivery = adapter.publish(event(1))
    const secondDelivery = adapter.publish(event(2))
    await drain()
    expect(authorize).toHaveBeenCalledOnce()
    expect(receiver.send).not.toHaveBeenCalled()
    first.resolve(allowed())

    expect(await Promise.all([firstDelivery, secondDelivery])).toEqual([1, 1])
    expect(vi.mocked(receiver.send).mock.calls.map(([raw]) => JSON.parse(raw).payload.sequence)).toEqual([1, 2])
  })

  it('keeps a healthy recipient independent from a slow or failed recipient', async () => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const blocked = deferred<RealtimeDeliveryDecision>()
    const slow = connection('slow')
    const broken = connection('broken')
    const healthy = connection('healthy')
    vi.mocked(broken.send).mockImplementation(() => { throw new Error('socket write failed') })
    adapter.setDeliveryAuthorizer(async receiver => receiver === slow ? blocked.promise : allowed())
    for (const receiver of [slow, broken, healthy]) {
      adapter.addConnection(receiver)
      adapter.subscribe(receiver.id, 'chat:room')
    }

    const publishing = adapter.publish(event())
    await drain()
    expect(healthy.send).toHaveBeenCalledOnce()
    blocked.resolve({ status: 'deny' })
    expect(await publishing).toBe(1)
    expect(slow.send).not.toHaveBeenCalled()
  })

  it('checks expiration again immediately before sending', async () => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const pending = deferred<RealtimeDeliveryDecision>()
    adapter.setDeliveryAuthorizer(() => pending.promise)
    const receiver = connection()
    adapter.addConnection(receiver)
    adapter.subscribe(receiver.id, 'chat:room')

    const publishing = adapter.publish(event())
    await drain()
    pending.resolve({ status: 'allowed', expiresAt: new Date(Date.now() - 1) })

    expect(await publishing).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
    expect(receiver.close).toHaveBeenCalledOnce()
  })

  it('isolates a thrown authorizer and does not leak its private error into logs', async () => {
    const adapter = new InMemoryRealtimeAdapter(context)
    const bad = connection('bad')
    const good = connection('good')
    adapter.setDeliveryAuthorizer(async receiver => {
      if (receiver === bad) throw new Error('private-session-bad secret-token')
      return allowed()
    })
    for (const receiver of [bad, good]) {
      adapter.addConnection(receiver)
      adapter.subscribe(receiver.id, 'chat:room')
    }

    expect(await adapter.publish(event())).toBe(1)
    expect(bad.send).not.toHaveBeenCalled()
    expect(good.send).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(context.logger.warn).mock.calls)).not.toContain('private-session-bad')
    expect(JSON.stringify(vi.mocked(context.logger.warn).mock.calls)).not.toContain('secret-token')
  })
})

describe('RedisRealtimeAdapter remote receive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redisClients.length = 0
  })

  async function setup(userId = 'buyer') {
    const repo = repository()
    const adapter = new RedisRealtimeAdapter(context, 'redis://test.invalid')
    const service = new RealtimeService(context, repo, adapter)
    const receiver = connection('receiver', userId)
    service.addConnection(receiver)
    await service.subscribe(receiver.id, 'chat:room')
    async function receive(realtimeEvent = event()) {
      redisClients[1]!.emit('message', 'marketplace:realtime', JSON.stringify({ source: 'other-server', event: realtimeEvent }))
      await drain()
    }
    return { repo, adapter, service, receiver, receive }
  }

  it('delivers valid remote events through the installed live authorization guard', async () => {
    const { repo, receiver, receive } = await setup()
    const published = event()
    await receive(published)

    expect(receiver.send).toHaveBeenCalledWith(JSON.stringify(published))
    expect(repo.findLiveSession).toHaveBeenCalledTimes(2)
    expect(vi.mocked(receiver.send).mock.calls[0]![0]).not.toContain('private-session')
  })

  it('denies an already subscribed remote recipient after session revocation', async () => {
    const { repo, receiver, receive, adapter } = await setup()
    vi.mocked(repo.findLiveSession).mockResolvedValue(null)
    await receive()

    expect(receiver.send).not.toHaveBeenCalled()
    expect(receiver.close).toHaveBeenCalledOnce()
    expect(adapter.getConnection(receiver.id)).toBeUndefined()
  })

  it('denies a remote seller after the shop is suspended while the historic buyer remains permitted', async () => {
    const { repo, service, receiver, receive } = await setup('seller')
    const buyer = connection('buyer')
    service.addConnection(buyer)
    await service.subscribe(buyer.id, 'chat:room')
    vi.mocked(repo.findChatRoomAccess).mockResolvedValue({
      id: 'room', buyerId: 'buyer', shop: { id: 'shop', ownerId: 'seller', status: 'SUSPENDED' },
    })
    await receive()

    expect(receiver.send).not.toHaveBeenCalled()
    expect(buyer.send).toHaveBeenCalledOnce()
    expect(receiver.close).not.toHaveBeenCalled()
  })

  it('fails closed on remote authorization errors, then continues with the next valid event', async () => {
    const { repo, receiver, receive } = await setup()
    vi.mocked(repo.findLiveSession).mockRejectedValueOnce(new Error('private-session-receiver'))
    await receive(event(1))
    expect(receiver.send).not.toHaveBeenCalled()
    await receive(event(2))

    expect(receiver.send).toHaveBeenCalledOnce()
    expect(JSON.parse(vi.mocked(receiver.send).mock.calls[0]![0]).payload.sequence).toBe(2)
  })

  it('drops a remote event after unsubscribe while its authorization is pending', async () => {
    const { repo, receiver, receive, service } = await setup()
    const pending = deferred<Awaited<ReturnType<IRealtimeRepository['findLiveSession']>>>()
    vi.mocked(repo.findLiveSession).mockReturnValueOnce(pending.promise)
    await receive()
    await service.unsubscribe(receiver.id, 'chat:room')
    pending.resolve({ userId: 'buyer', user: { id: 'buyer', role: 'USER' }, expiresAt: new Date(Date.now() + 60_000) })
    await drain()

    expect(receiver.send).not.toHaveBeenCalled()
  })

  it('preserves remote event order across slow authorization', async () => {
    const { repo, receiver, receive } = await setup()
    const pending = deferred<Awaited<ReturnType<IRealtimeRepository['findLiveSession']>>>()
    vi.mocked(repo.findLiveSession).mockReturnValueOnce(pending.promise)
    await receive(event(1))
    await receive(event(2))
    expect(receiver.send).not.toHaveBeenCalled()
    pending.resolve({ userId: 'buyer', user: { id: 'buyer', role: 'USER' }, expiresAt: new Date(Date.now() + 60_000) })
    await drain()

    expect(vi.mocked(receiver.send).mock.calls.map(([raw]) => JSON.parse(raw).payload.sequence)).toEqual([1, 2])
  })

  it('handles malformed remote input without rejecting the subscriber callback', async () => {
    const { receiver } = await setup()
    redisClients[1]!.emit('message', 'marketplace:realtime', '{invalid-json')
    redisClients[1]!.emit('message', 'marketplace:realtime', JSON.stringify({ event: { event: 'unknown', channel: 'chat:room' } }))
    await drain()

    expect(receiver.send).not.toHaveBeenCalled()
    expect(context.logger.warn).toHaveBeenCalledWith('Redis realtime adapter error', { operation: 'message' })
  })

  it('keeps local delivery successful when Redis publication fails', async () => {
    const { receiver, service } = await setup()
    redisClients[0]!.publish.mockRejectedValue(new Error('redis unreachable'))

    expect(await service.publish('chat.message.created', 'chat:room', { sequence: 1 })).toBe(1)
    expect(receiver.send).toHaveBeenCalledOnce()
    expect(context.logger.warn).toHaveBeenCalledWith('Redis realtime adapter error', { operation: 'publish' })
  })
})
