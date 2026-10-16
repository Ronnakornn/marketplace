import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FulfillmentStatus, PaymentStatus, ReturnStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IReturnRepository, ReturnRecord } from './return.repository.ts'
import { ReturnService } from './return.service.ts'
import { listPageResult } from '#server/lib/list-page.ts'

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

function createRepoMock(): IReturnRepository {
  return {
    transaction: vi.fn(async (callback) => callback(repo)),
    lockOrder: vi.fn(),
    findReturnOrderId: vi.fn(),
    findReturnSettlementState: vi.fn(),
    findOrderItemForReturn: vi.fn(),
    findUploadsByIds: vi.fn(),
    createReturn: vi.fn(),
    findBuyerReturns: vi.fn(),
    findBuyerReturnById: vi.fn(),
    findSellerShops: vi.fn(),
    findSellerReturns: vi.fn(),
    findSellerReturnById: vi.fn(),
    updateReturnStatus: vi.fn(),
    createPendingRefundForReturn: vi.fn(),
  }
}

function createActor(role: Role = 'USER', id = role === 'ADMIN' ? 'admin-1' : 'user-1') {
  return {
    id,
    role,
  }
}

function sellerActor() {
  return createActor('USER', 'seller-1')
}

const now = new Date('2026-05-13T00:00:00.000Z')

function createOrderItem(overrides: Partial<{
  userId: string
  shopId: string
  fulfillmentStatus: FulfillmentStatus
  lineTotal: bigint
  returnStatus: ReturnStatus
}> = {}): any {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    orderId: '11111111-1111-4111-8111-111111111111',
    shopId: overrides.shopId ?? 'shop-1',
    variantId: '33333333-3333-4333-8333-333333333333',
    productTitle: 'Cotton Tee',
    productSlug: 'cotton-tee',
    variantTitle: 'Black / M',
    variantSku: 'TEE-BLK-M',
    shopName: 'Shop One',
    shopSlug: 'shop-one',
    quantity: 2,
    unitPrice: 1200n,
    lineTotal: overrides.lineTotal ?? 2400,
    currency: 'USD',
    fulfillmentStatus: overrides.fulfillmentStatus ?? 'DELIVERED',
    order: {
      id: '11111111-1111-4111-8111-111111111111',
      checkoutId: '44444444-4444-4444-8444-444444444444',
      userId: overrides.userId ?? 'user-1',
      orderNumber: 'ORD-1',
      status: 'DELIVERED',
      paymentStatus: 'SUCCEEDED',
      subtotal: 2400n,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 2900n,
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
      payments: [createPayment()],
      refunds: [],
      items: [{ shopId: overrides.shopId ?? 'shop-1', fulfillmentStatus: 'DELIVERED' }],
      shipments: [{ shopId: overrides.shopId ?? 'shop-1', status: 'DELIVERED', deliveredAt: now }],
    },
    returnItems: overrides.returnStatus ? [{
      id: '55555555-5555-4555-8555-555555555555',
      returnRequestId: '66666666-6666-4666-8666-666666666666',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      quantity: 2,
      condition: null,
      returnRequest: {
        id: '66666666-6666-4666-8666-666666666666',
        status: overrides.returnStatus,
      },
    }] : [],
  }
}

function createPayment(status: PaymentStatus = 'SUCCEEDED'): any {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    orderId: '11111111-1111-4111-8111-111111111111',
    provider: 'mock',
    providerIntentId: 'pi_1',
    status,
    amount: 2900,
    currency: 'USD',
    paidAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

function createReturnRecord(overrides: Partial<{
  status: ReturnStatus
  shopId: string
  lineTotal: bigint
  refunds: ReturnRecord['refunds']
}> = {}): any {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    orderId: '11111111-1111-4111-8111-111111111111',
    userId: 'user-1',
    status: overrides.status ?? 'REQUESTED',
    reason: 'Damaged',
    description: 'Box was crushed',
    images: ['https://example.com/a.jpg'],
    createdAt: now,
    updatedAt: now,
    order: createOrderItem({ shopId: overrides.shopId, lineTotal: overrides.lineTotal }).order,
    items: [{
      id: '55555555-5555-4555-8555-555555555555',
      returnRequestId: '66666666-6666-4666-8666-666666666666',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      quantity: 2,
      condition: null,
      orderItem: createOrderItem({ shopId: overrides.shopId, lineTotal: overrides.lineTotal }),
    }],
    refunds: overrides.refunds ?? [],
  }
}

