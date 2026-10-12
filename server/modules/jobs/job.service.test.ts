import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Checkout, InventoryReservation, Order } from '#generated/client/client.ts'
import type { PaymentStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { QueueProducer } from '#server/modules/queue'
import type { WalletService } from '#server/modules/wallet'
import type { IJobRepository } from './job.repository.ts'
import { JobService } from './job.service.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createQueueProducerMock(): QueueProducer {
  return {
    enqueue: vi.fn(async () => ({ id: 'job-1' })),
    close: vi.fn(async () => {}),
  }
}

function createRepoMock(): IJobRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    createNotification: vi.fn(async () => {}),
    findExpiredPendingPayments: vi.fn(),
    lockPaymentForExpiry: vi.fn(async () => {}),
    findPaymentForExpiry: vi.fn(),
    markPaymentExpired: vi.fn(async () => {}),
    markOrderCanceled: vi.fn(async () => {}),
    releaseCouponReservation: vi.fn(async () => {}),
    markCheckoutExpired: vi.fn(async () => {}),
    releaseReservations: vi.fn(async () => {}),
    cleanupAbandonedCarts: vi.fn(async () => 0),
  }
}

const now = new Date('2026-05-14T00:00:00.000Z')

function createReservation(overrides: Partial<InventoryReservation> = {}): any {
  return {
    id: overrides.id ?? 'reservation-1',
    checkoutId: overrides.checkoutId ?? 'checkout-1',
    inventoryId: overrides.inventoryId ?? 'inventory-1',
    quantity: overrides.quantity ?? 2,
    status: overrides.status ?? 'ACTIVE',
    expiresAt: overrides.expiresAt ?? now,
    createdAt: overrides.createdAt ?? now,
  }
}

function createExpiredPayment(status: PaymentStatus = 'PENDING'): any {
  const checkout: Checkout & { inventoryReservations: InventoryReservation[] } = {
    id: 'checkout-1',
    cartId: 'cart-1',
    userId: 'user-1',
    status: 'PAYMENT_PENDING',
    subtotal: BigInt(2000),
    discountTotal: BigInt(0),
    shippingTotal: BigInt(0),
    taxTotal: BigInt(0),
    includedTaxTotal: 0n,
    reportedTaxTotal: 0n,
    grandTotal: BigInt(2000),
    currency: 'USD',
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
    inventoryReservations: [
      createReservation(),
      createReservation({ id: 'reservation-2', status: 'RELEASED' }),
    ],
  }
  const order: Order & { checkout: Checkout & { inventoryReservations: InventoryReservation[] } } = {
    id: 'order-1',
    checkoutId: checkout.id,
    userId: 'user-1',
    orderNumber: 'ORD-1',
    status: 'PENDING_PAYMENT',
    paymentStatus: status,
    subtotal: BigInt(2000),
    discountTotal: BigInt(0),
    shippingTotal: BigInt(0),
    taxTotal: BigInt(0),
    includedTaxTotal: 0n,
    reportedTaxTotal: 0n,
    grandTotal: BigInt(2000),
    currency: 'USD',
    shippingName: 'Buyer',
    shippingPhone: null,
    shippingLine1: '123 Road',
    shippingLine2: null,
    shippingCity: 'Bangkok',
    shippingRegion: null,
    shippingPostalCode: '10110',
    shippingCountry: 'TH',
    createdAt: now,
    updatedAt: now,
    checkout,
  }
  return {
    id: 'payment-1',
    orderId: order.id,
    provider: 'mock',
    providerIntentId: 'pending_ORD-1',
    status,
    amount: BigInt(2000),
    currency: 'USD',
    paidAt: null,
    createdAt: new Date('2026-05-13T23:00:00.000Z'),
    updatedAt: now,
    order,
  }
}

let repo: IJobRepository
let queueProducer: QueueProducer
let service: JobService
let eventPublisher: { publish: ReturnType<typeof vi.fn> }

