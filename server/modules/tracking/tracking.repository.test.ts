import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { PrismaTrackingRepository } from './tracking.repository.ts'

const context = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe('PrismaTrackingRepository impression batches', () => {
  it('selects only active product IDs and shops in one read and inserts duplicate facts in one write', async () => {
    const prisma = { product: { findMany: vi.fn().mockResolvedValue([{ id: 'product', shopId: 'shop' }]) }, productViewLog: { createMany: vi.fn() } }
    const repo = new PrismaTrackingRepository(context, prisma as unknown as PrismaClient)
    expect(await repo.findActiveProducts(['product'])).toEqual([{ id: 'product', shopId: 'shop' }])
    expect(prisma.product.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: { in: ['product'] }, status: 'ACTIVE', deletedAt: null, shop: { status: 'ACTIVE' } },
      select: { id: true, shopId: true },
    })
    const events = [
      { productId: 'product', shopId: 'shop', sessionId: 'session-a', source: 'search', metadata: { position: 0 } },
      { productId: 'product', shopId: 'shop', sessionId: 'session-b', source: 'category', metadata: { position: 1 } },
    ]
    await repo.createProductViewLogs(events)
    expect(prisma.productViewLog.createMany).toHaveBeenCalledExactlyOnceWith({ data: events })
  })
})
