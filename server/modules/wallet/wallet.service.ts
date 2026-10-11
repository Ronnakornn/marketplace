import { moneyNumber, moneyInteger } from '#server/lib/money.ts'
import { validateFrozenSaleEconomics } from '#server/modules/checkout/sale-economics.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CommissionService } from '#server/modules/commission'
import type { ActiveShopResolver } from '#server/modules/security'
import { WalletServiceError } from './wallet.errors.ts'
import type { CompletedOrderRecord, IWalletRepository, WalletEntryRecord, WalletRecord } from './wallet.repository.ts'

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
  availableBalanceCents: bigint
  sellerDebtCents: bigint
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

export interface SellerEarningsReconciliationResult {
  attemptedCount: number
  succeededCount: number
  failedCount: number
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
    return this.repo.transaction(async (txRepo) => {
      await txRepo.lockWallet(wallet.id)
      const balance = await txRepo.sumLedger(wallet.id, wallet.currency)
      const reserved = await txRepo.sumReservedPayouts(wallet.id, wallet.currency)
      return this.toSummary(wallet, balance, reserved)
    })
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
      await txRepo.lockOrder(orderId)
      const order = await txRepo.findCompletedOrder(orderId)
      if (!order) return
      if (order.items.some((item) => item.saleSnapshot) || order.shopOrders?.some((shop) => shop.saleSnapshot)) {
        await this.createSnapshottedEarnings(txRepo, order)
        return
      }
      const itemsByShop = new Map<string, typeof order.items>()
      for (const item of order.items) {
        itemsByShop.set(item.shopId, [...(itemsByShop.get(item.shopId) ?? []), item])
      }

