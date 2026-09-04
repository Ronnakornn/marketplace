import type { AffiliateService } from '#server/modules/affiliate'
import type { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import { PaymentServiceError } from './payment.errors.ts'
import type {
  PaymentSettlementContext,
  PaymentWithOrder,
  ReleaseReservationInput,
} from './payment.repository.ts'
import type { PaymentWebhookEventType, PaymentWebhookResponse } from './payment.types.ts'

export type PaymentSettlementEvent = 'payment.paid' | 'payment.failed' | 'payment.expired' | 'buyer.cancelled'

type PaymentSettlementReservation = Pick<
  PaymentWithOrder['order']['checkout']['inventoryReservations'][number],
  'id' | 'inventoryId' | 'quantity' | 'status'
>

export type PaymentSettlementPayment = Pick<PaymentWithOrder, 'id' | 'orderId'> & {
  order: Pick<PaymentWithOrder['order'], 'userId' | 'checkoutId'> & {
    checkout: { inventoryReservations: PaymentSettlementReservation[] }
  }
}

export interface SettlePaymentInput {
  payment: PaymentSettlementPayment
  eventType: PaymentSettlementEvent
  occurredAt: Date
}

export class PaymentSettlement {
  constructor(
    private shipmentModule: Pick<ShipmentService, 'createShipmentsForPaidOrderWithRepo'>,
    private affiliateModule?: Pick<AffiliateService, 'createCommissionForPaidOrderWithRepo'>,
  ) {}

  settle(
    context: PaymentSettlementContext,
    input: SettlePaymentInput & { eventType: PaymentWebhookEventType },
  ): Promise<PaymentWebhookResponse>
  settle(
    context: PaymentSettlementContext,
    input: SettlePaymentInput & { eventType: 'buyer.cancelled' },
  ): Promise<{ ok: true; code: 'ORDER_CANCELLED' }>
  async settle(
    context: PaymentSettlementContext,
    input: SettlePaymentInput,
  ): Promise<PaymentWebhookResponse | { ok: true; code: 'ORDER_CANCELLED' }> {
    const reservations = this.getActiveReservations(input.payment)
    if (input.eventType === 'payment.paid' && reservations.length === 0) {
      throw new PaymentServiceError(
        'Paid order has no active inventory reservations',
        409,
        'PAYMENT_STATE_CONFLICT',
      )
    }

    await context.payment.applyPaymentStateTransition({
      paymentId: input.payment.id,
      orderId: input.payment.orderId,
      checkoutId: input.payment.order.checkoutId,
      eventType: input.eventType,
      reservations,
      occurredAt: input.occurredAt,
    })

    if (input.eventType === 'payment.paid') {
      await this.affiliateModule?.createCommissionForPaidOrderWithRepo(context.affiliate, {
        orderId: input.payment.orderId,
        buyerUserId: input.payment.order.userId,
      })
      await this.shipmentModule.createShipmentsForPaidOrderWithRepo(context.shipment, input.payment.orderId)
      return { ok: true, code: 'PAYMENT_PAID' }
    }
    if (input.eventType === 'payment.failed') return { ok: true, code: 'PAYMENT_FAILED' }
    if (input.eventType === 'payment.expired') return { ok: true, code: 'PAYMENT_EXPIRED' }
    return { ok: true, code: 'ORDER_CANCELLED' }
  }

  private getActiveReservations(payment: PaymentSettlementPayment): ReleaseReservationInput[] {
    return payment.order.checkout.inventoryReservations
      .filter((reservation) => reservation.status === 'ACTIVE')
      .map((reservation) => ({
        reservationId: reservation.id,
        inventoryId: reservation.inventoryId,
        quantity: reservation.quantity,
      }))
  }
}
