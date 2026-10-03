import type { ItemSaleSnapshot, OrderItem, Refund, RefundItemAllocation, RefundShippingCause, RefundShopAllocation, ShopOrder, ShopSaleSnapshot } from '#generated/client/client.ts'
import { RefundServiceError } from './refund.errors.ts'

export type SettlementRefundIntent = {
  items: readonly Pick<RefundItemAllocation, 'orderItemId' | 'quantity'>[]
  shipping: readonly { shopOrderId: string; cause: RefundShippingCause }[]
}
export type SettlementRefundItemPlan = Pick<RefundItemAllocation, 'orderItemId' | 'quantity' | 'cashMerchandise' | 'platformCouponReversal' | 'coinFundingReversal'>
export type SettlementRefundShopPlan = Pick<RefundShopAllocation, 'shopOrderId' | 'buyerShippingRefund' | 'platformShippingReversal' | 'commissionReversal' | 'shippingCause'>
export type SettlementRefundPlan = { items: SettlementRefundItemPlan[]; shops: SettlementRefundShopPlan[]; amount: bigint }
export type SettlementRefundState = {
  orderId: string
  currency: string
  shops: readonly (Pick<ShopOrder, 'id' | 'shopId' | 'orderId' | 'currency'> & { saleSnapshot: ShopSaleSnapshot | null })[]
  items: readonly (Pick<OrderItem, 'id' | 'orderId' | 'shopId' | 'quantity' | 'lineTotal'> & { saleSnapshot: ItemSaleSnapshot | null })[]
  history: readonly (Pick<Refund, 'id' | 'status' | 'amount'> & { itemAllocations: readonly SettlementRefundItemPlan[]; shopAllocations: readonly SettlementRefundShopPlan[] })[]
}

export function invalidSettlementRefund(message = 'Refund settlement allocation is inconsistent'): never {
  throw new RefundServiceError(message, 409, 'INVALID_REFUND_STATE')
}

const activeStatuses = new Set(['SUCCESS', 'PENDING', 'PROCESSING'])
const amount = (value: bigint) => BigInt(value)
const merchandise = (allocation: SettlementRefundItemPlan) => amount(allocation.cashMerchandise) + amount(allocation.platformCouponReversal) + amount(allocation.coinFundingReversal)

