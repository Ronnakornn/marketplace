import type { OrderItem, ReturnItem, ShopOrder } from '#generated/client/client.ts'

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
