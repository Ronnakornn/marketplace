import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CommissionService } from '#server/modules/commission'
import type { ActiveShopResolver } from '#server/modules/security'
import { WalletServiceError } from './wallet.errors.ts'
import type { IWalletRepository, WalletEntryRecord, WalletRecord } from './wallet.repository.ts'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export interface WalletActor {
  id: string
  role: Role
}

export interface WalletSummary {
  walletId: string
  shopId: string
  shopName: string
  currency: string
  availableBalanceCents: number
}

export interface WalletTransactionResponse {
  id: string
  type: string
  amount: bigint
  currency: string
  orderId: string | null
  payoutId: string | null
  refundId: string | null
  description: string | null
  createdAt: Date
}

export class WalletService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IWalletRepository,
    private commissionService: CommissionService,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async getSellerWallet(actor: WalletActor): Promise<WalletSummary> {
    const wallet = await this.getSellerWalletRecord(actor.id)
    return this.toSummary(wallet, await this.repo.sumLedger(wallet.id))
  }

  async listSellerTransactions(actor: WalletActor, input: { page?: number; limit?: number }): Promise<{
    items: WalletTransactionResponse[]
    pagination: { page: number; limit: number }
  }> {
    const { page, limit, offset } = this.normalizePagination(input)
    const wallet = await this.getSellerWalletRecord(actor.id)
    const entries = await this.repo.listEntries(wallet.id, limit, offset)
    return {
      items: entries.map((entry) => this.toTransaction(entry)),
      pagination: { page, limit },
    }
  }

  async createEarningsForCompletedOrder(orderId: string): Promise<void> {
    this.logger.info('WalletService.createEarningsForCompletedOrder', { orderId })
    await this.repo.transaction(async (txRepo) => {
      const order = await txRepo.findCompletedOrder(orderId)
      if (!order) return
      const itemsByShop = new Map<string, typeof order.items>()
      for (const item of order.items) {
        itemsByShop.set(item.shopId, [...(itemsByShop.get(item.shopId) ?? []), item])
      }

      for (const [shopId, items] of itemsByShop) {
        if (await txRepo.hasOrderEarnings(order.id, shopId)) continue
        const gross = items.reduce((sum: number, item) => sum + Number(item.lineTotal), 0)
        const commission = this.commissionService.calculate(gross)
        const wallet = await txRepo.ensureWallet(shopId, order.currency)
        await txRepo.createLedgerEntry({
          walletId: wallet.id,
          shopId,
          type: 'order_earning',
          amount: gross,
          currency: order.currency,
          orderId: order.id,
          description: `Order earning for ${order.orderNumber}`,
          metadata: { orderNumber: order.orderNumber },
        })
        if (commission.commissionamount > 0) {
          await txRepo.createLedgerEntry({
            walletId: wallet.id,
            shopId,
            type: 'commission_fee',
            amount: -commission.commissionamount,
            currency: order.currency,
            orderId: order.id,
            description: `Platform commission for ${order.orderNumber}`,
            metadata: { commissionBps: commission.commissionBps },
          })
        }
      }
    })
  }

  async applyRefundAdjustment(shopId: string, refundId: string, orderId: string, amount: number, currency = 'USD'): Promise<void> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new WalletServiceError('Refund adjustment amount must be positive', 400, 'INVALID_PAYOUT_STATE')
    }
    await this.repo.transaction(async (txRepo) => {
      const wallet = await txRepo.ensureWallet(shopId, currency)
      await txRepo.createLedgerEntry({
        walletId: wallet.id,
        shopId,
        type: 'refund_adjustment',
        amount: -amount,
        currency,
        orderId,
        refundId,
        description: 'Refund adjustment',
      })
    })
  }

  private async getSellerWalletRecord(ownerId: string): Promise<WalletRecord> {
    const shop = this.activeShopResolver
      ? (await this.activeShopResolver.resolveActiveShops(ownerId))[0]
      : (await this.repo.findSellerShops(ownerId))[0]
    if (!shop) throw new WalletServiceError('Wallet not found', 404, 'WALLET_NOT_FOUND')
    await this.repo.ensureWallet(shop.id, 'USD')
    const wallet = await this.repo.findWalletByShopId(shop.id)
    if (!wallet) throw new WalletServiceError('Wallet not found', 404, 'WALLET_NOT_FOUND')
    if (wallet.shop.ownerId !== ownerId) throw new WalletServiceError('Wallet forbidden', 403, 'WALLET_FORBIDDEN')
    return wallet
  }

  private normalizePagination(input: { page?: number; limit?: number }) {
    const page = input.page ?? 1
    const limit = input.limit ?? DEFAULT_LIMIT
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new WalletServiceError('Invalid wallet pagination query', 400, 'INVALID_PAYOUT_STATE')
    }
    return { page, limit, offset: (page - 1) * limit }
  }

  private toSummary(wallet: WalletRecord, balance: number): WalletSummary {
    return {
      walletId: wallet.id,
      shopId: wallet.shopId,
      shopName: wallet.shop.name,
      currency: wallet.currency,
      availableBalanceCents: balance,
    }
  }

  private toTransaction(entry: WalletEntryRecord): WalletTransactionResponse {
    return {
      id: entry.id,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      orderId: entry.orderId,
      payoutId: entry.payoutId,
      refundId: entry.refundId,
      description: entry.description,
      createdAt: entry.createdAt,
    }
  }
}
