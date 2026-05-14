import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefundStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { AdminServiceError } from './admin.errors.ts'
import type { AdminDashboardCounts, AdminRefundRecord, IAdminRepository } from './admin.repository.ts'
import { AdminService } from './admin.service.ts'

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

function createRepoMock(): IAdminRepository {
  return {
    getDashboardCounts: vi.fn(),
    listUsers: vi.fn(),
    findUserById: vi.fn(),
    updateUserStatus: vi.fn(),
    listShops: vi.fn(),
    findShopById: vi.fn(),
    updateShopStatus: vi.fn(),
    listProducts: vi.fn(),
    findProductById: vi.fn(),
    updateProductStatus: vi.fn(),
    listOrders: vi.fn(),
    findOrderById: vi.fn(),
    listRefunds: vi.fn(),
    findRefundById: vi.fn(),
    updateRefundStatus: vi.fn(),
  }
}

function actor(role: Role = 'ADMIN') {
  return { id: `${role.toLowerCase()}-1`, role }
}

const now = new Date('2026-05-13T00:00:00.000Z')

const dashboard: AdminDashboardCounts = {
  users: { total: 3, buyers: 1, sellers: 1 },
  shops: { total: 2, active: 1, suspended: 1 },
  products: { total: 3, active: 2, banned: 1 },
  orders: { total: 4, paid: 1, delivered: 1, cancelled: 1 },
  refunds: { pending: 1, success: 1, failed: 1 },
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'User',
    email: 'user@example.com',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as any
}

function shop(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shop-1',
    ownerId: 'seller-1',
    name: 'Shop',
    slug: 'shop',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    owner: user({ id: 'seller-1', role: 'SELLER' }),
    ...overrides,
  } as any
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    shopId: 'shop-1',
    title: 'Product',
    description: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    shop: { id: 'shop-1', name: 'Shop', slug: 'shop', status: 'ACTIVE' },
    variants: [],
    ...overrides,
  } as any
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1',
    userId: 'user-1',
    status: 'PAID',
    paymentStatus: 'SUCCEEDED',
    createdAt: now,
    updatedAt: now,
    items: [],
    payments: [],
    shipments: [],
    refunds: [],
    ...overrides,
  } as any
}

function refund(status: RefundStatus = 'PENDING'): AdminRefundRecord {
  return {
    id: 'refund-1',
    orderId: 'order-1',
    paymentId: 'payment-1',
    returnRequestId: 'return-1',
    status,
    amountCents: 1000,
    reason: 'Return',
    createdAt: now,
    updatedAt: now,
    order: { id: 'order-1', orderNumber: 'ORD-1', status: 'PAID', paymentStatus: 'SUCCEEDED', userId: 'user-1' },
    payment: { id: 'payment-1', provider: 'mock', status: 'PAID', amountCents: 1000, currency: 'USD' },
  } as any
}

