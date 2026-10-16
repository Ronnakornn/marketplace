import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaReturnRepository } from './return.repository.ts'
import { ReturnService } from './return.service.ts'
import { PrismaPayoutRepository } from '#server/modules/payout/payout.repository.ts'
import { PayoutService } from '#server/modules/payout/payout.service.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('bounded return and payout lists on PostgreSQL', () => {
  let db: PrismaClient
  let returns: ReturnService
  let payouts: PayoutService
  let fixture: Awaited<ReturnType<typeof createFixture>>

  beforeAll(async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55439' || !/^\/marketplace_test_.*_test$/.test(url.pathname)) {
      throw new Error('Use a disposable local marketplace_test_*_test database on port 55439')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) })
    returns = new ReturnService(context, new PrismaReturnRepository(context, db))
    payouts = new PayoutService(context, new PrismaPayoutRepository(context, db))
    fixture = await createFixture()
  })
  afterAll(async () => { await db?.$disconnect() })

  async function createFixture() {
    const buyer = await db.user.create({ data: { name: 'List buyer', email: `${randomUUID()}@example.test` } })
    const foreignBuyer = await db.user.create({ data: { name: 'Foreign buyer', email: `${randomUUID()}@example.test` } })
    const shops = []
    for (let index = 0; index < 2; index++) {
      const seller = await db.user.create({ data: { name: `List seller ${index}`, email: `${randomUUID()}@example.test` } })
      const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
      const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: `List shop ${index}`, slug: randomUUID(), status: 'ACTIVE', contactEmail: seller.email, contactPhone: '0800000000' } })
      const wallet = await db.shopWallet.create({ data: { shopId: shop.id, currency: 'THB' } })
      const product = await db.product.create({ data: { shopId: shop.id, title: index === 0 ? 'Own item' : 'Secret foreign title', slug: randomUUID() } })
      const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: randomUUID(), price: 9007199254740993n } })
      shops.push({ seller, shop, wallet, product, variant })
    }
    const first = shops[0]!
    const foreign = shops[1]!
    async function order(userId: string) {
      const cart = await db.cart.create({ data: { userId, status: 'CHECKED_OUT' } })
      const checkout = await db.checkout.create({ data: { userId, cartId: cart.id, status: 'COMPLETED', subtotal: 9007199254740993n, grandTotal: 9007199254740993n, expiresAt: new Date() } })
      return db.order.create({ data: { userId, checkoutId: checkout.id, orderNumber: randomUUID(), status: 'DELIVERED', paymentStatus: 'SUCCEEDED', subtotal: 9007199254740993n, grandTotal: 9007199254740993n,
        shippingName: 'List buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
    }
    const ownOrder = await order(buyer.id)
    const foreignOrder = await order(foreignBuyer.id)
    async function item(orderId: string, source: typeof first) {
      return db.orderItem.create({ data: { orderId, shopId: source.shop.id, variantId: source.variant.id, productTitle: source.product.title, productSlug: source.product.slug,
        variantTitle: source.variant.title, variantSku: source.variant.sku, shopName: source.shop.name, shopSlug: source.shop.slug, quantity: 1,
        unitPrice: source.variant.price, lineTotal: source.variant.price, currency: 'THB', fulfillmentStatus: 'DELIVERED' } })
    }
    const ownItem = await item(ownOrder.id, first)
    const mixedItem = await item(ownOrder.id, foreign)
    const foreignItem = await item(foreignOrder.id, foreign)
    const returnRows = Array.from({ length: 61 }, (_, index) => ({ id: randomUUID(), userId: buyer.id, shopId: first.shop.id, orderId: ownOrder.id,
      reason: index === 0 ? 'Needle return beyond first fifty' : 'Ordinary return', status: index === 0 ? 'COMPLETED' as const : 'REQUESTED' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000) }))
    await db.returnRequest.createMany({ data: returnRows })
    await db.returnItem.createMany({ data: returnRows.map((row) => ({ returnRequestId: row.id, orderItemId: ownItem.id, quantity: 1 })) })
    await db.returnItem.create({ data: { returnRequestId: returnRows[60]!.id, orderItemId: mixedItem.id, quantity: 1 } })
    await db.returnRequest.create({ data: { userId: foreignBuyer.id, shopId: foreign.shop.id, orderId: foreignOrder.id, reason: 'Needle return beyond first fifty', status: 'COMPLETED',
      items: { create: { orderItemId: foreignItem.id, quantity: 1 } } } })
    const payoutRows = Array.from({ length: 61 }, (_, index) => ({ id: randomUUID(), walletId: first.wallet.id, shopId: first.shop.id, requestedById: first.seller.id,
      amount: 9007199254740993n + BigInt(index), currency: 'THB', status: index === 0 ? 'paid' as const : 'requested' as const,
      externalReference: index === 0 ? 'NEEDLE-BANK-REF' : null, requestedAt: new Date(Date.UTC(2026, 0, 1) + index * 1000) }))
    await db.sellerPayout.createMany({ data: payoutRows })
    await db.sellerPayout.create({ data: { walletId: foreign.wallet.id, shopId: foreign.shop.id, requestedById: foreign.seller.id, amount: 1n, currency: 'THB', status: 'paid', externalReference: 'NEEDLE-BANK-REF' } })
    return { buyer, first, foreign, foreignBuyer, returnRows, payoutRows }
  }

  it('reaches every buyer return exactly once, retaining totals and exact historical money', async () => {
    const pages = await Promise.all([1, 2, 3, 4].map((page) => returns.listBuyerReturns(fixture.buyer, { page, limit: 20 })))
    expect(pages.map((page) => page.data.length)).toEqual([20, 20, 20, 1])
    expect(pages.map((page) => page.meta.totalCount)).toEqual([61, 61, 61, 61])
    expect(pages.flatMap((page) => page.data.map((row) => row.id))).toEqual([...fixture.returnRows].reverse().map((row) => row.id))
    expect(pages[3]?.data[0]?.items[0]?.lineTotal).toBe(9007199254740993n)
    const filtered = await returns.listBuyerReturns(fixture.buyer, { q: 'needle', status: 'completed' })
    expect(filtered.data.map((row) => row.id)).toEqual([fixture.returnRows[0]!.id])
    expect(filtered.meta.totalCount).toBe(1)
  })

  it('filters seller return searches and items by owned shops before pagination', async () => {
    const owned = await returns.listSellerReturns(fixture.first.seller, { page: 4, limit: 20 })
    expect(owned.meta.totalCount).toBe(61)
    expect(owned.data.map((row) => row.id)).toEqual([fixture.returnRows[0]!.id])
    const firstPage = await returns.listSellerReturns(fixture.first.seller, {})
    expect(firstPage.data.every((row) => row.items.every((item) => item.shopId === fixture.first.shop.id))).toBe(true)
    expect((await returns.listSellerReturns(fixture.first.seller, { q: 'Secret foreign title' })).data).toEqual([])
    expect((await returns.listSellerReturns(fixture.first.seller, { q: '%_' })).data).toEqual([])
    expect((await returns.listSellerReturns(fixture.first.seller, { shopId: fixture.foreign.shop.id })).meta.totalCount).toBe(0)
  })

  it('preserves payout scope, requested order, full totals, status and exact amounts past fifty', async () => {
    const pages = await Promise.all([1, 2, 3, 4].map((page) => payouts.listSellerPayouts(fixture.first.seller, { page, limit: 20 })))
    expect(pages.map((page) => page.data.length)).toEqual([20, 20, 20, 1])
    expect(pages.flatMap((page) => page.data.map((row) => row.id))).toEqual([...fixture.payoutRows].reverse().map((row) => row.id))
    expect(pages[3]?.data[0]?.amount).toBe(9007199254740993n)
    expect(pages[3]?.meta.totalCount).toBe(61)
    const filtered = await payouts.listSellerPayouts(fixture.first.seller, { q: 'needle-bank', status: 'paid' })
    expect(filtered.data.map((row) => row.id)).toEqual([fixture.payoutRows[0]!.id])
    expect((await payouts.listSellerPayouts(fixture.first.seller, { shopId: fixture.foreign.shop.id })).meta.totalCount).toBe(0)
    const admin = await payouts.listAdminPayouts({ id: randomUUID(), role: 'ADMIN' }, { shopId: fixture.first.shop.id, q: 'needle-bank', status: 'paid' })
    expect(admin.data.map((row) => row.id)).toEqual([fixture.payoutRows[0]!.id])
    expect(admin.meta.totalCount).toBe(1)
    const byAmount = await payouts.listAdminPayouts({ id: randomUUID(), role: 'ADMIN' }, { shopId: fixture.first.shop.id, q: '9007199254740993' })
    expect(byAmount.data.map((row) => row.id)).toEqual([fixture.payoutRows[0]!.id])
    const byIdPrefix = await payouts.listAdminPayouts({ id: randomUUID(), role: 'ADMIN' }, { shopId: fixture.first.shop.id, q: fixture.payoutRows[0]!.id.slice(0, 8) })
    expect(byIdPrefix.data.map((row) => row.id)).toEqual([fixture.payoutRows[0]!.id])
    const byStatus = await payouts.listAdminPayouts({ id: randomUUID(), role: 'ADMIN' }, { shopId: fixture.first.shop.id, q: 'paid' })
    expect(byStatus.data.map((row) => row.id)).toEqual([fixture.payoutRows[0]!.id])
  })
})
