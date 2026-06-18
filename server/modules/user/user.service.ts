import type { Role, UserStatus } from '#generated/client/enums.ts'
import { randomInt } from 'node:crypto'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { isAPIError } from 'better-auth/api'
import type { AppContext } from '#server/context/app-context.ts'
import { auth } from '#server/lib/auth.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AddressData, AdminUserListItem, BuyerAddress, FavoriteProductRecord, IUserRepository, ShopFollowRecord, UserProfile } from './user.repository.ts'
import { UserServiceError } from './user.errors.ts'

export interface CreateAdminUserData {
  name: string
  email: string
  password: string
  role: Role
}

export interface UpdateAdminUserData {
  name: string
  email: string
  role: Role
}

export interface UpdateCurrentUserData {
  name?: string
  image?: string | null
  phone?: string | null
  phoneVerified?: boolean
}

export type VerificationPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'

const OTP_TTL_MS = 15 * 60 * 1000

export interface AddressInput {
  recipientName?: string
  phone?: string | null
  line1?: string
  line2?: string | null
  city?: string
  region?: string | null
  postalCode?: string
  country?: string
  isDefault?: boolean
}

export interface FavoriteProductResponse {
  id: string
  productId: string
  title: string
  price: number
  currency: string
  status: string
  imageUrls: string[]
  shop: { id: string; name: string; slug: string; status: string }
  purchaseVariant: {
    id: string
    title: string
    stock: number
    currency: string
    price: number
  } | null
  createdAt: Date
}

export interface ShopFollowResponse {
  id: string
  shopId: string
  name: string
  slug: string
  followerCount: number
  productCount: number
  products: Array<{ id: string; title: string; price: number; currency: string }>
  createdAt: Date
}

