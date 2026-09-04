import { describe, expect, it, vi } from 'vitest'
import type { PaymentSettlementContext } from './payment.repository.ts'
import { PaymentSettlement, type PaymentSettlementPayment } from './payment.settlement.ts'

describe('Payment settlement', () => {
  it('settles a verified paid payment through one transaction interface', async () => {
    const applyPaymentStateTransition = vi.fn().mockResolvedValue(undefined)
    const context: PaymentSettlementContext = {
      payment: { applyPaymentStateTransition },
      affiliate: {
        findAffiliateById: vi.fn(),
        findLatestAttributableClick: vi.fn(),
        findOrderForCommission: vi.fn(),
        findCommissionByOrderId: vi.fn(),
        createCommission: vi.fn(),
      },
      shipment: {
        findOrderForShipmentCreation: vi.fn(),
        createShipment: vi.fn(),
      },
    }
    const shipmentModule = {
      createShipmentsForPaidOrderWithRepo: vi.fn().mockResolvedValue([]),
    }
    const settlement = new PaymentSettlement(shipmentModule)
    const occurredAt = new Date('2026-09-04T10:00:00.000Z')
    const payment: PaymentSettlementPayment = {
      id: 'payment-1',
      orderId: 'order-1',
      order: {
        userId: 'buyer-1',
        checkoutId: 'checkout-1',
        checkout: {
          inventoryReservations: [{
            id: 'reservation-1',
            inventoryId: 'inventory-1',
            quantity: 2,
            status: 'ACTIVE',
          }],
        },
      },
    }

    await expect(settlement.settle(context, {
      payment,
      eventType: 'payment.paid',
      occurredAt,
    })).resolves.toEqual({ ok: true, code: 'PAYMENT_PAID' })

    expect(applyPaymentStateTransition).toHaveBeenCalledWith({
      paymentId: 'payment-1',
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      eventType: 'payment.paid',
      reservations: [{ reservationId: 'reservation-1', inventoryId: 'inventory-1', quantity: 2 }],
      occurredAt,
    })
    expect(shipmentModule.createShipmentsForPaidOrderWithRepo).toHaveBeenCalledWith(context.shipment, 'order-1')
  })
})
