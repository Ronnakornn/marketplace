import crypto from 'node:crypto'

const algorithm = 'aes-256-gcm'
const ivLength = 12
const authTagLength = 16
const devFallbackSecret = 'development-kyc-encryption-key-change-before-production'
const minProductionSecretLength = 32

export function encryptKycValue(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null

  const iv = crypto.randomBytes(ivLength)
  const key = getKycEncryptionKey()
  const cipher = crypto.createCipheriv(algorithm, key, iv, { authTagLength })
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function maskLast4(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (!digits) return null
  return digits.slice(-4).padStart(Math.min(4, digits.length), '*')
}

export function hashKycValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, '') || value?.trim()
  if (!normalized) return null

  return crypto.createHmac('sha256', getKycEncryptionKey()).update(normalized).digest('hex')
}

function getKycEncryptionKey(): Buffer {
  const secret = process.env['KYC_ENCRYPTION_KEY']?.trim()
  if (process.env['NODE_ENV'] === 'production') {
    if (!secret) {
      throw new Error('Missing required production environment variable: KYC_ENCRYPTION_KEY')
    }
    if (secret.length < minProductionSecretLength || secret.includes('your-kyc-encryption-key')) {
      throw new Error(`Production environment variable KYC_ENCRYPTION_KEY must be at least ${minProductionSecretLength} characters and not use a placeholder value`)
    }
  }
  return crypto.createHash('sha256').update(secret || devFallbackSecret).digest()
}
