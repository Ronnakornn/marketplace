import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type {
  DomainEvent,
  DomainEventHandlerResult,
  DomainEventPublishResult,
} from './domain-event.types.ts'
import { DomainEventError } from './domain-event.types.ts'
import type { EventHandlerRegistry } from './event-handler.registry.ts'

export interface EventBusOptions {
  async?: boolean
}

export class EventBus {
  private readonly logger: ILogger
  private readonly handledEvents = new Set<string>()

  constructor(
    appContext: AppContext,
    private readonly registry: EventHandlerRegistry,
    private readonly options: EventBusOptions = {},
  ) {
    this.logger = appContext.logger
  }

  async publish(event: DomainEvent): Promise<DomainEventPublishResult> {
    this.validateEvent(event)
    this.logger.info('EventBus.publish', {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    })

    const handlers = this.registry.getHandlers(event.eventName)
    if (this.options.async) {
      queueMicrotask(() => {
        void this.dispatch(event, handlers).catch((error) => {
          this.logger.error('EVENT_PUBLISH_FAILED', {
            eventId: event.eventId,
            eventName: event.eventName,
            error: error instanceof Error ? error.message : String(error),
          })
        })
      })
      return { event, handlerResults: [] }
    }

    const handlerResults = await this.dispatch(event, handlers)
    return { event, handlerResults }
  }

  private async dispatch(event: DomainEvent, handlers: ReturnType<EventHandlerRegistry['getHandlers']>): Promise<DomainEventHandlerResult[]> {
    const results: DomainEventHandlerResult[] = []

    for (const handler of handlers) {
      const idempotencyKey = `${event.eventId}:${handler.name}`
      if (this.handledEvents.has(idempotencyKey)) {
        results.push({ handlerName: handler.name, ok: true })
        continue
      }

      try {
        await handler.handle(event)
        this.handledEvents.add(idempotencyKey)
        results.push({ handlerName: handler.name, ok: true })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error('EVENT_HANDLER_FAILED', {
          eventId: event.eventId,
          eventName: event.eventName,
          handlerName: handler.name,
          error: errorMessage,
        })
        results.push({
          handlerName: handler.name,
          ok: false,
          errorCode: 'EVENT_HANDLER_FAILED',
          errorMessage,
        })
        if (handler.critical) {
          throw new DomainEventError('Critical event handler failed', 'EVENT_HANDLER_FAILED', {
            eventId: event.eventId,
            eventName: event.eventName,
            handlerName: handler.name,
          })
        }
      }
    }

    return results
  }

  private validateEvent(event: DomainEvent): void {
    if (!event.eventId || !event.eventName || !event.aggregateType || !event.aggregateId) {
      throw new DomainEventError('Invalid domain event payload', 'INVALID_EVENT_PAYLOAD')
    }
    const occurredAt = new Date(event.occurredAt)
    if (Number.isNaN(occurredAt.getTime())) {
      throw new DomainEventError('Invalid domain event timestamp', 'INVALID_EVENT_PAYLOAD', {
        eventName: event.eventName,
      })
    }
    if (!event.data || typeof event.data !== 'object' || Array.isArray(event.data)) {
      throw new DomainEventError('Invalid domain event data', 'INVALID_EVENT_PAYLOAD', {
        eventName: event.eventName,
      })
    }
  }
}
