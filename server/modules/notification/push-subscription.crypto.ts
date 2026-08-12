import crypto from 'node:crypto'

const algorithm = 'aes-256-gcm'
const devFallbackSecret = 'development-push-subscription-key-change-before-production'

export function encryptPushSubscriptionValue(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(algorithm, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':')
}

export function decryptPushSubscriptionValue(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(':')
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid encrypted push subscription value')
  const decipher = crypto.createDecipheriv(algorithm, encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}

export function hashPushEndpoint(endpoint: string): string {
  return crypto.createHmac('sha256', encryptionKey()).update(endpoint).digest('hex')
}

function encryptionKey(): Buffer {
  const secret = process.env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY']?.trim()
  if (process.env['NODE_ENV'] === 'production' && (!secret || secret.length < 32)) {
    throw new Error('PUSH_SUBSCRIPTION_ENCRYPTION_KEY must be at least 32 characters in production')
  }
  return crypto.createHash('sha256').update(secret || devFallbackSecret).digest()
}
