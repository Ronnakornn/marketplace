import { describe, expect, it, vi } from 'vitest'
import type { Prisma, PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaNotificationRepository } from './notification.repository.ts'

const context: AppContext = { logger: { debug() {}, info() {}, warn() {}, error() {} }, config: { environment: 'test' } }
function fixture() {
  const query = vi.fn<(sql: Prisma.Sql) => Promise<unknown[]>>().mockResolvedValue([])
  const update = vi.fn<(sql: Prisma.Sql) => Promise<number>>().mockResolvedValue(7)
  const prisma = { $queryRaw: query, $executeRaw: update } as unknown as PrismaClient
  return { repo: new PrismaNotificationRepository(context, prisma), query, update }
}

describe('notification repository bounded SQL', () => {
  it('owns both list and row cursor and requests only one bounded lookahead', async () => {
    const { repo, query } = fixture()
    await repo.findNotificationsForUser('owner', 'all', { cursor: 'cursor', limit: 30 })
    const sql = query.mock.calls[0]?.[0]
    expect(sql?.sql).toContain('("createdAt", "id") < (')
    expect(sql?.sql).toContain('WHERE "id" = ?::uuid AND "userId" = ?::uuid')
    expect(sql?.sql).toContain('ORDER BY "createdAt" DESC, "id" DESC LIMIT ?')
    expect(sql?.values).toEqual(['owner', 'cursor', 'owner', 31])
  })

  it('shares its exact seller predicate across page, count and a single bulk update', async () => {
    const { repo, query, update } = fixture()
    await repo.findNotificationsForUser('owner', 'seller', { limit: 30 })
    await repo.countUnreadForUser('owner', 'seller')
    await expect(repo.markAllAsRead('owner', new Date(0), 'seller')).resolves.toBe(7)
    const queries = [query.mock.calls[0]?.[0], query.mock.calls[1]?.[0], update.mock.calls[0]?.[0]]
    for (const sql of queries) {
      expect(sql?.sql).toContain('"userId" = ?::uuid')
      expect(sql?.values).toContain('owner')
      expect(sql?.sql).toContain("lower(\"type\") = 'payout_paid'")
      expect(sql?.sql).toContain("jsonb_typeof(\"data\") = 'object'")
      expect(sql?.sql).toContain("jsonb_typeof(\"data\"->'orderNo') IS DISTINCT FROM 'string'")
      expect(sql?.sql).not.toContain('payout_rejected')
    }
    expect(update).toHaveBeenCalledOnce()
    expect(queries[2]?.sql).toContain('AND "readAt" IS NULL')
  })

  it('counts unread in the database and adds the non-chat filter only when requested', async () => {
    const { repo, query } = fixture()
    query.mockResolvedValue([{ count: 12n }])
    expect(await repo.countUnreadForUser('owner')).toBe(12)
    expect(query.mock.calls[0]?.[0].sql).not.toContain("NOT LIKE '%chat%'")
    expect(await repo.countUnreadForUser('owner', 'seller', true)).toBe(12)
    expect(query.mock.calls[1]?.[0].sql).toContain("AND lower(\"type\") NOT LIKE '%chat%'")
  })

  it('filters category with the same precedence as the existing UI before the limit', async () => {
    const { repo, query } = fixture()
    await repo.findNotificationsForUser('owner', 'all', { category: 'chat', limit: 2 })
    const sql = query.mock.calls[0]?.[0]
    expect(sql?.sql).toMatch(/payment[\s\S]+refund[\s\S]+chat[\s\S]+promotion[\s\S]+LIMIT/)
    expect(sql?.values).toEqual(['owner', 'chat', 3])
  })
})
