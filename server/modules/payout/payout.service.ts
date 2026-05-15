import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { WalletServiceError } from '#server/modules/wallet'
import type { IPayoutRepository, PayoutRecord } from './payout.repository.ts'

export interface PayoutActor {
  id: string
  role: Role
}

export interface CreatePayoutInput {
  amountCents: number
}

export interface RejectPayoutInput {
  reason?: string
}

export interface PayoutResponse {
  id: string
  walletId: string
  shop: {
    id: string
    name: string
  }
  amountCents: number
  currency: string
  status: string
  rejectionReason: string | null
  requestedAt: Date
  approvedAt: Date | null
  rejectedAt: Date | null
  paidAt: Date | null
}

export class PayoutService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IPayoutRepository,
  ) {
    this.logger = appContext.logger
  }

  async createSellerPayout(actor: PayoutActor, input: CreatePayoutInput): Promise<PayoutResponse> {
    this.assertSeller(actor)
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new WalletServiceError('Payout amount must be positive cents', 400, 'INVALID_PAYOUT_STATE')
    }

    return this.repo.transaction(async (txRepo) => {
      const shop = (await txRepo.findSellerShops(actor.id))[0]
      if (!shop) throw new WalletServiceError('Wallet not found', 404, 'WALLET_NOT_FOUND')
      const wallet = await txRepo.ensureWallet(shop.id, 'USD')
      const balance = await txRepo.sumLedger(wallet.id)
      if (input.amountCents > balance) {
        throw new WalletServiceError('Payout request cannot exceed available balance', 409, 'INSUFFICIENT_BALANCE', {
          availableBalanceCents: balance,
        })
      }

      const payout = await txRepo.createPayout({
        walletId: wallet.id,
        shopId: shop.id,
        amountCents: input.amountCents,
        currency: wallet.currency,
        requestedById: actor.id,
      })
      await txRepo.createLedgerEntry({
        walletId: wallet.id,
        shopId: shop.id,
        payoutId: payout.id,
        type: 'payout_reserved',
        amountCents: -input.amountCents,
        currency: wallet.currency,
        description: 'Payout balance reserved',
      })
      return this.toResponse(payout)
    })
  }

  async listSellerPayouts(actor: PayoutActor): Promise<PayoutResponse[]> {
    this.assertSeller(actor)
    const shopIds = (await this.repo.findSellerShops(actor.id)).map((shop) => shop.id)
    return (await this.repo.listSellerPayouts(shopIds)).map((payout) => this.toResponse(payout))
  }

  async listAdminPayouts(actor: PayoutActor, input: { status?: string }): Promise<PayoutResponse[]> {
    this.assertAdmin(actor)
    const status = input.status ? this.normalizeStatus(input.status) : undefined
    return (await this.repo.listAdminPayouts(status)).map((payout) => this.toResponse(payout))
  }

  async getAdminPayout(actor: PayoutActor, payoutId: string): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    const payout = await this.repo.findPayoutById(payoutId)
    if (!payout) throw new WalletServiceError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
    return this.toResponse(payout)
  }

  approveAdminPayout(actor: PayoutActor, payoutId: string): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    this.logger.info('PayoutService.approveAdminPayout', { actorId: actor.id, payoutId })
    return this.repo.transaction(async (txRepo) => {
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'requested') {
        throw new WalletServiceError('Only requested payouts can be approved', 409, 'INVALID_PAYOUT_STATE')
      }
      return this.toResponse(await txRepo.updatePayout(payout.id, {
        status: 'approved',
        approvedById: actor.id,
        approvedAt: new Date(),
      }))
    })
  }

  rejectAdminPayout(actor: PayoutActor, payoutId: string, input: RejectPayoutInput = {}): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    return this.repo.transaction(async (txRepo) => {
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'requested' && payout.status !== 'approved') {
        throw new WalletServiceError('Only requested or approved payouts can be rejected', 409, 'INVALID_PAYOUT_STATE')
      }
      const updated = await txRepo.updatePayout(payout.id, {
        status: 'rejected',
        rejectedById: actor.id,
        rejectedAt: new Date(),
        rejectionReason: input.reason?.trim() || null,
      })
      await txRepo.createLedgerEntry({
        walletId: payout.walletId,
        shopId: payout.shopId,
        payoutId: payout.id,
        type: 'payout_rejected',
        amountCents: payout.amountCents,
        currency: payout.currency,
        description: 'Payout reserve released after rejection',
      })
      return this.toResponse(updated)
    })
  }

  markAdminPayoutPaid(actor: PayoutActor, payoutId: string): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    return this.repo.transaction(async (txRepo) => {
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'approved') {
        throw new WalletServiceError('Only approved payouts can be marked paid', 409, 'INVALID_PAYOUT_STATE')
      }
      const updated = await txRepo.updatePayout(payout.id, {
        status: 'paid',
        paidById: actor.id,
        paidAt: new Date(),
      })
      await txRepo.createLedgerEntry({
        walletId: payout.walletId,
        shopId: payout.shopId,
        payoutId: payout.id,
        type: 'payout_paid',
        amountCents: 0,
        currency: payout.currency,
        description: 'Payout marked paid manually',
      })
      return this.toResponse(updated)
    })
  }

  private async getPayoutForUpdate(repo: IPayoutRepository, payoutId: string): Promise<PayoutRecord> {
    const payout = await repo.findPayoutById(payoutId)
    if (!payout) throw new WalletServiceError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
    return payout
  }

  private assertSeller(actor: PayoutActor): void {
    if (actor.role !== 'SELLER') throw new WalletServiceError('Seller payout APIs require seller role', 403, 'PAYOUT_FORBIDDEN')
  }

  private assertAdmin(actor: PayoutActor): void {
    if (actor.role !== 'ADMIN') throw new WalletServiceError('Admin payout APIs require admin role', 403, 'PAYOUT_FORBIDDEN')
  }

  private normalizeStatus(status: string) {
    const normalized = status.trim().toLowerCase()
    if (!['requested', 'approved', 'rejected', 'paid', 'cancelled'].includes(normalized)) {
      throw new WalletServiceError('Invalid payout status', 400, 'INVALID_PAYOUT_STATE')
    }
    return normalized as 'requested' | 'approved' | 'rejected' | 'paid' | 'cancelled'
  }

  private toResponse(payout: PayoutRecord): PayoutResponse {
    return {
      id: payout.id,
      walletId: payout.walletId,
      shop: {
        id: payout.shop.id,
        name: payout.shop.name,
      },
      amountCents: payout.amountCents,
      currency: payout.currency,
      status: payout.status,
      rejectionReason: payout.rejectionReason,
      requestedAt: payout.requestedAt,
      approvedAt: payout.approvedAt,
      rejectedAt: payout.rejectedAt,
      paidAt: payout.paidAt,
    }
  }
}
