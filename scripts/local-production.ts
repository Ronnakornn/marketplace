import { spawn } from 'node:child_process'
import { validateProductionRuntimeEnv } from '../server/config/production-env.ts'
import { startProduction } from './start-production.ts'

export function localProductionEnv(env: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...env,
    NODE_ENV: 'production',
    NEXT_PHASE: undefined,
    LOCAL_PRODUCTION: 'true',
    HOST: '127.0.0.1',
    PORT: '3001',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
    API_BASE_URL: 'http://127.0.0.1:3001',
    REDIS_URL: env['REDIS_URL'] || 'redis://127.0.0.1:6379',
    OTP_HASH_SECRET: env['OTP_HASH_SECRET'] || env['BETTER_AUTH_SECRET'],
    KYC_ENCRYPTION_KEY: env['KYC_ENCRYPTION_KEY'] || 'development-kyc-encryption-key-change-before-production',
    ALLOW_INSECURE_HTTP: 'true',
    TRUST_PROXY: 'false',
    QUEUE_SKIP_REDIS_VERSION_CHECK: 'false',
    RATE_LIMIT_ENABLED: 'true',
    OPENAPI_ENABLED: 'false',
    PAYMENT_PROVIDER: 'disabled',
    PAYMENT_MOCK_ENABLED: 'false',
    EMAIL_PROVIDER: 'disabled',
    PHONE_OTP_ENABLED: 'false',
    PUSH_NOTIFICATIONS_ENABLED: 'false',
    METRICS_ENABLED: 'false',
    AFFILIATE_ENABLED: 'false',
    AI_SEARCH_ENABLED: 'false',
  }
}

if (import.meta.main) {
  const env = localProductionEnv(process.env)
  validateProductionRuntimeEnv(env)
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  if (process.argv.includes('--build')) {
    const child = spawn('bun', ['run', 'build'], { env: process.env, stdio: 'inherit' })
    child.once('error', () => process.exit(1))
    child.once('exit', code => process.exit(code ?? 1))
  } else {
    process.exit(await startProduction())
  }
}