/** Old orders have no snapshots. A partly snapshotted sale cannot use either policy. */
export function validateSettlementRefundState(state: SettlementRefundState): boolean {
  const snapshotCount = state.shops.filter((shop) => shop.saleSnapshot).length + state.items.filter((item) => item.saleSnapshot).length
  if (snapshotCount === 0) return false
  if (state.shops.length === 0 || state.items.length === 0 || snapshotCount !== state.shops.length + state.items.length) invalidSettlementRefund('Sale snapshot is incomplete')
  const shops = new Map(state.shops.map((shop) => [shop.id, shop]))
  if (shops.size !== state.shops.length || new Set(state.items.map((item) => item.id)).size !== state.items.length) invalidSettlementRefund()
  for (const item of state.items) {
    const sale = item.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const shop = shops.get(sale.shopOrderId)
    const values = [sale.grossMerchandise, sale.sellerCouponDiscount, sale.platformCouponDiscount, sale.coinDiscount, sale.buyerMerchandise].map(amount)
    if (!shop || item.orderId !== state.orderId || item.shopId !== shop.shopId || sale.orderItemId !== item.id
      || !Number.isSafeInteger(sale.originalQuantity) || sale.originalQuantity <= 0 || sale.originalQuantity !== item.quantity
      || amount(sale.grossMerchandise) !== amount(item.lineTotal) || values.some((value) => value < 0n)
      || amount(sale.grossMerchandise) - amount(sale.sellerCouponDiscount) !== amount(sale.platformCouponDiscount) + amount(sale.coinDiscount) + amount(sale.buyerMerchandise)) invalidSettlementRefund()
  }
  for (const shop of state.shops) {
    const sale = shop.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const base = state.items.filter((item) => item.saleSnapshot?.shopOrderId === shop.id).reduce((sum, item) => sum + amount(item.lineTotal) - amount(item.saleSnapshot!.sellerCouponDiscount), 0n)
    if (shop.orderId !== state.orderId || shop.currency !== state.currency || sale.shopOrderId !== shop.id || sale.currency !== state.currency
      || sale.policyVersion !== 1 || !Number.isSafeInteger(sale.commissionBps) || sale.commissionBps < 0 || sale.commissionBps > 10000
      || [sale.commissionBase, sale.originalCommission, sale.originalShipping, sale.buyerShipping, sale.sellerShippingWaiver, sale.platformShippingSubsidy].some((value) => amount(value) < 0n)
      || amount(sale.commissionBase) !== base || amount(sale.originalCommission) !== base * BigInt(sale.commissionBps) / 10000n
      || amount(sale.originalShipping) !== amount(sale.buyerShipping) + amount(sale.sellerShippingWaiver) + amount(sale.platformShippingSubsidy)) invalidSettlementRefund()
  }
  for (const past of state.history) {
    if (!activeStatuses.has(past.status)) continue
    if (past.itemAllocations.length === 0 && past.shopAllocations.length === 0) {
      if (past.status === 'SUCCESS') invalidSettlementRefund('Successful refund has no settlement allocation')
      continue
    }
    if (past.itemAllocations.reduce((sum, item) => sum + amount(item.cashMerchandise), 0n)
      + past.shopAllocations.reduce((sum, shop) => sum + amount(shop.buyerShippingRefund), 0n) !== amount(past.amount)) invalidSettlementRefund()
    validatePlanRows(state, past.itemAllocations, past.shopAllocations)
  }
  validateCapacity(state, [], [])
  for (const shop of state.shops) {
    const sale = shop.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const ids = new Set(state.items.filter((item) => item.saleSnapshot?.shopOrderId === shop.id).map((item) => item.id))
    const reversed = state.history.filter((past) => past.status === 'SUCCESS').flatMap((past) => past.itemAllocations).filter((item) => ids.has(item.orderItemId)).reduce((sum, item) => sum + merchandise(item), 0n)
    const expected = amount(sale.commissionBase) === 0n ? 0n : amount(sale.originalCommission) * reversed / amount(sale.commissionBase)
    if (shopConsumed(state, shop.id, true).commission !== expected) invalidSettlementRefund('Historical original commission reversal is inconsistent')
  }
  return true
}

function validatePlanRows(state: SettlementRefundState, items: readonly SettlementRefundItemPlan[], shops: readonly SettlementRefundShopPlan[]): void {
  if (new Set(items.map((item) => item.orderItemId)).size !== items.length || new Set(shops.map((shop) => shop.shopOrderId)).size !== shops.length) invalidSettlementRefund()
  for (const allocation of items) {
    const item = state.items.find((item) => item.id === allocation.orderItemId)
    if (!item?.saleSnapshot || !Number.isSafeInteger(allocation.quantity) || allocation.quantity !== item.saleSnapshot.originalQuantity
      || [allocation.cashMerchandise, allocation.platformCouponReversal, allocation.coinFundingReversal].some((value) => amount(value) < 0n)
      || amount(allocation.cashMerchandise) !== amount(item.saleSnapshot.buyerMerchandise)
      || amount(allocation.platformCouponReversal) !== amount(item.saleSnapshot.platformCouponDiscount)
      || amount(allocation.coinFundingReversal) !== amount(item.saleSnapshot.coinDiscount)
      || !shops.some((shop) => shop.shopOrderId === item.saleSnapshot?.shopOrderId)) invalidSettlementRefund()
  }
  for (const allocation of shops) {
    if (!state.shops.some((shop) => shop.id === allocation.shopOrderId)
      || [allocation.buyerShippingRefund, allocation.platformShippingReversal, allocation.commissionReversal].some((value) => amount(value) < 0n)) invalidSettlementRefund()
    switch (allocation.shippingCause) {
      case 'NONE': case 'CHANGE_OF_MIND':
        if (amount(allocation.buyerShippingRefund) !== 0n || amount(allocation.platformShippingReversal) !== 0n) invalidSettlementRefund()
        break
      case 'SELLER_FAULT':
        if (amount(allocation.platformShippingReversal) !== 0n) invalidSettlementRefund('Incurred platform shipping subsidy cannot be reversed')
        break
      case 'PRE_SHIPMENT_CANCEL':
        if (state.items.filter((item) => item.saleSnapshot?.shopOrderId === allocation.shopOrderId).some((item) => !items.some((row) => row.orderItemId === item.id && row.quantity === item.quantity))) invalidSettlementRefund('Pre-shipment cancellation requires every shop item')
        break
      default: invalidSettlementRefund()
    }
  }
}

