import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaDiscoveryRepository } from './discovery.repository.ts'
const database = process.env.REPORTING_TEST_DATABASE_URL
describe.skipIf(!database)('scheduled homepage banners on isolated PostgreSQL', () => {
  let prisma: PrismaClient
  const ids: string[] = [], now = new Date('2026-10-14T00:00:00Z')
  beforeAll(async () => {
    const url = new URL(database!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port === '5432' || !['/full_admin_reporting_test', '/marketplace_test_reporting'].includes(url.pathname)) throw new Error('Use the dedicated reporting test database')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database! }) })
    for (const [status, startsAt, endsAt] of [['SCHEDULED', now, new Date(now.getTime() + 1000)], ['PUBLISHED', now, new Date(now.getTime() + 1000)], ['SCHEDULED', new Date(now.getTime() + 1), null], ['PUBLISHED', null, now], ['DRAFT', null, null]] as const) {
      const id = randomUUID(); ids.push(id)
      await prisma.marketingBanner.create({ data: { id, title: 'Test popup', imageUrl: '/test.jpg', placement: 'HOME_POPUP', sortOrder: ids.length - 100, status, startsAt, endsAt, metadata: { popupFrequency: 'DAILY', titleTh: 'ข้อเสนอ' } } })
    }
  })
  afterAll(async () => { if (prisma) { await prisma.marketingBanner.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect() } })
  it('includes scheduled/published active popups, excludes future/expired/draft and projects metadata', async () => {
    const repo = new PrismaDiscoveryRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, prisma)
    const banners = await repo.findHomeBanners(8, now)
    expect(banners.filter(banner => ids.includes(banner.id)).map(banner => banner.id)).toEqual([ids[0]])
    expect(banners.find(banner => banner.id === ids[0])?.metadata).toEqual({ popupFrequency: 'DAILY', titleTh: 'ข้อเสนอ' })
    await prisma.marketingBanner.update({ where: { id: ids[0] }, data: { endsAt: now } })
    expect((await repo.findHomeBanners(8, now)).filter(banner => ids.includes(banner.id)).map(banner => banner.id)).toEqual([ids[1]])
  })
})
