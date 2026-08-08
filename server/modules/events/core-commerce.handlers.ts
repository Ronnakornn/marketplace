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
          await notifySellerUsers(deps.notificationService, event)
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
      eventName: 'shipment.delivered',
      handler: {
        name: 'shipment-delivered.notify-buyer',
        async handle(event) {
          await deps.notificationService?.notifyShipmentDelivered(event.aggregateId)
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

async function notifySellerUsers(notificationService: NotificationService | undefined, event: DomainEvent): Promise<void> {
  if (!notificationService) return
  const sellerUserIds = getStringArray(event.data['sellerUserIds'])
  await Promise.all(sellerUserIds.map((sellerUserId) =>
    notificationService.createNotification(
      sellerUserId,
            'order_paid',
            'New paid order',
            'A buyer paid for an order from your shop.',
            { orderId: event.aggregateId, audience: 'seller' },
    ),
  ))
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}
