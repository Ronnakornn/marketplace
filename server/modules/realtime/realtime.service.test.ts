import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter } from './realtime.adapter.ts'
import { RealtimeServiceError } from './realtime.errors.ts'
import type { IRealtimeRepository } from './realtime.repository.ts'
import { RealtimeService } from './realtime.service.ts'

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
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'user-1', role: 'USER' }, 'user:user-1:notifications')).resolves.toBeUndefined()
  })

  it('blocks users from subscribing to another user notification channel', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'user-1', role: 'USER' }, 'user:user-2:notifications')).rejects.toMatchObject({
      code: 'REALTIME_FORBIDDEN',
      status: 403,
    } satisfies Partial<RealtimeServiceError>)
  })

  it('allows a buyer to subscribe to their chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'buyer-1', role: 'USER' }, 'chat:room-1')).resolves.toBeUndefined()
  })

  it('allows a seller to subscribe to their shop chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'seller-1', role: 'USER' }, 'chat:room-1')).resolves.toBeUndefined()
  })

  it('blocks sellers from another shop chat room', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'seller-2', role: 'USER' }, 'chat:room-1')).rejects.toMatchObject({
      code: 'REALTIME_FORBIDDEN',
      status: 403,
    } satisfies Partial<RealtimeServiceError>)
  })

  it('allows sellers to subscribe to their shop aggregate chat channel', async () => {
    const service = new RealtimeService(appContext, createRepo(), new InMemoryRealtimeAdapter())

    await expect(service.assertCanSubscribe({ id: 'seller-1', role: 'USER' }, 'seller:shop-1:chats')).resolves.toBeUndefined()
  })

  it('publishes only to subscribers of the target channel', async () => {
    const adapter = new InMemoryRealtimeAdapter()
    const service = new RealtimeService(appContext, createRepo(), adapter)
    const sentA: string[] = []
    const sentB: string[] = []
    service.addConnection({ id: 'a', userId: 'user-1', send: (data) => sentA.push(data) })
    service.addConnection({ id: 'b', userId: 'user-2', send: (data) => sentB.push(data) })
    await service.subscribe({ id: 'user-1', role: 'USER' }, 'a', 'user:user-1:notifications')
    await service.subscribe({ id: 'user-2', role: 'USER' }, 'b', 'user:user-2:notifications')

    const delivered = service.publish('notification.created', 'user:user-1:notifications', { id: 'notification-1' })

    expect(delivered).toBe(1)
    expect(sentA).toHaveLength(1)
    expect(sentB).toHaveLength(0)
  })
})
