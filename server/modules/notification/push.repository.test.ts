import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaPushRepository, maxPushSubscriptionsPerUser } from './push.repository.ts'

const context: AppContext = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
const input = { endpoint: 'https://push.example/device', locale: 'en' as const, keys: { auth: 'auth', p256dh: 'key' } }

function setup(count: number, owner: string | null = null) {
  const calls: string[] = []
  const tx = {
    $queryRaw: vi.fn(async (_query: TemplateStringsArray, ..._values: unknown[]) => { calls.push('lock'); return [] }),
    pushSubscription: {
      deleteMany: vi.fn(async () => { calls.push('expire'); return { count: 0 } }),
      findUnique: vi.fn(async () => { calls.push('existing'); return owner ? { userId: owner } : null }),
      count: vi.fn(async () => { calls.push('count'); return count }),
      upsert: vi.fn(async () => { calls.push('upsert') }),
    },
  }
  const prisma = {
    $transaction: vi.fn(async (operation: (client: typeof tx) => Promise<void>) => operation(tx)),
    pushSubscription: { findMany: vi.fn(async () => []) },
  }
  return { repo: new PrismaPushRepository(context, prisma as unknown as PrismaClient), prisma, tx, calls }
}

describe('push device registry quota', () => {
  it('rejects a new device at quota only after serializing registration and expiring stale rows', async () => {
    const { repo, tx, calls } = setup(maxPushSubscriptionsPerUser)
    await expect(repo.upsert('user-1', input)).rejects.toMatchObject({ status: 409, code: 'PUSH_SUBSCRIPTION_LIMIT_REACHED' })
    expect(calls).toEqual(['lock', 'expire', 'existing', 'count'])
    expect(tx.$queryRaw.mock.calls[0]?.[0].join('?')).toContain('FOR UPDATE')
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', expirationTime: { lte: expect.any(Date) } } })
    expect(tx.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('renews an existing device at quota without evicting legitimate devices', async () => {
    const { repo, tx } = setup(maxPushSubscriptionsPerUser, 'user-1')
    await repo.upsert('user-1', input)
    expect(tx.pushSubscription.upsert).toHaveBeenCalledOnce()
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledTimes(1)
    expect(tx.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1', expirationTime: { lte: expect.any(Date) } } })
  })

  it('allows a new device below quota and does not bypass quota through an endpoint owned by another user', async () => {
    const below = setup(maxPushSubscriptionsPerUser - 1)
    await below.repo.upsert('user-1', input)
    expect(below.tx.pushSubscription.upsert).toHaveBeenCalledOnce()
    const transferred = setup(maxPushSubscriptionsPerUser, 'other-user')
    await expect(transferred.repo.upsert('user-1', input)).rejects.toMatchObject({ code: 'PUSH_SUBSCRIPTION_LIMIT_REACHED' })
    expect(transferred.tx.pushSubscription.upsert).not.toHaveBeenCalled()
  })

  it('bounds database hydration and uses stable ordering for existing larger registries', async () => {
    const { repo, prisma } = setup(0)
    expect(await repo.findForUser('user-1')).toEqual([])
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: maxPushSubscriptionsPerUser })
  })
})
