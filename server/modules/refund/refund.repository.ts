import type { Order, Payment, Prisma, PrismaClient, Refund, RefundStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AdminAuthorizer } from '#server/modules/admin-access/admin-access.contract.ts'
import { reverseBuyerCoinsForRefund } from '#server/modules/promotion/buyer-coin.transitions.ts'
import { reverseOriginalAffiliateForRefund } from '#server/modules/affiliate/affiliate-refund.repository.ts'
import { calculateRefundDebits } from './refund-amount.service.ts'
import { RefundServiceError } from './refund.errors.ts'
import { completeSettlementRefundPlan, createSettlementRefundPlan, invalidSettlementRefund, settlementItemGross, settlementShippingGross, validateSettlementRefundState, type SettlementRefundIntent, type SettlementRefundPlan, type SettlementRefundState } from './settlement-refund.service.ts'

export type RefundRecord = Refund & {
  order: Order
  payment: Payment
}

export interface IRefundRepository {
  prepareRefundPlan(refundId: string, intent: SettlementRefundIntent): Promise<void>
  createPlannedRefund(orderId: string, intent: SettlementRefundIntent): Promise<RefundRecord>
  listRefunds(): Promise<RefundRecord[]>
  findRefundById(refundId: string): Promise<RefundRecord | null>
  completeRefundSuccess(
    refundId: string,
    expectedStatus: RefundStatus,
    data?: Partial<Pick<Refund, 'completedById' | 'completedAt' | 'externalReference'>>,
  ): Promise<RefundRecord | null>
}

type RefundSettlementClient = Pick<Prisma.TransactionClient, 'shopOrder' | 'itemSaleSnapshot' | 'orderItem' | 'refund' | 'shipment' | 'refundItemAllocation' | 'refundShopAllocation'>

/** Read only after taking the parent Order lock. Historical allocations reserve rights. */
export async function loadRefundSettlementState(tx: RefundSettlementClient, orderId: string, currency: string, excludedRefundId?: string): Promise<SettlementRefundState | null> {
  const shops = await tx.shopOrder.findMany({ where: { orderId }, orderBy: { shopId: 'asc' }, include: { saleSnapshot: true } })
  if (shops.every((shop) => !shop.saleSnapshot)) {
    const orphanItems = await tx.itemSaleSnapshot.count({ where: { orderItem: { orderId } } })
    if (orphanItems) invalidSettlementRefund('Sale snapshot is incomplete')
    return null
  }
  const [items, history] = await Promise.all([
    tx.orderItem.findMany({ where: { orderId }, include: { saleSnapshot: true } }),
    tx.refund.findMany({ where: { orderId, ...(excludedRefundId ? { id: { not: excludedRefundId } } : {}) }, include: { itemAllocations: true, shopAllocations: true, payment: true, returnRequest: true } }),
  ])
  const paymentTotals = new Map<string, bigint>()
  for (const past of history) {
    if (!['SUCCESS', 'PENDING', 'PROCESSING'].includes(past.status)) continue
    if (past.orderId !== orderId || past.payment.orderId !== orderId || past.payment.id !== past.paymentId || past.payment.currency !== currency
      || past.payment.status !== 'SUCCEEDED' || BigInt(past.amount) < 0n) invalidSettlementRefund()
    if (past.returnRequest && (past.returnRequest.orderId !== orderId || past.itemAllocations.some((allocation) => items.find((item) => item.id === allocation.orderItemId)?.shopId !== past.returnRequest?.shopId))) invalidSettlementRefund()
    if (['SUCCESS', 'PENDING', 'PROCESSING'].includes(past.status)) {
      const total = (paymentTotals.get(past.paymentId) ?? 0n) + BigInt(past.amount)
      if (total > BigInt(past.payment.amount)) invalidSettlementRefund()
      paymentTotals.set(past.paymentId, total)
    }
  }
  const state = { orderId, currency, shops, items, history }
  validateSettlementRefundState(state)
  if (shops.some((shop) => {
    const sale = shop.saleSnapshot
    if (!sale || sale.policyVersion === 1 && BigInt(shop.taxTotal) !== 0n) return true
    const cash = items.filter((item) => item.saleSnapshot?.shopOrderId === shop.id).reduce((sum, item) => sum + BigInt(item.saleSnapshot?.buyerMerchandise ?? 0n), 0n)
    return cash + BigInt(sale.buyerShipping) !== BigInt(shop.grandTotal)
  })) invalidSettlementRefund('Sale cash snapshot does not match the shop order')
  return state
}

