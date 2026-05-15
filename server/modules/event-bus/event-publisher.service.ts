import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type {
  DomainEvent,
  DomainEventPublishResult,
  PublishDomainEventInput,
} from './domain-event.types.ts'
import { DomainEventError } from './domain-event.types.ts'
import type { EventBus } from './event-bus.ts'

const sensitiveFieldPattern = /(password|token|secret|authorization|card|cvv|cvc|pan|expiry|providerpayload|payload)/i

export class EventPublisherService {
  private readonly logger: ILogger

  constructor(
    appContext: AppContext,
    private readonly eventBus: EventBus,
  ) {
    this.logger = appContext.logger
  }

  publish(input: PublishDomainEventInput): Promise<DomainEventPublishResult> {
    const event = this.buildEvent(input)
    return this.publishEvent(event)
  }

  async publishEvent(event: DomainEvent): Promise<DomainEventPublishResult> {
    try {
      return await this.eventBus.publish(this.sanitizeEvent(event))
    } catch (error) {
      if (error instanceof DomainEventError) throw error
      this.logger.error('EVENT_PUBLISH_FAILED', {
        eventName: event.eventName,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new DomainEventError('Failed to publish event', 'EVENT_PUBLISH_FAILED', {
        eventName: event.eventName,
        eventId: event.eventId,
      })
    }
  }

  buildEvent(input: PublishDomainEventInput): DomainEvent {
    const occurredAt = input.occurredAt instanceof Date
      ? input.occurredAt.toISOString()
      : input.occurredAt ?? new Date().toISOString()

    return this.sanitizeEvent({
      eventId: crypto.randomUUID(),
      eventName: input.eventName,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      occurredAt,
      data: input.data ?? {},
      ...(input.metadata ? { metadata: input.metadata } : {}),
    })
  }

  sanitizeEvent(event: DomainEvent): DomainEvent {
    return {
      ...event,
      data: this.sanitizeRecord(event.data),
      ...(event.metadata ? { metadata: this.sanitizeRecord(event.metadata) } : {}),
    }
  }

  private sanitizeRecord(input: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (sensitiveFieldPattern.test(key)) continue
      sanitized[key] = this.sanitizeValue(value)
    }
    return sanitized
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item))
    if (!value || typeof value !== 'object') return value
    return this.sanitizeRecord(value as Record<string, unknown>)
  }
}
