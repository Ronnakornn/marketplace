const productionBuildPhase = 'phase-production-build'

export interface RequiredProductionEnvOptions {
  minLength?: number
  forbiddenValues?: string[]
  forbiddenSubstrings?: string[]
  requireHttpsUrl?: boolean
  allowInsecureHttp?: boolean
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

  if (options.requireHttpsUrl && !options.allowInsecureHttp) {
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
  if (!isProductionRuntime(env)) return

  const allowInsecureHttp = env['ALLOW_INSECURE_HTTP'] === 'true'

  requireProductionEnv('DATABASE_URL', env['DATABASE_URL'], {
    forbiddenSubstrings: ['postgres:password@localhost', 'localhost:5432/sming'],
  }, env)
  requireProductionEnv('BETTER_AUTH_SECRET', env['BETTER_AUTH_SECRET'], {
    minLength: 32,
    forbiddenValues: ['dev-secret-change-in-production', 'your-secret-here-change-in-production'],
  }, env)
  requireProductionEnv('BETTER_AUTH_URL', env['BETTER_AUTH_URL'], {
    requireHttpsUrl: true,
    allowInsecureHttp,
  }, env)
  requireProductionEnv('NEXT_PUBLIC_APP_URL', env['NEXT_PUBLIC_APP_URL'], {
    requireHttpsUrl: true,
    allowInsecureHttp,
  }, env)
  requireProductionEnv('API_BASE_URL', env['API_BASE_URL'], {}, env)
  requireProductionEnv('REDIS_URL', env['REDIS_URL'], {
    forbiddenSubstrings: ['localhost'],
  }, env)
  if (env['RATE_LIMIT_ENABLED'] === 'false') {
    throw new Error('RATE_LIMIT_ENABLED must not be false in production')
  }
  if (env['TRUST_PROXY'] !== 'true') {
    throw new Error('TRUST_PROXY must be true in production behind the required reverse proxy')
  }
  if (env['QUEUE_SKIP_REDIS_VERSION_CHECK'] === 'true') {
    throw new Error('QUEUE_SKIP_REDIS_VERSION_CHECK must be false in production')
  }
  if (env['OPENAPI_ENABLED'] === 'true') {
    throw new Error('OPENAPI_ENABLED must be false in production')
  }
  requireProductionEnv('PAYMENT_WEBHOOK_SECRET', env['PAYMENT_WEBHOOK_SECRET'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-payment-webhook-secret'],
  }, env)
  requireProductionEnv('OTP_HASH_SECRET', env['OTP_HASH_SECRET'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-otp-hash-secret'],
  }, env)
  const emailProvider = requireProductionEnv('EMAIL_PROVIDER', env['EMAIL_PROVIDER'], {}, env)
  if (emailProvider !== 'resend' && emailProvider !== 'disabled') {
    throw new Error('EMAIL_PROVIDER must be resend or disabled in production')
  }
  if (emailProvider === 'resend') {
    requireProductionEnv('RESEND_API_KEY', env['RESEND_API_KEY'], {
      minLength: 20,
      forbiddenValues: ['change-me', 'your-resend-api-key'],
    }, env)
    requireProductionEnv('EMAIL_FROM', env['EMAIL_FROM'], {}, env)
  }
  const paymentProvider = requireProductionEnv('PAYMENT_PROVIDER', env['PAYMENT_PROVIDER'], {
    forbiddenValues: ['mock'],
  }, env)
  if (paymentProvider !== 'disabled') {
    requireProductionEnv('PAYMENT_CHECKOUT_BASE_URL', env['PAYMENT_CHECKOUT_BASE_URL'], {
      requireHttpsUrl: true,
      allowInsecureHttp,
    }, env)
    requireProductionEnv('PAYMENT_CHECKOUT_SECRET', env['PAYMENT_CHECKOUT_SECRET'], {
      minLength: 32,
      forbiddenValues: ['change-me', 'your-payment-checkout-secret'],
    }, env)
  }
  if (env['PAYMENT_MOCK_ENABLED'] === 'true' || env['PAYMENT_MOCK_ENABLED'] === '1') {
    throw new Error('PAYMENT_MOCK_ENABLED must be false in production')
  }
  requireProductionEnv('KYC_ENCRYPTION_KEY', env['KYC_ENCRYPTION_KEY'], {
    minLength: 32,
    forbiddenValues: ['change-me', 'your-kyc-encryption-key'],
    forbiddenSubstrings: ['your-kyc-encryption-key', 'development-kyc-encryption-key'],
  }, env)
  const uploadStorage = env['UPLOAD_STORAGE']?.trim().toLowerCase() || 'local'
  if (uploadStorage !== 'local' && uploadStorage !== 's3') {
    throw new Error('UPLOAD_STORAGE must be local or s3 in production')
  }
  if (uploadStorage === 's3') {
    requireProductionEnv('S3_ENDPOINT', env['S3_ENDPOINT'], {}, env)
    requireProductionEnv('S3_REGION', env['S3_REGION'], {}, env)
    requireProductionEnv('S3_BUCKET', env['S3_BUCKET'], {}, env)
    requireProductionEnv('S3_ACCESS_KEY_ID', env['S3_ACCESS_KEY_ID'], {}, env)
    requireProductionEnv('S3_SECRET_ACCESS_KEY', env['S3_SECRET_ACCESS_KEY'], { minLength: 16 }, env)
    requireProductionEnv('S3_PUBLIC_BASE_URL', env['S3_PUBLIC_BASE_URL'], {
      requireHttpsUrl: true,
      allowInsecureHttp,
    }, env)
  }
  if (env['MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED'] !== 'true') {
    throw new Error('MANUAL_FINANCE_OPERATIONS_ACKNOWLEDGED must be true in production')
  }
  if (env['AFFILIATE_ENABLED'] !== 'false') {
    throw new Error('AFFILIATE_ENABLED must be false in production until commission settlement is enabled')
  }
  if (env['AI_SEARCH_ENABLED'] !== 'false') {
    throw new Error('AI_SEARCH_ENABLED must be false in production while pgvector storage is disabled')
  }
  if (env['METRICS_ENABLED'] === 'true') {
    requireProductionEnv('METRICS_AUTH_TOKEN', env['METRICS_AUTH_TOKEN'], { minLength: 24 }, env)
  }
  if (env['PHONE_OTP_ENABLED'] !== 'false') {
    const phoneOtpProvider = env['PHONE_OTP_PROVIDER']
    const deterministicAllowed = phoneOtpProvider === 'deterministic-dev'
      && env['ALLOW_DETERMINISTIC_OTP'] === 'true'
    if (phoneOtpProvider !== 'http' && !deterministicAllowed) {
      throw new Error('PHONE_OTP_PROVIDER must be http when phone OTP is enabled in production')
    }
    if (phoneOtpProvider === 'http') {
      requireProductionEnv('PHONE_OTP_HTTP_URL', env['PHONE_OTP_HTTP_URL'], {
        requireHttpsUrl: true,
      }, env)
    }
  }
  if (env['PUSH_NOTIFICATIONS_ENABLED'] === 'true') {
    requireProductionEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'], {}, env)
    requireProductionEnv('VAPID_PRIVATE_KEY', env['VAPID_PRIVATE_KEY'], {}, env)
    requireProductionEnv('VAPID_SUBJECT', env['VAPID_SUBJECT'], {}, env)
    requireProductionEnv('PUSH_SUBSCRIPTION_ENCRYPTION_KEY', env['PUSH_SUBSCRIPTION_ENCRYPTION_KEY'], {
      minLength: 32,
      forbiddenSubstrings: ['your-push-subscription-key', 'development-push-subscription-key'],
    }, env)
  }
}
