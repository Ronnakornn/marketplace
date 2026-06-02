const productionBuildPhase = 'phase-production-build'

export interface RequiredProductionEnvOptions {
  minLength?: number
  forbiddenValues?: string[]
  forbiddenSubstrings?: string[]
  requireHttpsUrl?: boolean
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['NODE_ENV'] === 'production' && env['NEXT_PHASE'] !== productionBuildPhase
}

export function requireProductionEnv(
  name: string,
  value: string | undefined,
  options: RequiredProductionEnvOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!isProductionRuntime(env)) return value

  const normalized = value?.trim()
  if (!normalized) {
    throw new Error(`Missing required production environment variable: ${name}`)
  }

  if (options.minLength && normalized.length < options.minLength) {
    throw new Error(`Production environment variable ${name} must be at least ${options.minLength} characters`)
  }

  if (options.forbiddenValues?.includes(normalized)) {
    throw new Error(`Production environment variable ${name} uses a placeholder value`)
  }

  if (options.forbiddenSubstrings?.some((substring) => normalized.includes(substring))) {
    throw new Error(`Production environment variable ${name} uses an unsafe development value`)
  }

  if (options.requireHttpsUrl) {
    let url: URL
    try {
      url = new URL(normalized)
    } catch {
      throw new Error(`Production environment variable ${name} must be a valid URL`)
    }
    if (url.protocol !== 'https:') {
      throw new Error(`Production environment variable ${name} must use https`)
    }
  }

  return normalized
}

export function validateProductionRuntimeEnv(env: NodeJS.ProcessEnv = process.env): void {
  requireProductionEnv('DATABASE_URL', env['DATABASE_URL'], {
    forbiddenSubstrings: ['postgres:password@localhost', 'localhost:5432/sming'],
  }, env)
  requireProductionEnv('BETTER_AUTH_SECRET', env['BETTER_AUTH_SECRET'], {
    minLength: 32,
    forbiddenValues: ['dev-secret-change-in-production', 'your-secret-here-change-in-production'],
  }, env)
  requireProductionEnv('BETTER_AUTH_URL', env['BETTER_AUTH_URL'], {
    requireHttpsUrl: true,
  }, env)
  requireProductionEnv('NEXT_PUBLIC_APP_URL', env['NEXT_PUBLIC_APP_URL'], {
    requireHttpsUrl: true,
  }, env)
  requireProductionEnv('API_BASE_URL', env['API_BASE_URL'], {}, env)
  requireProductionEnv('PAYMENT_WEBHOOK_SECRET', env['PAYMENT_WEBHOOK_SECRET'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-payment-webhook-secret'],
  }, env)
  requireProductionEnv('KYC_ENCRYPTION_KEY', env['KYC_ENCRYPTION_KEY'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-kyc-encryption-key'],
    forbiddenSubstrings: ['your-kyc-encryption-key', 'development-kyc-encryption-key'],
  }, env)
  if (env['PHONE_OTP_PROVIDER'] === 'http') {
    requireProductionEnv('PHONE_OTP_HTTP_URL', env['PHONE_OTP_HTTP_URL'], {
      requireHttpsUrl: true,
    }, env)
  }
}
