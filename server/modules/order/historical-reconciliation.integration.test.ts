import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { HistoricalReconciliationRepository } from './historical-reconciliation.repository.ts'
import { HistoricalReconciliationService } from './historical-reconciliation.service.ts'
import type { HistoricalReconciliationInput } from './historical-reconciliation.schema.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('original historical facts on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a disposable local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture() {
    const buyer = await db.user.create({ data: { name: 'Historical buyer', email: `${randomUUID()}@example.test` } })
    const admin = await db.user.create({ data: { name: 'Historical admin', email: `${randomUUID()}@example.test`, role: 'ADMIN', emailVerified: true } })
    const cart = await db.cart.create({ data: { userId: buyer.id } })
    const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: buyer.id, expiresAt: new Date() } })
    const shops = await Promise.all([4000, 6000].map(async price => {
      const owner = await db.user.create({ data: { name: 'Historical owner', email: `${randomUUID()}@example.test` } })
      const profile = await db.sellerProfile.create({ data: { userId: owner.id } })
      const shop = await db.shop.create({ data: { ownerId: owner.id, sellerProfileId: profile.id, name: 'Historical shop', slug: randomUUID(), contactEmail: owner.email, contactPhone: '0800000000' } })
      const product = await db.product.create({ data: { shopId: shop.id, title: 'Original item', slug: randomUUID() } })
      const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Original variant', sku: randomUUID(), price } })
      return { shop, variant, product, price }
    }))
    const order = await db.order.create({ data: {
      checkoutId: checkout.id, userId: buyer.id, orderNumber: randomUUID(), subtotal: 10000n, discountTotal: 2000n,
      shippingTotal: 500n, taxTotal: 0n, grandTotal: 8500n, shippingName: 'Historical buyer', shippingLine1: 'Original address',
      shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
      items: { create: shops.map(({ shop, product, variant, price }) => ({
        shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug,
        variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug,
        quantity: 1, unitPrice: price, lineTotal: price,
      })) },
    } })
    const facts: HistoricalReconciliationInput = {
      orderId: order.id, sourceReference: `original-export/${order.orderNumber}.json`,
      shops: shops.map(({ shop }, index) => ({ shopId: shop.id, currency: 'THB', status: 'PENDING_PAYMENT', fulfillmentStatus: 'PENDING',
        subtotal: index === 0 ? '4000' : '6000', discountTotal: index === 0 ? '800' : '1200',
        shippingTotal: index === 0 ? '200' : '300', taxTotal: '0', grandTotal: index === 0 ? '3400' : '5100' })),
    }
    const service = new HistoricalReconciliationService(context, new HistoricalReconciliationRepository(db))
    return { buyer, admin, order, facts, service }
  }

  async function noWrites(orderId: string) {
    expect(await db.shopOrder.count({ where: { orderId } })).toBe(0)
    expect(await db.auditLog.count({ where: { entityId: orderId } })).toBe(0)
  }

  it('previews exactly the missing shops without writing', async () => {
    const { admin, order, facts, service } = await fixture()
    expect(await service.reconcile(admin.id, facts)).toMatchObject({ mode: 'dry-run', missingShopIds: facts.shops.map(shop => shop.shopId) })
    await noWrites(order.id)
  })

  it('applies the original literal amounts once and preserves the evidence', async () => {
    const { admin, order, facts, service } = await fixture()
    const result = await service.reconcile(admin.id, facts, true)
    expect(await db.shopOrder.findMany({ where: { orderId: order.id }, orderBy: { subtotal: 'asc' } })).toMatchObject([
      { subtotal: 4000n, discountTotal: 800n, shippingTotal: 200n, taxTotal: 0n, grandTotal: 3400n, createdAt: order.createdAt },
      { subtotal: 6000n, discountTotal: 1200n, shippingTotal: 300n, taxTotal: 0n, grandTotal: 5100n, createdAt: order.createdAt },
    ])
    const audits = await db.auditLog.findMany({ where: { entityId: order.id } })
    expect(audits).toMatchObject([{ actorUserId: admin.id, action: 'ORDER_SNAPSHOT_RECONCILED', metadata: { sourceReference: facts.sourceReference, factsSha256: result.factsSha256 } }])
    const reversed = { ...facts, shops: [...facts.shops].reverse() }
    expect(await service.reconcile(admin.id, reversed, true)).toMatchObject({ missingShopIds: [], factsSha256: result.factsSha256 })
    expect(await db.auditLog.count({ where: { entityId: order.id } })).toBe(1)
    expect(await db.walletLedgerEntry.count({ where: { orderId: order.id } })).toBe(0)
    expect(await db.itemSaleSnapshot.count({ where: { orderItem: { orderId: order.id } } })).toBe(0)
  })

  it('serializes concurrent applications into one restoration and audit', async () => {
    const { admin, order, facts, service } = await fixture()
    const outcomes = await Promise.all([service.reconcile(admin.id, facts, true), service.reconcile(admin.id, facts, true)])
    expect(outcomes.map(result => result.missingShopIds.length).sort()).toEqual([0, 2])
    expect(await db.shopOrder.count({ where: { orderId: order.id } })).toBe(2)
    expect(await db.auditLog.count({ where: { entityId: order.id } })).toBe(1)
  })

  it('refuses new-policy settlement snapshots instead of treating them as legacy', async () => {
    const { admin, order, facts, service } = await fixture()
    const original = facts.shops[0]
    const shop = await db.shopOrder.create({ data: { orderId: order.id, shopId: original.shopId, subtotal: 4000n, discountTotal: 800n,
      shippingTotal: 200n, grandTotal: 3400n, saleSnapshot: { create: { currency: 'THB', commissionBase: 3200n,
        commissionBps: 1000, originalCommission: 320n, originalShipping: 200n, buyerShipping: 200n,
        sellerShippingWaiver: 0n, platformShippingSubsidy: 0n } } } })
    await expect(service.reconcile(admin.id, facts, true)).rejects.toMatchObject({ code: 'HISTORICAL_FACTS_CONFLICT' })
    expect(await db.shopOrder.findMany({ where: { orderId: order.id } })).toEqual([shop])
    expect(await db.auditLog.count({ where: { entityId: order.id } })).toBe(0)
  })

  it('rolls back both restored rows when the audit cannot persist', async () => {
    const { admin, order, facts } = await fixture()
    const instrumented = db.$extends({ query: { auditLog: { async create() { throw new Error('audit unavailable') } } } })
    const service = new HistoricalReconciliationService(context, new HistoricalReconciliationRepository(instrumented as unknown as PrismaClient))
    await expect(service.reconcile(admin.id, facts, true)).rejects.toThrow('audit unavailable')
    await noWrites(order.id)
  })

  it('fills only a missing shop and never overwrites an existing snapshot', async () => {
    const { admin, order, facts, service } = await fixture()
    const original = facts.shops[0]
    const existing = await db.shopOrder.create({ data: { orderId: order.id, ...original,
      subtotal: BigInt(original.subtotal), discountTotal: BigInt(original.discountTotal),
      shippingTotal: BigInt(original.shippingTotal), taxTotal: BigInt(original.taxTotal), grandTotal: BigInt(original.grandTotal) } })
    expect(await service.reconcile(admin.id, facts, true)).toMatchObject({ missingShopIds: [facts.shops[1].shopId] })
    expect(await db.shopOrder.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(existing)
    await db.shopOrder.update({ where: { id: existing.id }, data: { grandTotal: 3401n } })
    await expect(service.reconcile(admin.id, facts, true)).rejects.toMatchObject({ code: 'HISTORICAL_FACTS_CONFLICT' })
    expect((await db.shopOrder.findUniqueOrThrow({ where: { id: existing.id } })).grandTotal).toBe(3401n)
  })

  it.each(['buyer', 'unverified', 'suspended'] as const)('denies the %s actor before writes', async kind => {
    const { buyer, admin, order, facts, service } = await fixture()
    if (kind === 'unverified') await db.user.update({ where: { id: admin.id }, data: { emailVerified: false } })
    if (kind === 'suspended') await db.user.update({ where: { id: admin.id }, data: { status: 'SUSPENDED' } })
    await expect(service.reconcile(kind === 'buyer' ? buyer.id : admin.id, facts, true)).rejects.toMatchObject({ status: 403 })
    await noWrites(order.id)
  })

  it.each(['empty-reference', 'missing-shop', 'duplicate-shop', 'wrong-total', 'wrong-currency', 'wrong-line', 'unknown-field'] as const)
    ('rejects %s evidence without inventing allocation', async kind => {
      const { admin, order, facts, service } = await fixture()
      if (kind === 'empty-reference') facts.sourceReference = ' '
      if (kind === 'missing-shop') facts.shops.pop()
      if (kind === 'duplicate-shop') facts.shops[1] = { ...facts.shops[0] }
      if (kind === 'wrong-total') facts.shops[0].grandTotal = '3401'
      if (kind === 'wrong-currency') facts.shops[0].currency = 'USD'
      if (kind === 'wrong-line') await db.orderItem.updateMany({ where: { orderId: order.id }, data: { quantity: 2 } })
      const input = kind === 'unknown-field' ? { ...facts, funding: 'guess' } : facts
      await expect(service.reconcile(admin.id, input, true)).rejects.toMatchObject({ code: kind === 'unknown-field' ? 'HISTORICAL_FACTS_INVALID' : 'HISTORICAL_FACTS_CONFLICT' })
      await noWrites(order.id)
    })

  it('keeps cents above the JavaScript limit exact in PostgreSQL', async () => {
    const { admin, order, facts, service } = await fixture()
    const first = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id, shopId: facts.shops[0].shopId } })
    await db.orderItem.update({ where: { id: first.id }, data: { unitPrice: 9007199254740993n, lineTotal: 9007199254740993n } })
    await db.order.update({ where: { id: order.id }, data: { subtotal: 9007199254746993n, grandTotal: 9007199254745493n } })
    facts.shops[0].subtotal = '9007199254740993'
    facts.shops[0].grandTotal = '9007199254740393'
    await service.reconcile(admin.id, facts, true)
    expect((await db.shopOrder.findUniqueOrThrow({ where: { orderId_shopId: { orderId: order.id, shopId: facts.shops[0].shopId } } })).grandTotal).toBe(9007199254740393n)
  })

  it('runs the guarded CLI in dry-run mode and requires explicit apply', async () => {
    const { admin, order, facts } = await fixture()
    const folder = await mkdtemp(join(tmpdir(), 'marketplace-reconciliation-'))
    const manifest = join(folder, 'original-facts.json')
    try {
      await writeFile(manifest, JSON.stringify(facts))
      const result = spawnSync('bun', ['scripts/reconcile-historical-shop-orders.ts', manifest], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl!, RECONCILIATION_ADMIN_ID: admin.id }, encoding: 'utf8', timeout: 15000,
      })
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain('"mode": "dry-run"')
      await noWrites(order.id)
      const applied = spawnSync('bun', ['scripts/reconcile-historical-shop-orders.ts', manifest, '--apply'], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl!, RECONCILIATION_ADMIN_ID: admin.id }, encoding: 'utf8', timeout: 15000,
      })
      expect(applied.status, applied.stderr).toBe(0)
      expect(applied.stdout).toContain('"mode": "apply"')
      expect(await db.shopOrder.count({ where: { orderId: order.id } })).toBe(2)
      const forbidden = spawnSync('bun', ['scripts/reconcile-historical-shop-orders.ts', manifest, '--apply'], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: 'postgresql://postgres@127.0.0.1:55439/production', RECONCILIATION_ADMIN_ID: admin.id }, encoding: 'utf8', timeout: 15000,
      })
      expect(forbidden.status).not.toBe(0)
      expect(forbidden.stderr).toContain('disposable local marketplace test database')
    } finally {
      await rm(manifest, { force: true })
      await rmdir(folder)
    }
  })
})