export async function validateRefundShipping(tx: RefundSettlementClient, state: SettlementRefundState, plan: SettlementRefundPlan): Promise<void> {
  const shopIds = plan.shops.filter((shop) => shop.shippingCause === 'PRE_SHIPMENT_CANCEL').map((allocation) => state.shops.find((shop) => shop.id === allocation.shopOrderId)?.shopId).filter((id): id is string => Boolean(id))
  if (shopIds.length && await tx.shipment.count({ where: { orderId: state.orderId, shopId: { in: shopIds }, OR: [{ status: { in: ['SHIPPED', 'DELIVERED'] } }, { shippedAt: { not: null } }] } })) invalidSettlementRefund('Shipping cancellation requires an unshipped shop order')
  for (const allocation of plan.shops.filter((shop) => shop.shippingCause === 'SELLER_FAULT')) {
    const shop = state.shops.find((shop) => shop.id === allocation.shopOrderId)
    if (!shop || !await tx.shipment.count({ where: { orderId: state.orderId, shopId: shop.shopId, OR: [{ status: { in: ['SHIPPED', 'DELIVERED'] } }, { shippedAt: { not: null } }] } })) invalidSettlementRefund('Seller-fault shipping refund requires shipment evidence')
  }
}

export async function saveRefundSettlementPlan(tx: RefundSettlementClient, refundId: string, plan: SettlementRefundPlan): Promise<void> {
  const prepared = await tx.refund.updateMany({ where: { id: refundId, status: 'PENDING' }, data: { amount: plan.amount } })
  if (prepared.count !== 1) invalidSettlementRefund('Refund allocation can only change while pending')
  await tx.refundItemAllocation.deleteMany({ where: { refundId } })
  await tx.refundShopAllocation.deleteMany({ where: { refundId } })
  if (plan.items.length) await tx.refundItemAllocation.createMany({ data: plan.items.map((item) => ({ ...item, refundId })) })
  if (plan.shops.length) await tx.refundShopAllocation.createMany({ data: plan.shops.map((shop) => ({ ...shop, refundId })) })
}

async function completeOriginatingReturn(tx: Prisma.TransactionClient, refund: Pick<Refund, 'returnRequestId' | 'orderId'>): Promise<void> {
  if (!refund.returnRequestId) return
  const completed = await tx.returnRequest.updateMany({ where: { id: refund.returnRequestId, orderId: refund.orderId, status: { in: ['APPROVED', 'RECEIVED'] } }, data: { status: 'COMPLETED' } })
  if (completed.count !== 1) invalidSettlementRefund('Return cannot be completed from its current state')
}

