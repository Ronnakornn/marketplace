import type { OrderItem, ReturnItem, ShopOrder } from '#generated/client/client.ts'
import { RefundServiceError } from './refund.errors.ts'

export type RefundAllocationScope = { kind: 'order' } | { kind: 'shop'; shopId: string }
export type ShopRefundPosition = Pick<ShopOrder, 'shopId' | 'grandTotal'> & { refundedAmount: bigint }

/** Allocate only new debits, conserving the refund and respecting each shop's remaining cap. */
export function calculateRefundDebits(input: {
  amount: bigint
  scope: RefundAllocationScope
  shops: readonly ShopRefundPosition[]
}): Array<{ shopId: string; amount: bigint }> {
  const shops = [...input.shops].sort((a, b) => a.shopId.localeCompare(b.shopId))
  const invalid = () => new RefundServiceError('Refund exceeds the remaining shop allocation', 409, 'INVALID_REFUND_STATE')
  if (input.amount < 0n || new Set(shops.map((shop) => shop.shopId)).size !== shops.length
    || shops.some((shop) => shop.refundedAmount < 0n || shop.refundedAmount > BigInt(shop.grandTotal))) {
    throw invalid()
  }
  if (input.scope.kind === 'shop') {
    const targetShopId = input.scope.shopId
    const shop = shops.find((shop) => shop.shopId === targetShopId)
    if (!shop || input.amount > BigInt(shop.grandTotal) - shop.refundedAmount) throw invalid()
    return shops.map((shop) => ({ shopId: shop.shopId, amount: shop.shopId === targetShopId ? input.amount : 0n }))
  }
  const refunded = shops.reduce((sum, shop) => sum + shop.refundedAmount, 0n)
  const total = shops.reduce((sum, shop) => sum + BigInt(shop.grandTotal), 0n)
  if (refunded + input.amount > total) throw invalid()
  const targets = allocateRefundAmount(refunded + input.amount, shops.map((shop) => BigInt(shop.grandTotal)))
  const deficits = shops.map((shop, index) => {
    const difference = targets[index] - shop.refundedAmount
    return difference > 0n ? difference : 0n
  })
  const amounts = allocateRefundAmount(input.amount, deficits)
  return shops.map((shop, index) => ({ shopId: shop.shopId, amount: amounts[index] }))
}

/** Allocate every minor unit once. Callers supply a stable ordering of weights. */
export function allocateRefundAmount(amount: bigint, weights: readonly bigint[]): bigint[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0n)
  if (amount < 0n || weights.some((weight) => weight < 0n) || amount > total) {
    throw new Error('Refund exceeds the refundable amount')
  }
  let cumulative = 0n
  let allocated = 0n
  return weights.map((weight) => {
    cumulative += weight
    const target = total === 0n ? 0n : amount * cumulative / total
    const share = target - allocated
    allocated = target
    return share
  })
}

export function calculateReturnRefund(
  shopOrder: Pick<ShopOrder, 'subtotal' | 'discountTotal'>,
  orderItems: ReadonlyArray<Pick<OrderItem, 'id' | 'lineTotal' | 'quantity'>>,
  returnItems: ReadonlyArray<Pick<ReturnItem, 'orderItemId' | 'quantity'>>,
): bigint {
  const items = [...orderItems].sort((a, b) => a.id.localeCompare(b.id))
  const shares = allocateRefundAmount(
    BigInt(shopOrder.subtotal) - BigInt(shopOrder.discountTotal),
    items.map((item) => BigInt(item.lineTotal)),
  )
  return returnItems.reduce((total, returned) => {
    const index = items.findIndex((item) => item.id === returned.orderItemId)
    const item = items[index]
    if (!item || returned.quantity <= 0 || returned.quantity > item.quantity) {
      throw new Error('Invalid return item quantity')
    }
    return total + shares[index]! * BigInt(returned.quantity) / BigInt(item.quantity)
  }, 0n)
}