export class UserService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IUserRepository,
  ) {
    this.logger = appContext.logger
  }

  listForAdmin(): Promise<AdminUserListItem[]> {
    this.logger.debug('UserService.listForAdmin')
    return this.repo.findManyForAdmin()
  }

  async getCurrentUser(userId: string): Promise<UserProfile> {
    this.logger.debug('UserService.getCurrentUser', { userId })
    const user = await this.repo.findById(userId)
    if (!user) {
      throw new UserServiceError('User not found', 404)
    }

    return this.toUserProfile(user)
  }

  async updateCurrentUser(userId: string, data: UpdateCurrentUserData): Promise<UserProfile> {
    this.logger.info('UserService.updateCurrentUser', { userId })
    const updateData: UpdateCurrentUserData = {}

    if (data.name !== undefined) {
      const name = data.name.trim()
      if (!name) {
        throw new UserServiceError('Name is required', 400)
      }
      updateData.name = name
    }

    if (data.image !== undefined) {
      updateData.image = data.image
    }

    if (data.phone !== undefined) {
      const phone = this.normalizePhone(data.phone)
      if (phone) {
        const duplicateUser = await this.repo.findByPhone(phone)
        if (duplicateUser && duplicateUser.id !== userId) {
          throw new UserServiceError('Phone is already in use', 409)
        }
      }
      updateData.phone = phone
      updateData.phoneVerified = false
    }

    if (Object.keys(updateData).length === 0) {
      throw new UserServiceError('At least one profile field is required', 400)
    }

    return this.repo.updateCurrentUser(userId, updateData)
  }

  async resendEmailVerification(userId: string): Promise<{ success: true }> {
    this.logger.info('UserService.resendEmailVerification', { userId })
    const user = await this.repo.findById(userId)
    if (!user) throw new UserServiceError('User not found', 404)
    if (user.emailVerified) return { success: true }

    await this.createOtp('EMAIL_VERIFICATION', user.email)
    return { success: true }
  }

  async verifyEmailOtp(email: string, otp: string): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email)
    this.logger.info('UserService.verifyEmailOtp', { email: normalizedEmail })
    const user = await this.repo.findByEmail(normalizedEmail)
    if (!user) throw new UserServiceError('Invalid or expired verification code', 400)

    const verification = await this.findValidOtp('EMAIL_VERIFICATION', normalizedEmail, otp)
    await this.repo.markEmailVerified(user.id)
    await this.repo.deleteVerification(verification.id)
    return { success: true }
  }

  async requestPasswordResetOtp(email: string): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email)
    this.logger.info('UserService.requestPasswordResetOtp', { email: normalizedEmail })
    const user = await this.repo.findByEmail(normalizedEmail)
    if (user) {
      await this.createOtp('PASSWORD_RESET', normalizedEmail)
    }
    return { success: true }
  }

  async completePasswordReset(email: string, otp: string, newPassword: string): Promise<{ success: true }> {
    const normalizedEmail = this.normalizeEmail(email)
    this.logger.info('UserService.completePasswordReset', { email: normalizedEmail })
    this.assertPassword(newPassword)

    const user = await this.repo.findByEmail(normalizedEmail)
    if (!user) throw new UserServiceError('Invalid or expired reset code', 400)

    const verification = await this.findValidOtp('PASSWORD_RESET', normalizedEmail, otp)
    const account = await this.repo.findCredentialAccount(user.id)
    if (!account) throw new UserServiceError('Password credential not found', 400)

    await this.repo.updateCredentialPassword(account.id, await hashPassword(newPassword))
    await this.repo.deleteVerification(verification.id)
    return { success: true }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: true }> {
    this.logger.info('UserService.changePassword', { userId })
    this.assertPassword(newPassword)
    const user = await this.repo.findById(userId)
    if (!user) throw new UserServiceError('User not found', 404)
    if (!user.emailVerified) throw new UserServiceError('Email verification required', 403)

    const account = await this.repo.findCredentialAccount(userId)
    if (!account?.password) throw new UserServiceError('Password credential not found', 400)
    const validCurrentPassword = await verifyPassword({ hash: account.password, password: currentPassword })
    if (!validCurrentPassword) throw new UserServiceError('Current password is invalid', 400)

    await this.repo.updateCredentialPassword(account.id, await hashPassword(newPassword))
    return { success: true }
  }

  listAddresses(userId: string): Promise<BuyerAddress[]> {
    this.logger.debug('UserService.listAddresses', { userId })
    return this.repo.listAddresses(userId)
  }

  async createAddress(userId: string, input: AddressInput): Promise<BuyerAddress> {
    this.logger.info('UserService.createAddress', { userId })
    return this.repo.createAddress(userId, this.normalizeAddress(input, true))
  }

  async updateAddress(userId: string, addressId: string, input: AddressInput): Promise<BuyerAddress> {
    this.logger.info('UserService.updateAddress', { userId, addressId })
    await this.assertAddressOwner(userId, addressId)
    const data = this.normalizeAddress(input, false)
    if (Object.keys(data).length === 0) {
      throw new UserServiceError('At least one address field is required', 400)
    }
    return this.repo.updateAddress(userId, addressId, data)
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    this.logger.info('UserService.deleteAddress', { userId, addressId })
    await this.assertAddressOwner(userId, addressId)
    await this.repo.deleteAddress(userId, addressId)
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<BuyerAddress> {
    this.logger.info('UserService.setDefaultAddress', { userId, addressId })
    await this.assertAddressOwner(userId, addressId)
    return this.repo.setDefaultAddress(userId, addressId)
  }

  async listFavoriteProducts(userId: string): Promise<FavoriteProductResponse[]> {
    return (await this.repo.listFavoriteProducts(userId)).map((favorite) => this.toFavoriteProduct(favorite))
  }

  async getFavoriteStatus(userId: string, productId: string): Promise<{ favorited: boolean }> {
    return { favorited: Boolean(await this.repo.findFavoriteProduct(userId, productId)) }
  }

  async addFavoriteProduct(userId: string, productId: string): Promise<{ favorited: true }> {
    await this.repo.addFavoriteProduct(userId, productId)
    return { favorited: true }
  }

  async removeFavoriteProduct(userId: string, productId: string): Promise<{ favorited: false }> {
    await this.repo.removeFavoriteProduct(userId, productId)
    return { favorited: false }
  }

  async listFollowedShops(userId: string): Promise<ShopFollowResponse[]> {
    return (await this.repo.listFollowedShops(userId)).map((follow) => this.toShopFollow(follow))
  }

  async getShopFollowStatus(userId: string, shopId: string): Promise<{ following: boolean }> {
    return { following: Boolean(await this.repo.findShopFollow(userId, shopId)) }
  }

  async followShop(userId: string, shopId: string): Promise<{ following: true }> {
    await this.repo.followShop(userId, shopId)
    return { following: true }
  }

  async unfollowShop(userId: string, shopId: string): Promise<{ following: false }> {
    await this.repo.unfollowShop(userId, shopId)
    return { following: false }
  }

  async createForAdmin(data: CreateAdminUserData): Promise<AdminUserListItem> {
    this.logger.info('UserService.createForAdmin', { email: data.email, role: data.role })
    this.validateCreateInput(data)

    const email = data.email.trim().toLowerCase()
    const existingUser = await this.repo.findByEmail(email)
    if (existingUser) {
      throw new UserServiceError('Email is already in use', 409)
    }

    try {
      const result = await auth.api.signUpEmail({
        body: {
          name: data.name.trim(),
          email,
          password: data.password,
        },
      })

      const createdUser = data.role !== 'USER'
        ? await this.repo.updateUser(result.user.id, { role: data.role })
        : await this.repo.findById(result.user.id)

      if (!createdUser) {
        throw new UserServiceError('User not found after creation', 500)
      }

      return this.toAdminUser(createdUser)
    } catch (error) {
      if (isAPIError(error)) {
        if (error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
          throw new UserServiceError('Email is already in use', 409)
        }
        throw new UserServiceError(error.body?.message ?? 'Failed to create user', this.toStatusCode(error.status))
      }

      throw error
    }
  }

  async updateForAdmin(actorId: string, targetUserId: string, data: UpdateAdminUserData): Promise<AdminUserListItem> {
    this.logger.info('UserService.updateForAdmin', { actorId, targetUserId, role: data.role })
    this.validateUpdateInput(data)

    const targetUser = await this.repo.findById(targetUserId)
    if (!targetUser) {
      throw new UserServiceError('User not found', 404)
    }

    if (targetUser.id === actorId && targetUser.role === 'ADMIN' && data.role !== 'ADMIN') {
      throw new UserServiceError('You cannot remove your own admin access', 400)
    }

    const email = data.email.trim().toLowerCase()
    const duplicateUser = await this.repo.findByEmail(email)
    if (duplicateUser && duplicateUser.id !== targetUserId) {
      throw new UserServiceError('Email is already in use', 409)
    }

    if (targetUser.role === 'ADMIN' && data.role !== 'ADMIN') {
      const remainingAdminCount = await this.repo.countAdmins(targetUserId)
      if (remainingAdminCount < 1) {
        throw new UserServiceError('At least one admin must remain', 400)
      }
    }

    const updated = await this.repo.updateUser(targetUserId, {
      name: data.name.trim(),
      email,
      role: data.role,
    })

    return this.toAdminUser(updated)
  }

  async updateRole(actorId: string, targetUserId: string, role: Role): Promise<AdminUserListItem> {
    const targetUser = await this.repo.findById(targetUserId)
    if (!targetUser) {
      throw new UserServiceError('User not found', 404)
    }

    return this.updateForAdmin(actorId, targetUserId, {
      name: targetUser.name,
      email: targetUser.email,
      role,
    })
  }

  async updateStatus(actorId: string, targetUserId: string, status: UserStatus): Promise<AdminUserListItem> {
    this.logger.info('UserService.updateStatus', { actorId, targetUserId, status })
    this.assertStatus(status)

    const targetUser = await this.repo.findById(targetUserId)
    if (!targetUser) {
      throw new UserServiceError('User not found', 404)
    }

    if (targetUser.id === actorId && status === 'SUSPENDED') {
      throw new UserServiceError('You cannot suspend your own account', 400)
    }

    const updated = await this.repo.updateUser(targetUserId, { status })
    return this.toAdminUser(updated)
  }

  async deleteForAdmin(actorId: string, targetUserId: string): Promise<void> {
    this.logger.info('UserService.deleteForAdmin', { actorId, targetUserId })

    const targetUser = await this.repo.findById(targetUserId)
    if (!targetUser) {
      throw new UserServiceError('User not found', 404)
    }

    if (targetUser.id === actorId) {
      throw new UserServiceError('You cannot delete your own account', 400)
    }

    if (targetUser.role === 'ADMIN') {
      const remainingAdminCount = await this.repo.countAdmins(targetUserId)
      if (remainingAdminCount < 1) {
        throw new UserServiceError('At least one admin must remain', 400)
      }
    }

    await this.repo.delete(targetUserId)
  }

  private validateCreateInput(data: CreateAdminUserData): void {
    if (!data.name.trim()) {
      throw new UserServiceError('Name is required', 400)
    }
    if (!data.email.trim()) {
      throw new UserServiceError('Email is required', 400)
    }
    if (!data.password || data.password.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 400)
    }
    this.assertRole(data.role)
  }

  private validateUpdateInput(data: UpdateAdminUserData): void {
    if (!data.name.trim()) {
      throw new UserServiceError('Name is required', 400)
    }
    if (!data.email.trim()) {
      throw new UserServiceError('Email is required', 400)
    }
    this.assertRole(data.role)
  }

  private assertRole(role: Role): void {
    if (role !== 'USER' && role !== 'ADMIN') {
      throw new UserServiceError('Invalid role', 400)
    }
  }

  private assertStatus(status: UserStatus): void {
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      throw new UserServiceError('Invalid status', 400)
    }
  }

  private async createOtp(purpose: VerificationPurpose, email: string): Promise<void> {
    const identifier = this.verificationIdentifier(purpose, email)
    await this.repo.deleteVerificationsByIdentifier(identifier)
    await this.repo.createVerification({
      identifier,
      value: this.generateOtp(),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    })
  }

  private async findValidOtp(purpose: VerificationPurpose, email: string, otp: string) {
    const verification = await this.repo.findVerification(this.verificationIdentifier(purpose, email), otp.trim())
    if (!verification || verification.expiresAt <= new Date()) {
      throw new UserServiceError(`Invalid or expired ${purpose === 'EMAIL_VERIFICATION' ? 'verification' : 'reset'} code`, 400)
    }
    return verification
  }

  private verificationIdentifier(purpose: VerificationPurpose, email: string): string {
    return `${purpose}:${email}`
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  private normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase()
    if (!normalized) throw new UserServiceError('Email is required', 400)
    return normalized
  }

  private normalizePhone(phone: string | null): string | null {
    const trimmed = phone?.trim()
    if (!trimmed) return null
    const hasLeadingPlus = trimmed.startsWith('+')
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) {
      throw new UserServiceError('Phone is invalid', 400)
    }
    return `${hasLeadingPlus ? '+' : ''}${digits}`
  }

  private assertPassword(password: string): void {
    if (!password || password.length < 8) {
      throw new UserServiceError('Password must be at least 8 characters', 400)
    }
  }

  private async assertAddressOwner(userId: string, addressId: string): Promise<void> {
    const address = await this.repo.findAddress(userId, addressId)
    if (!address) {
      throw new UserServiceError('Address not found', 404)
    }
  }

  private normalizeAddress(input: AddressInput, requireAll: true): AddressData
  private normalizeAddress(input: AddressInput, requireAll: false): Partial<AddressData>
  private normalizeAddress(input: AddressInput, requireAll: boolean): AddressData | Partial<AddressData> {
    const data: Partial<AddressData> = {}
    this.copyRequiredText(input, data, 'recipientName', 'Recipient name is required', requireAll)
    this.copyOptionalText(input, data, 'phone')
    this.copyRequiredText(input, data, 'line1', 'Address line 1 is required', requireAll)
    this.copyOptionalText(input, data, 'line2')
    this.copyRequiredText(input, data, 'city', 'City is required', requireAll)
    this.copyOptionalText(input, data, 'region')
    this.copyRequiredText(input, data, 'postalCode', 'Postal code is required', requireAll)
    this.copyRequiredText(input, data, 'country', 'Country is required', requireAll)
    if (input.isDefault !== undefined) data.isDefault = input.isDefault
    return data as AddressData | Partial<AddressData>
  }

  private copyRequiredText(
    input: AddressInput,
    data: Partial<AddressData>,
    key: keyof Pick<AddressData, 'recipientName' | 'line1' | 'city' | 'postalCode' | 'country'>,
    message: string,
    requireAll: boolean,
  ): void {
    const value = input[key]
    if (value === undefined) {
      if (requireAll) throw new UserServiceError(message, 400)
      return
    }
    const trimmed = value.trim()
    if (!trimmed) throw new UserServiceError(message, 400)
    data[key] = trimmed
  }

  private copyOptionalText(
    input: AddressInput,
    data: Partial<AddressData>,
    key: keyof Pick<AddressData, 'phone' | 'line2' | 'region'>,
  ): void {
    if (input[key] === undefined) return
    const trimmed = input[key]?.trim()
    data[key] = trimmed ? trimmed : null
  }

  private toAdminUser(user: AdminUserListItem): AdminUserListItem {
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

  private toUserProfile(user: UserProfile): UserProfile {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  private toFavoriteProduct(favorite: FavoriteProductRecord): FavoriteProductResponse {
    const variants = favorite.product.variants.map((variant) => ({
      variant,
      stock: Math.max(0, (variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.quantityReserved ?? 0)),
    }))
    const firstVariant = variants[0]
    const purchaseVariant = favorite.product.status === 'ACTIVE' && favorite.product.shop.status === 'ACTIVE'
      ? variants.find((item) => item.stock > 0)
      : undefined
    const displayVariant = purchaseVariant ?? firstVariant

    return {
      id: favorite.id,
      productId: favorite.productId,
      title: favorite.product.title,
      price: displayVariant ? Number(displayVariant.variant.price) : 0,
      currency: displayVariant?.variant.currency ?? 'USD',
      status: favorite.product.status,
      imageUrls: favorite.product.images.map((image) => image.url),
      shop: favorite.product.shop,
      purchaseVariant: purchaseVariant ? {
        id: purchaseVariant.variant.id,
        title: purchaseVariant.variant.title,
        stock: purchaseVariant.stock,
        currency: purchaseVariant.variant.currency,
        price: Number(purchaseVariant.variant.price),
      } : null,
      createdAt: favorite.createdAt,
    }
  }

  private toShopFollow(follow: ShopFollowRecord): ShopFollowResponse {
    return {
      id: follow.id,
      shopId: follow.shopId,
      name: follow.shop.name,
      slug: follow.shop.slug,
      followerCount: follow.shop._count.followers,
      productCount: follow.shop._count.products,
      products: follow.shop.products.map((product) => {
        const variant = product.variants[0] ?? 0
        return {
          id: product.id,
          title: product.title,
          price: variant?.price !== null && variant?.price !== undefined ? Number(variant?.price) : 0,
          currency: variant?.currency ?? 'USD',
        }
      }),
      createdAt: follow.createdAt,
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
}
