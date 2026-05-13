import type { PrismaClient, User } from '#generated/client/client.ts'
import type { Role, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type AdminUserListItem = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'status' | 'createdAt' | 'updatedAt'
>

export type UserProfile = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'status' | 'emailVerified' | 'image' | 'createdAt' | 'updatedAt'
>

export interface UpdateAdminUserData {
  name?: string
  email?: string
  role?: Role
  status?: UserStatus
}

export interface UpdateCurrentUserData {
  name?: string
  image?: string | null
}

export interface IUserRepository {
  findManyForAdmin(): Promise<AdminUserListItem[]>
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  countAdmins(excludeUserId?: string): Promise<number>
  updateUser(id: string, data: UpdateAdminUserData): Promise<User>
  updateCurrentUser(id: string, data: UpdateCurrentUserData): Promise<UserProfile>
  delete(id: string): Promise<User>
  promoteByEmails(emails: string[]): Promise<number>
}

export class PrismaUserRepository implements IUserRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findManyForAdmin(): Promise<AdminUserListItem[]> {
    this.logger.debug('PrismaUserRepository.findManyForAdmin')
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      orderBy: { createdAt: 'desc' },
    })
  }

  findById(id: string): Promise<User | null> {
    this.logger.debug('PrismaUserRepository.findById', { id })
    return this.prisma.user.findUnique({ where: { id } })
  }

  findByEmail(email: string): Promise<User | null> {
    this.logger.debug('PrismaUserRepository.findByEmail', { email })
    return this.prisma.user.findUnique({ where: { email } })
  }

  countAdmins(excludeUserId?: string): Promise<number> {
    this.logger.debug('PrismaUserRepository.countAdmins', { excludeUserId })
    return this.prisma.user.count({
      where: {
        role: 'ADMIN',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
    })
  }

  updateUser(id: string, data: UpdateAdminUserData): Promise<User> {
    this.logger.info('PrismaUserRepository.updateUser', { id, data })
    return this.prisma.user.update({
      where: { id },
      data,
    })
  }

  updateCurrentUser(id: string, data: UpdateCurrentUserData): Promise<UserProfile> {
    this.logger.info('PrismaUserRepository.updateCurrentUser', { id })
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  delete(id: string): Promise<User> {
    this.logger.info('PrismaUserRepository.delete', { id })
    return this.prisma.user.delete({ where: { id } })
  }

  async promoteByEmails(emails: string[]): Promise<number> {
    this.logger.info('PrismaUserRepository.promoteByEmails', { count: emails.length })
    if (emails.length === 0) return 0
    const result = await this.prisma.user.updateMany({
      where: { email: { in: emails } },
      data: { role: 'ADMIN' },
    })
    return result.count
  }
}
