import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSecurityPlugin, resetSecurityRateLimitBuckets } from '#server/plugins/security.plugin.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { OwnershipGuards, type OwnershipGuardRepository } from './ownership-guards.ts'
import { SecurityError } from './security.errors.ts'
import { SecurityService } from './security.service.ts'
import { validateUploadInput } from './upload-validation.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext(environment = 'test'): AppContext {
  return {
    logger: createLogger(),
    config: { environment },
  }
}

function createSecurityApp(appContext = createAppContext()) {
  return new Elysia()
    .use(createSecurityPlugin(appContext, {
      rateLimitEnabled: true,
      rateLimitWindowSeconds: 60,
      publicMaxRequests: 3,
      authMaxRequests: 1,
      checkoutMaxRequests: 1,
      adminMaxRequests: 1,
      requestBodyLimitBytes: 10,
    }))
    .get('/api/public', () => ({ ok: true }))
    .get('/api/auth/session', () => ({ ok: true }))
    .get('/api/checkout/test', () => ({ ok: true }))
    .get('/api/admin/test', () => ({ ok: true }))
    .post('/api/public', () => ({ ok: true }))
    .get('/api/error', () => {
      throw new Error('internal failure token=abc123')
    })
}

function createOwnershipRepo(overrides: Partial<Record<keyof OwnershipGuardRepository, boolean>> = {}): OwnershipGuardRepository {
  return {
    cartBelongsToUser: vi.fn(async () => overrides.cartBelongsToUser ?? true),
    orderBelongsToUser: vi.fn(async () => overrides.orderBelongsToUser ?? true),
    shopBelongsToSeller: vi.fn(async () => overrides.shopBelongsToSeller ?? true),
    productBelongsToSeller: vi.fn(async () => overrides.productBelongsToSeller ?? true),
    shipmentBelongsToSeller: vi.fn(async () => overrides.shipmentBelongsToSeller ?? true),
  }
}

describe('security hardening', () => {
  beforeEach(() => {
    resetSecurityRateLimitBuckets()
    vi.clearAllMocks()
  })

  it('rate limit blocks excessive public requests', async () => {
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/public', { headers: { 'x-forwarded-for': '1.1.1.1' } }))
    await app.handle(new Request('http://localhost/api/public', { headers: { 'x-forwarded-for': '1.1.1.1' } }))
    await app.handle(new Request('http://localhost/api/public', { headers: { 'x-forwarded-for': '1.1.1.1' } }))
    const response = await app.handle(new Request('http://localhost/api/public', { headers: { 'x-forwarded-for': '1.1.1.1' } }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMIT_EXCEEDED' } })
  })

  it('auth routes have a stricter rate limit', async () => {
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/auth/session', { headers: { 'x-forwarded-for': '2.2.2.2' } }))
    const response = await app.handle(new Request('http://localhost/api/auth/session', { headers: { 'x-forwarded-for': '2.2.2.2' } }))

    expect(response.status).toBe(429)
  })

  it('checkout routes have a stricter rate limit', async () => {
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/checkout/test', { headers: { 'x-forwarded-for': '3.3.3.3' } }))
    const response = await app.handle(new Request('http://localhost/api/checkout/test', { headers: { 'x-forwarded-for': '3.3.3.3' } }))

    expect(response.status).toBe(429)
  })

  it('admin route rate limiting blocks excessive admin requests', async () => {
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/admin/test', { headers: { 'x-forwarded-for': '4.4.4.4' } }))
    const response = await app.handle(new Request('http://localhost/api/admin/test', { headers: { 'x-forwarded-for': '4.4.4.4' } }))

    expect(response.status).toBe(429)
  })

  it('seller ownership guard blocks wrong seller', async () => {
    const guards = new OwnershipGuards(createOwnershipRepo({ shopBelongsToSeller: false }))

    await expect(guards.assertSellerOwnsShop('seller-1', 'shop-2'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('buyer ownership guard blocks wrong buyer', async () => {
    const guards = new OwnershipGuards(createOwnershipRepo({ orderBelongsToUser: false }))

    await expect(guards.assertUserOwnsOrder('user-1', 'order-2'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('safe error response hides internal stack traces and tokens in production', async () => {
    const app = createSecurityApp(createAppContext('production'))
    const response = await app.handle(new Request('http://localhost/api/error', { headers: { 'x-forwarded-for': '5.5.5.5' } }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: { code: 'INVALID_REQUEST', message: 'Request failed' } })
    expect(JSON.stringify(body)).not.toContain('abc123')
    expect(JSON.stringify(body)).not.toContain('stack')
  })

  it('upload validation rejects invalid MIME types', () => {
    expect(() => validateUploadInput({
      contentType: 'image/gif',
      fileSize: 100,
      maxFileSize: 1000,
    })).toThrow(expect.objectContaining({ code: 'UNSUPPORTED_MEDIA_TYPE' }))
  })

  it('request body too large fails', async () => {
    const app = createSecurityApp()
    const response = await app.handle(new Request('http://localhost/api/public', {
      method: 'POST',
      headers: {
        'content-length': '20',
        'x-forwarded-for': '6.6.6.6',
      },
      body: '01234567890123456789',
    }))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } })
  })

  it('suspicious activity is logged', () => {
    const appContext = createAppContext()
    const service = new SecurityService(appContext)

    service.logSuspiciousActivity({
      type: 'SECURITY_POLICY_VIOLATION',
      metadata: { authorization: 'Bearer abc123', userId: 'user-1' },
    })

    expect(appContext.logger.warn).toHaveBeenCalledWith('Security event', expect.objectContaining({
      type: 'SECURITY_POLICY_VIOLATION',
      metadata: { authorization: '[REDACTED]', userId: 'user-1' },
    }))
  })

  it('security errors format with policy violation codes', () => {
    const service = new SecurityService(createAppContext())
    const formatted = service.formatError(
      new SecurityError('Policy violation', 400, 'SECURITY_POLICY_VIOLATION', { token: 'abc' }),
      'production',
    )

    expect(formatted).toEqual({
      status: 400,
      body: {
        error: {
          code: 'SECURITY_POLICY_VIOLATION',
          message: 'Policy violation',
          details: { token: '[REDACTED]' },
        },
      },
    })
  })
})
