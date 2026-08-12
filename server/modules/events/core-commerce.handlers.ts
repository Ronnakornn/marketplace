import type { CacheInvalidation } from '#server/modules/cache'
import type { DomainEvent, DomainEventHandler } from '#server/modules/event-bus'
import type { NotificationService } from '#server/modules/notification/notification.service.ts'
import type { SearchService } from '#server/modules/search/search.service.ts'
import type { ShipmentService } from '#server/modules/shipment/shipment.service.ts'

interface SearchIndexer {
  reindexProduct(productId: string): Promise<void>
}

export interface CoreCommerceEventHandlerDeps {
  cacheInvalidation?: CacheInvalidation
  notificationService?: NotificationService
  searchService?: SearchService | SearchIndexer
  shipmentService?: ShipmentService
}

export function createCoreCommerceEventHandlers(deps: CoreCommerceEventHandlerDeps): Array<{
  eventName: DomainEvent['eventName']
  handler: DomainEventHandler
}> {
  return [
    {
      eventName: 'order.paid',
      handler: {
        name: 'order-paid.create-shipments',
        async handle(event) {
          await deps.shipmentService?.createShipmentsForPaidOrder(event.aggregateId)
        },
      },
    },
    {
      eventName: 'order.paid',
      handler: {
        name: 'order-paid.notify-buyer-seller',
        async handle(event) {
          await deps.notificationService?.notifyOrderPaid(event.aggregateId)
          await deps.notificationService?.notifySellerOrderPaid(event.aggregateId)
        },
      },
    },
    {
      eventName: 'shipment.shipped',
      handler: {
        name: 'shipment-shipped.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyShipmentShipped(event.aggregateId)
        },
      },
    },
    {
      eventName: 'order.cancelled',
      handler: {
        name: 'order-cancelled.notify-buyer',
        async handle(event) {
          const cause = event.data['cause']
          if (cause === 'payment_failed' || cause === 'payment_expired') {
            await deps.notificationService?.notifyOrderCancelled(event.aggregateId, cause)
          }
        },
      },
    },
    {
      eventName: 'shipment.delivered',
      handler: {
        name: 'shipment-delivered.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyShipmentDelivered(event.aggregateId)
        },
      },
    },
    {
      eventName: 'return.requested',
      handler: {
        name: 'return-requested.notify-seller',
        async handle(event) {
          await deps.notificationService?.notifyReturnRequested(event.aggregateId)
        },
      },
    },
    {
      eventName: 'return.approved',
      handler: {
        name: 'return-approved.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyReturnDecision(event.aggregateId, 'approved')
        },
      },
    },
    {
      eventName: 'return.rejected',
      handler: {
        name: 'return-rejected.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyReturnDecision(event.aggregateId, 'rejected')
        },
      },
    },
    {
      eventName: 'refund.succeeded',
      handler: {
        name: 'refund-succeeded.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyRefundUpdated(event.aggregateId)
        },
      },
    },
    {
      eventName: 'product.updated',
      handler: {
        name: 'product-updated.invalidate-cache',
        async handle(event) {
          await deps.cacheInvalidation?.invalidateProduct(event.aggregateId)
        },
      },
    },
    {
      eventName: 'product.updated',
      handler: {
        name: 'product-updated.reindex-search',
        async handle(event) {
          const indexer = deps.searchService as Partial<SearchIndexer> | undefined
          if (typeof indexer?.reindexProduct === 'function') {
            await indexer.reindexProduct(event.aggregateId)
          }
        },
      },
    },
    {
      eventName: 'payout.paid',
      handler: {
        name: 'payout-paid.notify-seller',
        async handle(event) {
          const sellerUserId = getString(event.data['sellerUserId'])
          if (!sellerUserId) return
          await deps.notificationService?.createNotification(
            sellerUserId,
            'payout_paid',
            'Payout paid',
            'Your payout has been paid.',
            { payoutId: event.aggregateId, audience: 'seller' },
          )
        },
      },
    },
  ]
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}