      for (const [shopId, items] of itemsByShop) {
        if (await txRepo.hasOrderEarnings(order.id, shopId)) continue
        const gross = moneyNumber(items.reduce((sum, item) => sum + moneyInteger(item.lineTotal), 0n))
        const commission = this.commissionService.calculate(gross)
        const wallet = await txRepo.ensureWallet(shopId, order.currency)
        this.assertWalletCurrency(wallet.currency, order.currency)
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

  async reconcileSellerEarnings(batchSize = 100): Promise<SellerEarningsReconciliationResult> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
      throw new WalletServiceError('Invalid earnings reconciliation batch size', 400, 'INVALID_PAYOUT_STATE')
    }
    const result = { attemptedCount: 0, succeededCount: 0, failedCount: 0 }
    let afterOrderId: string | null = null
    while (true) {
      const candidates = await this.repo.findOrdersMissingEarnings(afterOrderId, batchSize)
      if (candidates.length === 0) break
      for (const candidate of candidates) {
        result.attemptedCount += 1
        try {
          await this.createEarningsForCompletedOrder(candidate.id)
          result.succeededCount += 1
        } catch (error) {
          result.failedCount += 1
          this.logger.error('WalletService seller earnings reconciliation failed', {
            orderId: candidate.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        afterOrderId = candidate.id
      }
    }
    this.logger.info('WalletService seller earnings reconciliation finished', result)
    return result
  }

  private async createSnapshottedEarnings(repo: IWalletRepository, order: CompletedOrderRecord): Promise<void> {
    const invalid = () => new WalletServiceError('Settlement snapshot or refund allocation is inconsistent', 409, 'INVALID_PAYOUT_STATE')
    const shops = order.shopOrders
    if (!shops?.length || order.items.some((item) => !item.saleSnapshot) || shops.some((shop) => !shop.saleSnapshot)) throw invalid()
    const plans = shops.map((shop) => {
      const sale = shop.saleSnapshot
      if (!sale || ![1, 2].includes(sale.policyVersion) || sale.currency !== order.currency || shop.currency !== order.currency
        || sale.shopOrderId !== shop.id || shop.orderId !== order.id || !Number.isInteger(sale.commissionBps)
        || sale.commissionBps < 0 || sale.commissionBps > 10000) throw invalid()
      const items = order.items.filter((item) => item.shopId === shop.shopId)
      if (!items.length) throw invalid()
      if (sale.policyVersion === 2) return this.versionTwoRecognitionPlan(order, shop, items)
      let merchandise = 0n
      let grossTotal = 0n
      let cash = 0n
      let reversed = 0n
      for (const item of items) {
        const snapshot = item.saleSnapshot
        if (!snapshot || snapshot.shopOrderId !== shop.id || snapshot.orderItemId !== item.id
          || snapshot.originalQuantity !== item.quantity || snapshot.originalQuantity <= 0
          || item.orderId !== order.id || item.currency !== order.currency
          || BigInt(snapshot.grossMerchandise) !== BigInt(item.lineTotal)) throw invalid()
        const gross = BigInt(snapshot.grossMerchandise)
        const seller = BigInt(snapshot.sellerCouponDiscount)
        const platform = BigInt(snapshot.platformCouponDiscount)
        const coins = BigInt(snapshot.coinDiscount)
        const buyer = BigInt(snapshot.buyerMerchandise)
        if ([gross, seller, platform, coins, buyer].some((amount) => amount < 0n) || buyer + seller + platform + coins !== gross) throw invalid()
        const allocations = snapshot.refundAllocations.filter((allocation) => allocation.refund.status === 'SUCCESS')
        const totals = allocations.reduce((sum, allocation) => {
          if (!Number.isInteger(allocation.quantity) || allocation.quantity < 0
            || [allocation.cashMerchandise, allocation.platformCouponReversal, allocation.coinFundingReversal].some((amount) => BigInt(amount) < 0n)) throw invalid()
          return { quantity: sum.quantity + allocation.quantity, cash: sum.cash + BigInt(allocation.cashMerchandise),
            platform: sum.platform + BigInt(allocation.platformCouponReversal), coins: sum.coins + BigInt(allocation.coinFundingReversal) }
        }, { quantity: 0, cash: 0n, platform: 0n, coins: 0n })
        const quantity = BigInt(totals.quantity)
        const originalQuantity = BigInt(snapshot.originalQuantity)
        if (totals.quantity > snapshot.originalQuantity || totals.cash !== buyer * quantity / originalQuantity
          || totals.platform !== platform * quantity / originalQuantity || totals.coins !== coins * quantity / originalQuantity) throw invalid()
        merchandise += gross - seller
        grossTotal += gross
        cash += buyer
        reversed += totals.cash + totals.platform + totals.coins
      }
      const shipping = BigInt(sale.buyerShipping) + BigInt(sale.platformShippingSubsidy)
      const originalFee = BigInt(sale.originalCommission)
      if ([sale.originalShipping, sale.buyerShipping, sale.sellerShippingWaiver, sale.platformShippingSubsidy].some((amount) => BigInt(amount) < 0n)
        || BigInt(sale.originalShipping) !== shipping + BigInt(sale.sellerShippingWaiver)
        || merchandise !== BigInt(sale.commissionBase) || originalFee !== merchandise * BigInt(sale.commissionBps) / 10000n
        || grossTotal !== BigInt(shop.subtotal) || grossTotal - cash !== BigInt(shop.discountTotal)
        || BigInt(shop.shippingTotal) !== BigInt(sale.buyerShipping) || BigInt(shop.taxTotal) !== 0n
        || cash + BigInt(sale.buyerShipping) !== BigInt(shop.grandTotal)) throw invalid()
      const allocations = sale.refundAllocations.filter((allocation) => allocation.refund.status === 'SUCCESS')
      if (items.some((item) => item.saleSnapshot?.refundAllocations.some((allocation) => allocation.refund.status === 'SUCCESS'
        && !allocations.some((shopAllocation) => shopAllocation.refundId === allocation.refundId)))) throw invalid()
      let reversedBuyerShipping = 0n
      let reversedPlatformShipping = 0n
      let reversedFee = 0n
      for (const allocation of allocations) {
        if ([allocation.buyerShippingRefund, allocation.platformShippingReversal, allocation.commissionReversal].some((amount) => BigInt(amount) < 0n)
          || (!sale.recognizedAt && allocation.walletPostedAt)) throw invalid()
        reversedBuyerShipping += BigInt(allocation.buyerShippingRefund)
        reversedPlatformShipping += BigInt(allocation.platformShippingReversal)
        reversedFee += BigInt(allocation.commissionReversal)
      }
      if (reversedBuyerShipping > BigInt(sale.buyerShipping) || reversedPlatformShipping > BigInt(sale.platformShippingSubsidy)
        || reversedFee !== (merchandise === 0n ? 0n : originalFee * reversed / merchandise)) throw invalid()
      const earning = moneyNumber(merchandise + shipping - reversed - reversedBuyerShipping - reversedPlatformShipping)
      const fee = moneyNumber(originalFee - reversedFee)
      if (!Number.isSafeInteger(earning) || earning < 0 || !Number.isSafeInteger(fee) || fee < 0) throw invalid()
      return { shop, sale, earning, fee }
    })
    if (order.items.some((item) => !shops.some((shop) => shop.shopId === item.shopId))) throw invalid()
    if (shops.reduce((sum, shop) => sum + BigInt(shop.grandTotal), 0n) !== BigInt(order.grandTotal)
      || shops.reduce((sum, shop) => sum + BigInt(shop.subtotal), 0n) !== BigInt(order.subtotal)
      || shops.reduce((sum, shop) => sum + BigInt(shop.discountTotal), 0n) !== BigInt(order.discountTotal)
      || shops.reduce((sum, shop) => sum + BigInt(shop.shippingTotal), 0n) !== BigInt(order.shippingTotal)
      || shops.reduce((sum, shop) => sum + BigInt(shop.taxTotal), 0n) !== BigInt(order.taxTotal)) throw invalid()
    if (shops.some((shop) => shop.saleSnapshot?.policyVersion === 2)) {
      const first = shops[0]!.saleSnapshot!
      if (shops.some((shop) => shop.saleSnapshot?.policyVersion !== 2 || shop.saleSnapshot.taxPolicyRevision !== first.taxPolicyRevision
        || shop.saleSnapshot.taxRatePpm !== first.taxRatePpm || shop.saleSnapshot.taxMode !== first.taxMode
        || shop.saleSnapshot.taxFundingBasis !== first.taxFundingBasis || shop.saleSnapshot.taxableShipping !== first.taxableShipping)
        || shops.reduce((sum, shop) => sum + shop.includedTaxTotal, 0n) !== order.includedTaxTotal
        || shops.reduce((sum, shop) => sum + shop.reportedTaxTotal, 0n) !== order.reportedTaxTotal) throw invalid()
    }
    for (const { shop, sale, earning, fee } of plans.sort((a, b) => a.shop.shopId.localeCompare(b.shop.shopId))) {
      if (sale.recognizedAt) continue
      if (await repo.hasOrderEarnings(order.id, shop.shopId)) throw invalid()
      const wallet = await repo.ensureWallet(shop.shopId, order.currency)
      this.assertWalletCurrency(wallet.currency, order.currency)
      await repo.lockWallet(wallet.id)
      await repo.createLedgerEntry({ walletId: wallet.id, shopId: shop.shopId, type: 'order_earning', amount: earning,
        currency: order.currency, orderId: order.id, description: `Order earning for ${order.orderNumber}`, metadata: { settlementPolicyVersion: sale.policyVersion } })
      if (fee > 0) await repo.createLedgerEntry({ walletId: wallet.id, shopId: shop.shopId, type: 'commission_fee', amount: -fee,
        currency: order.currency, orderId: order.id, description: `Platform commission for ${order.orderNumber}`, metadata: { commissionBps: sale.commissionBps } })
      await repo.recognizeShopSale(shop.id, new Date())
    }
  }

  private versionTwoRecognitionPlan(order: CompletedOrderRecord, shop: NonNullable<CompletedOrderRecord['shopOrders']>[number], items: CompletedOrderRecord['items']) {
    const invalid = () => new WalletServiceError('Settlement snapshot or refund allocation is inconsistent', 409, 'INVALID_PAYOUT_STATE')
    const sale = shop.saleSnapshot
    if (!sale) throw invalid()
    const snapshots = items.map((item) => {
      const snapshot = item.saleSnapshot
      if (!snapshot || snapshot.shopOrderId !== shop.id || snapshot.orderItemId !== item.id || snapshot.originalQuantity !== item.quantity
        || item.orderId !== order.id || item.currency !== order.currency || snapshot.grossMerchandise !== item.lineTotal
        || item.unitPrice < 0n || item.lineTotal !== item.unitPrice * BigInt(item.quantity)) throw invalid()
      return snapshot
    })
    let original: ReturnType<typeof validateFrozenSaleEconomics>
    try { original = validateFrozenSaleEconomics(sale, snapshots, shop) } catch { throw invalid() }
    let reversedGross = 0n
    let reversedNet = 0n
    for (const snapshot of snapshots) {
      const line = original.items.find((line) => line.cartItemId === snapshot.orderItemId)
      if (!line) throw invalid()
      const pools = [line.buyer.net, line.buyer.tax, line.platformCoupon.net, line.platformCoupon.tax, line.coins.net, line.coins.tax]
      const completed = snapshot.refundAllocations.filter((allocation) => allocation.refund.status === 'SUCCESS')
        .sort((a, b) => a.successfulQuantityBefore - b.successfulQuantityBefore)
      let quantity = 0
      for (const allocation of completed) {
        if (!Number.isInteger(allocation.quantity) || allocation.quantity <= 0 || allocation.successfulQuantityBefore !== quantity
          || quantity + allocation.quantity > snapshot.originalQuantity) throw invalid()
        const amounts = [allocation.cashMerchandise, allocation.buyerTaxRefund, allocation.platformCouponReversal, allocation.platformCouponTaxReversal, allocation.coinFundingReversal, allocation.coinTaxReversal]
        for (let index = 0; index < pools.length; index++) {
          const expected = pools[index]! * BigInt(quantity + allocation.quantity) / BigInt(snapshot.originalQuantity) - pools[index]! * BigInt(quantity) / BigInt(snapshot.originalQuantity)
          if (amounts[index] !== expected) throw invalid()
        }
        reversedGross += amounts.reduce((sum, amount) => sum + amount, 0n)
        reversedNet += allocation.cashMerchandise + allocation.platformCouponReversal + allocation.coinFundingReversal
        quantity += allocation.quantity
      }
    }
    const allocations = sale.refundAllocations.filter((allocation) => allocation.refund.status === 'SUCCESS')
    if (snapshots.some((snapshot) => snapshot.refundAllocations.some((allocation) => allocation.refund.status === 'SUCCESS' && !allocations.some((shopAllocation) => shopAllocation.refundId === allocation.refundId)))) throw invalid()
    const shipping = allocations.reduce((sum, allocation) => {
      if ([allocation.buyerShippingRefund, allocation.buyerShippingTaxRefund, allocation.platformShippingReversal, allocation.platformShippingTaxReversal, allocation.commissionReversal].some((amount) => amount < 0n)
        || (!sale.recognizedAt && allocation.walletPostedAt)) throw invalid()
      return { buyerNet: sum.buyerNet + allocation.buyerShippingRefund, buyerTax: sum.buyerTax + allocation.buyerShippingTaxRefund,
        platformNet: sum.platformNet + allocation.platformShippingReversal, platformTax: sum.platformTax + allocation.platformShippingTaxReversal,
        fee: sum.fee + allocation.commissionReversal }
    }, { buyerNet: 0n, buyerTax: 0n, platformNet: 0n, platformTax: 0n, fee: 0n })
    if (shipping.buyerNet > original.buyerShipping.net || shipping.buyerTax > original.buyerShipping.tax
      || shipping.platformNet > original.platformShipping.net || shipping.platformTax > original.platformShipping.tax
      || shipping.fee !== (original.commissionBase === 0n ? 0n : sale.originalCommission * reversedNet / original.commissionBase)) throw invalid()
    const earning = moneyNumber(original.sellerGrossMerchandise + original.sellerGrossShipping - reversedGross - shipping.buyerNet - shipping.buyerTax - shipping.platformNet - shipping.platformTax)
    const fee = moneyNumber(sale.originalCommission - shipping.fee)
    if (earning < 0 || fee < 0) throw invalid()
    return { shop, sale, earning, fee }
  }

  async applyRefundAdjustment(shopId: string, refundId: string, orderId: string, amount: number, currency = 'THB'): Promise<void> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new WalletServiceError('Refund adjustment amount must be positive', 400, 'INVALID_PAYOUT_STATE')
    }
    await this.repo.transaction(async (txRepo) => {
      const wallet = await txRepo.ensureWallet(shopId, currency)
      this.assertWalletCurrency(wallet.currency, currency)
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
    await this.repo.ensureWallet(shop.id, 'THB')
    const wallet = await this.repo.findWalletByShopId(shop.id)
    if (!wallet) throw new WalletServiceError('Wallet not found', 404, 'WALLET_NOT_FOUND')
    if (wallet.shop.ownerId !== ownerId) throw new WalletServiceError('Wallet forbidden', 403, 'WALLET_FORBIDDEN')
    this.assertWalletCurrency(wallet.currency, 'THB')
    return wallet
  }

  private assertWalletCurrency(walletCurrency: string, expectedCurrency: string): void {
    if (walletCurrency !== expectedCurrency) {
      throw new WalletServiceError('Wallet currency does not match transaction currency', 409, 'WALLET_CURRENCY_MISMATCH')
    }
  }

  private normalizePagination(input: { page?: number; limit?: number }) {
    const page = input.page ?? 1
    const limit = input.limit ?? DEFAULT_LIMIT
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new WalletServiceError('Invalid wallet pagination query', 400, 'INVALID_PAYOUT_STATE')
    }
    return { page, limit, offset: (page - 1) * limit }
  }

  private toSummary(wallet: WalletRecord, balance: bigint, reserved: bigint): WalletSummary {
    return {
      walletId: wallet.id,
      shopId: wallet.shopId,
      shopName: wallet.shop.name,
      currency: wallet.currency,
      availableBalanceCents: balance,
      sellerDebtCents: balance + reserved < 0n ? -(balance + reserved) : 0n,
    }
  }

  private toTransaction(entry: WalletEntryRecord): WalletTransactionResponse {
    return {
      id: entry.id,
      type: entry.type,
      amount: moneyInteger(entry.amount),
      currency: entry.currency,
      orderId: entry.orderId,
      payoutId: entry.payoutId,
      refundId: entry.refundId,
      description: entry.description,
      createdAt: entry.createdAt,
    }
  }
}
