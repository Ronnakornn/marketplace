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
  replayHorizonMs?: number
  maxLedgerEntries?: number
  maxInFlight?: number
  now?: () => number
}

export class EventBus {
  private readonly logger: ILogger
  private readonly handledEvents = new Map<string, number>()
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly now: () => number
  private readonly replayHorizonMs: number
  private readonly maxLedgerEntries: number
  private readonly maxInFlight: number
  private activeDispatches = 0

  constructor(
    appContext: AppContext,
    private readonly registry: EventHandlerRegistry,
    private readonly options: EventBusOptions = {},
  ) {
    this.logger = appContext.logger
    this.now = options.now ?? (() => performance.now())
    this.replayHorizonMs = options.replayHorizonMs ?? 24 * 60 * 60 * 1000
    this.maxLedgerEntries = options.maxLedgerEntries ?? 100_000
    this.maxInFlight = options.maxInFlight ?? 256
    for (const value of [this.replayHorizonMs, this.maxLedgerEntries, this.maxInFlight]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid EventBus resource limit')
    }
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
    if (this.activeDispatches >= this.maxInFlight) {
      throw new DomainEventError('EventBus publication capacity exhausted', 'EVENT_PUBLISH_FAILED')
    }
    this.activeDispatches++
    const dispatch = this.dispatch(event, handlers).finally(() => { this.activeDispatches-- })
    if (this.options.async) {
      void dispatch.catch((error) => {
          this.logger.error('EVENT_PUBLISH_FAILED', {
            eventId: event.eventId,
            eventName: event.eventName,
            error: error instanceof Error ? error.message : String(error),
          })
      })
      return { event, handlerResults: [] }
    }

    const handlerResults = await dispatch
    return { event, handlerResults }
  }

  private async dispatch(event: DomainEvent, handlers: ReturnType<EventHandlerRegistry['getHandlers']>): Promise<DomainEventHandlerResult[]> {
    const results: DomainEventHandlerResult[] = []

    for (const handler of handlers) {
      const idempotencyKey = JSON.stringify([event.eventId, handler.name])
      this.pruneHandledEvents()
      if (this.handledEvents.has(idempotencyKey)) {
        results.push({ handlerName: handler.name, ok: true })
        continue
      }

      try {
        let pending = this.inFlight.get(idempotencyKey)
        if (!pending) {
          if (handler.name.length > 512 || this.inFlight.size >= this.maxInFlight
            || this.handledEvents.size + this.inFlight.size >= this.maxLedgerEntries) {
            throw new Error('EventBus deduplication capacity exhausted')
          }
          pending = Promise.resolve().then(() => handler.handle(event)).then(() => {
            this.handledEvents.set(idempotencyKey, this.now() + this.replayHorizonMs)
          }).finally(() => { this.inFlight.delete(idempotencyKey) })
          this.inFlight.set(idempotencyKey, pending)
        }
        await pending
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

  private pruneHandledEvents(): void {
    const now = this.now()
    for (const [key, expiresAt] of this.handledEvents) {
      if (expiresAt > now) break
      this.handledEvents.delete(key)
    }
  }

  private validateEvent(event: DomainEvent): void {
    if (!event.eventId || event.eventId.length > 512 || !event.eventName || !event.aggregateType || !event.aggregateId) {
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
