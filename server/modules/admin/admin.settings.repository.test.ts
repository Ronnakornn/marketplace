import { expect, it, vi } from 'vitest'
import { PrismaAdminRepository } from './admin.repository.ts'

it('pages metadata without reading JSON values and retains dedicated full detail', async () => {
  const prisma = {
    $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)),
    systemSetting: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(1500), findUnique: vi.fn().mockResolvedValue({ key: 'coupon.targets.x', value: { productIds: ['p1'] } }) },
  }
  const repo = new PrismaAdminRepository({ logger: { debug: vi.fn() } } as never, prisma as never)
  expect(await repo.listSystemSettings('coupon.targets', { page: 3, limit: 10 })).toEqual({ items: [], total: 1500 })
  expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
    where: { OR: [{ key: { contains: 'coupon.targets', mode: 'insensitive' } }, { description: { contains: 'coupon.targets', mode: 'insensitive' } }] },
    orderBy: { key: 'asc' }, skip: 20, take: 10, omit: { value: true },
  })
  expect(await repo.findSystemSettingByKey('coupon.targets.x')).toMatchObject({ value: { productIds: ['p1'] } })
})

it('searches percent, underscore and backslash as literal key or description text', async () => {
  const findMany = vi.fn().mockResolvedValue([])
  const prisma = { $transaction: vi.fn(async (queries: unknown[]) => Promise.all(queries)), systemSetting: { findMany, count: vi.fn().mockResolvedValue(0) } }
  const repo = new PrismaAdminRepository({ logger: { debug: vi.fn() } } as never, prisma as never)
  await repo.listSystemSettings(String.raw`coupon_50%\path`, { page: 1, limit: 10 })
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [
    { key: { contains: String.raw`coupon\_50\%\\path`, mode: 'insensitive' } },
    { description: { contains: String.raw`coupon\_50\%\\path`, mode: 'insensitive' } },
  ] } }))
})
