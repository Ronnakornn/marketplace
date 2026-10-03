import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/client/client.ts'
import type { AppContext } from '../server/context/app-context.ts'
import type { ActiveShopResolver } from '../server/modules/security/index.ts'
import { PrismaProductAnalyticsRepository } from '../server/modules/product-analytics/product-analytics.repository.ts'
import { ProductAnalyticsService } from '../server/modules/product-analytics/product-analytics.service.ts'

const databaseUrl = process.env['COMMERCE_TEST_DATABASE_URL']
if (!databaseUrl) throw new Error('COMMERCE_TEST_DATABASE_URL is required')
const database = new URL(databaseUrl)
if (process.env['ANALYTICS_LOAD_ALLOW_LOCAL'] !== 'true'
  || !['127.0.0.1', 'localhost'].includes(database.hostname)
  || !['postgres:', 'postgresql:'].includes(database.protocol)
  || !/^\/marketplace_test_/.test(database.pathname)
  || !database.port || database.search || database.hash) {
  throw new Error('Require ANALYTICS_LOAD_ALLOW_LOCAL=true and an explicit local marketplace_test_* database port')
}

const sizes = (process.env['ANALYTICS_LOAD_SIZES'] ?? '501,5000,20000').split(',').map(Number)
if (!sizes.length || sizes.some((size) => ![501, 5000, 20000].includes(size)) || new Set(sizes).size !== sizes.length) {
  throw new Error('Dataset sizes must be distinct members of 501,5000,20000')
}
const output = path.resolve(process.env['ANALYTICS_LOAD_REPORT'] ?? 'test-results/analytics-load.json')
const MAX_RUNTIME_MS = 15 * 60 * 1000
const MAX_HEAP_BYTES = 2 * 1024 * 1024 * 1024
const BATCH_SIZE = 500
const started = performance.now()
const startedAt = new Date().toISOString()
const context: AppContext = {
  logger: { debug() {}, info() {}, warn() {}, error() {} },
  config: { environment: 'test' },
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl, max: 10 }),
  log: [{ level: 'query', emit: 'event' }],
})
let queryCount = 0
db.$on('query', () => { queryCount += 1 })
let heapPeak = 0
let rssPeak = 0
let samples = 0
let safetyFailure: string | undefined
let measuring = false
const records: Record<string, unknown>[] = []
const fixtures: Record<string, unknown>[] = []
let fatal: string | undefined

function sampleMemory(): void {
  const memory = process.memoryUsage()
  heapPeak = Math.max(heapPeak, memory.heapUsed)
  rssPeak = Math.max(rssPeak, memory.rss)
  samples += 1
  if (memory.heapUsed > MAX_HEAP_BYTES) safetyFailure = 'Measured heap exceeded 2 GiB safety bound'
  if (performance.now() - started > MAX_RUNTIME_MS) safetyFailure = 'Measured runtime exceeded 15 minute safety bound'
}

function assertSafety(): void {
  sampleMemory()
  if (safetyFailure) throw new Error(safetyFailure)
}

function publish(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function fixture(size: number) {
  const tag = `analytics-load-${randomUUID()}`
  const user = await db.user.create({ data: { name: 'Analytics load seller', email: `${tag}@example.test` } })
  const profile = await db.sellerProfile.create({ data: { userId: user.id } })
  const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: tag, slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
  fixtures.push({ tag, size, shopId: shop.id, userId: user.id })
  const products = Array.from({ length: size }, (_, index) => ({ id: randomUUID(), variantId: randomUUID(), ordinal: index + 1 }))
  const subtotal = BigInt(size) * BigInt(size + 1) / 2n
  const createdAt = new Date('2026-10-03T17:00:00.000Z')
  const cart = await db.cart.create({ data: { userId: user.id, status: 'CHECKED_OUT' } })
  const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: user.id, status: 'COMPLETED', subtotal, grandTotal: subtotal, expiresAt: createdAt } })
  const order = await db.order.create({ data: { checkoutId: checkout.id, userId: user.id, orderNumber: tag, status: 'PAID', paymentStatus: 'SUCCEEDED', subtotal, grandTotal: subtotal, createdAt, shippingName: 'Load buyer', shippingLine1: 'Test', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
  await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: tag, status: 'SUCCEEDED', amount: subtotal, currency: 'THB' } })
  for (let start = 0; start < size; start += BATCH_SIZE) {
    assertSafety()
    const batch = products.slice(start, start + BATCH_SIZE)
    await db.$transaction(async (tx) => {
      await tx.product.createMany({ data: batch.map((item) => ({ id: item.id, shopId: shop.id, title: `${tag}-${item.ordinal}`, slug: `${tag}-${item.ordinal}`, status: 'ACTIVE' })) })
      await tx.productVariant.createMany({ data: batch.map((item) => ({ id: item.variantId, productId: item.id, sku: `${tag}-${item.ordinal}`, title: `${item.ordinal}`, price: BigInt(item.ordinal), status: 'ACTIVE' })) })
      await tx.orderItem.createMany({ data: batch.map((item) => ({ orderId: order.id, shopId: shop.id, variantId: item.variantId, quantity: 1, unitPrice: BigInt(item.ordinal), lineTotal: BigInt(item.ordinal), productTitle: tag, productSlug: tag, variantTitle: tag, variantSku: `${tag}-${item.ordinal}`, shopName: tag, shopSlug: tag })) })
      await tx.productViewLog.createMany({ data: batch.map((item) => ({ productId: item.id, shopId: shop.id, createdAt })) })
      await tx.productAddToCartLog.createMany({ data: batch.map((item) => ({ productId: item.id, variantId: item.variantId, shopId: shop.id, quantity: 3, createdAt })) })
    }, { timeout: 30_000 })
  }
  assert.equal(await db.product.count({ where: { shopId: shop.id } }), size)
  assert.equal(await db.productVariant.count({ where: { product: { shopId: shop.id } } }), size)
  assert.equal(await db.orderItem.count({ where: { shopId: shop.id } }), size)
  const resolver = { resolveActiveShops: async () => [shop] } as unknown as ActiveShopResolver
  const service = new ProductAnalyticsService(context, new PrismaProductAnalyticsRepository(context, db), resolver)
  const actor = { id: user.id, role: 'USER' as const }
  return { service, actor, products, shopId: shop.id }
}

