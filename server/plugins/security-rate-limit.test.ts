import { EventEmitter } from 'node:events'
import { Elysia } from 'elysia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'

type ProbeRedis = EventEmitter & { status: string; connect: () => Promise<void>; eval: () => Promise<number> }
const { connections } = vi.hoisted(() => ({ connections: Array<ProbeRedis>() }))
vi.mock('ioredis', async () => {
  const { EventEmitter: Events } = await import('node:events')
  return { default: vi.fn().mockImplementation(function () {
    const redis: ProbeRedis = Object.assign(new Events(), {
      status: 'wait', connect: vi.fn(async () => { redis.status = 'ready' }), eval: vi.fn(async () => 1),
    })
    connections.push(redis)
    return redis
  }) }
})
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: async () => null }))
import { createSecurityPlugin, resetSecurityRateLimitBuckets } from './security.plugin.ts'
import { getSecurityConfigFromEnv } from '#server/modules/security/security.config.ts'

const context: AppContext = { logger: { debug() {}, info() {}, warn() {}, error() {} }, config: { environment: 'production' } }
function app() {
  return new Elysia().use(createSecurityPlugin(context, getSecurityConfigFromEnv({
    RATE_LIMIT_ENABLED: 'true', RATE_LIMIT_WINDOW_SECONDS: '1', TRUST_PROXY: 'true',
  }))).get('/api/probe', () => 'ok').compile()
}
beforeEach(() => { resetSecurityRateLimitBuckets(); connections.length = 0 })
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('rate limit resource lifetime', () => {
  it.each(['ready', 'error'])('shares a reconnect wait and removes both listeners after %s', async (event) => {
    vi.stubEnv('REDIS_URL', 'redis://audit.invalid:6379')
    const api = app()
    const redis = connections[0]!
    redis.setMaxListeners(0)
    for (let round = 0; round < 3; round++) {
      redis.status = 'reconnecting'
      const requests = Array.from({ length: 40 }, () => api.handle(new Request('http://audit.test/api/probe')))
      await vi.waitFor(() => expect(redis.listenerCount('ready')).toBeGreaterThan(0))
      if (event === 'ready') { redis.status = 'ready'; redis.emit('ready') }
      else redis.emit('error', new Error('unavailable'))
      const responses = await Promise.all(requests)
      expect(responses.every(response => response.status === (event === 'ready' ? 200 : 503))).toBe(true)
      expect(redis.listenerCount('ready')).toBe(0)
      expect(redis.listenerCount('error')).toBe(1)
    }
  })

  it('reclaims expired inactive subjects with bounded sweeps while preserving active limits', async () => {
    vi.stubEnv('REDIS_URL', '')
    let now = 1000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const deleted = vi.spyOn(Map.prototype, 'delete')
    const api = app()
    for (let index = 0; index < 250; index++) {
      expect((await api.handle(new Request('http://audit.test/api/probe', { headers: { 'x-forwarded-for': `expired-${index}` } }))).status).toBe(200)
    }
    now = 3000
    for (let index = 0; index < 4; index++) await api.handle(new Request('http://audit.test/api/probe', { headers: { 'x-forwarded-for': `live-${index}` } }))
    expect(deleted.mock.calls.filter(([key]) => typeof key === 'string' && key.startsWith('public:ip:expired-'))).toHaveLength(250)
    for (let index = 1; index < 600; index++) await api.handle(new Request('http://audit.test/api/probe', { headers: { 'x-forwarded-for': 'live-0' } }))
    expect((await api.handle(new Request('http://audit.test/api/probe', { headers: { 'x-forwarded-for': 'live-0' } }))).status).toBe(429)
  })
})
