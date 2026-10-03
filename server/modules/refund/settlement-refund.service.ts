import type { ItemSaleSnapshot, OrderItem, Refund, RefundItemAllocation, RefundShippingCause, RefundShopAllocation, ShopOrder, ShopSaleSnapshot } from '#generated/client/client.ts'
import { RefundServiceError } from './refund.errors.ts'
import { validateFrozenSaleEconomics } from '#server/modules/checkout/sale-economics.ts'

export type SettlementRefundIntent = {
  items: readonly Pick<RefundItemAllocation, 'orderItemId' | 'quantity'>[]
  shipping: readonly { shopOrderId: string; cause: RefundShippingCause }[]
}
export type SettlementRefundItemPlan = Pick<RefundItemAllocation, 'orderItemId' | 'quantity' | 'successfulQuantityBefore' | 'cashMerchandise' | 'buyerTaxRefund' | 'platformCouponReversal' | 'platformCouponTaxReversal' | 'coinFundingReversal' | 'coinTaxReversal'>
export type SettlementRefundShopPlan = Pick<RefundShopAllocation, 'shopOrderId' | 'buyerShippingRefund' | 'buyerShippingTaxRefund' | 'platformShippingReversal' | 'platformShippingTaxReversal' | 'commissionReversal' | 'shippingCause'>
export type SettlementRefundPlan = { items: SettlementRefundItemPlan[]; shops: SettlementRefundShopPlan[]; amount: bigint }
export type SettlementRefundState = {
  orderId: string
  currency: string
  shops: readonly (Pick<ShopOrder, 'id' | 'shopId' | 'orderId' | 'currency' | 'subtotal' | 'discountTotal' | 'shippingTotal' | 'taxTotal' | 'includedTaxTotal' | 'reportedTaxTotal' | 'grandTotal'> & { saleSnapshot: ShopSaleSnapshot | null })[]
  items: readonly (Pick<OrderItem, 'id' | 'orderId' | 'shopId' | 'quantity' | 'lineTotal'> & { saleSnapshot: ItemSaleSnapshot | null })[]
  history: readonly (Pick<Refund, 'id' | 'status' | 'amount'> & { itemAllocations: readonly SettlementRefundItemPlan[]; shopAllocations: readonly SettlementRefundShopPlan[] })[]
}

export function invalidSettlementRefund(message = 'Refund settlement allocation is inconsistent'): never {
  throw new RefundServiceError(message, 409, 'INVALID_REFUND_STATE')
}

const activeStatuses = new Set(['SUCCESS', 'PENDING', 'PROCESSING'])
const amount = (value: bigint) => BigInt(value)
const merchandise = (allocation: SettlementRefundItemPlan) => amount(allocation.cashMerchandise) + amount(allocation.platformCouponReversal) + amount(allocation.coinFundingReversal)
export const settlementItemGross = (row: SettlementRefundItemPlan) => merchandise(row) + row.buyerTaxRefund + row.platformCouponTaxReversal + row.coinTaxReversal
export const settlementShippingGross = (row: SettlementRefundShopPlan) => row.buyerShippingRefund + row.buyerShippingTaxRefund + row.platformShippingReversal + row.platformShippingTaxReversal
const itemPoolKeys = ['cashMerchandise', 'buyerTaxRefund', 'platformCouponReversal', 'platformCouponTaxReversal', 'coinFundingReversal', 'coinTaxReversal'] as const
const shippingPoolKeys = ['buyerShippingRefund', 'buyerShippingTaxRefund', 'platformShippingReversal', 'platformShippingTaxReversal'] as const
type ItemPools = Pick<SettlementRefundItemPlan, typeof itemPoolKeys[number]>
type ShippingPools = Pick<SettlementRefundShopPlan, typeof shippingPoolKeys[number]>
const buyerCash = (items: readonly SettlementRefundItemPlan[], shops: readonly SettlementRefundShopPlan[]) => items.reduce((sum, item) => sum + item.cashMerchandise + item.buyerTaxRefund, 0n) + shops.reduce((sum, shop) => sum + shop.buyerShippingRefund + shop.buyerShippingTaxRefund, 0n)

