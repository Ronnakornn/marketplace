import type { OrderStatus, ProductStatus, RefundStatus, ReturnStatus, Role, ShopStatus, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AuditLogService } from '#server/modules/audit-log'
import { isAPIError } from 'better-auth/api'
import { auth } from '#server/lib/auth.ts'
import { AdminServiceError } from './admin.errors.ts'
import type {
  AdminDashboardCounts,
  AdminBrandRecord,
  AdminPaginatedResult,
  AdminPaginationInput,
  AdminProductRecord,
  AdminRefundRecord,
  AdminReportMetrics,
  AdminReturnRecord,
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

export interface AdminCreateUserInput {
  name?: string
  email?: string
  password?: string
  role?: string
}

export interface AdminUpdateUserInput {
  name?: string
  email?: string
  role?: string
  status?: string
}

export interface AdminListByStatusInput {
  page?: number | string
  limit?: number | string
  status?: string
}

export interface AdminListBrandsInput {
  page?: number | string
  limit?: number | string
  q?: string
  isActive?: boolean | string
}

export interface AdminBrandWriteInput {
  name?: string
  nameTh?: string | null
  nameEn?: string | null
  slug?: string
  code?: string | null
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  logoUrl?: string | null
  websiteUrl?: string | null
  countryCode?: string | null
  sortOrder?: number
  isFeatured?: boolean
  isActive?: boolean
}

export interface AdminShopCreateInput {
  ownerId?: string
  ownerEmail?: string
  name?: string
  slug?: string
  status?: string
}

export interface AdminShopUpdateInput {
  ownerId?: string
  ownerEmail?: string
  name?: string
  slug?: string
  status?: string
}

const ROLES = ['USER', 'ADMIN'] as const
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
const RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'CANCELLED'] as const

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

  getReports(actor: AdminActor): Promise<AdminReportMetrics> {
    this.assertAdmin(actor)
    return this.repository.getReportMetrics()
  }

  async listUsers(actor: AdminActor, input: AdminListUsersInput = {}): Promise<AdminListResponse<AdminUserRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const role = input.role === undefined ? undefined : this.parseEnum<Role>(input.role, ROLES)
    const status = input.status === undefined ? undefined : this.parseEnum<UserStatus>(input.status, USER_STATUSES)
    return this.toListResponse(await this.repository.listUsers({ role, status }, pagination), pagination)
  }

  async listBrands(actor: AdminActor, input: AdminListBrandsInput = {}): Promise<AdminListResponse<AdminBrandRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const q = input.q?.trim() || undefined
    const isActive = this.normalizeOptionalBoolean(input.isActive)
    return this.toListResponse(await this.repository.listBrands({ q, isActive }, pagination), pagination)
  }

  async createBrand(actor: AdminActor, input: AdminBrandWriteInput): Promise<AdminBrandRecord> {
    this.assertAdmin(actor)
    const name = this.normalizeRequiredText(input.name, 'Brand name')
    const slug = this.normalizeSlug(input.slug ?? name, 'Brand slug')
    const code = this.normalizeOptionalCode(input.code)
    await this.assertBrandSlugAvailable(slug)
    if (code) await this.assertBrandCodeAvailable(code)
    this.logger.info('AdminService.createBrand', { actorId: actor.id, slug, code })
    return this.repository.createBrand({
      ...this.normalizeBrandProfile(input),
      name,
      slug,
      code,
      sortOrder: this.normalizeSortOrder(input.sortOrder),
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
    })
  }

  async updateBrand(actor: AdminActor, brandId: string, input: AdminBrandWriteInput): Promise<AdminBrandRecord> {
    this.assertAdmin(actor)
    const existing = await this.repository.findBrandById(brandId)
    if (!existing) throw new AdminServiceError('Brand not found', 404, 'BRAND_NOT_FOUND')
    const update: AdminBrandWriteInput = {}
    if (input.name !== undefined) update.name = this.normalizeRequiredText(input.name, 'Brand name')
    if (input.slug !== undefined) {
      update.slug = this.normalizeSlug(input.slug, 'Brand slug')
      await this.assertBrandSlugAvailable(update.slug, brandId)
    }
    if (input.code !== undefined) {
      update.code = this.normalizeOptionalCode(input.code)
      if (update.code) await this.assertBrandCodeAvailable(update.code, brandId)
    }
    Object.assign(update, this.normalizeBrandProfile(input))
    if (input.sortOrder !== undefined) update.sortOrder = this.normalizeSortOrder(input.sortOrder)
    if (input.isFeatured !== undefined) update.isFeatured = input.isFeatured
    if (input.isActive !== undefined) update.isActive = input.isActive
    if (Object.keys(update).length === 0) return existing
    this.logger.info('AdminService.updateBrand', { actorId: actor.id, brandId, fields: Object.keys(update) })
    return this.repository.updateBrand(brandId, update)
  }

  async deactivateBrand(actor: AdminActor, brandId: string): Promise<AdminBrandRecord> {
    return this.setBrandActive(actor, brandId, false)
  }

  async reactivateBrand(actor: AdminActor, brandId: string): Promise<AdminBrandRecord> {
    return this.setBrandActive(actor, brandId, true)
  }

  async createUser(actor: AdminActor, input: AdminCreateUserInput): Promise<AdminUserRecord> {
    this.assertAdmin(actor)
    const name = this.normalizeRequiredText(input.name, 'User name')
    const email = this.normalizeEmail(input.email)
    const password = this.normalizePassword(input.password)
    const role = input.role === undefined ? 'USER' : this.parseEnum<Role>(input.role, ROLES)
    if (await this.repository.findUserByEmail(email)) {
      throw new AdminServiceError('Email is already in use', 409, 'USER_EMAIL_EXISTS')
    }
    this.logger.info('AdminService.createUser', { actorId: actor.id, email, role })
    try {
      const created = await auth.api.signUpEmail({ body: { name, email, password } })
      const user = await this.repository.createUser({ id: created.user.id, name, email, role })
      await this.auditUserChange(actor, 'ADMIN_CONFIG_CHANGED', user.id, null, user)
      return user
    } catch (error) {
      if (isAPIError(error)) {
        if (error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
          throw new AdminServiceError('Email is already in use', 409, 'USER_EMAIL_EXISTS')
        }
        throw new AdminServiceError(error.body?.message ?? 'Failed to create user', this.toStatusCode(error.status), 'USER_CREATE_FAILED')
      }
      throw error
    }
  }

  async updateUser(actor: AdminActor, userId: string, input: AdminUpdateUserInput): Promise<AdminUserRecord> {
    this.assertAdmin(actor)
    const existing = await this.repository.findUserById(userId)
    if (!existing) throw new AdminServiceError('User not found', 404, 'USER_NOT_FOUND')
    const update: { name?: string; email?: string; role?: Role; status?: UserStatus } = {}
    if (input.name !== undefined) update.name = this.normalizeRequiredText(input.name, 'User name')
    if (input.email !== undefined) {
      update.email = this.normalizeEmail(input.email)
      const duplicate = await this.repository.findUserByEmail(update.email)
      if (duplicate && duplicate.id !== userId) {
        throw new AdminServiceError('Email is already in use', 409, 'USER_EMAIL_EXISTS')
      }
    }
    if (input.role !== undefined) {
      update.role = this.parseEnum<Role>(input.role, ROLES)
      await this.assertRoleChangeAllowed(actor, existing, update.role)
    }
    if (input.status !== undefined) {
      update.status = this.parseEnum<UserStatus>(input.status, USER_STATUSES)
      if (actor.id === userId && update.status === 'SUSPENDED') {
        throw new AdminServiceError('Admin cannot suspend own account', 409, 'INVALID_STATUS_TRANSITION')
      }
    }
    if (Object.keys(update).length === 0) return this.toAdminUserRecord(existing)
    this.logger.info('AdminService.updateUser', { actorId: actor.id, userId, fields: Object.keys(update) })
    const updated = await this.repository.updateUser(userId, update)
    await this.auditUserChange(actor, 'ADMIN_CONFIG_CHANGED', userId, existing, updated)
    return updated
  }

  async updateUserRole(actor: AdminActor, userId: string, roleValue: string): Promise<AdminUserRecord> {
    const role = this.parseEnum<Role>(roleValue, ROLES)
    return this.updateUser(actor, userId, { role })
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
    if (existing.role === 'ADMIN' && status === 'SUSPENDED' && await this.repository.countAdmins(userId) < 1) {
      throw new AdminServiceError('At least one admin must remain', 409, 'INVALID_STATUS_TRANSITION')
    }
    this.logger.info('AdminService.updateUserStatus', { actorId: actor.id, userId, status })
    const updated = await this.repository.updateUserStatus(userId, status)
    await this.auditStatusChange(actor, 'USER_STATUS_CHANGED', 'User', userId, existing, updated)
    return updated
  }

  async deleteUser(actor: AdminActor, userId: string): Promise<{ id: string; deleted: true }> {
    this.assertAdmin(actor)
    const existing = await this.repository.findUserById(userId)
    if (!existing) throw new AdminServiceError('User not found', 404, 'USER_NOT_FOUND')
    if (actor.id === userId) {
      throw new AdminServiceError('Admin cannot delete own account', 409, 'INVALID_STATUS_TRANSITION')
    }
    if (existing.role === 'ADMIN' && await this.repository.countAdmins(userId) < 1) {
      throw new AdminServiceError('At least one admin must remain', 409, 'INVALID_STATUS_TRANSITION')
    }
    await this.repository.deleteUser(userId)
    await this.auditUserChange(actor, 'ADMIN_CONFIG_CHANGED', userId, existing, null)
    return { id: userId, deleted: true }
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

  async createShop(actor: AdminActor, input: AdminShopCreateInput): Promise<AdminShopRecord> {
    this.assertAdmin(actor)
    const name = this.normalizeRequiredText(input.name, 'Shop name')
    const slug = this.normalizeSlug(input.slug ?? name)
    const status = input.status === undefined ? 'PENDING' : this.parseEnum<ShopStatus>(input.status, SHOP_STATUSES)
    const owner = await this.resolveShopOwner(input)
    const existingSlug = await this.repository.findShopBySlug(slug)
    if (existingSlug) {
      throw new AdminServiceError('Shop slug already exists', 409, 'SHOP_SLUG_EXISTS')
    }
    this.logger.info('AdminService.createShop', { actorId: actor.id, ownerId: owner.id, slug, status })
    return this.repository.createShop({ ownerId: owner.id, name, slug, status })
  }

  async updateShop(actor: AdminActor, shopId: string, input: AdminShopUpdateInput): Promise<AdminShopRecord> {
    this.assertAdmin(actor)
    const existing = await this.repository.findShopById(shopId)
    if (!existing) {
      throw new AdminServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    }
    const update: { ownerId?: string; name?: string; slug?: string; status?: ShopStatus } = {}
    if (input.name !== undefined) update.name = this.normalizeRequiredText(input.name, 'Shop name')
    if (input.slug !== undefined) {
      update.slug = this.normalizeSlug(input.slug)
      const existingSlug = await this.repository.findShopBySlug(update.slug)
      if (existingSlug && existingSlug.id !== shopId) {
        throw new AdminServiceError('Shop slug already exists', 409, 'SHOP_SLUG_EXISTS')
      }
    }
    if (input.status !== undefined) update.status = this.parseEnum<ShopStatus>(input.status, SHOP_STATUSES)
    if (input.ownerId !== undefined || input.ownerEmail !== undefined) {
      update.ownerId = (await this.resolveShopOwner(input)).id
    }
    if (Object.keys(update).length === 0) return existing
    this.logger.info('AdminService.updateShop', { actorId: actor.id, shopId, fields: Object.keys(update) })
    const updated = await this.repository.updateShop(shopId, update)
    await this.auditShopChange(actor, shopId, existing, updated)
    return updated
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

  async deleteShop(actor: AdminActor, shopId: string): Promise<{ id: string; deleted: true }> {
    this.assertAdmin(actor)
    const existing = await this.repository.findShopById(shopId)
    if (!existing) {
      throw new AdminServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    }
    const blockingRelations = await this.repository.countShopBlockingRelations(shopId)
    if (blockingRelations > 0) {
      throw new AdminServiceError('Shop has related marketplace records. Suspend it instead.', 409, 'SHOP_DELETE_BLOCKED')
    }
    this.logger.info('AdminService.deleteShop', { actorId: actor.id, shopId })
    await this.repository.deleteShop(shopId)
    await this.auditShopChange(actor, shopId, existing, { status: 'DELETED' })
    return { id: shopId, deleted: true }
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

  async listReturns(actor: AdminActor, input: AdminListByStatusInput = {}): Promise<AdminListResponse<AdminReturnRecord>> {
    this.assertAdmin(actor)
    const pagination = this.normalizePagination(input)
    const status = input.status === undefined ? undefined : this.parseEnum<ReturnStatus>(input.status, RETURN_STATUSES)
    return this.toListResponse(await this.repository.listReturns({ status }, pagination), pagination)
  }

  async getReturn(actor: AdminActor, returnId: string): Promise<AdminReturnRecord> {
    this.assertAdmin(actor)
    const returnRecord = await this.repository.findReturnById(returnId)
    if (!returnRecord) throw new AdminServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    return returnRecord
  }

  async updateReturnStatus(actor: AdminActor, returnId: string, statusValue: string): Promise<AdminReturnRecord> {
    this.assertAdmin(actor)
    const status = this.parseEnum<ReturnStatus>(statusValue, RETURN_STATUSES)
    const existing = await this.repository.findReturnById(returnId)
    if (!existing) throw new AdminServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
    if (existing.status === status) return existing
    const allowed: Record<ReturnStatus, ReturnStatus[]> = {
      REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['RECEIVED', 'COMPLETED', 'REJECTED'],
      RECEIVED: ['COMPLETED'],
      REJECTED: [],
      COMPLETED: [],
      CANCELLED: [],
    }
    if (!allowed[existing.status].includes(status)) {
      throw new AdminServiceError('Invalid return status transition', 409, 'INVALID_STATUS_TRANSITION')
    }
    this.logger.info('AdminService.updateReturnStatus', { actorId: actor.id, returnId, status })
    const updated = await this.repository.updateReturnStatus(returnId, status)
    await this.auditStatusChange(actor, 'RETURN_STATUS_CHANGED', 'ReturnRequest', returnId, existing, updated)
    return updated
  }

  private async auditStatusChange(
    actor: AdminActor,
    action: 'USER_STATUS_CHANGED' | 'SHOP_STATUS_CHANGED' | 'PRODUCT_STATUS_CHANGED' | 'REFUND_STATUS_CHANGED' | 'RETURN_STATUS_CHANGED',
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

  private async auditUserChange(
    actor: AdminActor,
    action: 'ADMIN_CONFIG_CHANGED',
    entityId: string,
    before: { name?: string; email?: string; role?: string; status?: string } | null,
    after: { name?: string; email?: string; role?: string; status?: string } | null,
  ): Promise<void> {
    if (!this.auditLogService) return
    await this.auditLogService.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action,
      entityType: 'User',
      entityId,
      before: before ? { name: before.name, email: before.email, role: before.role, status: before.status } : null,
      after: after ? { name: after.name, email: after.email, role: after.role, status: after.status } : null,
      metadata: { source: 'admin_api' },
      nonCritical: true,
    })
  }

  private async auditShopChange(
    actor: AdminActor,
    entityId: string,
    before: { status: string; name?: string; slug?: string; ownerId?: string },
    after: { status: string; name?: string; slug?: string; ownerId?: string },
  ): Promise<void> {
    if (!this.auditLogService) return
    await this.auditLogService.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'ADMIN_CONFIG_CHANGED',
      entityType: 'Shop',
      entityId,
      before: { status: before.status, name: before.name, slug: before.slug, ownerId: before.ownerId },
      after: { status: after.status, name: after.name, slug: after.slug, ownerId: after.ownerId },
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

  private normalizeRequiredText(value: string | undefined, label: string): string {
    const normalized = value?.trim()
    if (!normalized) {
      throw new AdminServiceError(`${label} is required`, 400, 'INVALID_SHOP_INPUT')
    }
    return normalized
  }

  private normalizeSlug(value: string | undefined, label = 'Shop slug'): string {
    const slug = this.normalizeRequiredText(value, label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (slug.length < 2) {
      throw new AdminServiceError('Shop slug is too short', 400, 'INVALID_SHOP_INPUT')
    }
    return slug
  }

  private normalizeOptionalBoolean(value: boolean | string | undefined): boolean | undefined {
    if (value === undefined) return undefined
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new AdminServiceError('Invalid boolean filter', 400, 'INVALID_STATUS')
  }

  private normalizeOptionalCode(value: string | null | undefined): string | null {
    const normalized = this.normalizeNullableText(value)
    return normalized ? normalized.toUpperCase() : null
  }

  private normalizeSortOrder(value: number | undefined): number {
    if (value === undefined) return 0
    if (!Number.isInteger(value) || value < 0) {
      throw new AdminServiceError('Brand sort order must be a non-negative integer', 400, 'INVALID_BRAND_INPUT')
    }
    return value
  }

  private normalizeBrandProfile(input: AdminBrandWriteInput) {
    return {
      ...(input.nameTh === undefined ? {} : { nameTh: this.normalizeNullableText(input.nameTh) }),
      ...(input.nameEn === undefined ? {} : { nameEn: this.normalizeNullableText(input.nameEn) }),
      ...(input.description === undefined ? {} : { description: this.normalizeNullableText(input.description) }),
      ...(input.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(input.descriptionTh) }),
      ...(input.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(input.descriptionEn) }),
      ...(input.logoUrl === undefined ? {} : { logoUrl: this.normalizeNullableText(input.logoUrl) }),
      ...(input.websiteUrl === undefined ? {} : { websiteUrl: this.normalizeNullableText(input.websiteUrl) }),
      ...(input.countryCode === undefined ? {} : { countryCode: this.normalizeNullableText(input.countryCode)?.toUpperCase() ?? null }),
    }
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private async assertBrandSlugAvailable(slug: string, currentBrandId?: string): Promise<void> {
    const duplicate = await this.repository.findBrandBySlug(slug)
    if (duplicate && duplicate.id !== currentBrandId) {
      throw new AdminServiceError('Brand slug already exists', 409, 'BRAND_SLUG_EXISTS')
    }
  }

  private async assertBrandCodeAvailable(code: string, currentBrandId?: string): Promise<void> {
    const duplicate = await this.repository.findBrandByCode(code)
    if (duplicate && duplicate.id !== currentBrandId) {
      throw new AdminServiceError('Brand code already exists', 409, 'BRAND_CODE_EXISTS')
    }
  }

  private async setBrandActive(actor: AdminActor, brandId: string, isActive: boolean): Promise<AdminBrandRecord> {
    this.assertAdmin(actor)
    const existing = await this.repository.findBrandById(brandId)
    if (!existing) throw new AdminServiceError('Brand not found', 404, 'BRAND_NOT_FOUND')
    if (existing.isActive === isActive) return existing
    this.logger.info('AdminService.setBrandActive', { actorId: actor.id, brandId, isActive })
    return this.repository.updateBrandActive(brandId, isActive)
  }

  private normalizeEmail(value: string | undefined): string {
    const email = this.normalizeRequiredText(value, 'Email').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AdminServiceError('Email is invalid', 400, 'INVALID_USER_INPUT')
    }
    return email
  }

  private normalizePassword(value: string | undefined): string {
    const password = value ?? ''
    if (password.length < 8) {
      throw new AdminServiceError('Password must be at least 8 characters', 400, 'INVALID_USER_INPUT')
    }
    return password
  }

  private async assertRoleChangeAllowed(actor: AdminActor, existing: { id: string; role: Role }, nextRole: Role): Promise<void> {
    if (existing.id === actor.id && existing.role === 'ADMIN' && nextRole !== 'ADMIN') {
      throw new AdminServiceError('Admin cannot remove own admin access', 409, 'INVALID_STATUS_TRANSITION')
    }
    if (existing.role === 'ADMIN' && nextRole !== 'ADMIN' && await this.repository.countAdmins(existing.id) < 1) {
      throw new AdminServiceError('At least one admin must remain', 409, 'INVALID_STATUS_TRANSITION')
    }
  }

  private toAdminUserRecord(user: { id: string; name: string; email: string; role: Role; status: UserStatus; createdAt: Date; updatedAt: Date }): AdminUserRecord {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  private toStatusCode(status: string | number | undefined): number {
    if (typeof status === 'number') return status
    switch (status) {
      case 'BAD_REQUEST':
        return 400
      case 'UNAUTHORIZED':
        return 401
      case 'FORBIDDEN':
        return 403
      case 'NOT_FOUND':
        return 404
      case 'UNPROCESSABLE_ENTITY':
        return 422
      default:
        return 500
    }
  }

  private async resolveShopOwner(input: { ownerId?: string; ownerEmail?: string }) {
    const ownerId = input.ownerId?.trim() || undefined
    const ownerEmail = input.ownerEmail?.trim().toLowerCase() || undefined
    if (!ownerId && !ownerEmail) {
      throw new AdminServiceError('Shop owner is required', 400, 'INVALID_SHOP_INPUT')
    }
    const owner = await this.repository.findUserForShopOwner({ ownerId, ownerEmail })
    if (!owner) {
      throw new AdminServiceError('Shop owner not found', 404, 'SHOP_OWNER_NOT_FOUND')
    }
    if (owner.status !== 'ACTIVE') {
      throw new AdminServiceError('Shop owner must be active', 409, 'INVALID_SHOP_OWNER')
    }
    return owner
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
