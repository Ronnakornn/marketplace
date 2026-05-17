import type { DomainEvent, DomainEventHandler } from '#server/modules/event-bus'
import type { FraudService } from './fraud.service.ts'

export interface FraudEventHandlerDeps {
  fraudService: FraudService
}

export function createFraudEventHandlers(deps: FraudEventHandlerDeps): Array<{
  eventName: DomainEvent['eventName']
  handler: DomainEventHandler
}> {
  return [
    {
      eventName: 'order.created',
      handler: {
        name: 'order-created.evaluate-fraud-risk',
        async handle(event) {
          await deps.fraudService.evaluateOrderRisk(event.aggregateId)
        },
      },
    },
    {
      eventName: 'payment.failed',
      handler: {
        name: 'payment-failed.evaluate-order-fraud-risk',
        async handle(event) {
          const orderId = getString(event.data['orderId'])
          if (orderId) await deps.fraudService.evaluateOrderRisk(orderId)
        },
      },
    },
    {
      eventName: 'refund.created',
      handler: {
        name: 'refund-created.evaluate-fraud-risk',
        async handle(event) {
          await deps.fraudService.evaluateRefundRisk(event.aggregateId)
        },
      },
    },
    {
      eventName: 'affiliate.conversion.created',
      handler: {
        name: 'affiliate-conversion-created.evaluate-fraud-risk',
        async handle(event) {
          const affiliateId = getString(event.data['affiliateId']) ?? event.aggregateId
          await deps.fraudService.evaluateAffiliateRisk(affiliateId)
        },
      },
    },
  ]
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}
