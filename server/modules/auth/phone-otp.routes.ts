import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from './auth-plugin.ts'
import { auth } from './auth.ts'
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
  pendingSignupToken: t.Optional(t.String()),
  expiresAt: t.Optional(t.Date()),
  token: t.Optional(t.String()),
  user: t.Optional(t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    role: t.String(),
    status: t.String(),
    emailVerified: t.Boolean(),
    phone: t.Nullable(t.String()),
    phoneVerified: t.Boolean(),
  })),
})
const CompletePhoneSignupBody = t.Object({
  phone: t.String({ minLength: 1 }),
  pendingSignupToken: t.String({ minLength: 1 }),
  email: t.String({ minLength: 1 }),
  name: t.String({ minLength: 1 }),
  password: t.String({ minLength: 8 }),
})
const AuthSessionResponse = t.Object({
  success: t.Boolean(),
  token: t.String(),
  user: t.Object({
    id: t.String(),
    email: t.String(),
    name: t.String(),
    role: t.String(),
    status: t.String(),
    emailVerified: t.Boolean(),
    phone: t.Nullable(t.String()),
    phoneVerified: t.Boolean(),
  }),
})

async function createBetterAuthSessionCookie(token: string): Promise<string> {
  const authContext = await auth.$context
  const cookie = authContext.authCookies.sessionToken
  const maxAge = authContext.sessionConfig.expiresIn
  const signedValue = await signCookieValue(token, authContext.secret)
  const attributes = [
    `${cookie.name}=${signedValue}`,
    `Max-Age=${Math.floor(maxAge)}`,
    `Path=${cookie.attributes.path ?? '/'}`,
    'HttpOnly',
    `SameSite=${capitalizeSameSite(cookie.attributes.sameSite ?? 'lax')}`,
  ]
  if (cookie.attributes.secure) attributes.push('Secure')
  return attributes.join('; ')
}

async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return encodeURIComponent(`${value}.${base64Signature}`)
}

function capitalizeSameSite(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function attachSessionCookie(set: any, token: string): Promise<void> {
  set.headers = {
    ...set.headers,
    'Set-Cookie': await createBetterAuthSessionCookie(token),
  }
}

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
    .post('/api/auth/phone/verify-otp', async ({ set, body }) => {
      const result = await container.phoneOtpService.verifyLoginOrSignupOtp(body.phone, body.otp)
      if (result.state === 'LOGIN_READY') {
        await attachSessionCookie(set, result.token)
      }
      return result
    }, {
      body: VerifyPhoneOtpBody,
      response: VerifyPhoneOtpResponse,
    })
    .post('/api/auth/phone/complete-signup', async ({ set, body }) => {
      const result = await container.phoneOtpService.completePhoneSignup(body)
      await attachSessionCookie(set, result.token)
      return result
    }, {
      body: CompletePhoneSignupBody,
      response: AuthSessionResponse,
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
