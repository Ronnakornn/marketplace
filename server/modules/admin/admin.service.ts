import type { OrderStatus, ProductStatus, RefundStatus, Role, ShopStatus, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AuditLogService } from '#server/modules/audit-log'
import { AdminServiceError } from './admin.errors.ts'
import type {
  AdminDashboardCounts,
  AdminPaginatedResult,
  AdminPaginationInput,
  AdminProductRecord,
  AdminRefundRecord,
  AdminShopRecord,
  AdminOrderRecord,
  AdminUserRecord,
  IAdminRepository,
} from './admin.repository.ts'

export interface AdminActor {
  id: string
  role: Role
}

export interface AdminListResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AdminListUsersInput {
  page?: number | string
  limit?: number | string
  role?: string
  status?: string
}

export interface AdminListByStatusInput {
  page?: number | string
  limit?: number | string
  status?: string
}

const ROLES = ['USER', 'SELLER', 'ADMIN'] as const
const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const
const SHOP_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const
const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const
const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'CANCELED',
  'REFUNDED',
] as const
const REFUND_STATUSES = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const

export class AdminService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repository: IAdminRepository,
    private auditLogService?: AuditLogService,
  ) {
    this.logger = appContext.logger
  }

  getDashboard(actor: AdminActor): Promise<AdminDashboardCounts> {
    this.assertAdmin(actor)
    return this.repository.getDashboardCounts()
  }

  async listUsers(actor: AdminActor, input: AdminListUsersInput = {}): Promise<AdminListResponse<AdminUserRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const role = input.role === undefined ? undefined : this.parseEnum<Role>(input.role, ROLES)
    const status = input.status === undefined ? undefined : this.parseEnum<UserStatus>(input.status, USER_STATUSES)
    return this.toListResponse(await this.repository.listUsers({ role, status }, pagination), pagination)
  }

  async updateUserStatus(actor: AdminActor, userId: string, statusValue: string): Promise<AdminUserRecord> {
    this.assertAdmin(actor)
    const status = this.parseEnum<UserStatus>(statusValue, USER_STATUSES)
    const existing = await this.repository.findUserById(userId)
    if (!existing) {
      throw new AdminServiceError('User not found', 404, 'USER_NOT_FOUND')
    }
    if (actor.id === userId && status === 'SUSPENDED') {
      throw new AdminServiceError('Admin cannot suspend own account', 409, 'INVALID_STATUS_TRANSITION')
    }
    this.logger.info('AdminService.updateUserStatus', { actorId: actor.id, userId, status })
    const updated = await this.repository.updateUserStatus(userId, status)
    await this.auditStatusChange(actor, 'USER_STATUS_CHANGED', 'User', userId, existing, updated)
    return updated
  }

  async listShops(actor: AdminActor, input: AdminListByStatusInput = {}): Promise<AdminListResponse<AdminShopRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const status = input.status === undefined ? undefined : this.parseEnum<ShopStatus>(input.status, SHOP_STATUSES)
    return this.toListResponse(await this.repository.listShops({ status }, pagination), pagination)
  }

  async getShop(actor: AdminActor, shopId: string): Promise<AdminShopRecord> {
    this.assertAdmin(actor)
    const shop = await this.repository.findShopById(shopId)
    if (!shop) {
      throw new AdminServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    }
    return shop
  }

  async updateShopStatus(actor: AdminActor, shopId: string, statusValue: string): Promise<AdminShopRecord> {
    this.assertAdmin(actor)
    const status = this.parseEnum<ShopStatus>(statusValue, SHOP_STATUSES)
    const existing = await this.repository.findShopById(shopId)
    if (!existing) {
      throw new AdminServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    }
    this.logger.info('AdminService.updateShopStatus', { actorId: actor.id, shopId, status })
    const updated = await this.repository.updateShopStatus(shopId, status)
    await this.auditStatusChange(actor, 'SHOP_STATUS_CHANGED', 'Shop', shopId, existing, updated)
    return updated
  }

  async listProducts(actor: AdminActor, input: AdminListByStatusInput = {}): Promise<AdminListResponse<AdminProductRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const status = input.status === undefined ? undefined : this.parseEnum<ProductStatus>(input.status, PRODUCT_STATUSES)
    return this.toListResponse(await this.repository.listProducts({ status }, pagination), pagination)
  }

  async getProduct(actor: AdminActor, productId: string): Promise<AdminProductRecord> {
    this.assertAdmin(actor)
    const product = await this.repository.findProductById(productId)
    if (!product) {
      throw new AdminServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    }
    return product
  }

  async updateProductStatus(actor: AdminActor, productId: string, statusValue: string): Promise<AdminProductRecord> {
    this.assertAdmin(actor)
    const status = this.parseEnum<ProductStatus>(statusValue, PRODUCT_STATUSES)
    const existing = await this.repository.findProductById(productId)
    if (!existing) {
      throw new AdminServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    }
    this.logger.info('AdminService.updateProductStatus', { actorId: actor.id, productId, status })
    const updated = await this.repository.updateProductStatus(productId, status)
    await this.auditStatusChange(actor, 'PRODUCT_STATUS_CHANGED', 'Product', productId, existing, updated)
    return updated
  }

  async listOrders(actor: AdminActor, input: AdminListByStatusInput = {}): Promise<AdminListResponse<AdminOrderRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const status = input.status === undefined ? undefined : this.parseEnum<OrderStatus>(input.status, ORDER_STATUSES)
    return this.toListResponse(await this.repository.listOrders({ status }, pagination), pagination)
  }

  async getOrder(actor: AdminActor, orderId: string): Promise<AdminOrderRecord> {
    this.assertAdmin(actor)
    const order = await this.repository.findOrderById(orderId)
    if (!order) {
      throw new AdminServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
    }
    return order
  }

  async listRefunds(actor: AdminActor, input: AdminListByStatusInput = {}): Promise<AdminListResponse<AdminRefundRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const status = input.status === undefined ? undefined : this.parseEnum<RefundStatus>(input.status, REFUND_STATUSES)
    return this.toListResponse(await this.repository.listRefunds({ status }, pagination), pagination)
  }

  async getRefund(actor: AdminActor, refundId: string): Promise<AdminRefundRecord> {
    this.assertAdmin(actor)
    const refund = await this.repository.findRefundById(refundId)
    if (!refund) {
      throw new AdminServiceError('Refund not found', 404, 'REFUND_NOT_FOUND')
    }
    return refund
  }

  async updateRefundStatus(actor: AdminActor, refundId: string, statusValue: string): Promise<AdminRefundRecord> {
    this.assertAdmin(actor)
    const status = this.parseEnum<RefundStatus>(statusValue, REFUND_STATUSES)
    const existing = await this.repository.findRefundById(refundId)
    if (!existing) {
      throw new AdminServiceError('Refund not found', 404, 'REFUND_NOT_FOUND')
    }
    if (existing.status === status) {
      return existing
    }
    if (existing.status === 'SUCCESS' || existing.status === 'FAILED' || (status === 'SUCCESS' && existing.status !== 'PROCESSING')) {
      throw new AdminServiceError('Invalid refund status transition', 409, 'INVALID_STATUS_TRANSITION')
    }
    this.logger.info('AdminService.updateRefundStatus', { actorId: actor.id, refundId, status })
    const updated = await this.repository.updateRefundStatus(refundId, status)
    await this.auditStatusChange(actor, 'REFUND_STATUS_CHANGED', 'Refund', refundId, existing, updated)
    return updated
  }

  private async auditStatusChange(
    actor: AdminActor,
    action: 'USER_STATUS_CHANGED' | 'SHOP_STATUS_CHANGED' | 'PRODUCT_STATUS_CHANGED' | 'REFUND_STATUS_CHANGED',
    entityType: string,
    entityId: string,
    before: { status: string },
    after: { status: string },
  ): Promise<void> {
    if (!this.auditLogService || before.status === after.status) return
    await this.auditLogService.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      before: { status: before.status },
      after: { status: after.status },
      metadata: { source: 'admin_api' },
      nonCritical: true,
    })
  }

  private assertAdmin(actor: AdminActor): void {
    if (actor.role !== 'ADMIN') {
      throw new AdminServiceError('Admin access required', 403, 'ADMIN_FORBIDDEN')
    }
  }

  private normalizePagination(input: { page?: number | string; limit?: number | string }): AdminPaginationInput {
    const page = Number(input.page ?? 1)
    const requestedLimit = Number(input.limit ?? 20)
    const limit = Math.min(requestedLimit, 50)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new AdminServiceError('Invalid pagination', 400, 'INVALID_STATUS')
    }
    return { page, limit }
  }

  private parseEnum<T extends string>(value: string, allowed: readonly string[]): T {
    if (!allowed.includes(value)) {
      throw new AdminServiceError('Invalid status', 400, 'INVALID_STATUS')
    }
    return value as T
  }

  private toListResponse<T>(result: AdminPaginatedResult<T>, pagination: AdminPaginationInput): AdminListResponse<T> {
    return {
      items: result.items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pagination.limit),
      },
    }
  }
}
