import { beforeEach, describe, expect, it } from 'vitest'
import type { PhoneOtpChallenge, User } from '#generated/client/client.ts'
import type { PhoneOtpPurpose, Role, UserStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import {
  createDeterministicPhoneOtp,
  DeterministicPhoneOtpProvider,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_REQUESTS_PER_WINDOW,
} from './phone-otp.provider.ts'
import { PhoneOtpServiceError } from './phone-otp.errors.ts'
import { PhoneOtpService } from './phone-otp.service.ts'
import type { CreatePhoneOtpChallengeData, IPhoneOtpRepository } from './phone-otp.repository.ts'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const appContext = {
  logger,
  config: { environment: 'test' },
} as AppContext

class InMemoryPhoneOtpRepository implements IPhoneOtpRepository {
  challenges: PhoneOtpChallenge[] = []
  users: User[] = []

  async createChallenge(data: CreatePhoneOtpChallengeData): Promise<PhoneOtpChallenge> {
    const now = new Date()
    const challenge: PhoneOtpChallenge = {
      id: `challenge-${this.challenges.length + 1}`,
      attempts: 0,
      consumedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
      ...data,
    }
    this.challenges.push(challenge)
    return challenge
  }

  async findLatestActiveChallenge(phone: string, purpose: PhoneOtpPurpose): Promise<PhoneOtpChallenge | null> {
    return [...this.challenges]
      .reverse()
      .find((challenge) =>
        challenge.phone === phone
        && challenge.purpose === purpose
        && challenge.consumedAt === null
        && challenge.revokedAt === null) ?? null
  }

  async countCreatedSince(phone: string, since: Date): Promise<number> {
    return this.challenges.filter((challenge) => challenge.phone === phone && challenge.createdAt >= since).length
  }

  async incrementAttempts(id: string): Promise<PhoneOtpChallenge> {
    const challenge = this.findChallenge(id)
    challenge.attempts += 1
    challenge.updatedAt = new Date()
    return challenge
  }

  async consumeChallenge(id: string): Promise<PhoneOtpChallenge> {
    const challenge = this.findChallenge(id)
    challenge.consumedAt = new Date()
    challenge.updatedAt = new Date()
    return challenge
  }

  async revokeActiveChallenges(phone: string, purpose: PhoneOtpPurpose): Promise<void> {
    const now = new Date()
    for (const challenge of this.challenges) {
      if (challenge.phone === phone && challenge.purpose === purpose && !challenge.consumedAt && !challenge.revokedAt) {
        challenge.revokedAt = now
      }
    }
  }

  async findUserByPhone(phone: string): Promise<User | null> {
    return this.users.find((user) => user.phone === phone) ?? null
  }

  async linkPhoneToUser(userId: string, phone: string): Promise<User> {
    const user = this.users.find((candidate) => candidate.id === userId)
    if (!user) throw new Error('User not found')
    user.phone = phone
    user.phoneVerified = true
    user.updatedAt = new Date()
    return user
  }

  addUser(overrides: Partial<User>): User {
    const now = new Date()
    const user: User = {
      id: overrides.id ?? `user-${this.users.length + 1}`,
      name: overrides.name ?? 'Test User',
      email: overrides.email ?? `user-${this.users.length + 1}@example.com`,
      role: overrides.role ?? ('USER' as Role),
      status: overrides.status ?? ('ACTIVE' as UserStatus),
      emailVerified: overrides.emailVerified ?? true,
      phone: overrides.phone ?? null,
      phoneVerified: overrides.phoneVerified ?? false,
      image: overrides.image ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.users.push(user)
    return user
  }

  findChallengeForTest(id: string): PhoneOtpChallenge {
    return this.findChallenge(id)
  }

  private findChallenge(id: string): PhoneOtpChallenge {
    const challenge = this.challenges.find((candidate) => candidate.id === id)
    if (!challenge) throw new Error(`Challenge not found: ${id}`)
    return challenge
  }
}

describe('PhoneOtpService', () => {
  let repo: InMemoryPhoneOtpRepository
  let provider: DeterministicPhoneOtpProvider
  let service: PhoneOtpService

  beforeEach(() => {
    repo = new InMemoryPhoneOtpRepository()
    provider = new DeterministicPhoneOtpProvider()
    service = new PhoneOtpService(appContext, repo, provider)
  })

  it('creates normalized, hashed login/signup challenges and sends through the provider', async () => {
    const result = await service.requestLoginOrSignupOtp(' +66 81-234-5678 ')

    expect(result.success).toBe(true)
    expect(repo.challenges).toHaveLength(1)
    expect(repo.challenges[0]?.phone).toBe('+66812345678')
    expect(repo.challenges[0]?.purpose).toBe('PHONE_LOGIN')
    expect(repo.challenges[0]?.otpHash).not.toContain(createDeterministicPhoneOtp('+66812345678', 'PHONE_LOGIN'))
    expect(provider.sentMessages).toEqual([
      {
        phone: '+66812345678',
        purpose: 'PHONE_LOGIN',
        otp: createDeterministicPhoneOtp('+66812345678', 'PHONE_LOGIN'),
      },
    ])
  })

  it('enforces resend cooldown for active challenges', async () => {
    await service.requestLoginOrSignupOtp('+66812345678')

    await expect(service.requestLoginOrSignupOtp('+66812345678')).rejects.toMatchObject({
      status: 429,
      message: 'Please wait before requesting another code',
    })
  })

  it('enforces request rate cap per phone window', async () => {
    for (let index = 0; index < PHONE_OTP_MAX_REQUESTS_PER_WINDOW; index += 1) {
      const result = await service.requestLoginOrSignupOtp('+66812345678')
      const challenge = repo.findChallengeForTest(result.challengeId)
      challenge.resendAvailableAt = new Date(Date.now() - 1_000)
    }

    await expect(service.requestLoginOrSignupOtp('+66812345678')).rejects.toMatchObject({
      status: 429,
      message: 'Too many phone verification requests',
    })
  })

  it('increments wrong attempts and caps verification attempts', async () => {
    await service.requestLoginOrSignupOtp('+66812345678')

    for (let index = 0; index < PHONE_OTP_MAX_ATTEMPTS - 1; index += 1) {
      await expect(service.verifyLoginOrSignupOtp('+66812345678', '000000')).rejects.toBeInstanceOf(PhoneOtpServiceError)
    }

    await expect(service.verifyLoginOrSignupOtp('+66812345678', '000000')).rejects.toMatchObject({
      status: 429,
      message: 'Too many invalid phone verification attempts',
    })
  })

  it('rejects expired challenges', async () => {
    const result = await service.requestLoginOrSignupOtp('+66812345678')
    repo.findChallengeForTest(result.challengeId).expiresAt = new Date(Date.now() - 1_000)

    await expect(service.verifyLoginOrSignupOtp('+66812345678', createDeterministicPhoneOtp('+66812345678', 'PHONE_LOGIN')))
      .rejects.toMatchObject({
        status: 400,
        message: 'Invalid or expired phone verification code',
      })
  })

  it('consumes successful challenges and rejects reuse', async () => {
    await service.requestLoginOrSignupOtp('+66812345678')
    const otp = createDeterministicPhoneOtp('+66812345678', 'PHONE_LOGIN')

    await expect(service.verifyLoginOrSignupOtp('+66812345678', otp)).resolves.toMatchObject({
      success: true,
      state: 'SIGNUP_REQUIRED',
      phone: '+66812345678',
    })
    await expect(service.verifyLoginOrSignupOtp('+66812345678', otp)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('returns login-ready state for active verified phone users', async () => {
    repo.addUser({ phone: '+66812345678', phoneVerified: true })
    await service.requestLoginOrSignupOtp('+66812345678')

    await expect(service.verifyLoginOrSignupOtp('+66812345678', createDeterministicPhoneOtp('+66812345678', 'PHONE_LOGIN')))
      .resolves.toEqual({
        success: true,
        state: 'LOGIN_READY',
        phone: '+66812345678',
      })
  })

  it('links a verified phone to the authenticated user', async () => {
    repo.addUser({ id: 'user-1' })
    await service.requestPhoneLinkOtp('user-1', '+66812345678')

    await expect(service.verifyPhoneLinkOtp('user-1', '+66812345678', createDeterministicPhoneOtp('+66812345678', 'PHONE_LINK')))
      .resolves.toEqual({
        success: true,
        state: 'PHONE_LINKED',
        phone: '+66812345678',
      })
    expect(repo.users[0]?.phone).toBe('+66812345678')
    expect(repo.users[0]?.phoneVerified).toBe(true)
  })

  it('rejects phone linking when another user already owns the phone', async () => {
    repo.addUser({ id: 'user-1' })
    repo.addUser({ id: 'user-2', phone: '+66812345678', phoneVerified: true })

    await expect(service.requestPhoneLinkOtp('user-1', '+66812345678')).rejects.toMatchObject({
      status: 409,
      message: 'Phone is already in use',
    })
  })
})
