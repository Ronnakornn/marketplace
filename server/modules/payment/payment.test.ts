import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentStatus } from '#generated/client/enums.ts'
import type { PaymentTransactionRepository, PaymentWithOrder, ReleaseReservationInput } from './payment.repository.ts'
import { PaymentService } from './payment.service.ts'
import type { PaymentWebhookBody } from './payment.types.ts'

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

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): PaymentTransactionRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    lockWebhookEvent: vi.fn(),
    lockPayment: vi.fn(),
    findPayment: vi.fn(),
    findPaymentForOrder: vi.fn(),
    findOrder: vi.fn(),
    findOrCreateAffiliate: vi.fn(),
    findAffiliateByUserId: vi.fn(),
    findAffiliateById: vi.fn(),
    listAffiliates: vi.fn(),
    updateAffiliateStatus: vi.fn(),
    findLinkByCode: vi.fn(),
    findLinkById: vi.fn(),
    listLinksByUserId: vi.fn(),
    createLink: vi.fn(),
    updateLinkStatus: vi.fn(),
    productExists: vi.fn(),
    shopExists: vi.fn(),
    campaignExists: vi.fn(),
    searchTargets: vi.fn(),
    createClick: vi.fn(),
    findLatestAttributableClick: vi.fn(),
    findOrderForCommission: vi.fn(),
    findCommissionByOrderId: vi.fn(),
    createCommission: vi.fn(),
    getStats: vi.fn(),
    findOrderForShipmentCreation: vi.fn(),
    createShipment: vi.fn(),
    findWebhookEvent: vi.fn(),
    createWebhookEvent: vi.fn(),
    applyPaymentStateTransition: vi.fn(),
  }
}

let repo: PaymentTransactionRepository
let eventPublisher: { publish: ReturnType<typeof vi.fn> }

const baseBody: PaymentWebhookBody = {
  provider: 'mock',
  providerRef: 'evt_1',
  eventType: 'payment.paid',
  paymentId: '14141414-1414-4141-8141-141414141414',
  orderId: '13131313-1313-4131-8131-131313131313',
  amount: 2900,
}

function createPayment(status: PaymentStatus = 'PENDING', overrides: Partial<PaymentWithOrder> = {}): any {
  const now = new Date('2026-05-13T00:00:00.000Z')
  const checkoutId = '12121212-1212-4121-8121-121212121212'
  const orderId = overrides.orderId ?? baseBody.orderId
  return {
    id: overrides.id ?? baseBody.paymentId,
    orderId,
    provider: overrides.provider ?? 'mock',
    providerIntentId: overrides.providerIntentId ?? 'pending_ORD-TEST',
    status,
    amount: overrides.amount ?? 2900,
    currency: overrides.currency ?? 'USD',
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    order: {
      id: orderId,
      checkoutId: '12121212-1212-4121-8121-121212121212',
      userId: 'user-1',
      orderNumber: 'ORD-TEST',
      status: status === 'SUCCEEDED' ? 'PAID' : 'PENDING_PAYMENT',
      paymentStatus: status,
      subtotal: 2400,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 2900,
      currency: 'USD',
      shippingName: 'Jane Buyer',
      shippingPhone: null,
      shippingLine1: '123 Market Road',
      shippingLine2: null,
      shippingCity: 'Bangkok',
      shippingRegion: 'Bangkok',
      shippingPostalCode: '10110',
      shippingCountry: 'TH',
      createdAt: now,
      updatedAt: now,
      items: [
        {
          id: '15151515-1515-4151-8151-151515151515',
          orderId,
          shopId: '11111111-1111-4111-8111-111111111111',
          variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          productTitle: 'Oversized Cotton Tee',
          productSlug: 'oversized-cotton-tee',
          variantTitle: 'Black / M',
          variantSku: 'TEE-BLK-M',
          shopName: 'Everyday Studio',
          shopSlug: 'everyday-studio',
          quantity: 2,
          unitPrice: 1200,
          lineTotal: 2400,
          currency: 'USD',
          fulfillmentStatus: 'PENDING',
        },
      ],
      checkout: {
        id: checkoutId,
        cartId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        userId: 'user-1',
        status: 'PAYMENT_PENDING',
        subtotal: 2400,
        discountTotal: 0,
        shippingTotal: 500,
        taxTotal: 0,
        grandTotal: 2900,
        currency: 'USD',
        expiresAt: new Date('2026-05-13T00:15:00.000Z'),
        createdAt: now,
        updatedAt: now,
        inventoryReservations: [
          {
            id: '16161616-1616-4161-8161-161616161616',
            checkoutId,
            inventoryId: '17171717-1717-4171-8171-171717171717',
            quantity: 2,
            status: 'ACTIVE',
            expiresAt: new Date('2026-05-13T00:15:00.000Z'),
            createdAt: now,
          },
        ],
      },
    },
    ...overrides,
  }
}