function createRefund(amount = 2400): any {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    orderId: '11111111-1111-4111-8111-111111111111',
    paymentId: '77777777-7777-4777-8777-777777777777',
    returnRequestId: '66666666-6666-4666-8666-666666666666',
    status: 'PENDING' as const,
    amount,
    reason: 'Damaged',
    createdAt: now,
    updatedAt: now,
  }
}

let repo: IReturnRepository
let service: ReturnService
let eventPublisher: { publish: ReturnType<typeof vi.fn> }

function setup() {
  repo = createRepoMock()
  eventPublisher = { publish: vi.fn().mockResolvedValue(undefined) }
  service = new ReturnService(createAppContext(), repo, undefined, eventPublisher as any)
  vi.mocked(repo.findReturnOrderId).mockResolvedValue('11111111-1111-4111-8111-111111111111')
  vi.mocked(repo.findReturnSettlementState).mockResolvedValue(null)
  vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(createOrderItem())
  vi.mocked(repo.findUploadsByIds).mockResolvedValue([])
  vi.mocked(repo.createReturn).mockResolvedValue(createReturnRecord())
  vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
  vi.mocked(repo.findSellerReturns).mockResolvedValue(listPageResult([createReturnRecord()], 1, {}))
  vi.mocked(repo.findSellerReturnById).mockResolvedValue(createReturnRecord())
  vi.mocked(repo.updateReturnStatus).mockImplementation(async (_id, status) => createReturnRecord({ status }))
  vi.mocked(repo.createPendingRefundForReturn).mockImplementation(async (returnRecord) =>
    createRefund(Number(returnRecord.items[0]!.orderItem.lineTotal)))
}

