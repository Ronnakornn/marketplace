import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { IPayoutRepository, PayoutRecord } from './payout.repository.ts'
import { PayoutService } from './payout.service.ts'

function appContext(): AppContext {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

function payout(status: PayoutRecord['status'] = 'requested'): PayoutRecord {
  return {
    id: 'payout-1',
    walletId: 'wallet-1',
    shopId: 'shop-1',
    amount: BigInt(5000),
    currency: 'USD',
    status,
    requestedById: 'seller-1',
    approvedById: null,
    rejectedById: null,
    paidById: null,
    rejectionReason: null,
    requestedAt: new Date('2026-05-01T00:00:00.000Z'),
    approvedAt: null,
    rejectedAt: null,
    paidAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    wallet: {
      id: 'wallet-1',
      shopId: 'shop-1',
      currency: 'USD',
      version: 0,
      balance: BigInt(0),
      pendingBalance: BigInt(0),
      withdrawableBalance: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    shop: { id: 'shop-1', name: 'Shop One', ownerId: 'seller-1' },
  }
}

function repoMock(): IPayoutRepository {
  return {
    transaction: vi.fn((callback) => callback(repo)),
    findSellerShops: vi.fn(),
    ensureWallet: vi.fn(),
    findWalletByShopId: vi.fn(),
    sumLedger: vi.fn(),
    createPayout: vi.fn(),
    createLedgerEntry: vi.fn(),
    listSellerPayouts: vi.fn(),
    listAdminPayouts: vi.fn(),
    findPayoutById: vi.fn(),
    updatePayout: vi.fn(),
  }
}

let repo: IPayoutRepository
let service: PayoutService
let eventPublisher: { publish: ReturnType<typeof vi.fn> }

describe('PayoutService', () => {
  beforeEach(() => {
    repo = repoMock()
    eventPublisher = { publish: vi.fn().mockResolvedValue(undefined) }
    service = new PayoutService(appContext(), repo, eventPublisher as any)
    vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1', name: 'Shop One', ownerId: 'seller-1' }])
    vi.mocked(repo.ensureWallet).mockResolvedValue({
      id: 'wallet-1',
      shopId: 'shop-1',
      currency: 'USD',
      version: 0,
      balance: BigInt(0),
      pendingBalance: BigInt(0),
      withdrawableBalance: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.sumLedger).mockResolvedValue(10000)
    vi.mocked(repo.createPayout).mockResolvedValue(payout('requested'))
    vi.mocked(repo.createLedgerEntry).mockResolvedValue({} as never)
  })

  it('payout request reserves balance', async () => {
    await service.createSellerPayout({ id: 'seller-1', role: 'USER' }, { amount: 5000 })

    expect(repo.createPayout).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000 }))
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout_reserved',
      amount: -5000,
    }))
  })

  it('payout cannot exceed available balance', async () => {
    vi.mocked(repo.sumLedger).mockResolvedValue(100)

    await expect(service.createSellerPayout({ id: 'seller-1', role: 'USER' }, { amount: 5000 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it('admin can approve payout', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('requested'))
    vi.mocked(repo.updatePayout).mockResolvedValue(payout('approved'))

    await expect(service.approveAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .resolves.toMatchObject({ status: 'approved' })
  })

  it('admin can reject payout', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('approved'))
    vi.mocked(repo.updatePayout).mockResolvedValue({ ...payout('rejected'), rejectionReason: 'bad details' })

    await expect(service.rejectAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1', { reason: 'bad details' }))
      .resolves.toMatchObject({ status: 'rejected', rejectionReason: 'bad details' })
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout_rejected',
      amount: 5000,
    }))
    expect(eventPublisher.publish).toHaveBeenCalledWith({
      eventName: 'payout.rejected',
      aggregateType: 'payout',
      aggregateId: 'payout-1',
      actorUserId: 'admin-1',
      data: {
        payoutId: 'payout-1',
        shopId: 'shop-1',
        sellerUserId: 'seller-1',
        reason: 'bad details',
      },
    })
  })

  it('publishes payout rejection only after the transaction commits', async () => {
    let committed = false
    vi.mocked(repo.transaction).mockImplementationOnce(async (callback) => {
      const result = await callback(repo)
      committed = true
      return result
    })
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('requested'))
    vi.mocked(repo.updatePayout).mockResolvedValue({ ...payout('rejected'), rejectionReason: 'verify bank account' })
    eventPublisher.publish.mockImplementation(async () => {
      expect(committed).toBe(true)
    })

    await service.rejectAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1', {
      reason: ' verify bank account ',
    })

    expect(eventPublisher.publish).toHaveBeenCalledTimes(1)
  })

  it('does not publish payout rejection for invalid or rolled-back transitions', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValueOnce(payout('paid'))
    await expect(service.rejectAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })

    vi.mocked(repo.findPayoutById).mockResolvedValueOnce(payout('requested'))
    vi.mocked(repo.updatePayout).mockResolvedValueOnce(payout('rejected'))
    vi.mocked(repo.createLedgerEntry).mockRejectedValueOnce(new Error('rollback'))
    await expect(service.rejectAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .rejects.toThrow('rollback')

    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it('admin can mark payout paid', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('approved'))
    vi.mocked(repo.updatePayout).mockResolvedValue(payout('paid'))

    await expect(service.markAdminPayoutPaid({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .resolves.toMatchObject({ status: 'paid' })
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout_paid',
      amount: 0,
    }))
  })

  it('invalid payout transition fails', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('paid'))

    await expect(service.approveAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })
  })
})
