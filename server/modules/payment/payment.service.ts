import type { PaymentStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { ShipmentService } from '#server/modules/shipment/shipment.service.ts'
import type { AffiliateService } from '#server/modules/affiliate'
import { PaymentServiceError } from './payment.errors.ts'
import type { IPaymentRepository, PaymentWithOrder, ReleaseReservationInput } from './payment.repository.ts'
import type { PaymentWebhookBody, PaymentWebhookResponse } from './payment.types.ts'

const VALID_EVENTS = new Set(['payment.paid', 'payment.failed', 'payment.expired'])

export class PaymentService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IPaymentRepository,
    private shipmentService: ShipmentService,
    private cacheInvalidation?: CacheInvalidation,
    private eventPublisher?: EventPublisherService,
    private affiliateService?: AffiliateService,
  ) {
    this.logger = appContext.logger
  }

  async handleWebhook(input: PaymentWebhookBody): Promise<PaymentWebhookResponse> {
    this.validateInput(input)
    this.logger.info('PaymentService.handleWebhook', {
      provider: input.provider,
      providerRef: input.providerRef,
      paymentId: input.paymentId,
      eventType: input.eventType,
    })

    const response = await this.repo.transaction(async (txRepo) => {
      const existingEvent = await txRepo.findWebhookEvent(input.providerRef)
      if (existingEvent) {
        return { ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' }
      }

      const payment = await txRepo.findPayment(input.paymentId)
      if (!payment) throw new PaymentServiceError('Payment not found', 404, 'PAYMENT_NOT_FOUND')

      const order = payment.orderId === input.orderId ? payment.order : await txRepo.findOrder(input.orderId)
      if (!order) throw new PaymentServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
      if (payment.orderId !== order.id) {
        throw new PaymentServiceError('Payment does not belong to order', 409, 'PAYMENT_STATE_CONFLICT')
      }
      if (payment.amount !== input.amount) {
        throw new PaymentServiceError('Webhook amount does not match payment amount', 400, 'AMOUNT_MISMATCH', {
          expectedamount: payment.amount,
          receivedamount: input.amount,
        })
      }

      const idempotentResult = this.getIdempotentResult(payment.status, input.eventType)
      if (idempotentResult) {
        await txRepo.createWebhookEvent(input)
        return idempotentResult
      }

      this.assertAllowedTransition(payment.status, input.eventType)
      await txRepo.createWebhookEvent(input)

      if (input.eventType === 'payment.paid') {
        await txRepo.markPaymentSucceeded(payment.id, new Date())
        await txRepo.markOrderPaid(order.id)
        await this.affiliateService?.createCommissionForPaidOrderWithRepo(txRepo, {
          orderId: order.id,
          buyerUserId: order.userId,
        })
        await this.shipmentService.createShipmentsForPaidOrderWithRepo(txRepo, order.id)
        await this.invalidateOrderAffectedCaches(payment)
        return { ok: true, code: 'PAYMENT_PAID' }
      }

      const reservations = this.getActiveReservations(payment)
      await txRepo.releaseReservations(reservations)

      if (input.eventType === 'payment.failed') {
        await txRepo.markPaymentFailed(payment.id)
        await txRepo.markOrderCanceled(order.id)
        await this.invalidateOrderAffectedCaches(payment)
        return { ok: true, code: 'PAYMENT_FAILED' }
      }

      await txRepo.markPaymentExpired(payment.id)
      await txRepo.markOrderCanceled(order.id)
      await this.invalidateOrderAffectedCaches(payment)
      return { ok: true, code: 'PAYMENT_EXPIRED' }
    })

    if (response.code === 'PAYMENT_PAID') {
      await this.publishBestEffort('order.paid', input.orderId, {
        orderId: input.orderId,
        paymentId: input.paymentId,
        provider: input.provider,
        amount: input.amount,
      })
    }

    return response
  }

  private validateInput(input: PaymentWebhookBody): void {
    if (input.provider !== 'mock') {
      throw new PaymentServiceError('Unsupported webhook provider', 400, 'INVALID_WEBHOOK_EVENT')
    }
    if (!VALID_EVENTS.has(input.eventType)) {
      throw new PaymentServiceError('Invalid webhook event type', 400, 'INVALID_WEBHOOK_EVENT')
    }
    if (!input.providerRef.trim()) {
      throw new PaymentServiceError('Provider reference is required', 400, 'INVALID_WEBHOOK_EVENT')
    }
  }

  private getIdempotentResult(
    status: PaymentStatus,
    eventType: PaymentWebhookBody['eventType'],
  ): PaymentWebhookResponse | null {
    if (status === 'SUCCEEDED' && eventType === 'payment.paid') {
      return { ok: true, code: 'PAYMENT_ALREADY_PAID' }
    }
    if (status === 'FAILED' && eventType === 'payment.failed') {
      return { ok: true, code: 'PAYMENT_ALREADY_FAILED' }
    }
    if (status === 'CANCELED' && eventType === 'payment.expired') {
      return { ok: true, code: 'PAYMENT_ALREADY_EXPIRED' }
    }
    return null
  }

  private assertAllowedTransition(status: PaymentStatus, eventType: PaymentWebhookBody['eventType']): void {
    if (status === 'PENDING' || status === 'REQUIRES_ACTION') return
    if (status === 'SUCCEEDED' && eventType !== 'payment.paid') {
      throw new PaymentServiceError('Paid payment cannot be failed or expired', 409, 'PAYMENT_STATE_CONFLICT')
    }
    throw new PaymentServiceError('Payment is already in a terminal state', 409, 'PAYMENT_STATE_CONFLICT')
  }

  private getActiveReservations(payment: PaymentWithOrder): ReleaseReservationInput[] {
    return payment.order.checkout.inventoryReservations
      .filter((reservation) => reservation.status === 'ACTIVE')
      .map((reservation) => ({
        reservationId: reservation.id,
        variantId: reservation.variantId,
        quantity: reservation.quantity,
      }))
  }

  private async invalidateOrderAffectedCaches(payment: PaymentWithOrder): Promise<void> {
    const cacheInvalidation = this.cacheInvalidation
    if (!cacheInvalidation) return
    await cacheInvalidation.invalidateInventory()
    await Promise.all(
      [...new Set(payment.order.items.map((item) => item.shopId))]
        .map((shopId) => cacheInvalidation.invalidateSellerDashboard(shopId)),
    )
  }

  private async publishBestEffort(eventName: 'order.paid', orderId: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName,
        aggregateType: 'order',
        aggregateId: orderId,
        data,
      })
    } catch (error) {
      this.logger.warn('PaymentService event publish failed', {
        eventName,
        orderId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
