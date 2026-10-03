import type { Prisma } from '#generated/client/client.ts'
import { invalidSettlementRefund } from '#server/modules/refund/settlement-refund.service.ts'
import { calculateOriginalAffiliateRefund, type AffiliateRefundInput } from './affiliate-refund.service.ts'

export async function reverseOriginalAffiliateForRefund(tx: Prisma.TransactionClient, input: AffiliateRefundInput): Promise<void> {
  const award = await tx.affiliateCommission.findUnique({ where: { orderId: input.orderId }, include: { itemBases: { include: { orderItem: true } }, refundReversals: { include: { refund: true } } } })
  if (!award) return
  if (award.itemBases.length !== await tx.orderItem.count({ where: { orderId: input.orderId } })) invalidSettlementRefund('Original affiliate item basis is incomplete')
  const data = calculateOriginalAffiliateRefund(award, input)
  await tx.affiliateRefundReversal.create({ data })
}
