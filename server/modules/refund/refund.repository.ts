import type { Order, Payment, PrismaClient, Refund, RefundStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { reverseBuyerCoinsForRefund } from '#server/modules/promotion/buyer-coin.transitions.ts'
import { calculateRefundDebits } from './refund-amount.service.ts'
import { RefundServiceError } from './refund.errors.ts'

export type RefundRecord = Refund & {
  order: Order
  payment: Payment
}

export interface IRefundRepository {
  listRefunds(): Promise<RefundRecord[]>
  findRefundById(refundId: string): Promise<RefundRecord | null>
  completeRefundSuccess(
    refundId: string,
    expectedStatus: RefundStatus,
    data?: Partial<Pick<Refund, 'completedById' | 'completedAt' | 'externalReference'>>,
  ): Promise<RefundRecord | null>
}

const refundInclude = {
  order: true,
  payment: true,
} as const

export class PrismaRefundRepository implements IRefundRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  listRefunds(): Promise<RefundRecord[]> {
    this.logger.debug('PrismaRefundRepository.listRefunds')
    return this.prisma.refund.findMany({
      include: refundInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  findRefundById(refundId: string): Promise<RefundRecord | null> {
    this.logger.debug('PrismaRefundRepository.findRefundById', { refundId })
    return this.prisma.refund.findUnique({
      where: { id: refundId },
      include: refundInclude,
    })
  }

  completeRefundSuccess(
    refundId: string,
    expectedStatus: RefundStatus,
    data: Partial<Pick<Refund, 'completedById' | 'completedAt' | 'externalReference'>> = {},
  ): Promise<RefundRecord | null> {
    this.logger.info('PrismaRefundRepository.completeRefundSuccess', { refundId, expectedStatus })
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true } })
      if (!reference) return null
      // Serialize all refunds for this order, including their cumulative coin reversal.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${reference.orderId}::uuid FOR UPDATE`
      const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { ...refundInclude, returnRequest: true } })
      if (!refund || refund.status !== expectedStatus) return null
      if (refund.status !== 'PROCESSING' || !data.completedById || !data.externalReference?.trim()
        || !refund.processingById || refund.processingById === data.completedById) {
        throw new RefundServiceError('Refund requires an external reference and two administrators', 409, 'INVALID_REFUND_STATE')
      }
      const invalidHistory = () => new RefundServiceError('Refund allocation history is inconsistent', 409, 'INVALID_REFUND_STATE')
      if (refund.orderId !== reference.orderId || refund.order.id !== refund.orderId
        || refund.payment.id !== refund.paymentId || refund.payment.orderId !== refund.orderId
        || refund.order.currency !== refund.payment.currency
        || BigInt(refund.order.grandTotal) !== BigInt(refund.payment.amount)
        || (refund.returnRequest && refund.returnRequest.orderId !== refund.orderId)) throw invalidHistory()
      const shops = await tx.shopOrder.findMany({
        where: { orderId: refund.orderId }, orderBy: { shopId: 'asc' },
        select: { shopId: true, grandTotal: true, currency: true },
      })
      if (shops.some((shop) => BigInt(shop.grandTotal) < 0n || shop.currency !== refund.payment.currency)
        || shops.reduce((sum, shop) => sum + BigInt(shop.grandTotal), 0n) !== BigInt(refund.order.grandTotal)) throw invalidHistory()
      const history = await tx.refund.findMany({
        where: { orderId: refund.orderId },
        select: {
          id: true, orderId: true, paymentId: true, status: true, amount: true,
          payment: { select: { id: true, orderId: true, currency: true, amount: true } },
          returnRequest: { select: { orderId: true, shopId: true } },
        },
      })
      const entries = await tx.walletLedgerEntry.findMany({
        where: { type: 'refund_adjustment', OR: [{ orderId: refund.orderId }, { refund: { orderId: refund.orderId } }] },
        select: { refundId: true, orderId: true, shopId: true, amount: true, currency: true },
      })
      const refundsById = new Map(history.map((past) => [past.id, past]))
      const shopDebits = new Map(shops.map((shop) => [shop.shopId, 0n]))
      const refundDebits = new Map<string, bigint>()
      for (const entry of entries) {
        const past = entry.refundId ? refundsById.get(entry.refundId) : undefined
        if (!past || past.status !== 'SUCCESS' || entry.orderId !== refund.orderId
          || entry.currency !== refund.payment.currency || BigInt(entry.amount) >= 0n
          || !shopDebits.has(entry.shopId)
          || (past.returnRequest && past.returnRequest.shopId !== entry.shopId)) throw invalidHistory()
        const debit = -BigInt(entry.amount)
        shopDebits.set(entry.shopId, (shopDebits.get(entry.shopId) ?? 0n) + debit)
        refundDebits.set(past.id, (refundDebits.get(past.id) ?? 0n) + debit)
      }
      const paymentRefunds = new Map<string, bigint>()
      for (const past of history) {
        if (past.status !== 'SUCCESS') continue
        if (past.orderId !== refund.orderId || past.payment.id !== past.paymentId
          || past.payment.orderId !== refund.orderId || past.payment.currency !== refund.payment.currency
          || BigInt(past.amount) < 0n || (refundDebits.get(past.id) ?? 0n) !== BigInt(past.amount)
          || (past.returnRequest && (past.returnRequest.orderId !== refund.orderId || !shopDebits.has(past.returnRequest.shopId)))) throw invalidHistory()
        const total = (paymentRefunds.get(past.paymentId) ?? 0n) + BigInt(past.amount)
        if (total > BigInt(past.payment.amount)) throw invalidHistory()
        paymentRefunds.set(past.paymentId, total)
      }
      if (BigInt(refund.amount) < 0n || (paymentRefunds.get(refund.paymentId) ?? 0n) + BigInt(refund.amount) > BigInt(refund.payment.amount)) {
        throw new RefundServiceError('Refund exceeds the remaining payment amount', 409, 'INVALID_REFUND_STATE')
      }
      const debits = calculateRefundDebits({
        amount: BigInt(refund.amount),
        scope: refund.returnRequest ? { kind: 'shop', shopId: refund.returnRequest.shopId } : { kind: 'order' },
        shops: shops.map((shop) => ({ ...shop, refundedAmount: shopDebits.get(shop.shopId) ?? 0n })),
      })
      const result = await tx.refund.updateMany({
        where: { id: refundId, status: expectedStatus, processingById: refund.processingById },
        data: { ...data, status: 'SUCCESS' },
      })
      if (result.count !== 1) return null

      for (const debit of debits) {
        if (debit.amount === 0n) continue
        const wallet = await tx.shopWallet.upsert({ where: { shopId: debit.shopId }, create: { shopId: debit.shopId, currency: refund.payment.currency }, update: {} })
        if (wallet.currency !== refund.payment.currency) throw new RefundServiceError('Refund wallet currency mismatch', 409, 'INVALID_REFUND_STATE')
        // Payouts take this same lock before reading the available ledger balance.
        await tx.$queryRaw`SELECT "id" FROM "ShopWallet" WHERE "id" = ${wallet.id}::uuid FOR UPDATE`
        await tx.walletLedgerEntry.create({ data: {
          walletId: wallet.id, shopId: debit.shopId, orderId: refund.orderId, refundId,
          type: 'refund_adjustment', amount: -debit.amount, currency: refund.payment.currency,
          description: 'Refund adjustment',
        } })
      }
      const buyerWallet = await tx.buyerCoinWallet.findUnique({ where: { userId: refund.order.userId }, select: { id: true } })
      if (buyerWallet) await tx.$queryRaw`SELECT "id" FROM "BuyerCoinWallet" WHERE "id" = ${buyerWallet.id}::uuid FOR UPDATE`
      await reverseBuyerCoinsForRefund(tx, {
        refundId,
        orderId: refund.orderId,
        refundAmount: refund.amount,
        orderGrandTotal: refund.order.grandTotal,
        userId: refund.order.userId,
      })
      return tx.refund.findUnique({ where: { id: refundId }, include: refundInclude })
    })
  }
}