function originalItemPools(state: SettlementRefundState, sale: ItemSaleSnapshot): ItemPools {
  const version = state.shops.find((shop) => shop.id === sale.shopOrderId)?.saleSnapshot?.policyVersion
  if (version === 1) return { cashMerchandise: sale.buyerMerchandise, buyerTaxRefund: 0n, platformCouponReversal: sale.platformCouponDiscount, platformCouponTaxReversal: 0n, coinFundingReversal: sale.coinDiscount, coinTaxReversal: 0n }
  if (version !== 2 || sale.buyerMerchandiseNet === null || sale.buyerMerchandiseTax === null || sale.platformCouponNet === null || sale.platformCouponTax === null || sale.coinFundingNet === null || sale.coinFundingTax === null) invalidSettlementRefund('Sale tax snapshot is incomplete')
  return { cashMerchandise: sale.buyerMerchandiseNet, buyerTaxRefund: sale.buyerMerchandiseTax, platformCouponReversal: sale.platformCouponNet, platformCouponTaxReversal: sale.platformCouponTax, coinFundingReversal: sale.coinFundingNet, coinTaxReversal: sale.coinFundingTax }
}

function originalShippingPools(sale: ShopSaleSnapshot): ShippingPools {
  if (sale.policyVersion === 1) return { buyerShippingRefund: sale.buyerShipping, buyerShippingTaxRefund: 0n, platformShippingReversal: sale.platformShippingSubsidy, platformShippingTaxReversal: 0n }
  if (sale.policyVersion !== 2 || sale.buyerShippingNet === null || sale.buyerShippingTax === null || sale.platformShippingNet === null || sale.platformShippingTax === null) invalidSettlementRefund('Sale tax snapshot is incomplete')
  return { buyerShippingRefund: sale.buyerShippingNet, buyerShippingTaxRefund: sale.buyerShippingTax, platformShippingReversal: sale.platformShippingNet, platformShippingTaxReversal: sale.platformShippingTax }
}

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
      || shop.saleSnapshot?.policyVersion === 1 && amount(sale.grossMerchandise) - amount(sale.sellerCouponDiscount) !== amount(sale.platformCouponDiscount) + amount(sale.coinDiscount) + amount(sale.buyerMerchandise)) invalidSettlementRefund()
  }
  for (const shop of state.shops) {
    const sale = shop.saleSnapshot
    if (!sale) invalidSettlementRefund()
    if (sale.policyVersion === 2) {
      if (shop.orderId !== state.orderId || shop.currency !== state.currency || sale.shopOrderId !== shop.id || sale.currency !== state.currency) invalidSettlementRefund()
      const items = state.items.filter((item) => item.saleSnapshot?.shopOrderId === shop.id).map((item) => item.saleSnapshot!)
      try { validateFrozenSaleEconomics(sale, items, shop) } catch { invalidSettlementRefund('Sale tax snapshot is inconsistent') }
      continue
    }
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
    if (buyerCash(past.itemAllocations, past.shopAllocations) !== amount(past.amount)) invalidSettlementRefund()
    validatePlanRows(state, past.itemAllocations, past.shopAllocations)
  }
  for (const item of state.items) {
    let quantity = 0
    const successful = state.history.filter((past) => past.status === 'SUCCESS').flatMap((past) => past.itemAllocations).filter((row) => row.orderItemId === item.id).sort((a, b) => a.successfulQuantityBefore - b.successfulQuantityBefore)
    for (const row of successful) {
      if (row.successfulQuantityBefore !== quantity) invalidSettlementRefund('Successful quantity intervals are inconsistent')
      quantity += row.quantity
    }
    const held = state.history.filter((past) => past.status === 'PENDING' || past.status === 'PROCESSING').flatMap((past) => past.itemAllocations).filter((row) => row.orderItemId === item.id)
    if (held.length > 1 || held.some((row) => row.successfulQuantityBefore !== quantity)) invalidSettlementRefund('Order item already has a reserved refund')
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
    if (!item?.saleSnapshot || !Number.isSafeInteger(allocation.quantity) || allocation.quantity <= 0
      || !Number.isSafeInteger(allocation.successfulQuantityBefore) || allocation.successfulQuantityBefore < 0
      || allocation.successfulQuantityBefore + allocation.quantity > item.saleSnapshot.originalQuantity
      || !shops.some((shop) => shop.shopOrderId === item.saleSnapshot?.shopOrderId)) invalidSettlementRefund()
    const pools = originalItemPools(state, item.saleSnapshot)
    for (const key of itemPoolKeys) {
      if (allocation[key] < 0n || allocation[key] !== quantityInterval(pools[key], allocation.successfulQuantityBefore, allocation.quantity, item.saleSnapshot.originalQuantity)) invalidSettlementRefund()
    }
  }
  for (const allocation of shops) {
    if (!state.shops.some((shop) => shop.id === allocation.shopOrderId)
      || [allocation.commissionReversal, ...shippingPoolKeys.map((key) => allocation[key])].some((value) => amount(value) < 0n)) invalidSettlementRefund()
    switch (allocation.shippingCause) {
      case 'NONE': case 'CHANGE_OF_MIND':
        if (settlementShippingGross(allocation) !== 0n) invalidSettlementRefund()
        break
      case 'SELLER_FAULT':
        if (amount(allocation.platformShippingReversal) !== 0n || allocation.platformShippingTaxReversal !== 0n) invalidSettlementRefund('Incurred platform shipping subsidy cannot be reversed')
        break
      case 'PRE_SHIPMENT_CANCEL':
        if (state.items.filter((item) => item.saleSnapshot?.shopOrderId === allocation.shopOrderId).some((item) => !items.some((row) => row.orderItemId === item.id && row.quantity === item.quantity && row.successfulQuantityBefore === 0))) invalidSettlementRefund('Pre-shipment cancellation requires every shop item')
        break
      default: invalidSettlementRefund()
    }
  }
}

