import { describe, expect, it, vi } from 'vitest'
import { PrismaPaymentRepository } from './payment.repository.ts'

function createRepository() {
  const prisma = {
    payment: { update: vi.fn().mockResolvedValue({}) },
    order: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null) },
    shopOrder: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    checkout: { update: vi.fn().mockResolvedValue({}) },
    inventoryReservation: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    inventory: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    couponRedemption: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    flashSaleReservation: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    flashSaleItem: { update: vi.fn().mockResolvedValue({}) },
    buyerCoinLedger: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
    buyerCoinWallet: { update: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({ id: 'wallet-1', balance: 0, debtBalance: 0 }) },
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

  it('commits flash-sale quota and settles coin spend and cashback after payment', async () => {
    const { prisma, repository } = createRepository()
    prisma.flashSaleReservation.findMany.mockResolvedValue([{ id: 'flash-reservation-1', flashSaleItemId: 'flash-item-1', quantity: 2 }])
    prisma.buyerCoinLedger.findMany.mockResolvedValue([{ id: 'spent-1', walletId: 'wallet-1', amount: 3 }])
    prisma.order.findUnique.mockResolvedValue({ userId: 'user-1', subtotal: 20_000, discountTotal: 0 })
    prisma.buyerCoinWallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 5, debtBalance: 0 })

    await repository.applyPaymentStateTransition({
      paymentId: 'payment-1', orderId: 'order-1', checkoutId: 'checkout-1', eventType: 'payment.paid', reservations: [],
      occurredAt: new Date('2026-08-08T00:00:00.000Z'),
    })

    expect(prisma.flashSaleReservation.updateMany).toHaveBeenCalledWith({
      where: { id: 'flash-reservation-1', status: 'ACTIVE' }, data: { status: 'COMMITTED' },
    })
    expect(prisma.flashSaleItem.update).toHaveBeenCalledWith({
      where: { id: 'flash-item-1' }, data: { soldCount: { increment: 2 } },
    })
    expect(prisma.buyerCoinLedger.update).toHaveBeenCalledWith({ where: { id: 'spent-1' }, data: { status: 'USED' } })
    expect(prisma.buyerCoinWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' }, data: { pendingBalance: { decrement: 3 }, lifetimeSpent: { increment: 3 } },
    })
    expect(prisma.buyerCoinLedger.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'EARNED', status: 'AVAILABLE', amount: 2, referenceType: 'ORDER_CASHBACK' }),
    }))
  })

  it('splits cashback between available coins and outstanding debt settlement', async () => {
    const { prisma, repository } = createRepository()
    prisma.order.findUnique.mockResolvedValue({ userId: 'user-1', subtotal: 50_000, discountTotal: 0 })
    prisma.buyerCoinWallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 8, debtBalance: 3 })
    prisma.buyerCoinWallet.update.mockResolvedValue({ id: 'wallet-1', balance: 5, debtBalance: 0 })

    await repository.applyPaymentStateTransition({
      paymentId: 'payment-1', orderId: 'order-1', checkoutId: 'checkout-1', eventType: 'payment.paid', reservations: [], occurredAt: new Date(),
    })

    expect(prisma.buyerCoinWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' }, data: { balance: { decrement: 3 }, debtBalance: { decrement: 3 }, version: { increment: 1 } },
    })
    expect(prisma.buyerCoinLedger.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ type: 'EARNED', status: 'AVAILABLE', amount: 2 }),
    }))
    expect(prisma.buyerCoinLedger.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ type: 'ADJUSTMENT', status: 'USED', amount: -3, referenceType: 'COIN_DEBT_SETTLEMENT' }),
    }))
  })

  it('releases reservations and synchronizes failed status', async () => {
    const { prisma, repository } = createRepository()
    prisma.buyerCoinLedger.findMany.mockResolvedValue([{ id: 'spent-1', walletId: 'wallet-1', amount: 4 }])

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
    expect(prisma.buyerCoinLedger.updateMany).toHaveBeenCalledWith({
      where: { id: 'spent-1', status: 'PENDING' }, data: { status: 'CANCELLED' },
    })
    expect(prisma.buyerCoinWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' }, data: { balance: { increment: 4 }, pendingBalance: { decrement: 4 } },
    })
  })

  it('marks checkout expired while releasing payment resources', async () => {
    const { prisma, repository } = createRepository()
    await repository.applyPaymentStateTransition({
      paymentId: 'payment-1', orderId: 'order-1', checkoutId: 'checkout-1', eventType: 'payment.expired', reservations: [], occurredAt: new Date(),
    })
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-1' }, data: { status: 'CANCELED' } })
    expect(prisma.checkout.update).toHaveBeenCalledWith({ where: { id: 'checkout-1' }, data: { status: 'EXPIRED' } })
    expect(prisma.flashSaleReservation.updateMany).toHaveBeenCalledWith({ where: { checkoutId: 'checkout-1', status: 'ACTIVE' }, data: { status: 'RELEASED' } })
  })
})
