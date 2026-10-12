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
    currency: 'THB',
    status,
    requestedById: 'seller-1',
    approvedById: null,
    rejectedById: null,
    paidById: null,
    externalReference: null,
    cycleKey: null,
    evidenceUploadId: null,
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
      currency: 'THB',
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
    lockWallet: vi.fn(),
    findWalletByShopId: vi.fn(),
    sumLedger: vi.fn(),
    createPayout: vi.fn(),
    createLedgerEntry: vi.fn(),
    listSellerPayouts: vi.fn(),
    listAdminPayouts: vi.fn(),
    lockPayout: vi.fn(),
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
      currency: 'THB',
      version: 0,
      balance: BigInt(0),
      pendingBalance: BigInt(0),
      withdrawableBalance: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(repo.sumLedger).mockResolvedValue(10000n)
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
    vi.mocked(repo.sumLedger).mockResolvedValue(100n)

    await expect(service.createSellerPayout({ id: 'seller-1', role: 'USER' }, { amount: 5000 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })
  })

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, 9007199254740992])('rejects an invalid payout amount %s before reserving funds', async (amount) => {
    vi.mocked(repo.sumLedger).mockResolvedValue(9007199254740992n)
    await expect(service.createSellerPayout({ id: 'seller-1', role: 'USER' }, { amount }))
      .rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE', status: 400 })
    expect(repo.createPayout).not.toHaveBeenCalled()
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })

  it('admin can approve payout', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('requested'))
    vi.mocked(repo.updatePayout).mockResolvedValue(payout('approved'))

    await expect(service.approveAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .resolves.toMatchObject({ status: 'approved' })
  })

  it.each(['approve', 'paid'] as const)('blocks %s when a refund leaves the reserved wallet at minus one', async (transition) => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout(transition === 'approve' ? 'requested' : 'approved'))
    vi.mocked(repo.updatePayout).mockResolvedValue(payout(transition === 'approve' ? 'approved' : 'paid'))
    vi.mocked(repo.sumLedger).mockResolvedValue(-1n)
    const result = transition === 'approve'
      ? service.approveAdminPayout({ id: 'admin-2', role: 'ADMIN' }, 'payout-1')
      : service.markAdminPayoutPaid({ id: 'admin-2', role: 'ADMIN' }, 'payout-1', { externalReference: 'BANK-123' })
    await expect(result).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE', status: 409 })
    expect(repo.lockWallet).toHaveBeenCalledWith('wallet-1')
    expect(repo.sumLedger).toHaveBeenCalledWith('wallet-1', 'THB')
    expect(repo.updatePayout).not.toHaveBeenCalled()
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it.each([
    ['approve', 0n], ['approve', 1n], ['paid', 0n], ['paid', 1n],
  ] as const)('allows %s at a ledger balance of %s after reservation', async (transition, balance) => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout(transition === 'approve' ? 'requested' : 'approved'))
    vi.mocked(repo.sumLedger).mockResolvedValue(balance)
    vi.mocked(repo.updatePayout).mockResolvedValue(payout(transition === 'approve' ? 'approved' : 'paid'))
    const result = transition === 'approve'
      ? service.approveAdminPayout({ id: 'admin-2', role: 'ADMIN' }, 'payout-1')
      : service.markAdminPayoutPaid({ id: 'admin-2', role: 'ADMIN' }, 'payout-1', { externalReference: 'BANK-123' })
    await expect(result).resolves.toMatchObject({ status: transition === 'approve' ? 'approved' : 'paid', amount: 5000n })
    const walletLock = vi.mocked(repo.lockWallet).mock.invocationCallOrder[0]!
    const balanceRead = vi.mocked(repo.sumLedger).mock.invocationCallOrder[0]!
    const statusWrite = vi.mocked(repo.updatePayout).mock.invocationCallOrder[0]!
    expect(walletLock).toBeGreaterThan(vi.mocked(repo.lockPayout).mock.invocationCallOrder[0]!)
    expect(balanceRead).toBeGreaterThan(walletLock)
    expect(statusWrite).toBeGreaterThan(balanceRead)
    if (transition === 'approve') expect(repo.createLedgerEntry).not.toHaveBeenCalled()
    else expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'payout_paid', amount: 0 }))
  })

  it.each(['approve', 'paid'] as const)('rejects %s when the payout currency differs from its wallet', async (transition) => {
    const record = payout(transition === 'approve' ? 'requested' : 'approved')
    record.wallet.currency = 'USD'
    vi.mocked(repo.findPayoutById).mockResolvedValue(record)
    vi.mocked(repo.updatePayout).mockResolvedValue(payout(transition === 'approve' ? 'approved' : 'paid'))
    const result = transition === 'approve'
      ? service.approveAdminPayout({ id: 'admin-2', role: 'ADMIN' }, 'payout-1')
      : service.markAdminPayoutPaid({ id: 'admin-2', role: 'ADMIN' }, 'payout-1', { externalReference: 'BANK-123' })
    await expect(result).rejects.toMatchObject({ code: 'WALLET_CURRENCY_MISMATCH', status: 409 })
    expect(repo.updatePayout).not.toHaveBeenCalled()
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })

  it('allows rejecting an unfunded reservation and releasing its literal reserved amount', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('approved'))
    vi.mocked(repo.sumLedger).mockResolvedValue(-1n)
    vi.mocked(repo.updatePayout).mockResolvedValue(payout('rejected'))
    await expect(service.rejectAdminPayout({ id: 'admin-2', role: 'ADMIN' }, 'payout-1')).resolves.toMatchObject({ status: 'rejected' })
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'payout_rejected', amount: 5000n }))
  })

  it('blocks a new payout while the seller owes one minor unit', async () => {
    vi.mocked(repo.sumLedger).mockResolvedValue(-1n)
    await expect(service.createSellerPayout({ id: 'seller-1', role: 'USER' }, { amount: 1 }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE', status: 409 })
    expect(repo.createPayout).not.toHaveBeenCalled()
    expect(repo.createLedgerEntry).not.toHaveBeenCalled()
  })

  it('admin can reject payout', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('approved'))
    vi.mocked(repo.updatePayout).mockResolvedValue({ ...payout('rejected'), rejectionReason: 'bad details' })

    await expect(service.rejectAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1', { reason: 'bad details' }))
      .resolves.toMatchObject({ status: 'rejected', rejectionReason: 'bad details' })
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout_rejected',
      amount: 5000n,
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

    await expect(service.markAdminPayoutPaid({ id: 'admin-2', role: 'ADMIN' }, 'payout-1', {
      externalReference: 'BANK-TRANSFER-123',
    }))
      .resolves.toMatchObject({ status: 'paid' })
    expect(repo.updatePayout).toHaveBeenCalledWith('payout-1', expect.objectContaining({
      paidById: 'admin-2',
      externalReference: 'BANK-TRANSFER-123',
    }))
    expect(repo.createLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payout_paid',
      amount: 0,
    }))
  })

  it('requires two administrators and an external transfer reference', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue({ ...payout('approved'), approvedById: 'admin-1' })

    await expect(service.markAdminPayoutPaid({ id: 'admin-1', role: 'ADMIN' }, 'payout-1', {
      externalReference: 'BANK-TRANSFER-123',
    })).rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })
    await expect(service.markAdminPayoutPaid({ id: 'admin-2', role: 'ADMIN' }, 'payout-1', {
      externalReference: ' ',
    })).rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })
  })

  it('invalid payout transition fails', async () => {
    vi.mocked(repo.findPayoutById).mockResolvedValue(payout('paid'))

    await expect(service.approveAdminPayout({ id: 'admin-1', role: 'ADMIN' }, 'payout-1'))
      .rejects.toMatchObject({ code: 'INVALID_PAYOUT_STATE' })
  })
})
