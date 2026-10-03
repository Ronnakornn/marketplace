import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { hashPassword } from 'better-auth/crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client.ts'

// Run against an already migrated, disposable local API/database. This measures
// pending-order creation; it never follows a payment URL or emits a webhook.
const base = new URL(required('LOAD_TEST_BASE_URL'))
const databaseUrl = required('LOAD_TEST_DATABASE_URL')
const database = new URL(databaseUrl)
if (process.env.LOAD_TEST_ALLOW_LOCAL !== 'true'
  || !['localhost', '127.0.0.1'].includes(base.hostname)
  || base.protocol !== 'http:' || !base.port || base.pathname !== '/'
  || base.username || base.password || base.search || base.hash
  || !['localhost', '127.0.0.1'].includes(database.hostname)
  || !['postgres:', 'postgresql:'].includes(database.protocol)
  || !/^\/marketplace_(test|e2e)_/.test(database.pathname)) {
  throw new Error('Require LOAD_TEST_ALLOW_LOCAL=true, explicit local HTTP port, and local marketplace_test_*/marketplace_e2e_* database')
}
const users = positive('LOAD_TEST_USERS', 100, true)
const minutes = positive('LOAD_TEST_MINUTES', 30)
const checkoutsPerMinute = positive('LOAD_TEST_CHECKOUTS_PER_MINUTE', 10)
const thinkMs = positive('LOAD_TEST_THINK_MS', 1000)
const timeoutMs = positive('LOAD_TEST_TIMEOUT_MS', 10000, true)
const p95LimitMs = positive('LOAD_TEST_P95_MS', 1000)
const errorLimit = positive('LOAD_TEST_ERROR_RATE', 0.01)
const expectedCheckouts = Math.floor(minutes * checkoutsPerMinute)
// Explicit local-only model: the target must trust this harness as its proxy.
// The shared-IP default exercises NAT throttling without overriding any limiter.
const distinctClientIps = process.env.LOAD_TEST_DISTINCT_CLIENT_IPS === 'true'
const output = path.resolve(process.env.LOAD_TEST_REPORT ?? 'test-results/production-load.json')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
type Actor = { cookie: string; addressId: string; clientIp?: string }
type Metric = { count: number; errors: number; durations: number[]; statuses: Record<string, number>; failureTypes: Record<string, number> }
const metrics: Record<string, Metric> = {}
let measuring = false
let checkoutAttempts = 0
let checkoutSuccesses = 0
let interrupted = false
process.once('SIGINT', () => { interrupted = true })
process.once('SIGTERM', () => { interrupted = true })
const startedAt = new Date().toISOString()
let fatal: string | null = null
let workloadStarted = 0
let workloadFinished = 0
let progressTimer: ReturnType<typeof setInterval> | undefined
let fixture: { tag: string; productId: string; variantId: string } | undefined
let catalogDataset: { products: number; variants: number; shops: number } | undefined
const machine = {
  platform: os.platform(), release: os.release(), architecture: os.arch(),
  runtime: process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.versions.node}`,
  logicalCpus: os.cpus().length, cpuModel: os.cpus()[0]?.model ?? 'unknown',
  totalMemoryBytes: os.totalmem(), initialFreeMemoryBytes: os.freemem(),
}

try {
  const tag = randomUUID()
  const password = `Load-${randomUUID()}!`
  const passwordHash = await hashPassword(password)
  const seller = await prisma.user.create({ data: { name: 'Load seller', email: `${tag}-seller@example.test`, emailVerified: true } })
  const profile = await prisma.sellerProfile.create({ data: { userId: seller.id } })
  const shop = await prisma.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: 'Load shop', slug: tag, status: 'ACTIVE', contactEmail: seller.email, contactPhone: '0800000000' } })
  const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Load fixture product', slug: tag, status: 'ACTIVE' } })
  const variant = await prisma.productVariant.create({ data: { productId: product.id, title: 'Load variant', sku: tag, price: 1000, inventory: { create: { quantityOnHand: Math.ceil(minutes * checkoutsPerMinute) + users + 100 } } } })
  fixture = { tag, productId: product.id, variantId: variant.id }
  const actors: Actor[] = []
  for (let i = 0; i < users; i++) {
    if (interrupted) throw new Error('Interrupted during fixture setup')
    const buyer = await prisma.user.create({ data: { name: `Load buyer ${i}`, email: `${tag}-${i}@example.test`, emailVerified: true, status: 'ACTIVE' } })
    await prisma.account.create({ data: { userId: buyer.id, accountId: buyer.id, providerId: 'credential', issuer: 'local:credential', password: passwordHash } })
    const address = await prisma.address.create({ data: { userId: buyer.id, recipientName: buyer.name, phone: '0800000000', line1: '1 Test Road', city: 'Bangkok', postalCode: '10110', country: 'TH' } })
    const clientIp = distinctClientIps ? `10.${Math.floor(i / 65025) % 256}.${Math.floor(i / 255) % 255}.${i % 255 + 1}` : undefined
    const response = await fetch(new URL('/api/auth/sign-in/email', base), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'content-type': 'application/json', origin: base.origin, ...(clientIp ? { 'x-forwarded-for': clientIp, 'x-real-ip': clientIp } : {}) },
      body: JSON.stringify({ email: buyer.email, password }),
    })
    // Read all response data, but never print credentials, cookies, or bodies.
    await response.text()
    const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    if (!response.ok || !cookie) throw new Error(`Fixture login failed with HTTP ${response.status}; check API/database match and auth rate limits`)
    actors.push({ cookie, addressId: address.id, clientIp })
    await sleep(positive('LOAD_TEST_LOGIN_DELAY_MS', 1200))
  }
  const [products, variants, shops] = await Promise.all([
    prisma.product.count(), prisma.productVariant.count(), prisma.shop.count(),
  ])
  catalogDataset = { products, variants, shops }
  process.stdout.write(`Prepared ${users} authenticated users; starting ${minutes} minute workload\n`)
  measuring = true
  workloadStarted = performance.now()
  progressTimer = setInterval(() => {
    const all = Object.values(metrics)
    const requests = all.reduce((sum, metric) => sum + metric.count, 0)
    const errors = all.reduce((sum, metric) => sum + metric.errors, 0)
    process.stdout.write(`Load progress: ${Math.floor((performance.now() - workloadStarted) / 1000)}s, ${requests} requests, ${errors} errors, ${checkoutSuccesses}/${checkoutAttempts} checkouts, freeMemoryMiB=${Math.round(os.freemem() / 1048576)}\n`)
  }, 60000)
  const deadline = workloadStarted + minutes * 60000
  const checkoutInterval = 60000 / checkoutsPerMinute
  const actorCheckoutChains = actors.map(() => Promise.resolve())
  const checkoutWork = Array.from({ length: expectedCheckouts }, (_, slot) => {
    const actorIndex = slot % actors.length
    const actor = actors[actorIndex]!
    const dueAt = workloadStarted + slot * checkoutInterval
    const previousActorCheckout = actorCheckoutChains[actorIndex]!
    const work = sleep(Math.max(0, dueAt - performance.now()))
      .then(() => previousActorCheckout)
      .then(async () => {
        if (interrupted) return
        checkoutAttempts++
        try {
          const cart = await request('cart-add', '/api/cart/items', actor, { variantId: variant.id, quantity: 1 })
          const cartItemIds = Array.isArray(cart.shops)
            ? cart.shops.flatMap((group: { items: Array<{ id: string }> }) => group.items.map(item => item.id)) : []
          if (typeof cart.id !== 'string' || cartItemIds.length === 0) throw new Error('Invalid cart response')
          const selection = { cartId: cart.id, cartItemIds }
          await request('checkout-quote', '/api/checkout/quote', actor, selection,
            value => typeof value.grandTotal === 'number' && value.grandTotal > 0)
          await request('checkout-create', '/api/checkout', actor,
            { ...selection, addressId: actor.addressId, paymentMethod: 'card', locale: 'en' },
            value => typeof value.orderId === 'string' && typeof value.paymentId === 'string' && value.paymentStatus === 'pending' && value.totalCents > 0)
          checkoutSuccesses++
        } catch { /* HTTP/business failures are counted; attempt remains failed. */ }
      })
    actorCheckoutChains[actorIndex] = work.catch(() => {})
    return work
  })
  const catalogWork = Promise.all(actors.map(async (actor, index) => {
    await sleep(index * thinkMs / users)
    let catalogTurn = 0
    while (!interrupted && performance.now() < deadline) {
      try {
        const detail = catalogTurn++ % 2 === 1
        await request(detail ? 'catalog-detail' : 'catalog-list', detail ? `/api/products/${product.id}` : '/api/products?limit=20', actor)
      } catch { /* Continue collecting failures without silently dropping them. */ }
      await sleep(thinkMs)
    }
  }))
  await Promise.all([catalogWork, ...checkoutWork])
  workloadFinished = performance.now()
} catch (error) {
  // Only setup errors use our controlled messages. Runtime infrastructure errors
  // can contain connection details, so retain the class rather than its message.
  fatal = error instanceof Error && /^(Fixture login|Interrupted)/.test(error.message) ? error.message : 'Setup or infrastructure failure; check local services'
} finally {
  if (progressTimer) clearInterval(progressTimer)
  await prisma.$disconnect()
  const endpoints = Object.fromEntries(Object.entries(metrics).map(([name, metric]) => [name, {
    requests: metric.count, errors: metric.errors, errorRate: metric.errors / metric.count,
    p95Ms: percentile(metric.durations, 0.95), statuses: metric.statuses, failureTypes: metric.failureTypes,
  }]))
  const all = Object.values(metrics)
  const requests = all.reduce((sum, metric) => sum + metric.count, 0)
  const errors = all.reduce((sum, metric) => sum + metric.errors, 0)
  const p95Ms = percentile(all.flatMap(metric => metric.durations), 0.95)
  const completeDuration = workloadFinished > 0 && workloadFinished - workloadStarted >= minutes * 60000
  const pass = !fatal && !interrupted && completeDuration && requests > 0
    && checkoutSuccesses >= expectedCheckouts && errors / requests < errorLimit
    && checkoutAttempts > 0 && (checkoutAttempts - checkoutSuccesses) / checkoutAttempts < errorLimit
    && p95Ms < p95LimitMs && Object.values(endpoints).every(metric => metric.p95Ms < p95LimitMs && metric.errorRate < errorLimit)
  const report = { startedAt, finishedAt: new Date().toISOString(), pass, fatal, interrupted, machine, fixture, catalogDataset,
    scope: 'Local HTTP catalog and authenticated pending checkout; no payment completion or external provider calls; unique fixtures retained in disposable database',
    configured: { users, minutes, checkoutsPerMinute, thinkMs, timeoutMs, p95LimitMs, errorLimit,
      fetchConcurrencyLimit: process.versions.bun ? Number(process.env.BUN_CONFIG_MAX_HTTP_REQUESTS ?? 256) : null,
      clientIpModel: distinctClientIps ? 'synthetic distinct IP per user; target must enable TRUST_PROXY=true for this local harness' : 'shared connection IP; NAT rate limits apply' },
    actualDurationSeconds: workloadFinished ? (workloadFinished - workloadStarted) / 1000 : 0,
    requests, errors, errorRate: requests ? errors / requests : null, p95Ms,
    checkoutAttempts, checkoutSuccesses, expectedCheckouts, endpoints }
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(`Load ${pass ? 'PASS' : 'FAIL'}: ${requests} requests, ${errors} errors, ${checkoutSuccesses}/${expectedCheckouts} checkouts. Report: ${output}\n`)
  if (!pass) process.exitCode = 1
}

async function request(name: string, route: string, actor: Actor, body?: unknown, valid: (value: any) => boolean = value => value !== null && typeof value === 'object' && !value.error) {
  const begin = performance.now()
  let status = 'network'
  let ok = false
  let failureType = 'unknown'
  try {
    const response = await fetch(new URL(route, base), {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { cookie: actor.cookie, origin: base.origin, 'content-type': 'application/json',
        ...(actor.clientIp ? { 'x-forwarded-for': actor.clientIp, 'x-real-ip': actor.clientIp } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    status = String(response.status)
    const value = await response.json()
    ok = response.ok && valid(value)
    if (!ok) failureType = `HTTP_${status}_or_invalid_response`
    if (!ok) throw new Error('HTTP or business response failure')
    return value
  } catch (error) {
    if (failureType === 'unknown') {
      const detail = error as { code?: unknown; name?: unknown; cause?: { code?: unknown } }
      const code = String(detail?.code ?? detail?.cause?.code ?? detail?.name ?? 'unknown')
      // Diagnostic classifications only; error messages can contain credentials/URLs.
      failureType = /^[A-Za-z0-9_]{1,64}$/.test(code) ? code : 'unknown'
    }
    throw error
  } finally {
    if (measuring) {
      const metric = metrics[name] ??= { count: 0, errors: 0, durations: [], statuses: {}, failureTypes: {} }
      metric.count++
      metric.errors += Number(!ok)
      metric.durations.push(performance.now() - begin)
      metric.statuses[status] = (metric.statuses[status] ?? 0) + 1
      if (!ok) metric.failureTypes[failureType] = (metric.failureTypes[failureType] ?? 0) + 1
    }
  }
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value }
function positive(name: string, fallback: number, integer = false) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) throw new Error(`${name} must be positive${integer ? ' integer' : ''}`)
  return value
}
function percentile(values: number[], quantile: number) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * quantile) - 1]! }
function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }
