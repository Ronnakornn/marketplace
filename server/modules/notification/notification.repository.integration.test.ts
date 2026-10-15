import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma, PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaNotificationRepository } from './notification.repository.ts'
import { NotificationService } from './notification.service.ts'

const context: AppContext = { logger: { debug() {}, info() {}, warn() {}, error() {} }, config: { environment: 'test' } }

describe.skipIf(!process.env['COMMERCE_TEST_DATABASE_URL'])('notification pagination on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaNotificationRepository
  let service: NotificationService
  const users: string[] = []
  beforeAll(() => {
    const connectionString = process.env['COMMERCE_TEST_DATABASE_URL']
    if (!connectionString) throw new Error('COMMERCE_TEST_DATABASE_URL is required')
    const parsed = new URL(connectionString)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
    repo = new PrismaNotificationRepository(context, db)
    service = new NotificationService(context, repo)
  })
  afterAll(async () => {
    if (db) {
      await db.user.deleteMany({ where: { id: { in: users } } })
      await db.$disconnect()
    }
  })
  async function actor() {
    const user = await db.user.create({ data: { name: 'Notifications test', email: `${randomUUID()}@example.test` } })
    users.push(user.id)
    return { id: user.id, role: user.role }
  }

  it('shares exact legacy seller JSON rules across listing, count and bulk read while retaining ownership', async () => {
    const owner = await actor()
    const other = await actor()
    const cases = [
      { type: 'PAYOUT_PAID', data: Prisma.DbNull, seller: true },
      { type: 'payout_rejected', data: {}, seller: false },
      { type: 'order_paid', data: {}, seller: true },
      { type: 'ORDER_PAID', data: { orderNo: null }, seller: true },
      { type: 'order_paid', data: { orderNo: 12 }, seller: true },
      { type: 'order_paid', data: { orderNo: false }, seller: true },
      { type: 'order_paid', data: { orderNo: [] }, seller: true },
      { type: 'order_paid', data: { orderNo: {} }, seller: true },
      { type: 'order_paid', data: { orderNo: '' }, seller: false },
      { type: 'order_paid', data: { orderNo: 'ORD-1' }, seller: false },
      { type: 'order_paid', data: Prisma.JsonNull, seller: false },
      { type: 'order_paid', data: Prisma.DbNull, seller: false },
      { type: 'order_paid', data: [], seller: false },
      { type: 'order_paid', data: 'seller', seller: false },
      { type: 'chat_message', data: { audience: 'seller' }, seller: true },
      { type: 'order_updated', data: { audience: 'seller', orderNo: 'ORD-2' }, seller: true },
    ] satisfies Array<{ type: string; data: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput; seller: boolean }>
    const rows = await Promise.all(cases.map((item) => db.notification.create({ data: { userId: owner.id, type: item.type, title: item.type, data: item.data } })))
    const foreign = await db.notification.create({ data: { userId: other.id, type: 'payout_paid', title: 'foreign' } })
    const expectedIds = rows.filter((_, index) => cases[index]?.seller).map((row) => row.id).sort()
    const page = await service.listNotifications(owner, 'seller', { limit: 100 })
    expect(page.items.map((row) => row.id).sort()).toEqual(expectedIds)
    expect(page.nextCursor).toBeNull()
    expect(await service.getUnreadCount(owner, 'seller')).toEqual({ unreadCount: expectedIds.length })
    expect(await service.getUnreadCount(owner, 'seller', true)).toEqual({ unreadCount: expectedIds.length - 1 })
    expect(await service.getUnreadCount(owner)).toEqual({ unreadCount: cases.length })
    expect(await service.markAllNotificationsAsRead(owner, 'seller')).toEqual({ updatedCount: expectedIds.length })
    expect(await service.markAllNotificationsAsRead(owner, 'seller')).toEqual({ updatedCount: 0 })
    const persisted = await db.notification.findMany({ where: { userId: owner.id } })
    expect(persisted.filter((row) => row.readAt).map((row) => row.id).sort()).toEqual(expectedIds)
    expect((await db.notification.findUniqueOrThrow({ where: { id: foreign.id } })).readAt).toBeNull()
  })

  it('paginates tied timestamps without skips and filters categories before applying limits', async () => {
    const owner = await actor()
    const other = await actor()
    const createdAt = new Date('2026-10-15T12:00:00.123Z')
    const types = ['order_paid', 'payment_chat', 'refund_chat', 'chat_coupon', 'promo_created', 'coupon_created', 'shipment_shipped', 'PAYOUT_PAID']
    const rows = await Promise.all(types.map((type) => db.notification.create({ data: { userId: owner.id, type, title: type, createdAt } })))
    const expected = rows.map((row) => row.id).sort().reverse()
    const ids: string[] = []
    let cursor: string | undefined
    do {
      const page = await service.listNotifications(owner, 'all', { limit: 2, cursor })
      ids.push(...page.items.map((row) => row.id))
      cursor = page.nextCursor ?? undefined
    } while (cursor)
    expect(ids).toEqual(expected)
    for (const [category, matching] of [
      ['order', ['order_paid', 'shipment_shipped']],
      ['payment', ['payment_chat', 'PAYOUT_PAID']],
      ['refund', ['refund_chat']],
      ['chat', ['chat_coupon']],
      ['promotion', ['promo_created', 'coupon_created']],
    ] as const) {
      const page = await service.listNotifications(owner, 'all', { limit: 1, category })
      expect(page.items).toHaveLength(1)
      expect(matching).toContain(page.items[0]?.type)
      const next = page.nextCursor ? await service.listNotifications(owner, 'all', { limit: 1, category, cursor: page.nextCursor }) : { items: [] }
      expect([...page.items, ...next.items].map((row) => row.type).sort()).toEqual([...matching].sort())
    }
    const foreign = await db.notification.create({ data: { userId: other.id, type: 'order_paid', title: 'foreign', createdAt } })
    expect(await service.listNotifications(owner, 'all', { cursor: foreign.id })).toEqual({ items: [], nextCursor: null })
    const removed = rows[0]
    if (!removed) throw new Error('Missing cursor fixture')
    await db.notification.delete({ where: { id: removed.id } })
    expect(await service.listNotifications(owner, 'all', { cursor: removed.id })).toEqual({ items: [], nextCursor: null })
    expect(await repo.markAllAsRead(owner.id, new Date())).toBe(types.length - 1)
    expect((await db.notification.findUniqueOrThrow({ where: { id: foreign.id } })).readAt).toBeNull()
  })
})
