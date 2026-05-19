import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentStatus } from '#generated/client/enums.ts'
import type { IPaymentRepository, PaymentWithOrder, ReleaseReservationInput } from './payment.repository.ts'
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

function createRepoMock(): IPaymentRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    findPayment: vi.fn(),
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
    markPaymentSucceeded: vi.fn(),
    markPaymentFailed: vi.fn(),
    markPaymentExpired: vi.fn(),
    markOrderPaid: vi.fn(),
    markOrderCanceled: vi.fn(),
    releaseReservations: vi.fn(),
  }
}

let repo: IPaymentRepository

const baseBody: PaymentWebhookBody = {
  provider: 'mock',
  providerRef: 'evt_1',
  eventType: 'payment.paid',
  paymentId: '14141414-1414-4141-8141-141414141414',
  orderId: '13131313-1313-4131-8131-131313131313',
  amount: 2900,
}

function createPayment(status: PaymentStatus = 'PENDING', overrides: Partial<PaymentWithOrder> = {}): PaymentWithOrder {
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
      checkoutId,
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
            variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
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
  vi.mocked(repo.findOrder).mockResolvedValue(payment?.order ?? null)
  vi.mocked(repo.findWebhookEvent).mockResolvedValue(null)
  vi.mocked(repo.createWebhookEvent).mockResolvedValue({} as never)
  vi.mocked(repo.markPaymentSucceeded).mockResolvedValue({} as never)
  vi.mocked(repo.markPaymentFailed).mockResolvedValue({} as never)
  vi.mocked(repo.markPaymentExpired).mockResolvedValue({} as never)
  vi.mocked(repo.markOrderPaid).mockResolvedValue({} as never)
  vi.mocked(repo.markOrderCanceled).mockResolvedValue({} as never)
  return new PaymentService(createAppContext(), repo, {
    createShipmentsForPaidOrderWithRepo: vi.fn().mockResolvedValue([]),
  } as never)
}

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles payment paid success and updates order to paid without decreasing stock on hand', async () => {
    const service = await setup()

    const result = await service.handleWebhook(baseBody)

    expect(result).toEqual({ ok: true, code: 'PAYMENT_PAID' })
    expect(repo.createWebhookEvent).toHaveBeenCalledWith(baseBody)
    expect(repo.markPaymentSucceeded).toHaveBeenCalledWith(baseBody.paymentId, expect.any(Date))
    expect(repo.markOrderPaid).toHaveBeenCalledWith(baseBody.orderId)
    expect(repo.releaseReservations).not.toHaveBeenCalled()
  })

  it('returns success for duplicate providerRef without duplicate effects', async () => {
    const service = await setup()
    vi.mocked(repo.findWebhookEvent).mockResolvedValue({ id: 'event-1' } as never)

    const result = await service.handleWebhook(baseBody)

    expect(result).toEqual({ ok: true, code: 'WEBHOOK_ALREADY_PROCESSED' })
    expect(repo.createWebhookEvent).not.toHaveBeenCalled()
    expect(repo.markPaymentSucceeded).not.toHaveBeenCalled()
    expect(repo.markOrderPaid).not.toHaveBeenCalled()
  })

  it('returns success when payment is already paid without changing data again', async () => {
    const service = await setup(createPayment('SUCCEEDED'))

    const result = await service.handleWebhook({ ...baseBody, providerRef: 'evt_2' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_ALREADY_PAID' })
    expect(repo.createWebhookEvent).toHaveBeenCalled()
    expect(repo.markPaymentSucceeded).not.toHaveBeenCalled()
    expect(repo.markOrderPaid).not.toHaveBeenCalled()
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
        variantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        quantity: 2,
      },
    ]
    expect(repo.releaseReservations).toHaveBeenCalledWith(expectedReservations)
    expect(repo.markPaymentFailed).toHaveBeenCalledWith(baseBody.paymentId)
    expect(repo.markOrderCanceled).toHaveBeenCalledWith(baseBody.orderId)
  })

  it('releases reserved stock and marks expired payment and order canceled', async () => {
    const service = await setup()

    const result = await service.handleWebhook({ ...baseBody, eventType: 'payment.expired' })

    expect(result).toEqual({ ok: true, code: 'PAYMENT_EXPIRED' })
    expect(repo.releaseReservations).toHaveBeenCalledOnce()
    expect(repo.markPaymentExpired).toHaveBeenCalledWith(baseBody.paymentId)
    expect(repo.markOrderCanceled).toHaveBeenCalledWith(baseBody.orderId)
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
    vi.mocked(repo.releaseReservations).mockRejectedValue(new Error('rollback marker'))

    await expect(service.handleWebhook({ ...baseBody, eventType: 'payment.failed' })).rejects.toThrow('rollback marker')
    expect(repo.markPaymentFailed).not.toHaveBeenCalled()
    expect(repo.markOrderCanceled).not.toHaveBeenCalled()
  })
})
