import { describe, expect, it, vi } from 'vitest'
import { PrismaReturnRepository } from './return.repository.ts'

describe('return refund persistence', () => {
  it('does not nest transactions when a Prisma transaction proxy exposes $transaction', async () => {
    const tx = {
      $transaction: vi.fn(async () => { throw new Error('Nested transaction attempted') }),
      $queryRaw: vi.fn(async () => []),
      itemSaleSnapshot: { count: vi.fn(async () => 0) },
      shopOrder: { findMany: vi.fn(async () => [{ saleSnapshot: null }]), findUniqueOrThrow: vi.fn(async () => ({ subtotal: 10000n, discountTotal: 2000n })) },
      orderItem: { findMany: vi.fn(async () => [{ id: 'item-1', lineTotal: 10000n, quantity: 1 }]) },
      refund: { create: vi.fn(async ({ data }: { data: { amount: bigint } }) => data) },
    }
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) }
    const repo = new PrismaReturnRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, prisma as never)
    await expect(repo.createPendingRefundForReturn({
      id: 'return-1', shopId: 'shop-1', orderId: 'order-1', reason: 'Damaged',
      items: [{ orderItemId: 'item-1', quantity: 1, orderItem: { lineTotal: 10000n } }],
      order: { payments: [{ id: 'payment-1', status: 'SUCCEEDED' }] },
    } as never)).resolves.toMatchObject({ amount: 8000n })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.$transaction).not.toHaveBeenCalled()
  })

  it('uses the returned shop settlement snapshot instead of the gross line total', async () => {
    const prisma = {
      $queryRaw: vi.fn(async () => []),
      itemSaleSnapshot: { count: vi.fn(async () => 0) },
      shopOrder: { findMany: vi.fn(async () => [{ saleSnapshot: null }]), findUniqueOrThrow: vi.fn(async () => ({ subtotal: 10000n, discountTotal: 2000n })) },
      orderItem: { findMany: vi.fn(async () => [{ id: 'item-1', lineTotal: 10000n, quantity: 1 }]) },
      refund: { create: vi.fn(async (input: any) => input.data) },
    }
    const repo = new PrismaReturnRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, prisma as any)
    await repo.createPendingRefundForReturn({
      id: 'return-1', shopId: 'shop-1', orderId: 'order-1', reason: 'Damaged',
      items: [{ orderItemId: 'item-1', quantity: 1, orderItem: { lineTotal: 10000n } }],
      order: { payments: [{ id: 'payment-1', status: 'SUCCEEDED' }] },
    } as any)
    expect(prisma.shopOrder.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { orderId_shopId: { orderId: 'order-1', shopId: 'shop-1' } } }))
    expect(prisma.refund.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 8000n }) })
  })
})