function quantityInterval(original: bigint, successfulQuantityBefore: number, quantity: number, originalQuantity: number): bigint {
  return original * BigInt(successfulQuantityBefore + quantity) / BigInt(originalQuantity) - original * BigInt(successfulQuantityBefore) / BigInt(originalQuantity)
}

function itemConsumed(state: SettlementRefundState, orderItemId: string, successfulOnly = false) {
  return state.history.filter((past) => successfulOnly ? past.status === 'SUCCESS' : activeStatuses.has(past.status))
    .flatMap((past) => past.itemAllocations).filter((item) => item.orderItemId === orderItemId)
    .reduce((sum, item) => ({ quantity: sum.quantity + item.quantity, cash: sum.cash + amount(item.cashMerchandise), buyerTax: sum.buyerTax + item.buyerTaxRefund, platform: sum.platform + amount(item.platformCouponReversal), platformTax: sum.platformTax + item.platformCouponTaxReversal, coin: sum.coin + amount(item.coinFundingReversal), coinTax: sum.coinTax + item.coinTaxReversal }), { quantity: 0, cash: 0n, buyerTax: 0n, platform: 0n, platformTax: 0n, coin: 0n, coinTax: 0n })
}

function shopConsumed(state: SettlementRefundState, shopOrderId: string, successfulOnly = false) {
  return state.history.filter((past) => successfulOnly ? past.status === 'SUCCESS' : activeStatuses.has(past.status))
    .flatMap((past) => past.shopAllocations).filter((shop) => shop.shopOrderId === shopOrderId)
    .reduce((sum, shop) => ({ shipping: sum.shipping + amount(shop.buyerShippingRefund), shippingTax: sum.shippingTax + shop.buyerShippingTaxRefund, subsidy: sum.subsidy + amount(shop.platformShippingReversal), subsidyTax: sum.subsidyTax + shop.platformShippingTaxReversal, commission: sum.commission + amount(shop.commissionReversal) }), { shipping: 0n, shippingTax: 0n, subsidy: 0n, subsidyTax: 0n, commission: 0n })
}

