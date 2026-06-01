import type { PhoneOtpChallenge, PrismaClient, User } from '#generated/client/client.ts'
import type { PhoneOtpPurpose } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

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
  revokeActiveChallenges(phone: string, purpose: PhoneOtpPurpose): Promise<void>
  findUserByPhone(phone: string): Promise<User | null>
  linkPhoneToUser(userId: string, phone: string): Promise<User>
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

  findUserByPhone(phone: string): Promise<User | null> {
    this.logger.debug('PrismaPhoneOtpRepository.findUserByPhone')
    return this.prisma.user.findUnique({ where: { phone } })
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
}
