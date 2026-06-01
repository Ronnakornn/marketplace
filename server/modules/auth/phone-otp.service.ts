import type { PhoneOtpChallenge } from '#generated/client/client.ts'
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

export interface VerifyPhoneOtpResult {
  success: true
  state: VerifyPhoneOtpState
  phone: string
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
      return { success: true, state: 'LOGIN_READY', phone: normalizedPhone }
    }

    return { success: true, state: 'SIGNUP_REQUIRED', phone: normalizedPhone }
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
}
