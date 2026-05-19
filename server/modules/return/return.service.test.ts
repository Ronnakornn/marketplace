import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FulfillmentStatus, PaymentStatus, ReturnStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IReturnRepository, ReturnOrderItem, ReturnRecord } from './return.repository.ts'
import { ReturnService } from './return.service.ts'

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
    findOrderItemForReturn: vi.fn(),
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
  lineTotal: number
  returnStatus: ReturnStatus
}> = {}): ReturnOrderItem {
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
    unitPrice: 1200,
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
      subtotal: 2400,
      discountTotal: 0,
      shippingTotal: 500,
      taxTotal: 0,
      grandTotal: 2900,
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

function createPayment(status: PaymentStatus = 'SUCCEEDED') {
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
  lineTotal: number
  refunds: ReturnRecord['refunds']
}> = {}): ReturnRecord {
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

function createRefund(amount = 2400) {
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

function setup() {
  repo = createRepoMock()
  service = new ReturnService(createAppContext(), repo)
  vi.mocked(repo.findOrderItemForReturn).mockResolvedValue(createOrderItem())
  vi.mocked(repo.createReturn).mockResolvedValue(createReturnRecord())
  vi.mocked(repo.findSellerShops).mockResolvedValue([{ id: 'shop-1' }])
  vi.mocked(repo.findSellerReturns).mockResolvedValue([createReturnRecord()])
  vi.mocked(repo.findSellerReturnById).mockResolvedValue(createReturnRecord())
  vi.mocked(repo.updateReturnStatus).mockImplementation(async (_id, status) => createReturnRecord({ status }))
  vi.mocked(repo.createPendingRefundForReturn).mockImplementation(async (returnRecord) =>
    createRefund(returnRecord.items[0]!.orderItem.lineTotal))
}

describe('ReturnService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('lets a buyer request a return for a delivered order item', async () => {
    const result = await service.createReturn(createActor(), {
      orderId: '11111111-1111-4111-8111-111111111111',
      orderItemId: '22222222-2222-4222-8222-222222222222',
      reason: ' Damaged ',
      description: ' Box was crushed ',
      images: [' https://example.com/a.jpg '],
    })

    expect(result).toMatchObject({ status: 'requested', reason: 'Damaged' })
    expect(repo.createReturn).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'Damaged',
      description: 'Box was crushed',
      images: ['https://example.com/a.jpg'],
      quantity: 2,
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
    vi.mocked(repo.findSellerReturns).mockResolvedValue([
      createReturnRecord({ shopId: 'shop-1' }),
      createReturnRecord({ shopId: 'shop-2' }),
    ])

    const results = await service.listSellerReturns(sellerActor())

    expect(repo.findSellerReturns).toHaveBeenCalledWith(['shop-1'])
    expect(results).toHaveLength(2)
    expect(results[0]!.items).toHaveLength(1)
    expect(results[1]!.items).toHaveLength(0)
  })

  it('returns not found when seller cannot access another shop return', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValue(null)

    await expect(service.getSellerReturn(sellerActor(), 'return-1')).rejects.toMatchObject({ code: 'RETURN_NOT_FOUND' })
  })

  it('lets sellers approve returns and creates a pending refund with server-side amount', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValue(createReturnRecord({ lineTotal: 1999 }))
    vi.mocked(repo.updateReturnStatus).mockResolvedValue(createReturnRecord({ status: 'APPROVED', lineTotal: 1999 }))

    const result = await service.approveSellerReturn(sellerActor(), 'return-1')

    expect(repo.updateReturnStatus).toHaveBeenCalledWith('66666666-6666-4666-8666-666666666666', 'APPROVED')
    expect(repo.createPendingRefundForReturn).toHaveBeenCalledWith(expect.objectContaining({
      status: 'APPROVED',
    }))
    expect(result.refund).toMatchObject({ status: 'pending', amount: 1999 })
  })

  it('lets sellers reject requested returns', async () => {
    const result = await service.rejectSellerReturn(sellerActor(), 'return-1')

    expect(repo.updateReturnStatus).toHaveBeenCalledWith('66666666-6666-4666-8666-666666666666', 'REJECTED')
    expect(result.status).toBe('rejected')
  })

  it('rejects invalid return transitions and rolls back repository failures', async () => {
    vi.mocked(repo.findSellerReturnById).mockResolvedValueOnce(createReturnRecord({ status: 'APPROVED' }))
    await expect(service.rejectSellerReturn(sellerActor(), 'return-1')).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })

    vi.mocked(repo.findSellerReturnById).mockResolvedValueOnce(createReturnRecord())
    vi.mocked(repo.createPendingRefundForReturn).mockRejectedValueOnce(new Error('rollback'))
    await expect(service.approveSellerReturn(sellerActor(), 'return-1')).rejects.toThrow('rollback')
    expect(repo.transaction).toHaveBeenCalled()
  })
})