const query = { range: 'custom' as const, from: '2026-10-04', to: '2026-10-04', sort: 'revenue', limit: 10 }
const topExpected: Record<number, string[]> = {
  501: ['501', '500', '499'], 5000: ['5000', '4999', '4998'], 20000: ['20000', '19999', '19998'],
}
const lastExpected: Record<number, string[]> = {
  501: ['1'], 5000: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'], 20000: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
}

try {
  for (const size of sizes) {
    const fixtureStarted = performance.now()
    const f = await fixture(size)
    publish({ event: 'fixture-ready', size, fixtureMs: performance.now() - fixtureStarted, shopId: f.shopId })
    const firstStarted = performance.now()
    const first = await f.service.getProducts(f.actor, query)
    assert.deepEqual(first.items.slice(0, 3).map((item) => String(item.revenue)), topExpected[size])
    assert.deepEqual(first.items.slice(0, 3).map((item) => item.productId), f.products.slice(-3).reverse().map((item) => item.id))
    const firstRequestMs = performance.now() - firstStarted
    const lastPage = Math.ceil(size / 10)
    for (const endpoint of ['products', 'skus'] as const) {
      const last = endpoint === 'products'
        ? await f.service.getProducts(f.actor, { ...query, page: lastPage })
        : await f.service.getSkus(f.actor, { ...query, page: lastPage })
      assert.deepEqual(last.items.map((item) => String(item.revenue)), lastExpected[size])
      assert.equal(last.pagination.total, size)
      assert.equal(last.pagination.totalPages, lastPage)
    }
    for (const concurrency of [1, 5, 20]) {
      assertSafety()
      const before = process.memoryUsage()
      heapPeak = before.heapUsed
      rssPeak = before.rss
      samples = 0
      queryCount = 0
      const durations: number[] = []
      const phaseStarted = performance.now()
      measuring = true
      const timer = setInterval(sampleMemory, 20)
      try {
        for (let wave = 0; wave < 3; wave += 1) {
          assertSafety()
          await Promise.all(Array.from({ length: concurrency }, async (_, index) => {
            const requestStarted = performance.now()
            const productsEndpoint = (wave + index) % 2 === 0
            const result = productsEndpoint ? await f.service.getProducts(f.actor, query) : await f.service.getSkus(f.actor, query)
            assert.deepEqual(result.items.slice(0, 3).map((item) => String(item.revenue)), topExpected[size])
            assert.equal(result.pagination.total, size)
            assert.equal(result.items.length, 10)
            for (const item of result.items) assert.equal(item.unitsSold, 1)
            durations.push(performance.now() - requestStarted)
            assertSafety()
          }))
        }
      } finally {
        clearInterval(timer)
        measuring = false
        sampleMemory()
      }
      durations.sort((a, b) => a - b)
      const elapsedMs = performance.now() - phaseStarted
      const result = {
        size, concurrency, waves: 3, requests: durations.length, errors: 0,
        firstRequestMs, elapsedMs, throughputPerSecond: durations.length / (elapsedMs / 1000),
        minMs: durations[0], medianMs: durations[Math.floor(durations.length / 2)],
        p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], maxMs: durations.at(-1),
        sqlQueries: queryCount, memorySamples: samples,
        heapBeforeBytes: before.heapUsed, heapPeakBytes: heapPeak, heapAfterBytes: process.memoryUsage().heapUsed,
        rssBeforeBytes: before.rss, rssPeakBytes: rssPeak, rssAfterBytes: process.memoryUsage().rss,
        passedRankingAndPagination: true,
      }
      records.push(result)
      publish({ event: 'phase-complete', ...result })
    }
  }
} catch (error) {
  fatal = error instanceof Error ? error.message : String(error)
  process.exitCode = 1
  publish({ event: 'failed', fatal, measuring })
} finally {
  await db.$disconnect()
  const report = {
    startedAt, finishedAt: new Date().toISOString(), runtimeMs: performance.now() - started,
    target: 'ProductAnalyticsService.getProducts/getSkus + production PrismaProductAnalyticsRepository in this measured process',
    runtime: process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.versions.node}`,
    pid: process.pid, platform: os.platform(), logicalCpus: os.cpus().length, machineMemoryBytes: os.totalmem(),
    poolMax: 10, safety: { maxRuntimeMs: MAX_RUNTIME_MS, maxHeapBytes: MAX_HEAP_BYTES, maxDataset: 20000, maxConcurrency: 20 },
    samplingIntervalMs: 20, cache: 'No analytics application cache; first request and repeated requests only',
    fixtures, records, fatal: fatal ?? null,
    limitations: ['Direct services, not HTTP/UI/network/auth load', '20ms sampling can miss shorter allocation peaks', 'No production SLO inferred from this local bounded run', 'Unique test fixtures retained for root-owned environment cleanup'],
  }
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  publish({ event: 'report-saved', output, fatal: fatal ?? null })
}
