export const coreDomainEventNames = [
  'user.registered',
  'product.created',
  'product.updated',
  'cart.checked_out',
  'order.created',
  'order.paid',
  'order.cancelled',
  'shipment.created',
  'shipment.shipped',
  'shipment.delivered',
  'return.requested',
  'return.approved',
  'return.rejected',
  'refund.created',
  'refund.succeeded',
  'payout.requested',
  'payout.paid',
] as const

export type CoreDomainEventName = typeof coreDomainEventNames[number]

export type AggregateType =
  | 'user'
  | 'product'
  | 'cart'
  | 'order'
  | 'shipment'
  | 'return'
  | 'refund'
  | 'payout'

export type DomainEventName = CoreDomainEventName | (string & {})

export type DomainEventData = Record<string, unknown>
export type DomainEventMetadata = Record<string, unknown>

export interface DomainEvent<TName extends DomainEventName = DomainEventName, TData extends DomainEventData = DomainEventData> {
  eventId: string
  eventName: TName
  aggregateType: AggregateType
  aggregateId: string
  actorUserId?: string
  occurredAt: string
  data: TData
  metadata?: DomainEventMetadata
}

export interface PublishDomainEventInput<TName extends DomainEventName = DomainEventName, TData extends DomainEventData = DomainEventData> {
  eventName: TName
  aggregateType: AggregateType
  aggregateId: string
  actorUserId?: string
  occurredAt?: Date | string
  data?: TData
  metadata?: DomainEventMetadata
}

export interface DomainEventHandler<TEvent extends DomainEvent = DomainEvent> {
  name: string
  critical?: boolean
  handle(event: TEvent): Promise<void> | void
}

export interface DomainEventPublishResult {
  event: DomainEvent
  handlerResults: DomainEventHandlerResult[]
}

export interface DomainEventHandlerResult {
  handlerName: string
  ok: boolean
  errorCode?: 'EVENT_HANDLER_FAILED'
  errorMessage?: string
}

export class DomainEventError extends Error {
  constructor(
    message: string,
    public readonly code: 'EVENT_HANDLER_FAILED' | 'EVENT_PUBLISH_FAILED' | 'INVALID_EVENT_PAYLOAD',
    public readonly metadata: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'DomainEventError'
  }
}