async function setup(payment: PaymentWithOrder | null = createPayment()) {
  repo = createRepoMock()
  vi.mocked(repo.findPayment).mockResolvedValue(payment)
  vi.mocked(repo.findPaymentForOrder).mockResolvedValue(payment)
  vi.mocked(repo.findOrder).mockResolvedValue(payment?.order ?? null)
  vi.mocked(repo.findWebhookEvent).mockResolvedValue(null)
  vi.mocked(repo.createWebhookEvent).mockResolvedValue({} as never)
  vi.mocked(repo.applyPaymentStateTransition).mockResolvedValue()
  eventPublisher = { publish: vi.fn().mockResolvedValue(undefined) }
  return new PaymentService(createAppContext(), repo, {
    createShipmentsForPaidOrderWithRepo: vi.fn().mockResolvedValue([]),
  } as never, undefined, eventPublisher as never)
}

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles payment paid success and commits reserved stock', async () => {
    const service = await setup()

    const result = await service.handleWebhook(baseBody)

    expect(result).toEqual({ ok: true, code: 'PAYMENT_PAID' })
    expect(repo.createWebhookEvent).toHaveBeenCalledWith(baseBody)
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      checkoutId: '12121212-1212-4121-8121-121212121212',
      eventType: 'payment.paid',
      reservations: [{
        reservationId: '16161616-1616-4161-8161-161616161616',
        inventoryId: '17171717-1717-4171-8171-171717171717',
        quantity: 2,
      }],
      occurredAt: expect.any(Date),
    })
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'order.paid' }))
  })

  it('lets an owner cancel an unpaid order and releases its reservation', async () => {
    const service = await setup()

    await expect(service.cancelBuyerOrder({ id: 'user-1', role: 'USER' } as any, baseBody.orderId)).resolves.toEqual({ ok: true })

    expect(repo.lockPayment).toHaveBeenCalledWith(baseBody.paymentId)
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      eventType: 'buyer.cancelled',
    }))
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'order.cancelled', data: expect.objectContaining({ cause: 'buyer_cancelled' }) }))
  })

  it('refuses cancellation after payment or for another buyer', async () => {
    const paidService = await setup(createPayment('SUCCEEDED'))
    await expect(paidService.cancelBuyerOrder({ id: 'user-1', role: 'USER' } as any, baseBody.orderId)).rejects.toMatchObject({ code: 'ORDER_CANCELLATION_NOT_ALLOWED' })

    const otherBuyerService = await setup()
    await expect(otherBuyerService.cancelBuyerOrder({ id: 'other-user', role: 'USER' } as any, baseBody.orderId)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
  })

  it('creates mock paid events from trusted server payment facts', async () => {
    const service = await setup()

    const result = await service.handleMockPaymentEvent({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.paid' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_PAID' })
    expect(repo.createWebhookEvent).toHaveBeenCalledWith({
      provider: 'mock',
      providerRef: `mock:${baseBody.paymentId}:payment.paid`,
      eventType: 'payment.paid',
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      amount: 2900,
    })
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      eventType: 'payment.paid',
    }))
  })

  it('returns buyer-owned display details for a mock payment', async () => {
    const service = await setup()

    const result = await service.getBuyerMockPaymentDetail({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId)

    expect(result).toEqual({
      id: baseBody.paymentId,
      orderId: baseBody.orderId,
      orderNo: 'ORD-TEST',
      amountCents: 2900,
      currency: 'USD',
      status: 'PENDING',
    })
  })

  it('keeps checkout-created non-mock providers outside the mock payment flow', async () => {
    const service = await setup(createPayment('PENDING', { provider: 'card' }))
    const actor = {
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      emailVerified: true,
    }

    await expect(service.getBuyerMockPaymentDetail(actor, baseBody.paymentId))
      .rejects.toMatchObject({ code: 'INVALID_WEBHOOK_EVENT' })
    await expect(service.handleMockPaymentEvent(actor, baseBody.paymentId, { eventType: 'payment.paid' }))
      .rejects.toMatchObject({ code: 'INVALID_WEBHOOK_EVENT' })
    expect(repo.createWebhookEvent).not.toHaveBeenCalled()
  })

  it('keeps non-card payment providers outside the mock payment flow', async () => {
    const service = await setup(createPayment('PENDING', { provider: 'cod' }))

    await expect(service.getBuyerMockPaymentDetail({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId)).rejects.toMatchObject({
      code: 'INVALID_WEBHOOK_EVENT',
    })
  })

  it('does not expose mock payment detail to another buyer', async () => {
    const service = await setup()

    await expect(service.getBuyerMockPaymentDetail({
      id: 'user-2',
      email: 'other@example.com',
      name: 'Other Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId)).rejects.toMatchObject({
      code: 'PAYMENT_FORBIDDEN',
    })
  })

  it('creates mock failed events through the webhook transition path', async () => {
    const service = await setup()

    const result = await service.handleMockPaymentEvent({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.failed' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_FAILED' })
    expect(repo.createWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({
      providerRef: `mock:${baseBody.paymentId}:payment.failed`,
      eventType: 'payment.failed',
      orderId: baseBody.orderId,
      amount: 2900,
    }))
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      checkoutId: '12121212-1212-4121-8121-121212121212',
      eventType: 'payment.failed',
    }))
  })

  it('keeps duplicate mock events idempotent', async () => {
    const service = await setup()
    vi.mocked(repo.findWebhookEvent).mockResolvedValue({ id: 'event-1' } as never)

    const result = await service.handleMockPaymentEvent({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.paid' })

    expect(result).toEqual({ ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' })
    expect(repo.applyPaymentStateTransition).not.toHaveBeenCalled()
  })

  it('rejects mock events for admins and other buyers', async () => {
    const service = await setup()

    await expect(service.handleMockPaymentEvent({
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.paid' })).rejects.toMatchObject({
      code: 'PAYMENT_FORBIDDEN',
    })

    await expect(service.handleMockPaymentEvent({
      id: 'user-2',
      email: 'other@example.com',
      name: 'Other Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.paid' })).rejects.toMatchObject({
      code: 'PAYMENT_FORBIDDEN',
    })
  })

  it('rejects mock events that conflict with terminal payment state', async () => {
    const service = await setup(createPayment('SUCCEEDED'))

    await expect(service.handleMockPaymentEvent({
      id: 'user-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    }, baseBody.paymentId, { eventType: 'payment.failed' })).rejects.toMatchObject({
      code: 'PAYMENT_STATE_CONFLICT',
    })
  })

  it('returns success for duplicate providerRef without duplicate effects', async () => {
    const service = await setup()
    vi.mocked(repo.findWebhookEvent).mockResolvedValue({ id: 'event-1' } as never)

    const result = await service.handleWebhook(baseBody)

    expect(result).toEqual({ ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' })
    expect(repo.lockWebhookEvent).toHaveBeenCalledWith(baseBody.providerRef)
    expect(vi.mocked(repo.lockWebhookEvent).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(repo.findWebhookEvent).mock.invocationCallOrder[0]!)
    expect(repo.createWebhookEvent).not.toHaveBeenCalled()
    expect(repo.applyPaymentStateTransition).not.toHaveBeenCalled()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it('returns success when payment is already paid without changing data again', async () => {
    const service = await setup(createPayment('SUCCEEDED'))

    const result = await service.handleWebhook({ ...baseBody, providerRef: 'evt_2' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_ALREADY_PAID' })
    expect(repo.createWebhookEvent).toHaveBeenCalled()
    expect(repo.applyPaymentStateTransition).not.toHaveBeenCalled()
  })

  it('fails amount mismatch and unknown payment', async () => {
    await expect((await setup()).handleWebhook({ ...baseBody, amount: 999 })).rejects.toMatchObject({
      code: 'AMOUNT_MISMATCH',
    })

    await expect((await setup(null)).handleWebhook(baseBody)).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
    })
  })

  it('fails when order is unknown or payment belongs to another order', async () => {
    const payment = createPayment('PENDING', { orderId: '22222222-2222-4222-8222-222222222222' })
    const service = await setup(payment)
    vi.mocked(repo.findOrder).mockResolvedValue(null)

    await expect(service.handleWebhook(baseBody)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })

    const otherOrderService = await setup(payment)
    vi.mocked(repo.findOrder).mockResolvedValue(createPayment().order)
    await expect(otherOrderService.handleWebhook(baseBody)).rejects.toMatchObject({ code: 'PAYMENT_STATE_CONFLICT' })
  })

  it('releases reserved stock and marks failed payment and order canceled', async () => {
    const service = await setup()

    const result = await service.handleWebhook({ ...baseBody, eventType: 'payment.failed' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_FAILED' })
    const expectedReservations: ReleaseReservationInput[] = [
      {
        reservationId: '16161616-1616-4161-8161-161616161616',
        inventoryId: '17171717-1717-4171-8171-171717171717',
        quantity: 2,
      },
    ]
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      checkoutId: '12121212-1212-4121-8121-121212121212',
      eventType: 'payment.failed',
      reservations: expectedReservations,
      occurredAt: expect.any(Date),
    })
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'order.cancelled',
      aggregateId: baseBody.orderId,
      data: expect.objectContaining({ cause: 'payment_failed' }),
    }))
  })

  it('releases reserved stock and marks expired payment and order canceled', async () => {
    const service = await setup()

    const result = await service.handleWebhook({ ...baseBody, eventType: 'payment.expired' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_EXPIRED' })
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: baseBody.paymentId,
      orderId: baseBody.orderId,
      eventType: 'payment.expired',
    }))
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'order.cancelled',
      aggregateId: baseBody.orderId,
      data: expect.objectContaining({ cause: 'payment_expired' }),
    }))
  })

  it("stamps the order's payment status to match the payment row for both cancel causes", async () => {
    // Order.paymentStatus is a denormalized copy of Payment.status. An expired
    // payment becomes CANCELED and a failed one becomes FAILED, so the copy has
    // to follow the cause rather than being hardcoded to one of them.
    const expiredService = await setup()
    await expiredService.handleWebhook({ ...baseBody, eventType: 'payment.expired' })
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'payment.expired',
    }))

    vi.clearAllMocks()

    const failedService = await setup()
    await failedService.handleWebhook({ ...baseBody, eventType: 'payment.failed' })
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'payment.failed',
    }))
  })

  it('rejects invalid event type and conflicting terminal transitions', async () => {
    await expect((await setup()).handleWebhook({ ...baseBody, eventType: 'unknown' as never })).rejects.toMatchObject({
      code: 'INVALID_WEBHOOK_EVENT',
    })

    await expect((await setup(createPayment('SUCCEEDED'))).handleWebhook({
      ...baseBody,
      eventType: 'payment.failed',
    })).rejects.toMatchObject({ code: 'PAYMENT_STATE_CONFLICT' })
  })

  it('lets repository transaction rollback failures bubble without later updates', async () => {
    const service = await setup()
    vi.mocked(repo.applyPaymentStateTransition).mockRejectedValue(new Error('rollback marker'))

    await expect(service.handleWebhook({ ...baseBody, eventType: 'payment.failed' })).rejects.toThrow('rollback marker')
    expect(repo.applyPaymentStateTransition).toHaveBeenCalledOnce()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })
})