function validateCapacity(state: SettlementRefundState, items: readonly SettlementRefundItemPlan[], shops: readonly SettlementRefundShopPlan[]): void {
  for (const item of state.items) {
    const sale = item.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const pools = originalItemPools(state, sale)
    const prior = itemConsumed(state, item.id)
    const next = items.find((allocation) => allocation.orderItemId === item.id)
    if (prior.quantity + (next?.quantity ?? 0) > sale.originalQuantity || prior.cash + amount(next?.cashMerchandise ?? 0n) > pools.cashMerchandise
      || prior.buyerTax + (next?.buyerTaxRefund ?? 0n) > pools.buyerTaxRefund || prior.platform + amount(next?.platformCouponReversal ?? 0n) > pools.platformCouponReversal
      || prior.platformTax + (next?.platformCouponTaxReversal ?? 0n) > pools.platformCouponTaxReversal || prior.coin + amount(next?.coinFundingReversal ?? 0n) > pools.coinFundingReversal
      || prior.coinTax + (next?.coinTaxReversal ?? 0n) > pools.coinTaxReversal) invalidSettlementRefund('Refund exceeds remaining item entitlement')
  }
  for (const shop of state.shops) {
    const sale = shop.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const prior = shopConsumed(state, shop.id)
    const next = shops.find((allocation) => allocation.shopOrderId === shop.id)
    const pools = originalShippingPools(sale)
    if (prior.shipping + amount(next?.buyerShippingRefund ?? 0n) > pools.buyerShippingRefund || prior.shippingTax + (next?.buyerShippingTaxRefund ?? 0n) > pools.buyerShippingTaxRefund
      || prior.subsidy + amount(next?.platformShippingReversal ?? 0n) > pools.platformShippingReversal || prior.subsidyTax + (next?.platformShippingTaxReversal ?? 0n) > pools.platformShippingTaxReversal
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
    if (!sale || !Number.isSafeInteger(requested.quantity) || requested.quantity <= 0) invalidSettlementRefund('Refund quantity must be a positive integer')
    if (state.history.some((past) => (past.status === 'PENDING' || past.status === 'PROCESSING') && past.itemAllocations.some((row) => row.orderItemId === requested.orderItemId))) invalidSettlementRefund('Order item already has a reserved refund')
    const prior = itemConsumed(state, requested.orderItemId, true)
    const quantity = prior.quantity + requested.quantity
    if (quantity > sale.originalQuantity) invalidSettlementRefund('Refund exceeds remaining item quantity')
    shops.set(sale.shopOrderId, { shopOrderId: sale.shopOrderId, buyerShippingRefund: 0n, buyerShippingTaxRefund: 0n, platformShippingReversal: 0n, platformShippingTaxReversal: 0n, commissionReversal: 0n, shippingCause: 'NONE' })
    const pools = originalItemPools(state, sale)
    const row: SettlementRefundItemPlan = { orderItemId: requested.orderItemId, quantity: requested.quantity, successfulQuantityBefore: prior.quantity, cashMerchandise: 0n, buyerTaxRefund: 0n, platformCouponReversal: 0n, platformCouponTaxReversal: 0n, coinFundingReversal: 0n, coinTaxReversal: 0n }
    for (const key of itemPoolKeys) row[key] = quantityInterval(pools[key], prior.quantity, requested.quantity, sale.originalQuantity)
    return row
  })
  for (const requested of intent.shipping) {
    const sale = state.shops.find((shop) => shop.id === requested.shopOrderId)?.saleSnapshot
    if (!sale) invalidSettlementRefund()
    const prior = shopConsumed(state, requested.shopOrderId)
    const pools = originalShippingPools(sale)
    const refundsShipping = requested.cause === 'PRE_SHIPMENT_CANCEL' || requested.cause === 'SELLER_FAULT'
    shops.set(requested.shopOrderId, { shopOrderId: requested.shopOrderId, shippingCause: requested.cause, commissionReversal: 0n,
      buyerShippingRefund: refundsShipping ? pools.buyerShippingRefund - prior.shipping : 0n,
      buyerShippingTaxRefund: refundsShipping ? pools.buyerShippingTaxRefund - prior.shippingTax : 0n,
      platformShippingReversal: requested.cause === 'PRE_SHIPMENT_CANCEL' ? pools.platformShippingReversal - prior.subsidy : 0n,
      platformShippingTaxReversal: requested.cause === 'PRE_SHIPMENT_CANCEL' ? pools.platformShippingTaxReversal - prior.subsidyTax : 0n })
  }
  const plan = { items, shops: [...shops.values()].sort((a, b) => a.shopOrderId.localeCompare(b.shopOrderId)), amount: buyerCash(items, [...shops.values()]) }
  validatePlanRows(state, plan.items, plan.shops)
  validateCapacity(state, plan.items, plan.shops)
  return plan
}

/** Complete a frozen plan, computing fee credits from successful actual reversals only. */
export function completeSettlementRefundPlan(state: SettlementRefundState, saved: SettlementRefundPlan): SettlementRefundPlan {
  if (!validateSettlementRefundState(state) || saved.items.length === 0 && saved.shops.length === 0) invalidSettlementRefund('Refund requires an explicit allocation plan')
  validatePlanRows(state, saved.items, saved.shops)
  validateCapacity(state, saved.items, saved.shops)
  for (const row of saved.items) {
    if (row.successfulQuantityBefore !== itemConsumed(state, row.orderItemId, true).quantity) invalidSettlementRefund('Refund quantity interval is stale')
  }
  if (buyerCash(saved.items, saved.shops) !== saved.amount) invalidSettlementRefund('Refund cash does not match its allocation plan')
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
