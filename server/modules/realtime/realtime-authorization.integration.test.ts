import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { InMemoryRealtimeAdapter } from './realtime.adapter.ts'
import { PrismaRealtimeRepository } from './realtime.repository.ts'
import { RealtimeService } from './realtime.service.ts'
import type { RealtimeConnection } from './realtime.types.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context: AppContext = {
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe.skipIf(!databaseUrl)('realtime live authorization on PostgreSQL', () => {
  let db: PrismaClient

  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a disposable local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
  })

  afterAll(async () => { await db?.$disconnect() })

  async function fixture() {
    const tag = randomUUID()
    const buyer = await db.user.create({ data: { name: 'Realtime buyer', email: `${tag}-buyer@example.test`, emailVerified: true } })
    const seller = await db.user.create({ data: { name: 'Realtime seller', email: `${tag}-seller@example.test`, emailVerified: true } })
    const buyerSession = await db.session.create({ data: { userId: buyer.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const sellerSession = await db.session.create({ data: { userId: seller.id, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
    const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
    const shop = await db.shop.create({ data: {
      ownerId: seller.id, sellerProfileId: profile.id, name: 'Realtime shop', slug: tag, status: 'ACTIVE',
      contactEmail: seller.email, contactPhone: '0800000000',
    } })
    const room = await db.chatThread.create({ data: { buyerId: buyer.id, shopId: shop.id } })
    const repo = new PrismaRealtimeRepository(context, db)
    const adapter = new InMemoryRealtimeAdapter(context)
    const service = new RealtimeService(context, repo, adapter)
    function connect(id: string, userId: string, sessionId: string) {
      const send = vi.fn<(data: string) => void>()
      const receiver = { id, userId, sessionId, send, close: vi.fn() } satisfies RealtimeConnection
      service.addConnection(receiver)
      return receiver
    }
    const buyerReceiver = connect(`${tag}-buyer`, buyer.id, buyerSession.id)
    const sellerReceiver = connect(`${tag}-seller`, seller.id, sellerSession.id)
    await service.subscribe(buyerReceiver.id, `chat:${room.id}`)
    await service.subscribe(sellerReceiver.id, `chat:${room.id}`)
    await service.subscribe(sellerReceiver.id, `seller:${shop.id}:chats`)
    await service.subscribe(sellerReceiver.id, `user:${seller.id}:notifications`)
    return { buyer, seller, buyerSession, sellerSession, shop, room, repo, adapter, service, connect, buyerReceiver, sellerReceiver }
  }

  it.each(['deleted', 'revoked', 'expired', 'user-suspended'] as const)('denies an already subscribed recipient after %s commits', async change => {
    const data = await fixture()
    if (change === 'deleted') await db.session.delete({ where: { id: data.sellerSession.id } })
    else if (change === 'revoked') await db.session.update({ where: { id: data.sellerSession.id }, data: { revokedAt: new Date() } })
    else if (change === 'expired') await db.session.update({ where: { id: data.sellerSession.id }, data: { expiresAt: new Date(Date.now() - 1) } })
    else await db.user.update({ where: { id: data.seller.id }, data: { status: 'SUSPENDED' } })

    expect(await data.service.publish('chat.message.created', `chat:${data.room.id}`, { messageId: 'private-message' })).toBe(1)
    expect(data.sellerReceiver.send).not.toHaveBeenCalled()
    expect(data.sellerReceiver.close).toHaveBeenCalledOnce()
    expect(data.buyerReceiver.send).toHaveBeenCalledOnce()
    expect(data.adapter.getConnection(data.sellerReceiver.id)).toBeUndefined()
    expect(await data.service.publish('notification.created', `user:${data.seller.id}:notifications`, {})).toBe(0)
  })

  it('requires the live session ID and user ID to match instead of accepting another live session', async () => {
    const data = await fixture()
    const impersonating = data.connect('impersonating', data.seller.id, data.buyerSession.id)

    await expect(data.service.subscribe(impersonating.id, `user:${data.seller.id}:notifications`)).rejects.toMatchObject({ code: 'REALTIME_UNAUTHENTICATED' })
    expect(impersonating.close).toHaveBeenCalledOnce()
    expect(impersonating.send).not.toHaveBeenCalled()
    expect(await data.repo.findLiveSession(data.buyerSession.id, data.seller.id, new Date())).toBeNull()
  })

  it('denies seller room and list channels after suspension while preserving buyer chat and seller notifications', async () => {
    const data = await fixture()
    await db.shop.update({ where: { id: data.shop.id }, data: { status: 'SUSPENDED' } })

    expect(await data.service.publish('chat.message.created', `chat:${data.room.id}`, {})).toBe(1)
    expect(await data.service.publish('chat.message.created', `seller:${data.shop.id}:chats`, {})).toBe(0)
    expect(data.sellerReceiver.send).not.toHaveBeenCalled()
    expect(data.buyerReceiver.send).toHaveBeenCalledOnce()
    expect(data.sellerReceiver.close).not.toHaveBeenCalled()
    expect(await data.service.publish('notification.created', `user:${data.seller.id}:notifications`, { notificationId: 'notice' })).toBe(1)
    expect(data.sellerReceiver.send).toHaveBeenCalledOnce()
  })

  it('denies old seller access after shop ownership changes', async () => {
    const data = await fixture()
    const newOwner = await db.user.create({ data: { name: 'New owner', email: `${randomUUID()}@example.test` } })
    await db.shop.update({ where: { id: data.shop.id }, data: { ownerId: newOwner.id } })

    expect(await data.service.publish('chat.message.created', `chat:${data.room.id}`, {})).toBe(1)
    expect(await data.service.publish('chat.message.created', `seller:${data.shop.id}:chats`, {})).toBe(0)
    expect(data.sellerReceiver.send).not.toHaveBeenCalled()
    expect(data.buyerReceiver.send).toHaveBeenCalledOnce()
  })

  it('delivers only the exact permitted notification recipient without exposing session identity', async () => {
    const data = await fixture()

    expect(await data.service.publish('notification.created', `user:${data.seller.id}:notifications`, { notificationId: 'notice' })).toBe(1)
    expect(data.buyerReceiver.send).not.toHaveBeenCalled()
    const raw = data.sellerReceiver.send.mock.calls[0]![0]
    expect(JSON.parse(raw)).toMatchObject({ channel: `user:${data.seller.id}:notifications`, payload: { notificationId: 'notice' } })
    expect(raw).not.toContain(data.sellerSession.id)
    expect(raw).not.toContain(data.sellerSession.token)
  })
})
