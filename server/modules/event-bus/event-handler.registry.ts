import type { DomainEvent, DomainEventHandler, DomainEventName } from './domain-event.types.ts'

export class EventHandlerRegistry {
  private readonly handlers = new Map<DomainEventName, DomainEventHandler[]>()

  register<TEvent extends DomainEvent>(eventName: TEvent['eventName'], handler: DomainEventHandler<TEvent>): void {
    const handlers = this.handlers.get(eventName) ?? []
    handlers.push(handler as DomainEventHandler)
    this.handlers.set(eventName, handlers)
  }

  registerMany(registrations: Array<{ eventName: DomainEventName; handler: DomainEventHandler }>): void {
    for (const registration of registrations) {
      this.register(registration.eventName, registration.handler)
    }
  }

  getHandlers(eventName: DomainEventName): DomainEventHandler[] {
    return [...(this.handlers.get(eventName) ?? [])]
  }

  clear(): void {
    this.handlers.clear()
  }
}
