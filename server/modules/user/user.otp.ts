import { createHmac } from 'node:crypto'

export function getOtpHashSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env['OTP_HASH_SECRET']?.trim() || env['BETTER_AUTH_SECRET']?.trim()
  if (secret) return secret
  if (env['NODE_ENV'] === 'production') throw new Error('OTP_HASH_SECRET is required in production')
  return 'development-otp-hash-secret-change-me'
}

export function hashEmailOtp(identifier: string, otp: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${identifier}\n${otp.trim()}`)
    .digest('hex')
}
