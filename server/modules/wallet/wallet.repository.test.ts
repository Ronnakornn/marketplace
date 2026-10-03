import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import { PrismaWalletRepository, type CreateLedgerEntryInput } from './wallet.repository.ts'

const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe('PrismaWalletRepository transaction boundaries', () => {
  it('keeps a nested earning write in the outer transaction despite a proxy transaction method', async () => {
    const writes: CreateLedgerEntryInput[] = []
    const tx = {
      $transaction: vi.fn(async () => { throw new Error('Interactive transaction proxy cannot open a nested transaction') }),
      walletLedgerEntry: { create: vi.fn(async ({ data }: { data: CreateLedgerEntryInput }) => {
        writes.push(data)
        return { id: 'earning-1', ...data }
      }) },
    }
    const prisma = { $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) }
    const repo = new PrismaWalletRepository(context, prisma as unknown as PrismaClient)
    const result = await repo.transaction((outer) => outer.transaction((inner) => inner.createLedgerEntry({
      walletId: 'wallet-1', shopId: 'shop-1', type: 'order_earning', amount: 4000,
      currency: 'THB', orderId: 'order-1', description: 'Retained shipping',
    })))
    expect(result).toMatchObject({ id: 'earning-1', type: 'order_earning', amount: 4000, orderId: 'order-1' })
    expect(writes).toEqual([{ walletId: 'wallet-1', shopId: 'shop-1', type: 'order_earning', amount: 4000,
      currency: 'THB', orderId: 'order-1', payoutId: null, refundId: null, description: 'Retained shipping', metadata: undefined }])
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.$transaction).not.toHaveBeenCalled()
  })
})
