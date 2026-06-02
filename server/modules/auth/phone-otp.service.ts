import type { PhoneOtpChallenge, User } from '#generated/client/client.ts'
import type { PhoneOtpPurpose } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import {
  createDeterministicPhoneOtp,
  createOtpHash,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_MAX_REQUESTS_PER_WINDOW,
  PHONE_OTP_REQUEST_WINDOW_SECONDS,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
  type PhoneOtpProvider,
  normalizePhoneNumber,
  verifyOtpHash,
} from './phone-otp.provider.ts'
import type { IPhoneOtpRepository } from './phone-otp.repository.ts'
import { PhoneOtpServiceError } from './phone-otp.errors.ts'

export interface RequestPhoneOtpResult {
  success: true
  challengeId: string
  resendAvailableAt: Date
  expiresAt: Date
}

export type VerifyPhoneOtpState = 'LOGIN_READY' | 'SIGNUP_REQUIRED' | 'PHONE_LINKED'

export interface PublicAuthUser {
  id: string
  email: string
  name: string
  role: string
  status: string
  emailVerified: boolean
  phone: string | null
  phoneVerified: boolean
}

export type VerifyPhoneOtpResult = {
  success: true
  state: 'SIGNUP_REQUIRED'
  phone: string
  pendingSignupToken: string
  expiresAt: Date
} | {
  success: true
  state: 'LOGIN_READY'
  phone: string
  token: string
  user: PublicAuthUser
} | {
  success: true
  state: 'PHONE_LINKED'
  phone: string
}

export interface CompletePhoneSignupInput {
  phone: string
  pendingSignupToken: string
  email: string
  name: string
  password: string
}

export interface CompletePhoneSignupResult {
  success: true
  token: string
  user: PublicAuthUser
}

