import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { PrismaCartRepository } from './cart.repository.ts'

const context = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

function fixture() {
  const events: string[] = []
  const cart = { id: 'cart', userId: 'buyer', status: 'ACTIVE', items: [] }
  const tx = {
    $queryRaw: vi.fn(async (sql: TemplateStringsArray) => { events.push(sql.join('?')); return [] }),
    cart: {
      findFirst: vi.fn().mockResolvedValue({ id: cart.id }),
      create: vi.fn().mockResolvedValue({ id: cart.id }),
      findUniqueOrThrow: vi.fn(async () => { events.push('hydrate'); return cart }),
    },
  }
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  }
  const repo = new PrismaCartRepository(context, prisma as unknown as PrismaClient)
  return { repo, prisma, tx, cart, events }
}

describe('PrismaCartRepository locked snapshots', () => {
  it('loads cart relations once after both locks and returns that snapshot', async () => {
    const f = fixture()
    const result = await f.repo.withLockedActiveCart('buyer', async cart => {
      f.events.push('callback')
      return cart
    })
    expect(result).toBe(f.cart)
    expect(f.tx.cart.findFirst).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'buyer', status: 'ACTIVE' }, select: { id: true }, orderBy: { createdAt: 'desc' },
    })
    expect(f.tx.cart.findUniqueOrThrow).toHaveBeenCalledTimes(1)
    expect(f.events).toEqual([
      'SELECT "id" FROM "Cart" WHERE "id" = ? FOR UPDATE',
      'SELECT "id" FROM "CartItem" WHERE "cartId" = ? ORDER BY "id" FOR UPDATE',
      'hydrate', 'callback',
    ])
  })

  it('reuses the cart created by an overlapping request after obtaining the buyer lock', async () => {
    const f = fixture()
    f.tx.cart.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'overlapping-cart' })
    await f.repo.withLockedActiveCart('buyer', async cart => cart)
    expect(f.events[0]).toBe('SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE')
    expect(f.tx.cart.findFirst).toHaveBeenCalledTimes(2)
    expect(f.tx.cart.create).not.toHaveBeenCalled()
    expect(f.tx.cart.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'overlapping-cart' } }))
    expect(f.tx.cart.findUniqueOrThrow).toHaveBeenCalledTimes(1)
  })

  it('creates a first cart with only its ID before hydrating the locked snapshot', async () => {
    const f = fixture()
    f.tx.cart.findFirst.mockResolvedValue(null)
    await f.repo.withLockedActiveCart('buyer', async cart => cart)
    expect(f.tx.cart.create).toHaveBeenCalledExactlyOnceWith({
      data: { userId: 'buyer', status: 'ACTIVE' }, select: { id: true },
    })
    expect(f.tx.cart.findUniqueOrThrow).toHaveBeenCalledTimes(1)
    expect(f.events).toEqual([
      'SELECT "id" FROM "User" WHERE "id" = ? FOR UPDATE',
      'SELECT "id" FROM "Cart" WHERE "id" = ? FOR UPDATE',
      'SELECT "id" FROM "CartItem" WHERE "cartId" = ? ORDER BY "id" FOR UPDATE',
      'hydrate',
    ])
  })
})
