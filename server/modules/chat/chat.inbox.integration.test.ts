import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdContext } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaChatRepository } from './chat.repository.ts'
import { ChatService } from './chat.service.ts'

const databaseUrl = process.env['CHAT_TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('bounded chat inbox on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    if (!databaseUrl) throw new Error('CHAT_TEST_DATABASE_URL is required')
    const url = new URL(databaseUrl)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Use an isolated local *_test database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  it('reaches every room beyond 50 with tied timestamps, scopes search before pagination and counts all unread messages', async () => {
    const f = await numericThresholdFixture(db)
    const repo = new PrismaChatRepository(thresholdContext, db)
    const service = new ChatService(thresholdContext, repo)
    const shops = Array.from({ length: 55 }, (_, index) => ({ id: randomUUID(), ownerId: f.owner.id, sellerProfileId: f.shop.sellerProfileId,
      name: `${f.tag}-shop-${String(index).padStart(2, '0')}-end`, slug: randomUUID(), status: 'ACTIVE' as const, contactEmail: f.owner.email, contactPhone: '0800000000' }))
    await db.shop.createMany({ data: shops })
    const date = new Date('2026-10-15T01:00:00.000Z')
    const rooms = shops.map((shop) => ({ id: randomUUID(), buyerId: f.buyer.id, shopId: shop.id, updatedAt: date }))
    await db.chatThread.createMany({ data: rooms })
    await db.chatMessage.createMany({ data: rooms.map((room) => ({ threadId: room.id, senderId: f.owner.id, body: 'Unread visible content' })) })
    const count = vi.spyOn(db.chatMessage, 'count')
    try {
      const first = await service.listRooms(f.buyer, { scope: 'buyer', limit: 50 })
      expect(first.items).toHaveLength(50)
      expect(first.items.every((room) => room.unreadCount === 1)).toBe(true)
      expect(first.pagination.hasMore).toBe(true)
      expect(first.pagination.nextCursor).toBeTruthy()
      expect(await service.unreadCount(f.buyer, { scope: 'buyer' })).toEqual({ unreadCount: 55 })
      const second = await service.listRooms(f.buyer, { scope: 'buyer', limit: 50, cursor: first.pagination.nextCursor ?? undefined })
      expect(second.items).toHaveLength(5)
      expect(second.pagination).toEqual({ limit: 50, hasMore: false, nextCursor: null })
      const ids = [...first.items, ...second.items].map((room) => room.roomId)
      expect(ids).toEqual(rooms.map((room) => room.id).sort().reverse())
      expect(new Set(ids).size).toBe(55)
      const lastRoom = second.items.at(-1)
      const searched = await service.listRooms(f.buyer, { scope: 'buyer', q: lastRoom?.shop.name, limit: 1 })
      expect(searched.items.map((room) => room.roomId)).toEqual([lastRoom?.roomId])
      expect((await service.listRooms(f.buyer, { scope: 'buyer', q: "' OR 1=1 --" })).items).toEqual([])
      expect((await service.listRooms(f.buyer, { scope: 'buyer', q: '%' })).items).toEqual([])
      expect((await service.listRooms(f.buyer, { scope: 'buyer', q: '_' })).items).toEqual([])
      expect((await service.listRooms(f.buyer, { scope: 'buyer', q: f.buyer.name })).items).toEqual([])
      expect((await service.listRooms(f.buyer, { q: f.buyer.name })).items).toEqual([])
      expect((await service.listRooms(f.owner, { scope: 'seller', shopId: shops[0].id, q: f.buyer.name })).items.map((room) => room.shop.id)).toEqual([shops[0].id])
      expect((await service.listRooms(f.buyer, { scope: 'seller', shopId: shops[0].id })).items).toEqual([])
      expect((await service.listRooms(f.owner, { scope: 'seller', shopId: shops[0].id })).items.map((room) => room.shop.id)).toEqual([shops[0].id])
      expect(await service.unreadCount(f.owner, { scope: 'buyer' })).toEqual({ unreadCount: 0 })
      expect(count).not.toHaveBeenCalled()
    } finally { count.mockRestore() }
  })

  it('preserves ID and legacy timestamp read boundaries, sender exclusion, tombstones and actor isolation', async () => {
    const f = await numericThresholdFixture(db)
    const repo = new PrismaChatRepository(thresholdContext, db)
    const service = new ChatService(thresholdContext, repo)
    const room = await db.chatThread.create({ data: { buyerId: f.buyer.id, shopId: f.shop.id } })
    const at = new Date('2026-10-15T01:00:00.000Z')
    const later = new Date(at.getTime() + 1_000)
    const ids = Array.from({ length: 6 }, () => randomUUID()).sort()
    await db.chatMessage.createMany({ data: ids.map((id, index) => ({ id, threadId: room.id, senderId: index === 3 ? f.buyer.id : f.owner.id,
      body: index === 4 ? 'Deleted secret content' : `Visible ${index}`, createdAt: index > 2 ? later : at, deletedAt: index === 4 ? later : null })) })
    await db.chatThread.update({ where: { id: room.id }, data: { buyerReadAt: at, buyerReadMessageId: ids[1], sellerReadAt: at, sellerReadMessageId: ids[1] } })
    expect((await service.listRooms(f.buyer, { scope: 'buyer', unreadOnly: true })).items.map((row) => row.unreadCount)).toEqual([2])
    expect(await service.unreadCount(f.buyer, { scope: 'buyer' })).toEqual({ unreadCount: 2 })
    expect((await service.listRooms(f.owner, { scope: 'seller', shopId: f.shop.id })).items.map((row) => row.unreadCount)).toEqual([1])
    expect((await service.listRooms(f.buyer, { scope: 'buyer', q: 'Deleted secret content' })).items).toEqual([])
    await db.chatThread.update({ where: { id: room.id }, data: { buyerReadMessageId: null } })
    expect(await service.unreadCount(f.buyer, { scope: 'buyer' })).toEqual({ unreadCount: 1 })
    expect((await service.listRooms(f.buyer, { scope: 'buyer' })).items[0]?.unreadCount).toBe(1)
    await db.chatThread.update({ where: { id: room.id }, data: { buyerReadAt: null } })
    expect(await service.unreadCount(f.buyer, { scope: 'buyer' })).toEqual({ unreadCount: 4 })
    const stranger = await db.user.create({ data: { name: 'Stranger', email: `${randomUUID()}@example.test` } })
    expect((await service.listRooms(stranger, { scope: 'buyer' })).items).toEqual([])
    expect(await service.unreadCount(stranger)).toEqual({ unreadCount: 0 })
    await db.shop.update({ where: { id: f.shop.id }, data: { status: 'SUSPENDED' } })
    expect((await service.listRooms(f.owner, { scope: 'seller', shopId: f.shop.id })).items).toEqual([])
    expect(await service.unreadCount(f.owner, { scope: 'seller', shopId: f.shop.id })).toEqual({ unreadCount: 0 })
    expect((await service.listRooms(f.buyer, { scope: 'buyer' })).items.map((row) => row.canSend)).toEqual([false])
  })
})
