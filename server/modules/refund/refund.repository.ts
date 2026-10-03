import type { Order, Payment, PrismaClient, Refund, RefundStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { reverseBuyerCoinsForRefund } from '#server/modules/promotion/buyer-coin.transitions.ts'
import { allocateRefundAmount } from './refund-amount.service.ts'
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
      const successful = await tx.refund.aggregate({ where: { paymentId: refund.paymentId, status: 'SUCCESS' }, _sum: { amount: true } })
      if (BigInt(refund.amount) < 0n || BigInt(successful._sum.amount ?? 0) + BigInt(refund.amount) > BigInt(refund.payment.amount)) {
        throw new RefundServiceError('Refund exceeds the remaining payment amount', 409, 'INVALID_REFUND_STATE')
      }
      const result = await tx.refund.updateMany({
        where: { id: refundId, status: expectedStatus, processingById: refund.processingById },
        data: { ...data, status: 'SUCCESS' },
      })
      if (result.count !== 1) return null

      const shops = await tx.shopOrder.findMany({ where: { orderId: refund.orderId }, orderBy: { shopId: 'asc' }, select: { shopId: true, grandTotal: true } })
      const debits = refund.returnRequest
        ? [{ shopId: refund.returnRequest.shopId, amount: BigInt(refund.amount) }]
        : allocateRefundAmount(BigInt(refund.amount), shops.map((shop) => BigInt(shop.grandTotal)))
          .map((amount, index) => ({ shopId: shops[index]!.shopId, amount }))
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
