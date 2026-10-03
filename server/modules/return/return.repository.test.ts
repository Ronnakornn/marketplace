import { describe, expect, it, vi } from 'vitest'
import { PrismaReturnRepository } from './return.repository.ts'

describe('return refund persistence', () => {
  it('uses the returned shop settlement snapshot instead of the gross line total', async () => {
    const prisma = {
      shopOrder: { findUniqueOrThrow: vi.fn(async () => ({ subtotal: 10000n, discountTotal: 2000n })) },
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