function itemConsumed(state: SettlementRefundState, orderItemId: string, successfulOnly = false) {
  return state.history.filter((past) => successfulOnly ? past.status === 'SUCCESS' : activeStatuses.has(past.status))
    .flatMap((past) => past.itemAllocations).filter((item) => item.orderItemId === orderItemId)
    .reduce((sum, item) => ({ quantity: sum.quantity + item.quantity, cash: sum.cash + amount(item.cashMerchandise), platform: sum.platform + amount(item.platformCouponReversal), coin: sum.coin + amount(item.coinFundingReversal) }), { quantity: 0, cash: 0n, platform: 0n, coin: 0n })
}

function shopConsumed(state: SettlementRefundState, shopOrderId: string, successfulOnly = false) {
  return state.history.filter((past) => successfulOnly ? past.status === 'SUCCESS' : activeStatuses.has(past.status))
    .flatMap((past) => past.shopAllocations).filter((shop) => shop.shopOrderId === shopOrderId)
    .reduce((sum, shop) => ({ shipping: sum.shipping + amount(shop.buyerShippingRefund), subsidy: sum.subsidy + amount(shop.platformShippingReversal), commission: sum.commission + amount(shop.commissionReversal) }), { shipping: 0n, subsidy: 0n, commission: 0n })
}

function validateCapacity(state: SettlementRefundState, items: readonly SettlementRefundItemPlan[], shops: readonly SettlementRefundShopPlan[]): void {
  for (const item of state.items) {
    const sale = item.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const prior = itemConsumed(state, item.id)
    const next = items.find((allocation) => allocation.orderItemId === item.id)
    if (prior.quantity + (next?.quantity ?? 0) > sale.originalQuantity || prior.cash + amount(next?.cashMerchandise ?? 0n) > amount(sale.buyerMerchandise)
      || prior.platform + amount(next?.platformCouponReversal ?? 0n) > amount(sale.platformCouponDiscount) || prior.coin + amount(next?.coinFundingReversal ?? 0n) > amount(sale.coinDiscount)) invalidSettlementRefund('Refund exceeds remaining item entitlement')
  }
  for (const shop of state.shops) {
    const sale = shop.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const prior = shopConsumed(state, shop.id)
    const next = shops.find((allocation) => allocation.shopOrderId === shop.id)
    if (prior.shipping + amount(next?.buyerShippingRefund ?? 0n) > amount(sale.buyerShipping)
      || prior.subsidy + amount(next?.platformShippingReversal ?? 0n) > amount(sale.platformShippingSubsidy)
      || prior.commission + amount(next?.commissionReversal ?? 0n) > amount(sale.originalCommission)) invalidSettlementRefund('Refund exceeds remaining shop entitlement')
  }
}