describe('JobService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    queueProducer = createQueueProducerMock()
    eventPublisher = { publish: vi.fn().mockResolvedValue(undefined) }
    service = new JobService(createAppContext(), repo, queueProducer, undefined, eventPublisher as never)
  })

  it('enqueues notification jobs', async () => {
    const result = await service.enqueue('send_notification', {
      userId: 'user-1',
      type: 'order_paid',
      title: 'Paid',
      body: 'Order paid',
    })

    expect(result).toEqual({ id: 'job-1' })
    expect(queueProducer.enqueue).toHaveBeenCalledWith('send_notification', expect.objectContaining({
      userId: 'user-1',
      type: 'order_paid',
    }))
  })

  it('processes notification jobs', async () => {
    const result = await service.process('send_notification', {
      userId: 'user-1',
      type: 'order_paid',
      title: ' Paid ',
      body: ' Done ',
      data: { orderId: 'order-1' },
    })

    expect(result).toEqual({ ok: true, code: 'NOTIFICATION_SENT', processedCount: 1 })
    expect(repo.createNotification).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'order_paid',
      title: 'Paid',
      body: 'Done',
      data: { orderId: 'order-1' },
    })
  })

  it('releases reserved stock for expired pending payments in a transaction', async () => {
    const payment = createExpiredPayment()
    vi.mocked(repo.findExpiredPendingPayments).mockResolvedValue([payment])
    vi.mocked(repo.findPaymentForExpiry).mockResolvedValue(payment)

    const result = await service.process('release_expired_payment_stock', {
      now: '2026-05-14T00:00:00.000Z',
      paymentTimeoutMinutes: 30,
    })

    expect(result).toEqual({ ok: true, code: 'EXPIRED_PAYMENTS_RELEASED', processedCount: 1 })
    expect(repo.transaction).toHaveBeenCalled()
    expect(repo.releaseReservations).toHaveBeenCalledWith([{
      reservationId: 'reservation-1',
      inventoryId: 'inventory-1',
      quantity: 2,
    }])
    expect(repo.markPaymentExpired).toHaveBeenCalledWith('payment-1')
    expect(repo.markOrderCanceled).toHaveBeenCalledWith('order-1')
    expect(repo.markCheckoutExpired).toHaveBeenCalledWith('checkout-1')
    expect(eventPublisher.publish).toHaveBeenCalledWith({
      eventName: 'order.cancelled',
      aggregateType: 'order',
      aggregateId: 'order-1',
      data: { orderId: 'order-1', paymentId: 'payment-1', cause: 'payment_expired' },
    })
  })

  it('is idempotent for already expired payments', async () => {
    const payment = createExpiredPayment('CANCELED')
    vi.mocked(repo.findExpiredPendingPayments).mockResolvedValue([payment])
    vi.mocked(repo.findPaymentForExpiry).mockResolvedValue(payment)

    const result = await service.process('release_expired_payment_stock', {
      now: '2026-05-14T00:00:00.000Z',
      paymentTimeoutMinutes: 30,
    })

    expect(result.processedCount).toBe(0)
    expect(repo.releaseReservations).not.toHaveBeenCalled()
    expect(repo.markPaymentExpired).not.toHaveBeenCalled()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it('cleans abandoned carts through repository criteria that ignore ordered carts', async () => {
    vi.mocked(repo.cleanupAbandonedCarts).mockResolvedValue(3)

    const result = await service.process('cleanup_abandoned_carts', {
      now: '2026-05-14T00:00:00.000Z',
      olderThanMinutes: 60,
    })

    expect(result).toEqual({ ok: true, code: 'ABANDONED_CARTS_CLEANED', processedCount: 3 })
    expect(repo.cleanupAbandonedCarts).toHaveBeenCalledWith(new Date('2026-05-13T23:00:00.000Z'))
  })

  it('fails invalid job payloads clearly', async () => {
    await expect(service.process('send_notification', {
      userId: '',
      type: 'order_paid',
      title: 'Paid',
    })).rejects.toMatchObject({ code: 'INVALID_JOB_PAYLOAD' })
  })

  it('delegates recurring earnings recovery and exposes the completed candidate counts', async () => {
    const wallets = { reconcileSellerEarnings: vi.fn().mockResolvedValue({ attemptedCount: 3, succeededCount: 3, failedCount: 0 }) }
    service = new JobService(createAppContext(), repo, queueProducer, undefined, undefined, undefined, wallets as unknown as WalletService)
    await expect(service.process('reconcile_seller_earnings', { limit: 25 })).resolves.toEqual({
      ok: true, code: 'SELLER_EARNINGS_RECONCILED', processedCount: 3, attemptedCount: 3, succeededCount: 3, failedCount: 0,
    })
    expect(wallets.reconcileSellerEarnings).toHaveBeenCalledWith(25)
  })

  it('fails recurring recovery visibly when wallet wiring is missing or some candidates remain incomplete', async () => {
    await expect(service.process('reconcile_seller_earnings', {})).rejects.toMatchObject({ code: 'JOB_FAILED', message: 'Wallet service is not configured' })
    const wallets = { reconcileSellerEarnings: vi.fn().mockResolvedValue({ attemptedCount: 3, succeededCount: 2, failedCount: 1 }) }
    service = new JobService(createAppContext(), repo, queueProducer, undefined, undefined, undefined, wallets as unknown as WalletService)
    await expect(service.process('reconcile_seller_earnings', {})).rejects.toMatchObject({
      code: 'JOB_FAILED', details: { attemptedCount: 3, succeededCount: 2, failedCount: 1 },
    })
  })

  it.each([0, -1, 1.5, 1001, '100'])('rejects invalid reconciliation page size %s', async (limit) => {
    await expect(service.process('reconcile_seller_earnings', { limit } as never)).rejects.toMatchObject({ code: 'INVALID_JOB_PAYLOAD' })
  })

  it('delegates report and payout schedulers with exact instants and fails missing wiring', async () => {
    const callbacks = { processDueSchedules: vi.fn(async () => ({ checked: 2 })), prepareDuePayouts: vi.fn(async () => ({ checked: 3 })) }
    service = new JobService(createAppContext(), repo, queueProducer, undefined, undefined, undefined, undefined, callbacks)
    await expect(service.process('process_admin_report_schedules', { now: '2026-10-14T08:00:00+07:00' })).resolves.toEqual({ ok: true, code: 'ADMIN_REPORT_SCHEDULES_PROCESSED' })
    await expect(service.process('prepare_admin_payouts', { now: '2026-10-14T01:00:00Z' })).resolves.toEqual({ ok: true, code: 'ADMIN_PAYOUTS_PREPARED' })
    expect(callbacks.processDueSchedules).toHaveBeenCalledWith(new Date('2026-10-14T01:00:00Z'))
    expect(callbacks.prepareDuePayouts).toHaveBeenCalledWith(new Date('2026-10-14T01:00:00Z'))
    await expect(service.process('prepare_admin_payouts', { now: '2026-10-14' })).rejects.toMatchObject({ code: 'INVALID_JOB_PAYLOAD' })
    service = new JobService(createAppContext(), repo, queueProducer)
    await expect(service.process('process_admin_report_schedules', {})).rejects.toMatchObject({ code: 'JOB_FAILED' })
  })

  it('sends queued notifications through the configured delivery owner', async () => {
    const notification = { createNotification: vi.fn(async () => ({ id: 'n', type: 'order_paid', title: 'Paid', createdAt: now })) }
    service = new JobService(createAppContext(), repo, queueProducer, undefined, undefined, undefined, undefined, undefined, notification)
    await service.process('send_notification', { userId: 'user-1', type: 'order_paid', title: 'Paid', body: 'Original text', data: { orderNo: 'ORD-1' } })
    expect(notification.createNotification).toHaveBeenCalledWith('user-1', 'order_paid', 'Paid', 'Original text', { orderNo: 'ORD-1' })
    expect(repo.createNotification).not.toHaveBeenCalled()
  })
})
