import type { AdminAuthorizer, AdminPermission } from '#server/modules/admin-access/admin-access.contract.ts'
import { payoutCycleKey } from '#server/modules/admin-operations/payout-cycle.ts'
import { moneyInteger } from '#server/lib/money.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { ActiveShopResolver } from '#server/modules/security'
import type { AuditLogService } from '#server/modules/audit-log'
import { WalletServiceError } from '#server/modules/wallet'
import type { IPayoutRepository, PayoutRecord } from './payout.repository.ts'

export interface PayoutActor {
  id: string
  role: Role
}

export interface CreatePayoutInput {
  amount: number
}

export interface RejectPayoutInput {
  reason?: string
}

export interface MarkPayoutPaidInput {
  evidenceId?: string
  externalReference: string
}

export interface PayoutResponse {
  id: string
  walletId: string
  shop: {
    id: string
    name: string
  }
  amount: bigint
  currency: string
  status: string
  approvedById: string | null
  externalReference: string | null
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
    private eventPublisher?: EventPublisherService,
    private activeShopResolver?: ActiveShopResolver,
    private auditLogService?: AuditLogService,
    private adminAuthorizer?: AdminAuthorizer,
  ) {
    this.logger = appContext.logger
  }

  async createSellerPayout(actor: PayoutActor, input: CreatePayoutInput): Promise<PayoutResponse> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
      throw new WalletServiceError('Payout amount must be positive cents', 400, 'INVALID_PAYOUT_STATE')
    }

    return this.repo.transaction(async (txRepo) => {
      const shop = (await txRepo.findSellerShops(actor.id))[0]
      if (!shop) throw new WalletServiceError('Wallet not found', 404, 'WALLET_NOT_FOUND')
      const wallet = await txRepo.ensureWallet(shop.id, 'THB')
      if (wallet.currency !== 'THB') {
        throw new WalletServiceError('Wallet currency must be THB', 409, 'WALLET_CURRENCY_MISMATCH')
      }
      await txRepo.lockWallet(wallet.id)
      const balance = await txRepo.sumLedger(wallet.id, wallet.currency)
      if (input.amount > balance) {
        throw new WalletServiceError('Payout request cannot exceed available balance', 409, 'INSUFFICIENT_BALANCE', {
          availableBalanceCents: balance,
        })
      }

      const payout = await txRepo.createPayout({
        walletId: wallet.id,
        shopId: shop.id,
        amount: input.amount,
        currency: wallet.currency,
        requestedById: actor.id,
      })
      await txRepo.createLedgerEntry({
        walletId: wallet.id,
        shopId: shop.id,
        payoutId: payout.id,
        type: 'payout_reserved',
        amount: -input.amount,
        currency: wallet.currency,
        description: 'Payout balance reserved',
      })
      const response = this.toResponse(payout)
      await this.publishBestEffort('payout.requested', response.id, actor.id, {
        payoutId: response.id,
        shopId: response.shop.id,
        amount: response.amount,
      })
      return response
    })
  }

  async listSellerPayouts(actor: PayoutActor): Promise<PayoutResponse[]> {
    const shopIds = this.activeShopResolver
      ? (await this.activeShopResolver.resolveActiveShops(actor.id)).map((shop) => shop.id)
      : (await this.repo.findSellerShops(actor.id)).map((shop) => shop.id)
    if (shopIds.length === 0) throw new WalletServiceError('Active seller shop not found', 403, 'PAYOUT_FORBIDDEN')
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

  async approveAdminPayout(
    actor: PayoutActor,
    payoutId: string,
  ): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    this.logger.info('PayoutService.approveAdminPayout', {
      actorId: actor.id,
      payoutId,
    })
    const result = await this.repo.transaction(async (txRepo) => {
      await this.authorizeTransaction(txRepo, actor, 'payouts.approve')
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'requested') {
        throw new WalletServiceError(
          'Only requested payouts can be approved',
          409,
          'INVALID_PAYOUT_STATE',
        )
      }
      await this.assertReservedPayoutFunded(txRepo, payout)
      await txRepo.auditOperation?.(actor.id, payout.id, 'approved', {
        beforeStatus: payout.status,
      })
      return {
        beforeStatus: payout.status,
        response: this.toResponse(
          await txRepo.updatePayout(payout.id, {
            status: 'approved',
            approvedById: actor.id,
            approvedAt: new Date(),
          }),
        ),
      }
    })
    await this.auditPayoutStatus(
      actor,
      payoutId,
      result.beforeStatus,
      result.response.status,
    )
    return result.response
  }

  async rejectAdminPayout(
    actor: PayoutActor,
    payoutId: string,
    input: RejectPayoutInput = {},
  ): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    const result = await this.repo.transaction(async (txRepo) => {
      await this.authorizeTransaction(txRepo, actor, 'payouts.approve')
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'requested' && payout.status !== 'approved') {
        throw new WalletServiceError(
          'Only requested or approved payouts can be rejected',
          409,
          'INVALID_PAYOUT_STATE',
        )
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
        amount: moneyInteger(payout.amount),
        currency: payout.currency,
        description: 'Payout reserve released after rejection',
      })
      await txRepo.auditOperation?.(actor.id, payout.id, 'rejected', {
        beforeStatus: payout.status,
        reason: input.reason?.trim() ?? '',
      })
      return {
        response: this.toResponse(updated),
        requestedById: payout.requestedById,
        beforeStatus: payout.status,
      }
    })
    await this.publishBestEffort(
      'payout.rejected',
      result.response.id,
      actor.id,
      {
        payoutId: result.response.id,
        shopId: result.response.shop.id,
        sellerUserId: result.requestedById,
        reason: result.response.rejectionReason,
      },
    )
    await this.auditPayoutStatus(
      actor,
      payoutId,
      result.beforeStatus,
      result.response.status,
    )
    return result.response
  }

  async markAdminPayoutPaid(
    actor: PayoutActor,
    payoutId: string,
    input: MarkPayoutPaidInput,
  ): Promise<PayoutResponse> {
    this.assertAdmin(actor)
    const externalReference = input.externalReference?.trim()
    if (!externalReference) {
      throw new WalletServiceError(
        'External transfer reference is required',
        400,
        'INVALID_PAYOUT_STATE',
      )
    }
    const result = await this.repo.transaction(async (txRepo) => {
      await this.authorizeTransaction(txRepo, actor, 'payouts.complete')
      const payout = await this.getPayoutForUpdate(txRepo, payoutId)
      if (payout.status !== 'approved') {
        throw new WalletServiceError(
          'Only approved payouts can be marked paid',
          409,
          'INVALID_PAYOUT_STATE',
        )
      }
      if (payout.approvedById === actor.id) {
        throw new WalletServiceError(
          'Payout must be paid by a different administrator',
          409,
          'INVALID_PAYOUT_STATE',
        )
      }
      await this.assertReservedPayoutFunded(txRepo, payout)
      let evidenceUploadId: string | undefined
      if (input.evidenceId) {
        if (!txRepo.validatePaidEvidence)
          throw new WalletServiceError(
            'Finance evidence validation is unavailable',
            409,
            'INVALID_PAYOUT_STATE',
          )
        try {
          evidenceUploadId = await txRepo.validatePaidEvidence({
            evidenceId: input.evidenceId,
            payoutId: payout.id,
            amount: moneyInteger(payout.amount),
            currency: payout.currency,
            externalReference,
            actorId: actor.id,
          })
        } catch (error) {
          throw new WalletServiceError(
            error instanceof Error ? error.message : 'Invalid payout evidence',
            409,
            'INVALID_PAYOUT_STATE',
          )
        }
      }
      const updated = await txRepo.updatePayout(payout.id, {
        evidenceUploadId,
        status: 'paid',
        paidById: actor.id,
        externalReference,
        paidAt: new Date(),
      })
      await txRepo.createLedgerEntry({
        walletId: payout.walletId,
        shopId: payout.shopId,
        payoutId: payout.id,
        type: 'payout_paid',
        amount: 0,
        currency: payout.currency,
        description: 'Payout marked paid manually',
      })
      await txRepo.auditOperation?.(actor.id, payout.id, 'paid', {
        externalReference,
        ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
      })
      const response = this.toResponse(updated)
      await this.publishBestEffort('payout.paid', response.id, actor.id, {
        payoutId: response.id,
        shopId: response.shop.id,
        sellerUserId: payout.requestedById,
        amount: response.amount,
        externalReference,
      })
      return { response, beforeStatus: payout.status }
    })
    await this.auditPayoutStatus(
      actor,
      payoutId,
      result.beforeStatus,
      result.response.status,
      {
        externalReference,
      },
    )
    return result.response
  }

  async prepareDuePayouts(now: Date, actor?: PayoutActor) {
    if (actor) this.assertAdmin(actor)
    if (
      !Number.isFinite(now.getTime()) ||
      !this.repo.findCyclePolicies ||
      !this.repo.findCyclePayout
    )
      throw new WalletServiceError(
        'Payout cycle preparation is unavailable',
        409,
        'INVALID_PAYOUT_STATE',
      )
    const results: Array<{
      shopId: string
      cycleKey: string
      payoutId: string | null
      status: string
    }> = []
    let afterShopId: string | undefined
    while (true) {
      const policies = await this.repo.findCyclePolicies(afterShopId)
      for (const policy of policies) {
        const cycleKey = payoutCycleKey(policy.payoutCadence, now)
        if (!cycleKey) continue
        const storedRequester = actor
          ? null
          : await this.repo.findCycleRequester?.(policy.updatedById)
        const requester =
          actor ??
          (storedRequester?.role === 'ADMIN' &&
          storedRequester.status === 'ACTIVE' &&
          storedRequester.emailVerified
            ? storedRequester
            : null)
        if (!requester || (!actor && !this.adminAuthorizer)) {
          results.push({
            shopId: policy.shopId,
            cycleKey,
            payoutId: null,
            status: 'REQUESTER_UNAVAILABLE',
          })
          continue
        }
        try {
          results.push(
            await this.prepareAdminCycle(requester, policy.shopId, now, !actor),
          )
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'status' in error &&
            error.status === 403
          )
            results.push({
              shopId: policy.shopId,
              cycleKey,
              payoutId: null,
              status: 'REQUESTER_FORBIDDEN',
            })
          else throw error
        }
      }
      if (policies.length < 100) break
      afterShopId = policies[policies.length - 1]?.shopId
    }
    return { preparedAt: now, results, transferPerformed: false }
  }

  async prepareAdminCycle(
    actor: PayoutActor,
    shopId: string,
    now: Date,
    scheduled = false,
  ) {
    this.assertAdmin(actor)
    if (!this.repo.findCyclePolicy || !this.repo.findCyclePayout)
      throw new WalletServiceError(
        'Payout cycle preparation is unavailable',
        409,
        'INVALID_PAYOUT_STATE',
      )
    return this.repo.transaction(async (txRepo) => {
      await this.authorizeTransaction(txRepo, actor, 'payouts.approve')
      const policy = await txRepo.findCyclePolicy?.(shopId)
      const cycleKey = policy ? payoutCycleKey(policy.payoutCadence, now) : null
      if (
        !policy ||
        policy.shop.status !== 'ACTIVE' ||
        !cycleKey ||
        (scheduled && policy.updatedById !== actor.id)
      )
        return {
          shopId,
          cycleKey: cycleKey ?? '',
          payoutId: null,
          status: 'POLICY_CHANGED',
        }
      const wallet = await txRepo.ensureWallet(shopId, 'THB')
      await txRepo.lockWallet(wallet.id)
      const existing = await txRepo.findCyclePayout?.(shopId, cycleKey)
      if (existing)
        return { shopId, cycleKey, payoutId: existing.id, status: 'EXISTING' }
      if (wallet.currency !== 'THB')
        return {
          shopId,
          cycleKey,
          payoutId: null,
          status: 'CURRENCY_MISMATCH',
        }
      const balance = await txRepo.sumLedger(wallet.id, wallet.currency)
      if (balance <= 0n || balance < policy.payoutMinimum)
        return {
          shopId,
          cycleKey,
          payoutId: null,
          status: 'BELOW_MINIMUM_OR_DEBT',
        }
      const payout = await txRepo.createPayout({
        walletId: wallet.id,
        shopId,
        amount: balance,
        currency: wallet.currency,
        requestedById: policy.shop.ownerId,
        cycleKey,
      })
      await txRepo.createLedgerEntry({
        walletId: wallet.id,
        shopId,
        payoutId: payout.id,
        type: 'payout_reserved',
        amount: -balance,
        currency: wallet.currency,
        description: `Scheduled payout reserved for ${cycleKey}`,
      })
      await txRepo.auditOperation?.(actor.id, payout.id, 'cycle-prepared', {
        cycleKey,
        amount: balance.toString(),
        policyVersion: policy.version.toString(),
      })
      return { shopId, cycleKey, payoutId: payout.id, status: 'REQUESTED' }
    })
  }

  private async authorizeTransaction(
    repo: IPayoutRepository,
    actor: PayoutActor,
    permission: AdminPermission,
  ) {
    if (!this.adminAuthorizer) return
    if (!repo.lockAdminGrants)
      throw new WalletServiceError(
        'Administrative grant locking is unavailable',
        409,
        'INVALID_PAYOUT_STATE',
      )
    await repo.lockAdminGrants()
    await this.adminAuthorizer.require(actor, permission)
  }

  private async getPayoutForUpdate(repo: IPayoutRepository, payoutId: string): Promise<PayoutRecord> {
    await repo.lockPayout(payoutId)
    const payout = await repo.findPayoutById(payoutId)
    if (!payout) throw new WalletServiceError('Payout not found', 404, 'PAYOUT_NOT_FOUND')
    return payout
  }

  private async assertReservedPayoutFunded(repo: IPayoutRepository, payout: PayoutRecord): Promise<void> {
    await repo.lockWallet(payout.walletId)
    if (payout.wallet.currency !== payout.currency) {
      throw new WalletServiceError('Payout currency must match its wallet', 409, 'WALLET_CURRENCY_MISMATCH')
    }
    const balance = await repo.sumLedger(payout.walletId, payout.currency)
    if (balance < 0n) {
      throw new WalletServiceError('Payout cannot proceed while the wallet is unfunded', 409, 'INSUFFICIENT_BALANCE', {
        availableBalanceCents: balance,
      })
    }
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
      amount: moneyInteger(payout.amount),
      currency: payout.currency,
      status: payout.status,
      approvedById: payout.approvedById,
      externalReference: payout.externalReference,
      rejectionReason: payout.rejectionReason,
      requestedAt: payout.requestedAt,
      approvedAt: payout.approvedAt,
      rejectedAt: payout.rejectedAt,
      paidAt: payout.paidAt,
    }
  }

  private async publishBestEffort(
    eventName: 'payout.requested' | 'payout.rejected' | 'payout.paid',
    payoutId: string,
    actorUserId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName,
        aggregateType: 'payout',
        aggregateId: payoutId,
        actorUserId,
        data,
      })
    } catch (error) {
      this.logger.warn('PayoutService event publish failed', {
        eventName,
        payoutId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async auditPayoutStatus(
    actor: PayoutActor,
    payoutId: string,
    beforeStatus: string,
    afterStatus: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    await this.auditLogService?.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'PAYOUT_STATUS_CHANGED',
      entityType: 'payout',
      entityId: payoutId,
      before: { status: beforeStatus },
      after: { status: afterStatus, ...details },
      nonCritical: false,
    })
  }
}
