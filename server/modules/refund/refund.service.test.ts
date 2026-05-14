import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefundStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { IRefundRepository, RefundRecord } from './refund.repository.ts'
import { RefundService } from './refund.service.ts'

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

function createRepoMock(): IRefundRepository {
  return {
    listRefunds: vi.fn(),
    findRefundById: vi.fn(),
    updateRefundStatus: vi.fn(),
  }
}

function createActor(role: Role = 'ADMIN') {
  return {
    id: `${role.toLowerCase()}-1`,
    role,
  }
}

const now = new Date('2026-05-13T00:00:00.000Z')

function createRefund(status: RefundStatus = 'PENDING'): RefundRecord {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    orderId: '11111111-1111-4111-8111-111111111111',
    paymentId: '77777777-7777-4777-8777-777777777777',
    returnRequestId: '66666666-6666-4666-8666-666666666666',
    status,
    amountCents: 2400,
    reason: 'Damaged',
    createdAt: now,
    updatedAt: now,
    order: {
      id: '11111111-1111-4111-8111-111111111111',
      checkoutId: '44444444-4444-4444-8444-444444444444',
      userId: 'user-1',
      orderNumber: 'ORD-1',
      status: 'DELIVERED',
      paymentStatus: 'SUCCEEDED',
      subtotalCents: 2400,
      discountTotalCents: 0,
      shippingTotalCents: 500,
      taxTotalCents: 0,
      grandTotalCents: 2900,
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
    },
    payment: {
      id: '77777777-7777-4777-8777-777777777777',
      orderId: '11111111-1111-4111-8111-111111111111',
      provider: 'mock',
      providerIntentId: 'pi_1',
      status: 'SUCCEEDED',
      amountCents: 2900,
      currency: 'USD',
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    },
  }
}

let repo: IRefundRepository
let service: RefundService

describe('RefundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new RefundService(createAppContext(), repo)
    vi.mocked(repo.listRefunds).mockResolvedValue([createRefund()])
    vi.mocked(repo.findRefundById).mockResolvedValue(createRefund())
    vi.mocked(repo.updateRefundStatus).mockImplementation(async (_id, status) => createRefund(status))
  })

  it('lists admin refunds and blocks non-admin users', async () => {
    await expect(service.listAdminRefunds(createActor())).resolves.toHaveLength(1)
    await expect(service.listAdminRefunds(createActor('USER'))).rejects.toMatchObject({ code: 'REFUND_FORBIDDEN' })
  })

  it('marks a pending refund as processing', async () => {
    const result = await service.processAdminRefund(createActor(), 'refund-1', 'processing')

    expect(repo.updateRefundStatus).toHaveBeenCalledWith('88888888-8888-4888-8888-888888888888', 'PROCESSING')
    expect(result.status).toBe('processing')
  })

  it('marks a processing refund as success', async () => {
    vi.mocked(repo.findRefundById).mockResolvedValue(createRefund('PROCESSING'))

    const result = await service.processAdminRefund(createActor(), 'refund-1', 'success')

    expect(repo.updateRefundStatus).toHaveBeenCalledWith('88888888-8888-4888-8888-888888888888', 'SUCCESS')
    expect(result.status).toBe('success')
  })

  it('rejects invalid refund transitions', async () => {
    await expect(service.processAdminRefund(createActor(), 'refund-1', 'success')).rejects.toMatchObject({
      code: 'INVALID_REFUND_STATE',
    })

    vi.mocked(repo.findRefundById).mockResolvedValue(createRefund('SUCCESS'))
    await expect(service.processAdminRefund(createActor(), 'refund-1', 'processing')).rejects.toMatchObject({
      code: 'INVALID_REFUND_STATE',
    })
  })
})
