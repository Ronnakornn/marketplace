import type { Role, UserStatus } from '#generated/client/enums.ts'
import { isAPIError } from 'better-auth/api'
import type { AppContext } from '#server/context/app-context.ts'
import { auth } from '#server/lib/auth.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AdminUserListItem, IUserRepository, UserProfile } from './user.repository.ts'
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

    if (Object.keys(updateData).length === 0) {
      throw new UserServiceError('At least one profile field is required', 400)
    }

    return this.repo.updateCurrentUser(userId, updateData)
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
    if (role !== 'USER' && role !== 'SELLER' && role !== 'ADMIN') {
      throw new UserServiceError('Invalid role', 400)
    }
  }

  private assertStatus(status: UserStatus): void {
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      throw new UserServiceError('Invalid status', 400)
    }
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
      image: user.image,
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
}
