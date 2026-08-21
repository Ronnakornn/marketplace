import { describe, expect, it, vi } from 'vitest'
import { PrismaPaymentRepository } from './payment.repository.ts'

function createRepository() {
  const prisma = {
    payment: { update: vi.fn().mockResolvedValue({}) },
    order: { update: vi.fn().mockResolvedValue({}) },
    shopOrder: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    checkout: { update: vi.fn().mockResolvedValue({}) },
    inventoryReservation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    couponRedemption: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  const repository = new PrismaPaymentRepository({
    logger: {
      debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      fatal: vi.fn(), trace: vi.fn(), child: vi.fn(),
    },
    config: { environment: 'test' },
  } as never, prisma as never)

  return { prisma, repository }
}

describe('PrismaPaymentRepository.applyPaymentStateTransition', () => {
  it('keeps paid Payment and Order status synchronized', async () => {
    const { prisma, repository } = createRepository()
    const occurredAt = new Date('2026-08-08T00:00:00.000Z')

    await repository.applyPaymentStateTransition({
      paymentId: 'payment-1',
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      eventType: 'payment.paid',
      reservations: [{ reservationId: 'reservation-1', inventoryId: 'inventory-1', quantity: 2 }],
      occurredAt,
    })

    expect(prisma.inventoryReservation.updateMany).toHaveBeenCalledWith({
      where: { id: 'reservation-1', status: 'ACTIVE' },
      data: { status: 'COMMITTED', orderId: 'order-1' },
    })
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inventory-1',
        quantityOnHand: { gte: 2 },
        quantityReserved: { gte: 2 },
      },
      data: {
        quantityOnHand: { decrement: 2 },
        quantityReserved: { decrement: 2 },
        version: { increment: 1 },
      },
    })
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'SUCCEEDED', paidAt: occurredAt },
    })
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'PAID', paymentStatus: 'SUCCEEDED' },
    })
    expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: 'RESERVED' },
      data: { status: 'REDEEMED', redeemedAt: occurredAt },
    })
  })

  it('releases reservations and synchronizes failed status', async () => {
    const { prisma, repository } = createRepository()

    await repository.applyPaymentStateTransition({
      paymentId: 'payment-1',
      orderId: 'order-1',
      checkoutId: 'checkout-1',
      eventType: 'payment.failed',
      reservations: [{ reservationId: 'reservation-1', inventoryId: 'inventory-1', quantity: 2 }],
      occurredAt: new Date(),
    })

    expect(prisma.inventory.updateMany).toHaveBeenCalledWith({
      where: { id: 'inventory-1', quantityReserved: { gte: 2 } },
      data: { quantityReserved: { decrement: 2 }, version: { increment: 1 } },
    })
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'FAILED' },
    })
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'CANCELED', paymentStatus: 'FAILED' },
    })
    expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: 'RESERVED' },
      data: { status: 'RELEASED' },
    })
  })
})
