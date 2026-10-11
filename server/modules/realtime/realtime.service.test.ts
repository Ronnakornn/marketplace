import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter } from './realtime.adapter.ts'
import { RealtimeServiceError } from './realtime.errors.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import { RealtimeService } from './realtime.service.ts'
import type { RealtimeConnection } from './realtime.types.ts'

function connection(id = 'a', userId = 'buyer-1'): RealtimeConnection {
  return { id, userId, sessionId: `session-${id}`, send: vi.fn(), close: vi.fn() }
}

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const appContext = {
  logger,
  config: { environment: 'test' },
} satisfies AppContext

function createRepo(overrides: Partial<IRealtimeRepository> = {}): IRealtimeRepository {
  return {
    findLiveSession: vi.fn().mockImplementation(async (_sessionId: string, userId: string) => ({
      userId,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: userId, role: 'USER' },
    })),
    findChatRoomAccess: vi.fn().mockResolvedValue({
      id: 'room-1',
      buyerId: 'buyer-1',
      shop: { id: 'shop-1', ownerId: 'seller-1', status: 'ACTIVE' },
    }),
    findShopOwnerId: vi.fn().mockResolvedValue('seller-1'),
    ...overrides,
  }
}

describe('RealtimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows users to subscribe to their own notification channel', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'user-1', role: 'USER' }, 'user:user-1:notifications')).resolves.toBeUndefined()
  })

  it('blocks users from subscribing to another user notification channel', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'user-1', role: 'USER' }, 'user:user-2:notifications')).rejects.toMatchObject({
      code: 'REALTIME_FORBIDDEN',
      status: 403,
    } satisfies Partial<RealtimeServiceError>)
  })

  it('allows a buyer to subscribe to their chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'buyer-1', role: 'USER' }, 'chat:room-1')).resolves.toBeUndefined()
  })

  it('allows a seller to subscribe to their shop chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'seller-1', role: 'USER' }, 'chat:room-1')).resolves.toBeUndefined()
  })

  it('blocks sellers from another shop chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'seller-2', role: 'USER' }, 'chat:room-1')).rejects.toMatchObject({
      code: 'REALTIME_FORBIDDEN',
      status: 403,
    } satisfies Partial<RealtimeServiceError>)
  })

  it('allows sellers to subscribe to their shop aggregate chat channel', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter(appContext))

    await expect(service.assertCanSubscribe({ id: 'seller-1', role: 'USER' }, 'seller:shop-1:chats')).resolves.toBeUndefined()
  })

  it('publishes only to subscribers of the target channel', async () => {
    const adapter = new InMemoryRealtimeAdapter(appContext)
    const service = new RealtimeService(appContext, createRepo(), adapter)
    const sentA: string[] = []
    const sentB: string[] = []
    service.addConnection({ id: 'a', userId: 'user-1', sessionId: 'session-a', close: vi.fn(), send: (data) => sentA.push(data) })
    service.addConnection({ id: 'b', userId: 'user-2', sessionId: 'session-b', close: vi.fn(), send: (data) => sentB.push(data) })
    await service.subscribe('a', 'user:user-1:notifications')
    await service.subscribe('b', 'user:user-2:notifications')

    const delivered = await service.publish('notification.created', 'user:user-1:notifications', { id: 'notification-1' })

    expect(delivered).toBe(1)
    expect(sentA).toHaveLength(1)
    expect(sentB).toHaveLength(0)
  })

  it('stops delivering to an existing seller subscription when the shop is suspended', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const sent: string[] = []
    service.addConnection({ id: 'seller-connection', userId: 'seller-1', sessionId: 'session-seller', close: vi.fn(), send: (data) => sent.push(data) })
    await service.subscribe('seller-connection', 'seller:shop-1:chats')
    vi.mocked(repo.findShopOwnerId).mockResolvedValue(null)

    await service.publish('chat.message.created', 'seller:shop-1:chats', { roomId: 'room-1' })

    expect(sent).toHaveLength(0)
  })

  it('derives subscription identity from the connection and rejects another recipient channel', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    service.addConnection(connection())

    await expect(service.subscribe('a', 'user:seller-1:notifications')).rejects.toMatchObject({ code: 'REALTIME_FORBIDDEN' })
    expect(repo.findLiveSession).toHaveBeenCalledWith('session-a', 'buyer-1', expect.any(Date))
    expect(await service.publish('notification.created', 'user:seller-1:notifications', {})).toBe(0)
  })

  it('removes the whole connection when its session is no longer live', async () => {
    const repo = createRepo()
    const adapter = new InMemoryRealtimeAdapter(appContext)
    const service = new RealtimeService(appContext, repo, adapter)
    const receiver = connection()
    service.addConnection(receiver)
    await service.subscribe('a', 'chat:room-1')
    await service.subscribe('a', 'user:buyer-1:notifications')
    vi.mocked(repo.findLiveSession).mockResolvedValue(null)

    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(await service.publish('notification.created', 'user:buyer-1:notifications', {})).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
    expect(receiver.close).toHaveBeenCalledOnce()
    expect(adapter.getConnection('a')).toBeUndefined()
  })

  it('drops only the forbidden seller channel while retaining the user notification subscription', async () => {
    const repo = createRepo()
    const adapter = new InMemoryRealtimeAdapter(appContext)
    const service = new RealtimeService(appContext, repo, adapter)
    const receiver = connection('seller', 'seller-1')
    service.addConnection(receiver)
    await service.subscribe('seller', 'chat:room-1')
    await service.subscribe('seller', 'user:seller-1:notifications')
    vi.mocked(repo.findChatRoomAccess).mockResolvedValue({
      id: 'room-1', buyerId: 'buyer-1', shop: { id: 'shop-1', ownerId: 'seller-1', status: 'SUSPENDED' },
    })

    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(await service.publish('notification.created', 'user:seller-1:notifications', {})).toBe(1)
    expect(receiver.send).toHaveBeenCalledOnce()
    expect(receiver.close).not.toHaveBeenCalled()
    expect(adapter.getConnection('seller')).toBe(receiver)
  })

  it('preserves a buyer subscription to historical chat after the seller shop is suspended', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const receiver = connection()
    service.addConnection(receiver)
    await service.subscribe('a', 'chat:room-1')
    vi.mocked(repo.findChatRoomAccess).mockResolvedValue({
      id: 'room-1', buyerId: 'buyer-1', shop: { id: 'shop-1', ownerId: 'seller-1', status: 'SUSPENDED' },
    })

    expect(await service.publish('chat.message.created', 'chat:room-1', { id: 'historic-message' })).toBe(1)
    expect(receiver.send).toHaveBeenCalledWith(expect.stringContaining('historic-message'))
  })

  it('denies delivery when shop ownership or chat ownership changes after subscription', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const sellerReceiver = connection('seller', 'seller-1')
    const buyerReceiver = connection('buyer', 'buyer-1')
    service.addConnection(sellerReceiver)
    service.addConnection(buyerReceiver)
    await service.subscribe('seller', 'seller:shop-1:chats')
    await service.subscribe('buyer', 'chat:room-1')
    vi.mocked(repo.findShopOwnerId).mockResolvedValue('seller-2')
    vi.mocked(repo.findChatRoomAccess).mockResolvedValue({
      id: 'room-1', buyerId: 'buyer-2', shop: { id: 'shop-1', ownerId: 'seller-2', status: 'ACTIVE' },
    })

    expect(await service.publish('chat.message.created', 'seller:shop-1:chats', {})).toBe(0)
    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(sellerReceiver.send).not.toHaveBeenCalled()
    expect(buyerReceiver.send).not.toHaveBeenCalled()
  })

  it('fails closed on a database error and allows a later delivery after recovery without logging secrets', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const receiver = connection()
    service.addConnection(receiver)
    await service.subscribe('a', 'chat:room-1')
    vi.mocked(repo.findLiveSession).mockRejectedValueOnce(new Error('session-a secret-cookie-token'))

    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
    expect(receiver.close).not.toHaveBeenCalled()
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('session-a')
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret-cookie-token')
    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(1)
  })

  it('does not authorize a replacement connection with an old pending subscription request', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const receiver = connection()
    service.addConnection(receiver)
    let resolve!: (session: Awaited<ReturnType<IRealtimeRepository['findLiveSession']>>) => void
    vi.mocked(repo.findLiveSession).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const subscribing = service.subscribe('a', 'chat:room-1')
    service.removeConnection('a')
    const replacement = connection('a', 'outsider')
    service.addConnection(replacement)
    resolve({ userId: 'buyer-1', expiresAt: new Date(Date.now() + 60_000), user: { id: 'buyer-1', role: 'USER' } })

    await expect(subscribing).rejects.toMatchObject({ code: 'REALTIME_UNAUTHENTICATED' })
    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(replacement.send).not.toHaveBeenCalled()
  })

  it('returns success after a transport failure instead of rejecting a durable publisher operation', async () => {
    const adapter = new InMemoryRealtimeAdapter(appContext)
    const service = new RealtimeService(appContext, createRepo(), adapter)
    vi.spyOn(adapter, 'publish').mockRejectedValue(new Error('transport unavailable'))

    await expect(service.publish('notification.created', 'user:buyer-1:notifications', {})).resolves.toBe(0)
    expect(logger.warn).toHaveBeenCalledWith('Realtime publication failed', {
      event: 'notification.created', channel: 'user:buyer-1:notifications',
    })
  })

  it('does not reinstate a subscription canceled while its authorization is pending', async () => {
    const repo = createRepo()
    const service = new RealtimeService(appContext, repo, new InMemoryRealtimeAdapter(appContext))
    const receiver = connection()
    service.addConnection(receiver)
    let resolve!: (session: Awaited<ReturnType<IRealtimeRepository['findLiveSession']>>) => void
    vi.mocked(repo.findLiveSession).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const subscribing = service.subscribe('a', 'chat:room-1')
    await service.unsubscribe('a', 'chat:room-1')
    resolve({ userId: 'buyer-1', expiresAt: new Date(Date.now() + 60_000), user: { id: 'buyer-1', role: 'USER' } })

    await expect(subscribing).rejects.toMatchObject({ code: 'REALTIME_UNAUTHENTICATED' })
    expect(await service.publish('chat.message.created', 'chat:room-1', {})).toBe(0)
    expect(receiver.send).not.toHaveBeenCalled()
  })
})