export class PhoneOtpService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IPhoneOtpRepository,
    private provider: PhoneOtpProvider,
  ) {
    this.logger = appContext.logger
  }

  requestLoginOrSignupOtp(phone: string): Promise<RequestPhoneOtpResult> {
    return this.createChallenge(phone, 'PHONE_LOGIN')
  }

  async verifyLoginOrSignupOtp(phone: string, otp: string): Promise<VerifyPhoneOtpResult> {
    const normalizedPhone = this.normalizePhone(phone)
    const challenge = await this.assertValidChallenge(normalizedPhone, 'PHONE_LOGIN')
    await this.verifyChallengeOtp(challenge, otp)
    await this.repo.consumeChallenge(challenge.id)

    const user = await this.repo.findUserByPhone(normalizedPhone)
    if (user?.phoneVerified) {
      if (user.status === 'SUSPENDED') {
        throw new PhoneOtpServiceError('Account is suspended', 403)
      }
      const session = await this.repo.createSession(user.id)
      return {
        success: true,
        state: 'LOGIN_READY',
        phone: normalizedPhone,
        token: session.token,
        user: this.toPublicAuthUser(user),
      }
    }

    if (user && !user.phoneVerified) {
      throw new PhoneOtpServiceError('Phone is not verified for login', 403)
    }

    return {
      success: true,
      state: 'SIGNUP_REQUIRED',
      phone: normalizedPhone,
      pendingSignupToken: challenge.id,
      expiresAt: challenge.expiresAt,
    }
  }

  async completePhoneSignup(input: CompletePhoneSignupInput): Promise<CompletePhoneSignupResult> {
    const phone = this.normalizePhone(input.phone)
    const email = this.normalizeEmail(input.email)
    const name = this.normalizeRequiredText(input.name, 'Name')
    const password = this.normalizePassword(input.password)
    const token = this.normalizeRequiredText(input.pendingSignupToken, 'Pending signup token')

    const challenge = await this.repo.findPendingSignupChallenge(token, phone)
    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new PhoneOtpServiceError('Pending phone signup has expired', 400)
    }
    if (await this.repo.findUserByPhone(phone)) {
      throw new PhoneOtpServiceError('Phone is already in use', 409)
    }
    if (await this.repo.findUserByEmail(email)) {
      throw new PhoneOtpServiceError('Email is already in use', 409)
    }

    const created = await this.repo.createEmailPasswordUser({ name, email, password })
    const user = await this.repo.setVerifiedPhone(created.id, phone)
    await this.repo.revokeChallenge(challenge.id)
    const session = await this.repo.createSession(user.id)
    return {
      success: true,
      token: session.token,
      user: this.toPublicAuthUser(user),
    }
  }

  async requestPhoneLinkOtp(userId: string, phone: string): Promise<RequestPhoneOtpResult> {
    const normalizedPhone = this.normalizePhone(phone)
    await this.assertPhoneCanBeLinked(userId, normalizedPhone)
    return this.createChallenge(normalizedPhone, 'PHONE_LINK')
  }

  async verifyPhoneLinkOtp(userId: string, phone: string, otp: string): Promise<VerifyPhoneOtpResult> {
    const normalizedPhone = this.normalizePhone(phone)
    await this.assertPhoneCanBeLinked(userId, normalizedPhone)
    const challenge = await this.assertValidChallenge(normalizedPhone, 'PHONE_LINK')
    await this.verifyChallengeOtp(challenge, otp)
    await this.repo.linkPhoneToUser(userId, normalizedPhone)
    await this.repo.consumeChallenge(challenge.id)
    return { success: true, state: 'PHONE_LINKED', phone: normalizedPhone }
  }

  private async createChallenge(phone: string, purpose: PhoneOtpPurpose): Promise<RequestPhoneOtpResult> {
    const normalizedPhone = this.normalizePhone(phone)
    this.logger.info('PhoneOtpService.createChallenge', { purpose })
    const now = new Date()
    const latest = await this.repo.findLatestActiveChallenge(normalizedPhone, purpose)
    if (latest && latest.expiresAt > now && latest.resendAvailableAt > now) {
      throw new PhoneOtpServiceError('Please wait before requesting another code', 429)
    }

    const requestWindowStart = new Date(now.getTime() - PHONE_OTP_REQUEST_WINDOW_SECONDS * 1000)
    const requestCount = await this.repo.countCreatedSince(normalizedPhone, requestWindowStart)
    if (requestCount >= PHONE_OTP_MAX_REQUESTS_PER_WINDOW) {
      throw new PhoneOtpServiceError('Too many phone verification requests', 429)
    }

    await this.repo.revokeActiveChallenges(normalizedPhone, purpose)

    const otp = createDeterministicPhoneOtp(normalizedPhone, purpose)
    const expiresAt = new Date(now.getTime() + PHONE_OTP_TTL_SECONDS * 1000)
    const resendAvailableAt = new Date(now.getTime() + PHONE_OTP_RESEND_COOLDOWN_SECONDS * 1000)
    const challenge = await this.repo.createChallenge({
      phone: normalizedPhone,
      purpose,
      otpHash: createOtpHash(otp, normalizedPhone),
      maxAttempts: PHONE_OTP_MAX_ATTEMPTS,
      resendAvailableAt,
      expiresAt,
    })

    try {
      await this.provider.send({ phone: normalizedPhone, purpose, otp })
    } catch (error) {
      await this.repo.revokeActiveChallenges(normalizedPhone, purpose)
      this.logger.error('PhoneOtpService.providerSendFailed', {
        purpose,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new PhoneOtpServiceError('Unable to send phone verification code', 502)
    }

    return {
      success: true,
      challengeId: challenge.id,
      resendAvailableAt: challenge.resendAvailableAt,
      expiresAt: challenge.expiresAt,
    }
  }

  private async assertValidChallenge(phone: string, purpose: PhoneOtpPurpose): Promise<PhoneOtpChallenge> {
    const challenge = await this.repo.findLatestActiveChallenge(phone, purpose)
    const now = new Date()
    if (!challenge || challenge.expiresAt <= now) {
      throw new PhoneOtpServiceError('Invalid or expired phone verification code', 400)
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new PhoneOtpServiceError('Too many invalid phone verification attempts', 429)
    }
    return challenge
  }

  private async verifyChallengeOtp(challenge: PhoneOtpChallenge, otp: string): Promise<void> {
    const trimmedOtp = otp.trim()
    if (!verifyOtpHash(trimmedOtp, challenge.phone, challenge.otpHash)) {
      const updated = await this.repo.incrementAttempts(challenge.id)
      if (updated.attempts >= updated.maxAttempts) {
        throw new PhoneOtpServiceError('Too many invalid phone verification attempts', 429)
      }
      throw new PhoneOtpServiceError('Invalid or expired phone verification code', 400)
    }
  }

  private async assertPhoneCanBeLinked(userId: string, phone: string): Promise<void> {
    const existingUser = await this.repo.findUserByPhone(phone)
    if (existingUser && existingUser.id !== userId) {
      throw new PhoneOtpServiceError('Phone is already in use', 409)
    }
  }

  private normalizePhone(phone: string): string {
    const normalized = normalizePhoneNumber(phone)
    const digits = normalized.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) {
      throw new PhoneOtpServiceError('Phone is invalid', 400)
    }
    return normalized
  }

  private normalizeEmail(value: string): string {
    const email = this.normalizeRequiredText(value, 'Email').toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PhoneOtpServiceError('Email is invalid', 400)
    }
    return email
  }

  private normalizePassword(value: string): string {
    if (value.length < 8) {
      throw new PhoneOtpServiceError('Password must be at least 8 characters', 400)
    }
    return value
  }

  private normalizeRequiredText(value: string, label: string): string {
    const trimmed = value.trim()
    if (!trimmed) {
      throw new PhoneOtpServiceError(`${label} is required`, 400)
    }
    return trimmed
  }

  private toPublicAuthUser(user: User): PublicAuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
    }
  }

}
