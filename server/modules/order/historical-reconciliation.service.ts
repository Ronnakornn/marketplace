import { createHash } from 'node:crypto'
import type { AppContext } from '#server/context/app-context.ts'
import type { Prisma } from '#generated/client/client.ts'
import { OrderServiceError } from './order.errors.ts'
import { HistoricalReconciliationRepository, type HistoricalOrder } from './historical-reconciliation.repository.ts'
import { historicalReconciliationValidator, type HistoricalReconciliationInput } from './historical-reconciliation.schema.ts'

const moneyFields = ['subtotal', 'discountTotal', 'shippingTotal', 'taxTotal', 'grandTotal'] as const
const pgBigIntMaximum = 9223372036854775807n
const conflict = (message: string): never => { throw new OrderServiceError(message, 409, 'HISTORICAL_FACTS_CONFLICT') }

export function planHistoricalShopOrders(order: HistoricalOrder, facts: HistoricalReconciliationInput) {
  if (order.id !== facts.orderId || !facts.sourceReference.trim()) conflict('Original evidence reference is required')
  if (order.items.some((item) => item.saleSnapshot) || order.shopOrders.some((shop) => shop.saleSnapshot)) {
    conflict('Settlement-policy orders cannot be repriced by historical reconciliation')
  }
  if (moneyFields.some((field) => BigInt(order[field]) < 0n)
    || BigInt(order.discountTotal) > BigInt(order.subtotal)
    || BigInt(order.grandTotal) !== BigInt(order.subtotal) - BigInt(order.discountTotal) + BigInt(order.shippingTotal) + BigInt(order.taxTotal)
    || order.items.some((item) => item.currency !== order.currency || item.quantity <= 0
      || BigInt(item.unitPrice) < 0n || BigInt(item.lineTotal) !== BigInt(item.unitPrice) * BigInt(item.quantity))) {
    conflict('Original order and item amounts must reconcile before adding shop snapshots')
  }
  const shops = new Map(facts.shops.map((shop) => [shop.shopId, shop]))
  const originalShopIds = new Set(order.items.map((item) => item.shopId))
  if (shops.size !== facts.shops.length || shops.size !== originalShopIds.size
    || [...originalShopIds].some((shopId) => !shops.has(shopId))
    || order.shopOrders.some((shop) => !shops.has(shop.shopId))) conflict('Evidence must cover exactly the original shops')
  for (const field of moneyFields) {
    if (facts.shops.reduce((total, shop) => total + BigInt(shop[field]), 0n) !== BigInt(order[field])) {
      conflict(`Original ${field} does not reconcile with the order`)
    }
  }
  const create: Prisma.ShopOrderUncheckedCreateInput[] = []
  for (const shop of facts.shops) {
    if (moneyFields.some((field) => BigInt(shop[field]) > pgBigIntMaximum)) conflict('Original amount exceeds database storage')
    const subtotal = order.items.filter((item) => item.shopId === shop.shopId)
      .reduce((total, item) => total + BigInt(item.lineTotal), 0n)
    if (shop.currency !== order.currency || BigInt(shop.subtotal) !== subtotal
      || BigInt(shop.discountTotal) > subtotal
      || BigInt(shop.grandTotal) !== subtotal - BigInt(shop.discountTotal) + BigInt(shop.shippingTotal) + BigInt(shop.taxTotal)) {
      conflict('Original shop facts do not reconcile with its purchased items')
    }
    const existing = order.shopOrders.find((row) => row.shopId === shop.shopId)
    if (existing) {
      if (moneyFields.some((field) => BigInt(existing[field]) !== BigInt(shop[field]))
        || existing.currency !== shop.currency || existing.status !== shop.status || existing.fulfillmentStatus !== shop.fulfillmentStatus) {
        conflict('Existing shop snapshot differs; reconciliation cannot overwrite financial history')
      }
      continue
    }
    create.push({
      orderId: order.id, shopId: shop.shopId, currency: shop.currency,
      status: shop.status, fulfillmentStatus: shop.fulfillmentStatus,
      subtotal: BigInt(shop.subtotal), discountTotal: BigInt(shop.discountTotal),
      shippingTotal: BigInt(shop.shippingTotal), taxTotal: BigInt(shop.taxTotal), grandTotal: BigInt(shop.grandTotal),
      createdAt: order.createdAt,
    })
  }
  return create
}

export class HistoricalReconciliationService {
  constructor(private readonly context: AppContext, private readonly repository: HistoricalReconciliationRepository) {}

  async reconcile(actorId: string, input: unknown, apply = false) {
    if (!historicalReconciliationValidator.Check(input)) {
      throw new OrderServiceError('Invalid original reconciliation facts', 400, 'HISTORICAL_FACTS_INVALID')
    }
    return this.repository.transaction(async (repository) => {
      const actor = await repository.findActor(actorId)
      if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE' || !actor.emailVerified) {
        throw new OrderServiceError('An active verified administrator is required', 403, 'HISTORICAL_RECONCILIATION_FORBIDDEN')
      }
      await repository.lockOrder(input.orderId)
      const order = await repository.findOrder(input.orderId)
      if (!order) throw new OrderServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
      const create = planHistoricalShopOrders(order, input)
      const canonical = { ...input, shops: [...input.shops].sort((a, b) => a.shopId.localeCompare(b.shopId)) }
      const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
      if (apply && create.length) {
        for (const row of create) await repository.createMissing(row)
        await repository.recordAudit({
          actorUserId: actorId, actorRole: 'ADMIN', action: 'ORDER_SNAPSHOT_RECONCILED',
          entityType: 'Order', entityId: order.id,
          metadata: { sourceReference: input.sourceReference, factsSha256: digest, originalFacts: canonical, createdShopIds: create.map((row) => row.shopId) },
        })
      }
      this.context.logger.info('HistoricalReconciliationService.reconcile', { orderId: order.id, apply, missingShops: create.length, factsSha256: digest })
      return { orderId: order.id, mode: apply ? 'apply' : 'dry-run', missingShopIds: create.map((row) => row.shopId), factsSha256: digest }
    })
  }
}
