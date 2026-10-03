import type { Prisma } from '#generated/client/client.ts'
import type { SettlementRefundItemPlan } from '#server/modules/refund/settlement-refund.service.ts'
import { invalidSettlementRefund } from '#server/modules/refund/settlement-refund.service.ts'

type OriginalAward = Prisma.AffiliateCommissionGetPayload<{ include: { itemBases: { include: { orderItem: true } }; refundReversals: { include: { refund: true } } } }>
export type AffiliateRefundInput = { orderId: string; refundId: string; currency: string; items: readonly SettlementRefundItemPlan[] }

export function calculateOriginalAffiliateRefund(award: OriginalAward, input: AffiliateRefundInput) {
  const bases = award.itemBases
  if (!bases.length || award.currency !== input.currency || award.eligiblesubtotal <= 0n || !Number.isInteger(award.commissionBps) || award.commissionBps < 0 || award.commissionBps > 10000
    || award.commission !== award.eligiblesubtotal * BigInt(award.commissionBps) / 10000n
    || bases.reduce((sum, item) => sum + item.originalEligibleNet, 0n) !== award.eligiblesubtotal
    || bases.some((item) => item.orderItem.orderId !== input.orderId || item.orderItem.currency !== input.currency || item.originalEligibleNet < 0n || !Number.isInteger(item.originalQuantity) || item.originalQuantity <= 0 || item.originalQuantity !== item.orderItem.quantity)
    || input.items.some((item) => !bases.some((basis) => basis.orderItemId === item.orderItemId))) invalidSettlementRefund('Original affiliate item basis is missing or inconsistent')
  const existing = award.refundReversals.find((row) => row.refundId === input.refundId)
  if (existing) invalidSettlementRefund('Affiliate refund effect already exists')
  const reversed = input.items.reduce((sum, row) => {
    const basis = bases.find((item) => item.orderItemId === row.orderItemId)!
    const quantity = BigInt(basis.originalQuantity)
    return sum + basis.originalEligibleNet * BigInt(row.successfulQuantityBefore + row.quantity) / quantity - basis.originalEligibleNet * BigInt(row.successfulQuantityBefore) / quantity
  }, 0n)
  const previous = award.refundReversals.reduce((sum, row) => sum + row.eligibleNetReversed, 0n)
  const previousCredit = award.refundReversals.reduce((sum, row) => sum + row.amount, 0n)
  if (award.refundReversals.some((row) => row.eligibleNetReversed < 0n || row.amount < 0n || row.refund.orderId !== input.orderId || row.refund.status !== 'SUCCESS')
    || previous + reversed > award.eligiblesubtotal || award.status !== 'VOID' && previousCredit !== award.commission * previous / award.eligiblesubtotal) invalidSettlementRefund('Affiliate refund exceeds original rights')
  const target = award.status === 'VOID' ? previousCredit : award.commission * (previous + reversed) / award.eligiblesubtotal
  const amount = target - previousCredit
  if (amount < 0n || target > award.commission) invalidSettlementRefund('Affiliate original commission reversal is inconsistent')
  return { commissionId: award.id, refundId: input.refundId, eligibleNetReversed: reversed, amount }
}