describe('ReturnService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    setup()
  })

  afterEach(() => vi.restoreAllMocks())

  const input = {
    orderId: '11111111-1111-4111-8111-111111111111',
    orderItemId: '22222222-2222-4222-8222-222222222222',
    reason: 'Damaged',
  }

  it('accepts a request exactly seven days after complete delivery', async () => {
    vi.mocked(Date.now).mockReturnValue(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    await expect(service.createReturn(createActor(), input)).resolves.toMatchObject({ status: 'requested' })
  })

  it('rejects one millisecond after the seven-day deadline without creating or publishing', async () => {
    vi.mocked(Date.now).mockReturnValue(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 1)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'RETURN_WINDOW_EXPIRED', status: 409 })
    expect(repo.createReturn).not.toHaveBeenCalled()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it('starts the window when the last active shop delivery completes', async () => {
    const item = createOrderItem()
    item.order.items.push({ shopId: 'shop-2', fulfillmentStatus: 'DELIVERED' })
    item.order.shipments[0].deliveredAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    item.order.shipments.push({ shopId: 'shop-2', status: 'DELIVERED', deliveredAt: now })
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).resolves.toMatchObject({ status: 'requested' })
  })

  it('waits for all shops even when the requested item is delivered', async () => {
    const item = createOrderItem()
    item.order.status = 'PARTIALLY_FULFILLED'
    item.order.items.push({ shopId: 'shop-2', fulfillmentStatus: 'SHIPPED' })
    item.order.shipments.push({ shopId: 'shop-2', status: 'SHIPPED', deliveredAt: null })
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'ORDER_NOT_DELIVERED' })
    expect(repo.createReturn).not.toHaveBeenCalled()
  })

  it('does not use a stale fully-delivered parent status when one active shipment is still shipped', async () => {
    const item = createOrderItem()
    item.order.shipments[0].status = 'SHIPPED'
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'ORDER_NOT_DELIVERED' })
  })

  it('excludes cancelled shops and shipments from complete delivery', async () => {
    const item = createOrderItem()
    item.order.items.push({ shopId: 'shop-2', fulfillmentStatus: 'CANCELED' })
    item.order.shipments.push({ shopId: 'shop-2', status: 'CANCELED', deliveredAt: null })
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).resolves.toMatchObject({ status: 'requested' })
  })

  it.each(['absent shipments', 'missing timestamp', 'future timestamp', 'invalid timestamp', 'missing shop'])('fails closed with %s delivery evidence', async (missing) => {
    const item = createOrderItem()
    if (missing === 'absent shipments') item.order.shipments = []
    if (missing === 'missing timestamp') item.order.shipments[0].deliveredAt = null
    if (missing === 'future timestamp') item.order.shipments[0].deliveredAt = new Date(now.getTime() + 1)
    if (missing === 'invalid timestamp') item.order.shipments[0].deliveredAt = new Date(Number.NaN)
    if (missing === 'missing shop') item.order.items.push({ shopId: 'shop-2', fulfillmentStatus: 'DELIVERED' })
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'RETURN_DELIVERY_EVIDENCE_MISSING' })
    expect(repo.createReturn).not.toHaveBeenCalled()
  })

  it('uses the configured return window captured on construction', async () => {
    service = new ReturnService(createAppContext(), repo, undefined, eventPublisher as any, { windowDays: 2 })
    vi.mocked(Date.now).mockReturnValue(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 1)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'RETURN_WINDOW_EXPIRED' })
  })

  it('checks ownership before returning delivery eligibility details', async () => {
    const item = createOrderItem({ userId: 'another-buyer' })
    item.order.shipments = []
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(item)
    await expect(service.createReturn(createActor(), input)).rejects.toMatchObject({ code: 'RETURN_FORBIDDEN' })
  })

  it('lets a buyer request a return for a delivered order item', async () => {
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([{
      id: '77777777-7777-4777-8777-777777777777',
      userId: 'user-1',
      usage: 'REVIEW_IMAGE',
      status: 'COMPLETED',
      contentType: 'image/jpeg',
      publicUrl: '/uploads/review_image/user-1/a.jpg',
    }] as any)
    const result = await service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: ' Damaged ',
      description: ' Box was crushed ',
      uploadIds: ['77777777-7777-4777-8777-777777777777'],
    })

    expect(result).toMatchObject({ status: 'requested', reason: 'Damaged' })
    expect(repo.createReturn).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'Damaged',
      description: 'Box was crushed',
      images: ['/uploads/review_image/user-1/a.jpg'],
      quantity: 2,
    }))
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'return.requested', aggregateId: '66666666-6666-4666-8666-666666666666',
    }))
  })

  it('accepts only completed buyer-owned evidence uploads', async () => {
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([{
      id: '77777777-7777-4777-8777-777777777777',
      userId: 'user-1',
      usage: 'REVIEW_IMAGE',
      status: 'COMPLETED',
      contentType: 'image/jpeg',
      publicUrl: '/uploads/review_image/user-1/a.jpg',
    }] as any)

    await service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: 'Damaged',
      uploadIds: ['77777777-7777-4777-8777-777777777777'],
    })

    expect(repo.createReturn).toHaveBeenCalledWith(expect.objectContaining({
      images: ['/uploads/review_image/user-1/a.jpg'],
    }))
  })

  it('rejects undelivered order items and another buyer order item', async () => {
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValueOnce(createOrderItem({ fulfillmentStatus: 'SHIPPED' }))
    await expect(service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: 'Damaged',
    })).rejects.toMatchObject({ code: 'ORDER_ITEM_NOT_DELIVERED' })

    vi.mocked(repo.findOrderItemForReturn).mockResolvedValueOnce(createOrderItem({ userId: 'other-user' }))
    await expect(service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: 'Damaged',
    })).rejects.toMatchObject({ code: 'RETURN_FORBIDDEN' })
  })

  it('rejects duplicate active returns', async () => {
    vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(createOrderItem({ returnStatus: 'REQUESTED' }))

    await expect(service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: 'Damaged',
    })).rejects.toMatchObject({ code: 'RETURN_ALREADY_EXISTS' })
  })

  it('lets sellers view only own shop returns', async () => {
    vi.mocked(repo.findSellerReturns).mockResolvedValue(listPageResult([
      createReturnRecord({ shopId: 'shop-1' }),
      createReturnRecord({ shopId: 'shop-2' }),
    ], 2, {}))

    const results = await service.listSellerReturns(sellerActor())

    expect(repo.findSellerReturns).toHaveBeenCalledWith(['shop-1'], { q: undefined, status: undefined })
    expect(results.data).toHaveLength(2)
    expect(results.data[0]!.items).toHaveLength(1)
    expect(results.data[1]!.items).toHaveLength(0)
  })

  it('preserves exact return amounts and whole-scope counts on a later buyer page', async () => {
    vi.mocked(repo.findBuyerReturns).mockResolvedValue(listPageResult([createReturnRecord({ lineTotal: 9007199254740993n })], 61, { page: 4, limit: 20 }))
    const result = await service.listBuyerReturns(createActor(), { page: 4, limit: 20, q: '  cotton  ', status: 'completed' })
    expect(repo.findBuyerReturns).toHaveBeenCalledWith('user-1', { page: 4, limit: 20, q: 'cotton', status: 'COMPLETED' })
    expect(result.meta).toEqual({ page: 4, limit: 20, totalCount: 61, totalPages: 4, hasNextPage: false, hasPreviousPage: true })
    expect(result.data[0]?.items[0]?.lineTotal).toBe(9007199254740993n)
  })

  it('does not broaden the authorized seller shops when a foreign shop filter is supplied', async () => {
    vi.mocked(repo.findSellerReturns).mockResolvedValue(listPageResult([], 0, {}))
    const result = await service.listSellerReturns(sellerActor(), { shopId: 'foreign-shop' })
    expect(repo.findSellerReturns).toHaveBeenCalledWith([], { shopId: 'foreign-shop', q: undefined, status: undefined })
    expect(result.data).toEqual([])
  })

  it('rejects invalid return list status before reading records', async () => {
    await expect(service.listBuyerReturns(createActor(), { status: 'invalid' })).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(repo.findBuyerReturns).not.toHaveBeenCalled()
  })

  it('returns not found when seller cannot access another shop return', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValue(null)

    await expect(service.getSellerReturn(sellerActor(), 'return-1')).rejects.toMatchObject({ code: 'RETURN_NOT_FOUND' })
  })

  it('lets sellers approve returns and creates a pending refund with server-side amount', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValue(createReturnRecord({ lineTotal: 1999n }))
    vi.mocked(repo.updateReturnStatus).mockResolvedValue(createReturnRecord({ status: 'APPROVED', lineTotal: 1999n }))

    const result = await service.approveSellerReturn(sellerActor(), 'return-1')

    expect(repo.updateReturnStatus).toHaveBeenCalledWith('66666666-6666-4666-8666-666666666666', 'APPROVED')
    expect(repo.createPendingRefundForReturn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'APPROVED',
    }))
    expect(result.refund).toMatchObject({ status: 'pending', amount: 1999n })
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'return.approved', aggregateId: '66666666-6666-4666-8666-666666666666',
    }))
  })

  it('lets sellers reject requested returns', async () => {
    const result = await service.rejectSellerReturn(sellerActor(), 'return-1')

    expect(repo.updateReturnStatus).toHaveBeenCalledWith('66666666-6666-4666-8666-666666666666', 'REJECTED')
    expect(result.status).toBe('rejected')
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'return.rejected' }))
  })

  it('rejects invalid return transitions and rolls back repository failures', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValueOnce(createReturnRecord({ status: 'APPROVED' }))
    await expect(service.rejectSellerReturn(sellerActor(), 'return-1')).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })

    vi.mocked(repo.findSellerReturnById).mockResolvedValueOnce(createReturnRecord())
    vi.mocked(repo.createPendingRefundForReturn).mockRejectedValueOnce(new Error('rollback'))
    await expect(service.approveSellerReturn(sellerActor(), 'return-1')).rejects.toThrow('rollback')
    expect(repo.transaction).toHaveBeenCalled()
    expect(eventPublisher.publish).not.toHaveBeenCalled()
  })

  it.each([0, -1, 0.5, 2147483648])('rejects invalid quantities before creating a Return: %s', async quantity => {
    await expect(service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222', quantity, reason: 'Damaged',
    })).rejects.toMatchObject({ code: 'INVALID_RETURN_QUANTITY' })
    expect(repo.createReturn).not.toHaveBeenCalled()
  })

  it('rejects a partial legacy quantity without original settlement evidence', async () => {
    await expect(service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222', quantity: 1, reason: 'Damaged',
    })).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(repo.createReturn).not.toHaveBeenCalled()
  })

  it('does not approve a Return without a successful payment', async () => {
    const data = createReturnRecord()
    data.order.payments = [createPayment('FAILED')]
    vi.mocked(repo.findSellerReturnById).mockResolvedValue(data)
    await expect(service.approveSellerReturn(sellerActor(), data.id)).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(repo.updateReturnStatus).not.toHaveBeenCalled()
    expect(repo.createPendingRefundForReturn).not.toHaveBeenCalled()
  })

})
