import type { PhoneOtpChallenge, PrismaClient, Session, User } from '#generated/client/client.ts'
import type { PhoneOtpPurpose } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { isAPIError } from 'better-auth/api'
import { auth } from './auth.ts'
import { PhoneOtpServiceError } from './phone-otp.errors.ts'

export interface CreatePhoneOtpChallengeData {
  phone: string
  purpose: PhoneOtpPurpose
  otpHash: string
  maxAttempts: number
  resendAvailableAt: Date
  expiresAt: Date
}

export interface IPhoneOtpRepository {
  createChallenge(data: CreatePhoneOtpChallengeData): Promise<PhoneOtpChallenge>
  findLatestActiveChallenge(phone: string, purpose: PhoneOtpPurpose): Promise<PhoneOtpChallenge | null>
  countCreatedSince(phone: string, since: Date): Promise<number>
  incrementAttempts(id: string): Promise<PhoneOtpChallenge>
  consumeChallenge(id: string): Promise<PhoneOtpChallenge>
  revokeChallenge(id: string): Promise<PhoneOtpChallenge>
  revokeActiveChallenges(phone: string, purpose: PhoneOtpPurpose): Promise<void>
  findPendingSignupChallenge(id: string, phone: string): Promise<PhoneOtpChallenge | null>
  findUserByPhone(phone: string): Promise<User | null>
  findUserByEmail(email: string): Promise<User | null>
  createEmailPasswordUser(input: { email: string; name: string; password: string }): Promise<User>
  linkPhoneToUser(userId: string, phone: string): Promise<User>
  setVerifiedPhone(userId: string, phone: string): Promise<User>
  createSession(userId: string): Promise<Session>
}

export class PrismaPhoneOtpRepository implements IPhoneOtpRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  createChallenge(data: CreatePhoneOtpChallengeData): Promise<PhoneOtpChallenge> {
    this.logger.info('PrismaPhoneOtpRepository.createChallenge', { purpose: data.purpose })
    return this.prisma.phoneOtpChallenge.create({ data })
  }

  findLatestActiveChallenge(phone: string, purpose: PhoneOtpPurpose): Promise<PhoneOtpChallenge | null> {
    this.logger.debug('PrismaPhoneOtpRepository.findLatestActiveChallenge', { purpose })
    return this.prisma.phoneOtpChallenge.findFirst({
      where: {
        phone,
        purpose,
        consumedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  countCreatedSince(phone: string, since: Date): Promise<number> {
    this.logger.debug('PrismaPhoneOtpRepository.countCreatedSince')
    return this.prisma.phoneOtpChallenge.count({
      where: {
        phone,
        createdAt: { gte: since },
      },
    })
  }

  incrementAttempts(id: string): Promise<PhoneOtpChallenge> {
    this.logger.info('PrismaPhoneOtpRepository.incrementAttempts', { id })
    return this.prisma.phoneOtpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  consumeChallenge(id: string): Promise<PhoneOtpChallenge> {
    this.logger.info('PrismaPhoneOtpRepository.consumeChallenge', { id })
    return this.prisma.phoneOtpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    })
  }

  revokeChallenge(id: string): Promise<PhoneOtpChallenge> {
    this.logger.info('PrismaPhoneOtpRepository.revokeChallenge', { id })
    return this.prisma.phoneOtpChallenge.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  async revokeActiveChallenges(phone: string, purpose: PhoneOtpPurpose): Promise<void> {
    this.logger.info('PrismaPhoneOtpRepository.revokeActiveChallenges', { purpose })
    await this.prisma.phoneOtpChallenge.updateMany({
      where: {
        phone,
        purpose,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
  }

  findPendingSignupChallenge(id: string, phone: string): Promise<PhoneOtpChallenge | null> {
    this.logger.debug('PrismaPhoneOtpRepository.findPendingSignupChallenge')
    return this.prisma.phoneOtpChallenge.findFirst({
      where: {
        id,
        phone,
        purpose: 'PHONE_LOGIN',
        consumedAt: { not: null },
        revokedAt: null,
      },
    })
  }

  findUserByPhone(phone: string): Promise<User | null> {
    this.logger.debug('PrismaPhoneOtpRepository.findUserByPhone')
    return this.prisma.user.findUnique({ where: { phone } })
  }

  findUserByEmail(email: string): Promise<User | null> {
    this.logger.debug('PrismaPhoneOtpRepository.findUserByEmail')
    return this.prisma.user.findUnique({ where: { email } })
  }

  async createEmailPasswordUser(input: { email: string; name: string; password: string }): Promise<User> {
    this.logger.info('PrismaPhoneOtpRepository.createEmailPasswordUser')
    try {
      const created = await auth.api.signUpEmail({ body: input })
      return created.user as User
    } catch (error) {
      if (isAPIError(error)) {
        const message = error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
          ? 'Email is already in use'
          : error.body?.message ?? 'Unable to complete phone signup'
        const status = error.body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ? 409 : this.toStatusCode(error.status)
        throw new PhoneOtpServiceError(message, status)
      }
      throw error
    }
  }

  linkPhoneToUser(userId: string, phone: string): Promise<User> {
    this.logger.info('PrismaPhoneOtpRepository.linkPhoneToUser', { userId })
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        phone,
        phoneVerified: true,
      },
    })
  }

  setVerifiedPhone(userId: string, phone: string): Promise<User> {
    this.logger.info('PrismaPhoneOtpRepository.setVerifiedPhone', { userId })
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        phone,
        phoneVerified: true,
        role: 'USER',
        status: 'ACTIVE',
      },
    })
  }

  async createSession(userId: string): Promise<Session> {
    this.logger.info('PrismaPhoneOtpRepository.createSession', { userId })
    const authContext = await import('./auth.ts').then(({ auth }) => auth.$context)
    const session = await authContext.internalAdapter.createSession(userId)
    if (!session) throw new Error('Failed to create session')
    return session as Session
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
