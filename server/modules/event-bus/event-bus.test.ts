import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { createCoreCommerceEventHandlers } from '#server/modules/events'
import { DomainEventError, EventBus, EventHandlerRegistry, EventPublisherService, type DomainEvent } from './index.ts'

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

describe('EventBus', () => {
  let registry: EventHandlerRegistry
  let eventBus: EventBus
  let publisher: EventPublisherService

  beforeEach(() => {
    registry = new EventHandlerRegistry()
    eventBus = new EventBus(createAppContext(), registry)
    publisher = new EventPublisherService(createAppContext(), eventBus)
  })

  it('publishes an event', async () => {
    const result = await publisher.publish({
      eventName: 'order.created',
      aggregateType: 'order',
      aggregateId: 'order-1',
      actorUserId: 'user-1',
      data: { orderNo: '1001' },
    })

    expect(result.event).toMatchObject({
      eventName: 'order.created',
      aggregateType: 'order',
      aggregateId: 'order-1',
      actorUserId: 'user-1',
      data: { orderNo: '1001' },
    })
    expect(result.event.eventId).toEqual(expect.any(String))
    expect(new Date(result.event.occurredAt).toString()).not.toBe('Invalid Date')
  })

  it('delivers the correct payload to a handler', async () => {
    const handler = vi.fn()
    registry.register('order.created', {
      name: 'test-handler',
      handle: handler,
    })

    const result = await publisher.publish({
      eventName: 'order.created',
      aggregateType: 'order',
      aggregateId: 'order-1',
      data: { totalCents: 1200 },
    })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventId: result.event.eventId,
      eventName: 'order.created',
      aggregateId: 'order-1',
      data: { totalCents: 1200 },
    }))
    expect(result.handlerResults).toEqual([{ handlerName: 'test-handler', ok: true }])
  })

  it('keeps order.paid shipment handling idempotent for duplicate event delivery', async () => {
    const shipmentService = {
      createShipmentsForPaidOrder: vi.fn(async () => [{ id: 'shipment-1' }]),
    }
    registry.registerMany(createCoreCommerceEventHandlers({ shipmentService: shipmentService as any }))
    const event = buildEvent('event-1', 'order.paid', 'order', 'order-1')

    await publisher.publishEvent(event)
    await publisher.publishEvent(event)

    expect(shipmentService.createShipmentsForPaidOrder).toHaveBeenCalledTimes(1)
    expect(shipmentService.createShipmentsForPaidOrder).toHaveBeenCalledWith('order-1')
  })

  it('invalidates product cache on product.updated', async () => {
    const cacheInvalidation = {
      invalidateProduct: vi.fn(async () => 2),
    }
    registry.registerMany(createCoreCommerceEventHandlers({ cacheInvalidation: cacheInvalidation as any }))

    await publisher.publishEvent(buildEvent('event-2', 'product.updated', 'product', 'product-1'))

    expect(cacheInvalidation.invalidateProduct).toHaveBeenCalledWith('product-1')
  })

  it('routes payment cancellation causes to buyer notifications', async () => {
    const notificationService = { notifyOrderCancelled: vi.fn(async () => {}) }
    registry.registerMany(createCoreCommerceEventHandlers({ notificationService: notificationService as any }))

    await publisher.publishEvent({
      ...buildEvent('event-cancel', 'order.cancelled', 'order', 'order-1'),
      data: { cause: 'payment_expired' },
    })

    expect(notificationService.notifyOrderCancelled).toHaveBeenCalledWith('order-1', 'payment_expired')
  })

  it('reindexes product search on product.updated when a search engine exists', async () => {
    const searchService = {
      reindexProduct: vi.fn(async () => {}),
    }
    registry.registerMany(createCoreCommerceEventHandlers({ searchService: searchService as any }))

    await publisher.publishEvent(buildEvent('event-3', 'product.updated', 'product', 'product-1'))

    expect(searchService.reindexProduct).toHaveBeenCalledWith('product-1')
  })

  it('does not fail publishing when a non-critical handler fails', async () => {
    registry.register('order.created', {
      name: 'failing-handler',
      async handle() {
        throw new Error('handler down')
      },
    })

    const result = await publisher.publishEvent(buildEvent('event-4', 'order.created', 'order', 'order-1'))

    expect(result.handlerResults).toEqual([{
      handlerName: 'failing-handler',
      ok: false,
      errorCode: 'EVENT_HANDLER_FAILED',
      errorMessage: 'handler down',
    }])
  })

  it('fails publishing when a critical handler fails', async () => {
    registry.register('order.created', {
      name: 'critical-handler',
      critical: true,
      async handle() {
        throw new Error('critical down')
      },
    })

    await expect(publisher.publishEvent(buildEvent('event-5', 'order.created', 'order', 'order-1')))
      .rejects.toMatchObject({
        code: 'EVENT_HANDLER_FAILED',
      } satisfies Partial<DomainEventError>)
  })

  it('removes sensitive fields from event payloads and metadata', async () => {
    const result = await publisher.publish({
      eventName: 'order.paid',
      aggregateType: 'order',
      aggregateId: 'order-1',
      data: {
        orderId: 'order-1',
        accessToken: 'secret-token',
        paymentCard: { last4: '1111', cvv: '123' },
        nested: { refreshToken: 'refresh-secret', safe: true },
      },
      metadata: {
        authorization: 'Bearer secret',
        requestId: 'req-1',
      },
    })

    expect(result.event.data).toEqual({
      orderId: 'order-1',
      nested: { safe: true },
    })
    expect(result.event.metadata).toEqual({ requestId: 'req-1' })
  })

  it('rejects invalid event payloads', async () => {
    await expect(publisher.publishEvent({
      ...buildEvent('event-6', 'order.created', 'order', ''),
    })).rejects.toMatchObject({
      code: 'INVALID_EVENT_PAYLOAD',
    } satisfies Partial<DomainEventError>)
  })
})

function buildEvent(
  eventId: string,
  eventName: DomainEvent['eventName'],
  aggregateType: DomainEvent['aggregateType'],
  aggregateId: string,
): DomainEvent {
  return {
    eventId,
    eventName,
    aggregateType,
    aggregateId,
    occurredAt: new Date().toISOString(),
    data: {},
  }
}
