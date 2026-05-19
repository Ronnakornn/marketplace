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
    getReportMetrics: vi.fn(),
    listUsers: vi.fn(),
    findUserById: vi.fn(),
    findUserByEmail: vi.fn(),
    countAdmins: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUserStatus: vi.fn(),
    listShops: vi.fn(),
    createShop: vi.fn(),
    findShopById: vi.fn(),
    findShopBySlug: vi.fn(),
    findUserForShopOwner: vi.fn(),
    countShopBlockingRelations: vi.fn(),
    updateShop: vi.fn(),
    updateShopStatus: vi.fn(),
    deleteShop: vi.fn(),
    listProducts: vi.fn(),
    findProductById: vi.fn(),
    updateProductStatus: vi.fn(),
    listOrders: vi.fn(),
    findOrderById: vi.fn(),
    listRefunds: vi.fn(),
    findRefundById: vi.fn(),
    updateRefundStatus: vi.fn(),
    listReturns: vi.fn(),
    findReturnById: vi.fn(),
    updateReturnStatus: vi.fn(),
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
  exceptions: {
    pendingPayments: 1,
    failedPayments: 1,
    delayedShipments: 1,
    returnEscalations: 1,
    refundEscalations: 1,
    pendingShops: 1,
    pendingProducts: 1,
    payoutApprovals: 1,
    fraudOpen: 1,
  },
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
    owner: user({ id: 'seller-1', role: 'USER' }),
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
    amount: 1000,
    reason: 'Return',
    createdAt: now,
    updatedAt: now,
    order: { id: 'order-1', orderNumber: 'ORD-1', status: 'PAID', paymentStatus: 'SUCCEEDED', userId: 'user-1' },
    payment: { id: 'payment-1', provider: 'mock', status: 'PAID', amount: 1000, currency: 'USD' },
  } as any
}

function returnRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'return-1',
    orderId: 'order-1',
    userId: 'user-1',
    status: 'REQUESTED',
    reason: 'Damaged',
    description: null,
    images: [],
    createdAt: now,
    updatedAt: now,
    order: { id: 'order-1', orderNumber: 'ORD-1', status: 'DELIVERED', paymentStatus: 'SUCCEEDED', userId: 'user-1', currency: 'USD' },
    user: { id: 'user-1', name: 'User', email: 'user@example.com' },
    items: [],
    refunds: [],
    ...overrides,
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
    expect(() => service.getDashboard(actor('USER'))).toThrow(AdminServiceError)
  })

  it('returns dashboard counts including archived products as banned', async () => {
    vi.mocked(repo.getDashboardCounts).mockResolvedValue(dashboard)

    await expect(service.getDashboard(actor())).resolves.toEqual(dashboard)
    expect(repo.getDashboardCounts).toHaveBeenCalledOnce()
  })

  it('returns derived report metrics', async () => {
    const reports = {
      sales: { grossCents: 10000, paidOrderCount: 2, averageOrderValueCents: 5000 },
      orders: { total: 3, pendingPayment: 1, paid: 1, shipped: 0, delivered: 1, cancelled: 0, refunded: 0 },
      refunds: { totalCents: 1000, pending: 1, processing: 0, success: 0, failed: 0 },
      payouts: { requestedCents: 2000, approvedCents: 0, paidCents: 0, requested: 1, approved: 0, paid: 0 },
      commissions: { pendingCents: 300, approvedCents: 0, voidCents: 0 },
      marketplace: { users: 4, sellers: 1, shops: 1, products: 2, activeProducts: 1 },
    }
    vi.mocked(repo.getReportMetrics).mockResolvedValue(reports)

    await expect(service.getReports(actor())).resolves.toEqual(reports)
  })

  it('lists users with role/status filters and pagination metadata', async () => {
    vi.mocked(repo.listUsers).mockResolvedValue({ items: [user({ role: 'USER' })], total: 12 })

    const result = await service.listUsers(actor(), { role: 'USER', status: 'ACTIVE', page: 2, limit: 5 })

    expect(repo.listUsers).toHaveBeenCalledWith({ role: 'USER', status: 'ACTIVE' }, { page: 2, limit: 5 })
    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 12, totalPages: 3 })
  })

  it('updates user status and validates not found and invalid status', async () => {
    vi.mocked(repo.findUserById).mockResolvedValueOnce(user())
    vi.mocked(repo.countAdmins).mockResolvedValue(1)
    vi.mocked(repo.updateUserStatus).mockResolvedValue(user({ status: 'SUSPENDED' }))

    await expect(service.updateUserStatus(actor(), 'user-1', 'SUSPENDED')).resolves.toMatchObject({ status: 'SUSPENDED' })
    await expect(service.updateUserStatus(actor(), 'user-1', 'BANNED')).rejects.toMatchObject({ code: 'INVALID_STATUS' })

    vi.mocked(repo.findUserById).mockResolvedValueOnce(null)
    await expect(service.updateUserStatus(actor(), 'missing', 'ACTIVE')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })

  it('updates admin users while protecting self admin access', async () => {
    vi.mocked(repo.findUserById).mockResolvedValue(user({ id: 'admin-1', role: 'ADMIN' }))

    await expect(service.updateUser(actor('ADMIN'), 'admin-1', { role: 'USER' })).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })

    vi.mocked(repo.findUserById).mockResolvedValue(user({ id: 'seller-1', role: 'USER' }))
    vi.mocked(repo.findUserByEmail).mockResolvedValue(null)
    vi.mocked(repo.updateUser).mockResolvedValue(user({ id: 'seller-1', role: 'ADMIN', email: 'seller@example.com' }))

    await expect(service.updateUser(actor(), 'seller-1', { role: 'ADMIN', email: 'seller@example.com' })).resolves.toMatchObject({ role: 'ADMIN' })
  })

  it('deletes users but not self or last admin', async () => {
    vi.mocked(repo.findUserById).mockResolvedValueOnce(user({ id: 'admin-1', role: 'ADMIN' }))
    await expect(service.deleteUser(actor('ADMIN'), 'admin-1')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })

    vi.mocked(repo.findUserById).mockResolvedValueOnce(user({ id: 'admin-2', role: 'ADMIN' }))
    vi.mocked(repo.countAdmins).mockResolvedValueOnce(0)
    await expect(service.deleteUser(actor('ADMIN'), 'admin-2')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })

    vi.mocked(repo.findUserById).mockResolvedValueOnce(user({ id: 'user-2', role: 'USER' }))
    vi.mocked(repo.deleteUser).mockResolvedValue(user({ id: 'user-2' }))
    await expect(service.deleteUser(actor(), 'user-2')).resolves.toEqual({ id: 'user-2', deleted: true })
  })

  it('lists shops and updates shop status', async () => {
    vi.mocked(repo.listShops).mockResolvedValue({ items: [shop()], total: 1 })
    vi.mocked(repo.findShopById).mockResolvedValue(shop())
    vi.mocked(repo.updateShopStatus).mockResolvedValue(shop({ status: 'SUSPENDED' }))

    await service.listShops(actor(), { status: 'ACTIVE' })
    expect(repo.listShops).toHaveBeenCalledWith({ status: 'ACTIVE' }, { page: 1, limit: 20 })
    await expect(service.updateShopStatus(actor(), 'shop-1', 'SUSPENDED')).resolves.toMatchObject({ status: 'SUSPENDED' })
  })

  it('creates and updates shops with validated owner and slug', async () => {
    vi.mocked(repo.findUserForShopOwner).mockResolvedValue({ id: 'seller-1', role: 'USER', status: 'ACTIVE' } as any)
    vi.mocked(repo.findShopBySlug).mockResolvedValue(null)
    vi.mocked(repo.createShop).mockResolvedValue(shop({ name: 'New Shop', slug: 'new-shop', status: 'PENDING' }))
    vi.mocked(repo.findShopById).mockResolvedValue(shop())
    vi.mocked(repo.updateShop).mockResolvedValue(shop({ name: 'Updated', slug: 'updated', status: 'ACTIVE' }))

    await expect(service.createShop(actor(), { ownerEmail: 'seller@example.com', name: 'New Shop' })).resolves.toMatchObject({ slug: 'new-shop' })
    expect(repo.createShop).toHaveBeenCalledWith({ ownerId: 'seller-1', name: 'New Shop', slug: 'new-shop', status: 'PENDING' })

    await expect(service.updateShop(actor(), 'shop-1', { name: 'Updated', slug: 'Updated', status: 'ACTIVE' })).resolves.toMatchObject({ name: 'Updated' })
    expect(repo.updateShop).toHaveBeenCalledWith('shop-1', { name: 'Updated', slug: 'updated', status: 'ACTIVE' })
  })

  it('blocks shop deletes when marketplace records exist', async () => {
    vi.mocked(repo.findShopById).mockResolvedValue(shop())
    vi.mocked(repo.countShopBlockingRelations).mockResolvedValue(1)

    await expect(service.deleteShop(actor(), 'shop-1')).rejects.toMatchObject({ code: 'SHOP_DELETE_BLOCKED' })
  })

  it('deletes empty shops', async () => {
    vi.mocked(repo.findShopById).mockResolvedValue(shop())
    vi.mocked(repo.countShopBlockingRelations).mockResolvedValue(0)
    vi.mocked(repo.deleteShop).mockResolvedValue(shop())

    await expect(service.deleteShop(actor(), 'shop-1')).resolves.toEqual({ id: 'shop-1', deleted: true })
    expect(repo.deleteShop).toHaveBeenCalledWith('shop-1')
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

  it('lists and updates return escalations', async () => {
    vi.mocked(repo.listReturns).mockResolvedValue({ items: [returnRecord()], total: 1 })
    vi.mocked(repo.findReturnById).mockResolvedValueOnce(returnRecord())
    vi.mocked(repo.updateReturnStatus).mockResolvedValue(returnRecord({ status: 'APPROVED' }))

    await service.listReturns(actor(), { status: 'REQUESTED' })
    expect(repo.listReturns).toHaveBeenCalledWith({ status: 'REQUESTED' }, { page: 1, limit: 20 })
    await expect(service.updateReturnStatus(actor(), 'return-1', 'APPROVED')).resolves.toMatchObject({ status: 'APPROVED' })

    vi.mocked(repo.findReturnById).mockResolvedValueOnce(returnRecord({ status: 'COMPLETED' }))
    await expect(service.updateReturnStatus(actor(), 'return-1', 'APPROVED')).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
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
