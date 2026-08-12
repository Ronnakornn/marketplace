import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

import { createSecurityPlugin, resetSecurityRateLimitBuckets } from '#server/plugins/security.plugin.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { ActiveShopResolver } from './active-shop.ts'
import { OwnershipGuards, type OwnershipGuardRepository } from './ownership-guards.ts'
import { SecurityError } from './security.errors.ts'
import { SecurityService } from './security.service.ts'
import { validateUploadInput } from './upload-validation.ts'
import { getSecurityConfigFromEnv } from './security.config.ts'

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
      sellerReadMaxRequests: 2,
      sellerWriteMaxRequests: 2,
      sellerMediaMaxRequests: 1,
      sellerReviewMaxRequests: 1,
      requestBodyLimitBytes: 10,
      trustProxy: false,
      requireContentLength: false,
    }))
    .get('/api/public', () => ({ ok: true }))
    .get('/api/auth/session', () => ({ ok: true }))
    .get('/api/checkout/test', () => ({ ok: true }))
    .get('/api/admin/test', () => ({ ok: true }))
    .get('/api/seller/products', () => ({ ok: true }))
    .post('/api/seller/products', () => ({ ok: true }))
    .post('/api/seller/products/:productId/images', () => ({ ok: true }))
    .post('/api/seller/products/:productId/submit-review', () => ({ ok: true }))
    .post('/api/public', () => ({ ok: true }))
    .get('/api/error', () => {
      throw new Error('internal failure token=abc123')
    })
}

function createOwnershipRepo(overrides: Partial<Record<keyof OwnershipGuardRepository, boolean>> = {}): OwnershipGuardRepository {
  return {
    cartBelongsToUser: vi.fn(async () => overrides.cartBelongsToUser ?? true),
    orderBelongsToUser: vi.fn(async () => overrides.orderBelongsToUser ?? true),
    activeShopBelongsToUser: vi.fn(async () => overrides.activeShopBelongsToUser ?? true),
    productBelongsToActiveShop: vi.fn(async () => overrides.productBelongsToActiveShop ?? true),
    shipmentBelongsToActiveShop: vi.fn(async () => overrides.shipmentBelongsToActiveShop ?? true),
    findActiveShopsForUser: vi.fn(async () => [{ id: 'shop-1', ownerId: 'seller-1', status: 'ACTIVE' as const }]),
    findActiveShopForUser: vi.fn(async () => ({ id: 'shop-1', ownerId: 'seller-1', status: 'ACTIVE' as const })),
  }
}

describe('security hardening', () => {
  beforeEach(() => {
    resetSecurityRateLimitBuckets()
    vi.clearAllMocks()
    vi.mocked(getAuthContext).mockResolvedValue(null)
  })

  it('uses production-safe documented defaults when rate limits are not configured', () => {
    expect(getSecurityConfigFromEnv({})).toMatchObject({
      rateLimitWindowSeconds: 60,
      publicMaxRequests: 600,
      authMaxRequests: 120,
      checkoutMaxRequests: 180,
      adminMaxRequests: 300,
      sellerReadMaxRequests: 180,
      sellerWriteMaxRequests: 30,
      sellerMediaMaxRequests: 10,
      sellerReviewMaxRequests: 5,
    })
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

  it('falls back to memory when Redis is unavailable outside production', async () => {
    const originalRedisUrl = process.env['REDIS_URL']
    process.env['REDIS_URL'] = 'redis://127.0.0.1:1'
    try {
      const response = await createSecurityApp(createAppContext('development'))
        .handle(new Request('http://localhost/api/public'))

      expect(response.status).toBe(200)
    } finally {
      if (originalRedisUrl === undefined) delete process.env['REDIS_URL']
      else process.env['REDIS_URL'] = originalRedisUrl
    }
  })

  it('fails closed when Redis is unavailable in production', async () => {
    const originalRedisUrl = process.env['REDIS_URL']
    process.env['REDIS_URL'] = 'redis://127.0.0.1:1'
    try {
      const response = await createSecurityApp(createAppContext('production'))
        .handle(new Request('http://localhost/api/public'))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMIT_UNAVAILABLE' } })
    } finally {
      if (originalRedisUrl === undefined) delete process.env['REDIS_URL']
      else process.env['REDIS_URL'] = originalRedisUrl
    }
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

  it('seller reads are limited by seller identity instead of IP address', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'seller-1' } } as never)
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/seller/products', { headers: { 'x-forwarded-for': '7.7.7.7' } }))
    await app.handle(new Request('http://localhost/api/seller/products', { headers: { 'x-forwarded-for': '8.8.8.8' } }))
    const response = await app.handle(new Request('http://localhost/api/seller/products', { headers: { 'x-forwarded-for': '9.9.9.9' } }))

    expect(response.status).toBe(429)
  })

  it('seller product writes, media uploads, and review submissions use separate limits', async () => {
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'seller-1' } } as never)
    const app = createSecurityApp()

    await app.handle(new Request('http://localhost/api/seller/products', { method: 'POST' }))
    await app.handle(new Request('http://localhost/api/seller/products', { method: 'POST' }))
    const writeResponse = await app.handle(new Request('http://localhost/api/seller/products', { method: 'POST' }))
    expect(writeResponse.status).toBe(429)

    await app.handle(new Request('http://localhost/api/seller/products/product-1/images', { method: 'POST' }))
    const mediaResponse = await app.handle(new Request('http://localhost/api/seller/products/product-1/images', { method: 'POST' }))
    expect(mediaResponse.status).toBe(429)

    await app.handle(new Request('http://localhost/api/seller/products/product-1/submit-review', { method: 'POST' }))
    const reviewResponse = await app.handle(new Request('http://localhost/api/seller/products/product-1/submit-review', { method: 'POST' }))
    expect(reviewResponse.status).toBe(429)
  })

  it('seller ownership guard blocks wrong seller', async () => {
    const guards = new OwnershipGuards(createOwnershipRepo({ activeShopBelongsToUser: false }))

    await expect(guards.assertSellerOwnsShop('seller-1', 'shop-2'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('seller ownership guard requires active shop ownership', async () => {
    const repo = createOwnershipRepo({ activeShopBelongsToUser: false })
    const guards = new OwnershipGuards(repo)

    await expect(guards.assertSellerOwnsShop('seller-1', 'shop-1'))
      .rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(repo.activeShopBelongsToUser).toHaveBeenCalledWith('seller-1', 'shop-1')
  })

  it('active shop resolver authorizes only active shops owned by the user', async () => {
    const repo = createOwnershipRepo()
    const resolver = new ActiveShopResolver(repo)

    await expect(resolver.requireAnyActiveShop('seller-1')).resolves.toMatchObject({
      id: 'shop-1',
      ownerId: 'seller-1',
      status: 'ACTIVE',
    })
    expect(repo.findActiveShopsForUser).toHaveBeenCalledWith('seller-1')

    vi.mocked(repo.findActiveShopsForUser).mockResolvedValueOnce([])
    await expect(resolver.requireAnyActiveShop('pending-seller'))
      .rejects.toMatchObject({ status: 403, code: 'SELLER_SHOP_NOT_ACTIVE' })

    vi.mocked(repo.findActiveShopForUser).mockResolvedValueOnce(null)
    await expect(resolver.requireActiveShop('seller-1', 'other-shop'))
      .rejects.toMatchObject({ status: 403, code: 'SELLER_SHOP_NOT_ACTIVE' })
    expect(repo.findActiveShopForUser).toHaveBeenCalledWith('seller-1', 'other-shop')
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