async function applyPreShipmentCancellation(tx: Prisma.TransactionClient, state: SettlementRefundState, plan: SettlementRefundPlan, refundId: string, completedById: string): Promise<void> {
  const canceledShopOrders = plan.shops.filter((shop) => shop.shippingCause === 'PRE_SHIPMENT_CANCEL').map((shop) => shop.shopOrderId)
  if (!canceledShopOrders.length) return
  const shopIds = state.shops.filter((shop) => canceledShopOrders.includes(shop.id)).map((shop) => shop.shopId)
  const itemIds = state.items.filter((item) => item.saleSnapshot && canceledShopOrders.includes(item.saleSnapshot.shopOrderId)).map((item) => item.id)
  const items = await tx.orderItem.findMany({ where: { id: { in: itemIds } }, select: { variantId: true, quantity: true, fulfillmentStatus: true } })
  if (items.length !== itemIds.length || items.some((item) => ['PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELED'].includes(item.fulfillmentStatus))) invalidSettlementRefund('Canceled sale items must remain unshipped')
  const quantities = new Map<string, number>()
  for (const item of items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity)
  const inventories = await tx.inventory.findMany({ where: { variantId: { in: [...quantities.keys()] } }, orderBy: { id: 'asc' } })
  if (inventories.length !== quantities.size) invalidSettlementRefund('Canceled sale inventory is missing')
  for (const inventory of inventories) {
    await tx.$queryRaw`SELECT "id" FROM "Inventory" WHERE "id" = ${inventory.id}::uuid FOR UPDATE`
    const current = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } })
    const reservations = await tx.inventoryReservation.findMany({ where: { orderId: state.orderId, inventoryId: current.id, status: 'COMMITTED' } })
    const quantity = reservations.reduce((sum, reservation) => sum + reservation.quantity, 0)
    if (quantity !== quantities.get(current.variantId)) invalidSettlementRefund('Canceled sale stock commitment is inconsistent')
    for (const reservation of reservations) {
      const released = await tx.inventoryReservation.updateMany({ where: { id: reservation.id, status: 'COMMITTED' }, data: { status: 'RELEASED' } })
      if (released.count !== 1) invalidSettlementRefund('Canceled sale stock was already released')
    }
    const updated = await tx.inventory.update({ where: { id: current.id }, data: { quantityOnHand: { increment: quantity }, version: { increment: 1 } } })
    await tx.inventoryMovement.create({ data: { inventoryId: current.id, variantId: current.variantId, type: 'RETURN_RESTOCK', quantityDelta: quantity,
      quantityOnHandBefore: current.quantityOnHand, quantityOnHandAfter: updated.quantityOnHand, quantityReservedBefore: current.quantityReserved,
      quantityReservedAfter: updated.quantityReserved, actorUserId: completedById, reason: 'Paid pre-shipment sale canceled', referenceType: 'PRE_SHIPMENT_REFUND', referenceId: refundId } })
  }
  await tx.orderItem.updateMany({ where: { id: { in: itemIds } }, data: { fulfillmentStatus: 'CANCELED' } })
  await tx.shopOrder.updateMany({ where: { id: { in: canceledShopOrders } }, data: { status: 'CANCELED', fulfillmentStatus: 'CANCELED', version: { increment: 1 } } })
  await tx.shipment.updateMany({ where: { orderId: state.orderId, shopId: { in: shopIds } }, data: { status: 'CANCELED' } })
  if (!await tx.shopOrder.count({ where: { orderId: state.orderId, status: { not: 'CANCELED' } } })) {
    await tx.order.update({ where: { id: state.orderId }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' } })
    await tx.payment.updateMany({ where: { orderId: state.orderId, status: 'SUCCEEDED' }, data: { status: 'REFUNDED' } })
  } else {
    const active = await tx.shipment.findMany({ where: { orderId: state.orderId, status: { not: 'CANCELED' } }, select: { status: true } })
    if (active.length && active.every((shipment) => shipment.status === 'DELIVERED')) {
      await tx.order.update({ where: { id: state.orderId }, data: { status: 'DELIVERED' } })
    } else if (active.length && active.every((shipment) => shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED')) {
      await tx.order.update({ where: { id: state.orderId }, data: { status: 'SHIPPED' } })
    } else if (active.some((shipment) => shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED')) {
      await tx.order.update({ where: { id: state.orderId }, data: { status: 'PARTIALLY_FULFILLED' } })
    }
  }
}

const refundInclude = {
  order: true,
  payment: true,
} as const

export class PrismaRefundRepository implements IRefundRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: Pick<PrismaClient, '$transaction' | 'refund'>,
    private adminAuthorizer?: AdminAuthorizer,
  ) {
    this.logger = appContext.logger
  }

  async createPlannedRefund(orderId: string, intent: SettlementRefundIntent): Promise<RefundRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: { where: { status: 'SUCCEEDED' }, orderBy: { createdAt: 'desc' } } } })
      const payment = order?.payments[0]
      if (!order || !payment || payment.currency !== order.currency || BigInt(payment.amount) !== BigInt(order.grandTotal)) invalidSettlementRefund('Refund requires a successful original payment')
      if (intent.items.length && await tx.returnItem.count({ where: { orderItemId: { in: intent.items.map((item) => item.orderItemId) }, returnRequest: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } } })) invalidSettlementRefund('Order item already has an active return')
      const state = await loadRefundSettlementState(tx, orderId, order.currency)
      if (!state) invalidSettlementRefund('Legacy sale requires reviewed refund allocation')
      const plan = createSettlementRefundPlan(state, intent)
      await validateRefundShipping(tx, state, plan)
      const record = await tx.refund.create({ data: { orderId, paymentId: payment.id, amount: plan.amount, status: 'PENDING' }, include: refundInclude })
      await saveRefundSettlementPlan(tx, record.id, plan)
      return record
    })
  }

  async prepareRefundPlan(refundId: string, intent: SettlementRefundIntent): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const reference = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true } })
      if (!reference) invalidSettlementRefund('Refund does not exist')
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${reference.orderId}::uuid FOR UPDATE`
      const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { order: true, payment: true, returnRequest: { include: { items: true } } } })
      if (!refund || refund.status !== 'PENDING' || refund.payment.status !== 'SUCCEEDED' || refund.payment.orderId !== refund.orderId || refund.payment.id !== refund.paymentId
        || refund.payment.currency !== refund.order.currency || BigInt(refund.payment.amount) !== BigInt(refund.order.grandTotal)) invalidSettlementRefund('Only pending refunds can receive an allocation plan')
      const state = await loadRefundSettlementState(tx, refund.orderId, refund.order.currency, refundId)
      if (!state) invalidSettlementRefund('Legacy sale requires reviewed refund allocation')
      if (refund.returnRequest && (refund.returnRequest.orderId !== refund.orderId || intent.items.length !== refund.returnRequest.items.length
        || intent.items.some((item) => !refund.returnRequest?.items.some((returned) => returned.orderItemId === item.orderItemId && returned.quantity === item.quantity)))) invalidSettlementRefund('Return allocation must match the approved items')
      const plan = createSettlementRefundPlan(state, intent)
      if (refund.returnRequest && plan.shops.some((shop) => state.shops.find((row) => row.id === shop.shopOrderId)?.shopId !== refund.returnRequest?.shopId)) invalidSettlementRefund()
      await validateRefundShipping(tx, state, plan)
      await saveRefundSettlementPlan(tx, refundId, plan)
    })
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
      const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { ...refundInclude, returnRequest: { include: { items: true } }, itemAllocations: true, shopAllocations: true, supportDispute: { select: { id: true, status: true, compensation: true } } } })
      if (!refund || refund.status !== expectedStatus) return null
      if (refund.status !== 'PROCESSING' || !data.completedById || !data.externalReference?.trim()
        || !refund.processingById || refund.processingById === data.completedById) {
        throw new RefundServiceError('Refund requires an external reference and two administrators', 409, 'INVALID_REFUND_STATE')
      }
      if (this.adminAuthorizer) {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
        await this.adminAuthorizer.require({ id: data.completedById, role: 'ADMIN' }, 'refunds.complete')
      }
      if (refund.supportDispute && (refund.supportDispute.status !== 'RESOLVED_BUYER' || refund.supportDispute.compensation !== refund.amount)) {
        throw new RefundServiceError('Support compensation does not match the frozen refund plan', 409, 'INVALID_REFUND_STATE')
      }
      const invalidHistory = () => new RefundServiceError('Refund allocation history is inconsistent', 409, 'INVALID_REFUND_STATE')
      if (refund.orderId !== reference.orderId || refund.order.id !== refund.orderId
        || refund.payment.id !== refund.paymentId || refund.payment.orderId !== refund.orderId
        || refund.order.currency !== refund.payment.currency
        || BigInt(refund.order.grandTotal) !== BigInt(refund.payment.amount)
        || (refund.returnRequest && refund.returnRequest.orderId !== refund.orderId)) throw invalidHistory()
      const settlement = await loadRefundSettlementState(tx, refund.orderId, refund.payment.currency, refundId)
      if (settlement) {
        if (refund.payment.status !== 'SUCCEEDED') invalidSettlementRefund('Refund requires a successful original payment')
        const paidRefunds = settlement.history.filter((past) => ['SUCCESS', 'PENDING', 'PROCESSING'].includes(past.status)).reduce((sum, past) => sum + BigInt(past.amount), 0n)
        if (BigInt(refund.amount) < 0n || paidRefunds + BigInt(refund.amount) > BigInt(refund.payment.amount)) invalidSettlementRefund('Refund exceeds remaining payment amount')
        const plan = completeSettlementRefundPlan(settlement, { items: refund.itemAllocations, shops: refund.shopAllocations, amount: BigInt(refund.amount) })
        if (refund.shopAllocations.some((shop) => shop.walletPostedAt !== null)
          || refund.returnRequest && (plan.items.length !== refund.returnRequest.items.length || plan.items.some((item) => !refund.returnRequest?.items.some((returned) => returned.orderItemId === item.orderItemId && returned.quantity === item.quantity))
            || plan.shops.some((shop) => settlement.shops.find((row) => row.id === shop.shopOrderId)?.shopId !== refund.returnRequest?.shopId))) invalidSettlementRefund()
        await validateRefundShipping(tx, settlement, plan)
        const updated = await tx.refund.updateMany({ where: { id: refundId, status: expectedStatus, processingById: refund.processingById }, data: { ...data, status: 'SUCCESS' } })
        if (updated.count !== 1) return null
        if (refund.supportDispute) await tx.disputeCase.update({ where: { id: refund.supportDispute.id }, data: { status: 'COMPENSATED', resolvedAt: new Date() } })
        await applyPreShipmentCancellation(tx, settlement, plan, refundId, data.completedById)
        for (const allocation of [...plan.shops].sort((a, b) => (settlement.shops.find((shop) => shop.id === a.shopOrderId)?.shopId ?? '').localeCompare(settlement.shops.find((shop) => shop.id === b.shopOrderId)?.shopId ?? ''))) {
          const shop = settlement.shops.find((shop) => shop.id === allocation.shopOrderId)
          if (!shop?.saleSnapshot) invalidSettlementRefund()
          await tx.refundShopAllocation.update({ where: { refundId_shopOrderId: { refundId, shopOrderId: shop.id } }, data: { commissionReversal: allocation.commissionReversal } })
          if (!shop.saleSnapshot.recognizedAt) continue
          const itemIds = new Set(settlement.items.filter((item) => item.saleSnapshot?.shopOrderId === shop.id).map((item) => item.id))
          const debit = plan.items.filter((item) => itemIds.has(item.orderItemId)).reduce((sum, item) => sum + settlementItemGross(item), 0n) + settlementShippingGross(allocation)
          const wallet = await tx.shopWallet.upsert({ where: { shopId: shop.shopId }, create: { shopId: shop.shopId, currency: refund.payment.currency }, update: {} })
          if (wallet.currency !== refund.payment.currency) invalidSettlementRefund('Refund wallet currency mismatch')
          await tx.$queryRaw`SELECT "id" FROM "ShopWallet" WHERE "id" = ${wallet.id}::uuid FOR UPDATE`
          if (debit > 0n) await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: shop.shopId, orderId: refund.orderId, refundId, type: 'refund_adjustment', amount: -debit, currency: refund.payment.currency, description: 'Sale entitlement reversed', metadata: { policyVersion: shop.saleSnapshot.policyVersion, shopOrderId: shop.id } } })
          if (allocation.commissionReversal > 0n) await tx.walletLedgerEntry.create({ data: { walletId: wallet.id, shopId: shop.shopId, orderId: refund.orderId, refundId, type: 'commission_fee', amount: allocation.commissionReversal, currency: refund.payment.currency, description: 'Original commission reversed', metadata: { policyVersion: shop.saleSnapshot.policyVersion, shopOrderId: shop.id, reversal: true } } })
          await tx.refundShopAllocation.update({ where: { refundId_shopOrderId: { refundId, shopOrderId: shop.id } }, data: { walletPostedAt: new Date() } })
        }
        const buyerWallet = await tx.buyerCoinWallet.findUnique({ where: { userId: refund.order.userId }, select: { id: true } })
        if (buyerWallet) await tx.$queryRaw`SELECT "id" FROM "BuyerCoinWallet" WHERE "id" = ${buyerWallet.id}::uuid FOR UPDATE`
        const completedItems = [...settlement.history.filter((past) => past.status === 'SUCCESS').flatMap((past) => past.itemAllocations), ...plan.items]
        await reverseBuyerCoinsForRefund(tx, { refundId, orderId: refund.orderId, refundAmount: refund.amount, orderGrandTotal: refund.order.grandTotal, userId: refund.order.userId,
          coinFundingTargetCents: completedItems.reduce((sum, item) => sum + item.coinFundingReversal + item.coinTaxReversal, 0n),
          coinFundingTotalCents: settlement.items.reduce((sum, item) => sum + BigInt(item.saleSnapshot?.coinDiscount ?? 0n), 0n),
          merchandiseCashTarget: completedItems.reduce((sum, item) => sum + BigInt(item.cashMerchandise), 0n),
          merchandiseCashTotal: settlement.items.reduce((sum, item) => sum + BigInt(item.saleSnapshot?.originalCashbackEligibleNet ?? item.saleSnapshot?.buyerMerchandise ?? 0n), 0n) })
        await reverseOriginalAffiliateForRefund(tx, { orderId: refund.orderId, refundId, currency: refund.payment.currency, items: plan.items })
        await completeOriginatingReturn(tx, refund)
        return tx.refund.findUnique({ where: { id: refundId }, include: refundInclude })
      }
      const legacyAward = await tx.affiliateCommission.findUnique({ where: { orderId: refund.orderId }, select: { status: true } })
      if (legacyAward && legacyAward.status !== 'VOID') invalidSettlementRefund('Legacy affiliate refund requires original merchandise allocations')
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
      if (refund.supportDispute) await tx.disputeCase.update({ where: { id: refund.supportDispute.id }, data: { status: 'COMPENSATED', resolvedAt: new Date() } })

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
      await completeOriginatingReturn(tx, refund)
      return tx.refund.findUnique({ where: { id: refundId }, include: refundInclude })
    })
  }
}