/** Build and reserve exact original components. History excludes the plan being replaced. */
export function createSettlementRefundPlan(state: SettlementRefundState, intent: SettlementRefundIntent): SettlementRefundPlan {
  if (!validateSettlementRefundState(state)) invalidSettlementRefund('Sale has no settlement snapshot')
  if (intent.items.length === 0 && intent.shipping.length === 0) invalidSettlementRefund('Refund requires an explicit allocation plan')
  if (new Set(intent.items.map((item) => item.orderItemId)).size !== intent.items.length || new Set(intent.shipping.map((shop) => shop.shopOrderId)).size !== intent.shipping.length) invalidSettlementRefund()
  const shops = new Map<string, SettlementRefundShopPlan>()
  const items = intent.items.map((requested): SettlementRefundItemPlan => {
    const item = state.items.find((item) => item.id === requested.orderItemId)
    const sale = item?.saleSnapshot
    if (!sale || !Number.isSafeInteger(requested.quantity) || requested.quantity !== sale.originalQuantity) invalidSettlementRefund('Only full order-item quantities can be refunded')
    const prior = itemConsumed(state, requested.orderItemId)
    if (prior.quantity !== 0) invalidSettlementRefund('Order item already has a reserved refund')
    const quantity = prior.quantity + requested.quantity
    if (quantity > sale.originalQuantity) invalidSettlementRefund('Refund exceeds remaining item quantity')
    shops.set(sale.shopOrderId, { shopOrderId: sale.shopOrderId, buyerShippingRefund: 0n, platformShippingReversal: 0n, commissionReversal: 0n, shippingCause: 'NONE' })
    return { orderItemId: requested.orderItemId, quantity: requested.quantity,
      cashMerchandise: amount(sale.buyerMerchandise) * BigInt(quantity) / BigInt(sale.originalQuantity) - prior.cash,
      platformCouponReversal: amount(sale.platformCouponDiscount) * BigInt(quantity) / BigInt(sale.originalQuantity) - prior.platform,
      coinFundingReversal: amount(sale.coinDiscount) * BigInt(quantity) / BigInt(sale.originalQuantity) - prior.coin }
  })
  for (const requested of intent.shipping) {
    const sale = state.shops.find((shop) => shop.id === requested.shopOrderId)?.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const prior = shopConsumed(state, requested.shopOrderId)
    shops.set(requested.shopOrderId, { shopOrderId: requested.shopOrderId, shippingCause: requested.cause, commissionReversal: 0n,
      buyerShippingRefund: requested.cause === 'PRE_SHIPMENT_CANCEL' || requested.cause === 'SELLER_FAULT' ? amount(sale.buyerShipping) - prior.shipping : 0n,
      platformShippingReversal: requested.cause === 'PRE_SHIPMENT_CANCEL' ? amount(sale.platformShippingSubsidy) - prior.subsidy : 0n })
  }
  const plan = { items, shops: [...shops.values()].sort((a, b) => a.shopOrderId.localeCompare(b.shopOrderId)), amount: items.reduce((sum, item) => sum + amount(item.cashMerchandise), 0n) + [...shops.values()].reduce((sum, shop) => sum + amount(shop.buyerShippingRefund), 0n) }
  validatePlanRows(state, plan.items, plan.shops)
  validateCapacity(state, plan.items, plan.shops)
  return plan
}

/** Complete a frozen plan, computing fee credits from successful actual reversals only. */
export function completeSettlementRefundPlan(state: SettlementRefundState, saved: SettlementRefundPlan): SettlementRefundPlan {
  if (!validateSettlementRefundState(state) || saved.items.length === 0 && saved.shops.length === 0) invalidSettlementRefund('Refund requires an explicit allocation plan')
  validatePlanRows(state, saved.items, saved.shops)
  validateCapacity(state, saved.items, saved.shops)
  if (saved.items.reduce((sum, item) => sum + amount(item.cashMerchandise), 0n) + saved.shops.reduce((sum, shop) => sum + amount(shop.buyerShippingRefund), 0n) !== saved.amount) invalidSettlementRefund('Refund cash does not match its allocation plan')
  return { ...saved, shops: saved.shops.map((allocation) => {
    const shop = state.shops.find((shop) => shop.id === allocation.shopOrderId)
    const sale = shop?.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const ids = new Set(state.items.filter((item) => item.saleSnapshot?.shopOrderId === allocation.shopOrderId).map((item) => item.id))
    const reversed = state.history.filter((past) => past.status === 'SUCCESS').flatMap((past) => past.itemAllocations).filter((item) => ids.has(item.orderItemId)).reduce((sum, item) => sum + merchandise(item), 0n)
      + saved.items.filter((item) => ids.has(item.orderItemId)).reduce((sum, item) => sum + merchandise(item), 0n)
    const target = amount(sale.commissionBase) === 0n ? 0n : amount(sale.originalCommission) * reversed / amount(sale.commissionBase)
    const commissionReversal = target - shopConsumed(state, allocation.shopOrderId, true).commission
    if (commissionReversal < 0n || target > amount(sale.originalCommission)) invalidSettlementRefund('Original commission reversal is inconsistent')
    return { ...allocation, commissionReversal }
  }) }
}
