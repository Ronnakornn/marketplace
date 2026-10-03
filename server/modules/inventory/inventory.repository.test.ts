import { describe, expect, it, vi } from 'vitest'
import { PrismaInventoryRepository } from './inventory.repository.ts'

describe('inventory mutation locking', () => {
  it('rereads stock under the transaction lock after an outdated upsert read', async () => {
    const tx = {
      inventory: {
        upsert: vi.fn(async () => ({ quantityOnHand: 10, quantityReserved: 0 })),
        findUniqueOrThrow: vi.fn(async () => ({ quantityOnHand: 10, quantityReserved: 8 })),
      },
      $queryRaw: vi.fn(async () => []),
    }
    const repo = new PrismaInventoryRepository({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }, {} as any)
    await expect(repo.ensureInventory('variant-1', tx as any)).resolves.toMatchObject({ quantityReserved: 8 })
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.inventory.findUniqueOrThrow.mock.invocationCallOrder[0]!)
  })
})
