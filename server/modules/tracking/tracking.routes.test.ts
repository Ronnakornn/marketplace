import { Elysia } from 'elysia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrackingRoutes } from './tracking.routes.ts'
import { TrackingService } from './tracking.service.ts'
import { createSecurityPlugin, resetSecurityRateLimitBuckets } from '#server/plugins/security.plugin.ts'
import { getSecurityConfigFromEnv } from '#server/modules/security/security.config.ts'
import { MAX_IMPRESSION_BATCH_BYTES } from './tracking.limits.ts'

vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn(async () => null) }))

const productId = '11111111-1111-4111-8111-111111111111'
const shopId = '22222222-2222-4222-8222-222222222222'
const context = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
const event = { eventType: 'product_impression', productId, shopId, position: 0, source: 'search_results', sessionId: 'anonymous' }

function fixture(withSecurity = false, maxEvents = 600) {
  const repo = {
    findActiveProducts: vi.fn().mockResolvedValue([{ id: productId, shopId }]),
    createProductViewLogs: vi.fn(),
    findActiveProduct: vi.fn().mockResolvedValue({ id: productId, shopId }),
    createProductViewLog: vi.fn(),
  }
  const service = new TrackingService(context, repo as never, {} as never)
  const app = new Elysia()
  if (withSecurity) app.use(createSecurityPlugin(context, getSecurityConfigFromEnv({ RATE_LIMIT_MAX_REQUESTS: String(maxEvents) })))
  app.use(createTrackingRoutes({ trackingService: service } as never))
  const post = (body: unknown, path = '/api/discovery/impressions', headers: Record<string, string> = {}) => app.handle(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  }))
  return { repo, post }
}

beforeEach(() => {
  resetSecurityRateLimitBuckets()
  vi.stubEnv('REDIS_URL', '')
})
afterEach(() => vi.unstubAllEnvs())

describe('product impression batch HTTP boundary', () => {
  it('accepts fifty impressions in one write and keeps the single event endpoint', async () => {
    const f = fixture()
    const response = await f.post({ events: Array.from({ length: 50 }, (_, position) => ({ ...event, position })) })
    expect(response.status, await response.clone().text()).toBe(200)
    expect(f.repo.createProductViewLogs.mock.calls[0]?.[0]).toHaveLength(50)
    expect((await f.post({ ...event, eventType: 'product_click' }, '/api/discovery/track')).status).toBe(200)
    expect(f.repo.createProductViewLog).toHaveBeenCalledOnce()
  })

  it.each([
    { events: [] },
    { events: Array.from({ length: 51 }, () => event) },
    { events: [{ ...event, eventType: 'product_click' }] },
    { events: [{ ...event, productId: undefined }] },
    { events: [{ ...event, position: 'bad' }] },
  ])('rejects malformed batch schemas before reading or writing products %j', async body => {
    const f = fixture()
    const response = await f.post(body)
    expect(response.status, await response.clone().text()).toBe(422)
    expect(f.repo.findActiveProducts).not.toHaveBeenCalled()
    expect(f.repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('rejects invalid later ownership or metadata without writing an earlier valid event', async () => {
    for (const invalid of [{ shopId: '33333333-3333-4333-8333-333333333333' }, { timestamp: 'invalid' }, { position: 0.5 }]) {
      const f = fixture()
      const response = await f.post({ events: [event, { ...event, ...invalid }] })
      expect(response.status, await response.clone().text()).toBe(400)
      expect(f.repo.createProductViewLogs).not.toHaveBeenCalled()
    }
  })

  it('bounds encoded multibyte bytes without trusting Content-Length before any product query', async () => {
    const f = fixture()
    const response = await f.post({ events: [{ ...event, filters: { label: 'ก'.repeat(MAX_IMPRESSION_BATCH_BYTES / 2) } }] })
    expect(response.status, await response.clone().text()).toBe(413)
    expect(f.repo.findActiveProducts).not.toHaveBeenCalled()
    expect(f.repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it.each(['/api/discovery/impressions', '/api/discovery/impressions/'])('charges the exact batch count against the same public budget as single events for %s', async path => {
    const f = fixture(true, 4)
    expect((await f.post({ events: [event, event, event] }, path)).status).toBe(200)
    expect((await f.post(event, '/api/discovery/track')).status).toBe(200)
    const blocked = await f.post({ events: [event] })
    expect(blocked.status, await blocked.clone().text()).toBe(429)
    expect(f.repo.createProductViewLogs).toHaveBeenCalledOnce()
    expect(f.repo.createProductViewLog).toHaveBeenCalledOnce()
  })

  it('does not read or write a batch when its remaining events exceed the rate budget', async () => {
    const f = fixture(true, 3)
    expect((await f.post(event, '/api/discovery/track')).status).toBe(200)
    const response = await f.post({ events: [event, event, event] })
    expect(response.status, await response.clone().text()).toBe(429)
    expect(f.repo.findActiveProducts).not.toHaveBeenCalled()
    expect(f.repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('retains only the cheap request admission charge for invalid batch schemas', async () => {
    const f = fixture(true, 3)
    expect((await f.post({ events: Array.from({ length: 51 }, () => event) })).ok).toBe(false)
    expect((await f.post({ events: [event, event] })).status).toBe(200)
    expect((await f.post(event, '/api/discovery/track')).status).toBe(429)
    expect(f.repo.createProductViewLogs).toHaveBeenCalledOnce()
  })

  it('rejects an oversized declared body before the tracking route handler', async () => {
    const f = fixture(true)
    const response = await f.post({ events: [event] }, undefined, { 'content-length': String(MAX_IMPRESSION_BATCH_BYTES + 1) })
    expect(response.status).toBe(413)
    expect(f.repo.findActiveProducts).not.toHaveBeenCalled()
  })
})
