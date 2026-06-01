import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from './auth-plugin.ts'
import { PhoneOtpServiceError } from './phone-otp.errors.ts'

const PhoneBody = t.Object({
  phone: t.String({ minLength: 1 }),
})
const VerifyPhoneOtpBody = t.Object({
  phone: t.String({ minLength: 1 }),
  otp: t.String({ minLength: 4, maxLength: 12 }),
})
const RequestPhoneOtpResponse = t.Object({
  success: t.Boolean(),
  challengeId: t.String(),
  resendAvailableAt: t.Date(),
  expiresAt: t.Date(),
})
const VerifyPhoneOtpResponse = t.Object({
  success: t.Boolean(),
  state: t.Union([t.Literal('LOGIN_READY'), t.Literal('SIGNUP_REQUIRED'), t.Literal('PHONE_LINKED')]),
  phone: t.String(),
})

export function createPhoneOtpRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof PhoneOtpServiceError) {
        return httpStatus(error.status, { message: error.message })
      }
    })
    .post('/api/auth/phone/request-otp', ({ body }) =>
      container.phoneOtpService.requestLoginOrSignupOtp(body.phone), {
      body: PhoneBody,
      response: RequestPhoneOtpResponse,
    })
    .post('/api/auth/phone/verify-otp', ({ body }) =>
      container.phoneOtpService.verifyLoginOrSignupOtp(body.phone, body.otp), {
      body: VerifyPhoneOtpBody,
      response: VerifyPhoneOtpResponse,
    })
    .post('/api/me/phone/request-otp', ({ authContext, body }: any) =>
      container.phoneOtpService.requestPhoneLinkOtp(authContext!.user.id, body.phone), {
      withAuth: true,
      body: PhoneBody,
      response: RequestPhoneOtpResponse,
    })
    .post('/api/me/phone/verify-otp', ({ authContext, body }: any) =>
      container.phoneOtpService.verifyPhoneLinkOtp(authContext!.user.id, body.phone, body.otp), {
      withAuth: true,
      body: VerifyPhoneOtpBody,
      response: VerifyPhoneOtpResponse,
    })
}