describe('AdminService', () => {
  let repo: IAdminRepository
  let service: AdminService

  beforeEach(() => {
    repo = createRepoMock()
    service = new AdminService(createAppContext(), repo)
  })

  it('rejects buyer and seller actors', async () => {
    expect(() => service.getDashboard(actor('USER'))).toThrow(AdminServiceError)
    expect(() => service.getDashboard(actor('SELLER'))).toThrow(AdminServiceError)
  })

  it('returns dashboard counts including archived products as banned', async () => {
    vi.mocked(repo.getDashboardCounts).mockResolvedValue(dashboard)

    await expect(service.getDashboard(actor())).resolves.toEqual(dashboard)
    expect(repo.getDashboardCounts).toHaveBeenCalledOnce()
  })

  it('lists users with role/status filters and pagination metadata', async () => {
    vi.mocked(repo.listUsers).mockResolvedValue({ items: [user({ role: 'SELLER' })], total: 12 })

    const result = await service.listUsers(actor(), { role: 'SELLER', status: 'ACTIVE', page: 2, limit: 5 })

    expect(repo.listUsers).toHaveBeenCalledWith({ role: 'SELLER', status: 'ACTIVE' }, { page: 2, limit: 5 })
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 })
  })

  it('updates user status and validates not found and invalid status', async () => {
    vi.mocked(repo.findUserById).mockResolvedValueOnce(user())
    vi.mocked(repo.updateUserStatus).mockResolvedValue(user({ status: 'SUSPENDED' }))

    await expect(service.updateUserStatus(actor(), 'user-1', 'SUSPENDED')).resolves.toMatchObject({ status: 'SUSPENDED' })
    await expect(service.updateUserStatus(actor(), 'user-1', 'BANNED')).rejects.toMatchObject({ code: 'INVALID_STATUS' })

    vi.mocked(repo.findUserById).mockResolvedValueOnce(null)
    await expect(service.updateUserStatus(actor(), 'missing', 'ACTIVE')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('lists shops and updates shop status', async () => {
    vi.mocked(repo.listShops).mockResolvedValue({ items: [shop()], total: 1 })
    vi.mocked(repo.findShopById).mockResolvedValue(shop())
    vi.mocked(repo.updateShopStatus).mockResolvedValue(shop({ status: 'SUSPENDED' }))

    await service.listShops(actor(), { status: 'ACTIVE' })
    expect(repo.listShops).toHaveBeenCalledWith({ status: 'ACTIVE' }, { page: 1, limit: 20 })
    await expect(service.updateShopStatus(actor(), 'shop-1', 'SUSPENDED')).resolves.toMatchObject({ status: 'SUSPENDED' })
  })

  it('lists products and updates product status', async () => {
    vi.mocked(repo.listProducts).mockResolvedValue({ items: [product()], total: 1 })
    vi.mocked(repo.findProductById).mockResolvedValue(product())
    vi.mocked(repo.updateProductStatus).mockResolvedValue(product({ status: 'ARCHIVED' }))

    await service.listProducts(actor(), { status: 'ACTIVE' })
    expect(repo.listProducts).toHaveBeenCalledWith({ status: 'ACTIVE' }, { page: 1, limit: 20 })
    await expect(service.updateProductStatus(actor(), 'product-1', 'ARCHIVED')).resolves.toMatchObject({ status: 'ARCHIVED' })
  })

  it('lists and gets orders with status filters', async () => {
    vi.mocked(repo.listOrders).mockResolvedValue({ items: [order()], total: 1 })
    vi.mocked(repo.findOrderById).mockResolvedValue(order())

    await service.listOrders(actor(), { status: 'PAID' })
    expect(repo.listOrders).toHaveBeenCalledWith({ status: 'PAID' }, { page: 1, limit: 20 })
    await expect(service.getOrder(actor(), 'order-1')).resolves.toMatchObject({ id: 'order-1' })
  })

  it('lists and gets refunds with status filters', async () => {
    vi.mocked(repo.listRefunds).mockResolvedValue({ items: [refund()], total: 1 })
    vi.mocked(repo.findRefundById).mockResolvedValue(refund())

    await service.listRefunds(actor(), { status: 'PENDING' })
    expect(repo.listRefunds).toHaveBeenCalledWith({ status: 'PENDING' }, { page: 1, limit: 20 })
    await expect(service.getRefund(actor(), 'refund-1')).resolves.toMatchObject({ id: 'refund-1' })
  })

  it('updates refund status and rejects invalid status/transition', async () => {
    vi.mocked(repo.findRefundById).mockResolvedValueOnce(refund('PENDING'))
    vi.mocked(repo.updateRefundStatus).mockResolvedValue(refund('PROCESSING'))

    await expect(service.updateRefundStatus(actor(), 'refund-1', 'PROCESSING')).resolves.toMatchObject({ status: 'PROCESSING' })
    await expect(service.updateRefundStatus(actor(), 'refund-1', 'BAD')).rejects.toMatchObject({ code: 'INVALID_STATUS' })

    vi.mocked(repo.findRefundById).mockResolvedValueOnce(refund('PENDING'))
    await expect(service.updateRefundStatus(actor(), 'refund-1', 'SUCCESS')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })

    vi.mocked(repo.findRefundById).mockResolvedValueOnce(refund('SUCCESS'))
    await expect(service.updateRefundStatus(actor(), 'refund-1', 'PROCESSING')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
  })

  it('caps pagination limit at 50', async () => {
    vi.mocked(repo.listProducts).mockResolvedValue({ items: [], total: 0 })

    const result = await service.listProducts(actor(), { page: 1, limit: 500 })

    expect(repo.listProducts).toHaveBeenCalledWith({}, { page: 1, limit: 50 })
    expect(result.pagination).toEqual({ page: 1, limit: 50, total: 0, totalPages: 0 })
  })

  it('throws domain errors as AdminServiceError instances', async () => {
    await expect(service.listUsers(actor(), { status: 'LOCKED' })).rejects.toBeInstanceOf(AdminServiceError)
  })
})
