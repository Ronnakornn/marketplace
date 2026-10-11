import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient, type Order } from '#generated/client/client.ts'
import { CommissionService } from '#server/modules/commission'
import { PrismaWalletRepository } from './wallet.repository.ts'
import { WalletService } from './wallet.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('durable seller earning reconstruction on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })

  async function fixture(options: { snapshot?: boolean; zero?: boolean; status?: Order['status']; paymentStatus?: Order['paymentStatus']; id?: string } = {}) {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Earning recovery', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Recovery shop', slug: tag, contactEmail: user.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Recovery item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price: 1000n } })
    const cart = await prisma.cart.create({ data: { userId: user.id } })
    const checkout = await prisma.checkout.create({ data: { cartId: cart.id, userId: user.id, status: 'COMPLETED', expiresAt: new Date() } })
    const total = options.zero ? 0n : 1000n
    const order = await prisma.order.create({ data: {
      id: options.id, checkoutId: checkout.id, userId: user.id, orderNumber: tag,
      status: options.status ?? 'DELIVERED', paymentStatus: options.paymentStatus ?? 'SUCCEEDED',
      subtotal: 1000n, discountTotal: 1000n - total, grandTotal: total,
      shippingName: 'Buyer', shippingLine1: '1 Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
    } })
    const item = await prisma.orderItem.create({ data: {
      orderId: order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug,
      variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug,
      quantity: 1, unitPrice: 1000n, lineTotal: 1000n, fulfillmentStatus: 'DELIVERED',
    } })
    const shopOrder = await prisma.shopOrder.create({ data: {
      orderId: order.id, shopId: shop.id, status: order.status, fulfillmentStatus: 'DELIVERED',
      subtotal: 1000n, discountTotal: 1000n - total, grandTotal: total,
    } })
    if (options.snapshot) {
      await prisma.shopSaleSnapshot.create({ data: {
        shopOrderId: shopOrder.id, currency: 'THB', commissionBase: total, commissionBps: 1000,
        originalCommission: total / 10n, originalShipping: 0n, buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n,
      } })
      await prisma.itemSaleSnapshot.create({ data: {
        orderItemId: item.id, shopOrderId: shopOrder.id, originalQuantity: 1, grossMerchandise: 1000n,
        sellerCouponDiscount: 1000n - total, platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: total,
      } })
    }
    return { order, shop, shopOrder }
  }

  function scopedRecovery(orderIds: string[]) {
    const repo = new PrismaWalletRepository(context, prisma)
    const realCandidates = repo.findOrdersMissingEarnings.bind(repo)
    const owned = new Set(orderIds)
    vi.spyOn(repo, 'findOrdersMissingEarnings').mockImplementation(async (afterOrderId, limit) => {
      let cursor = afterOrderId
      while (true) {
        const page = await realCandidates(cursor, limit)
        if (!page.length) return []
        const candidates = page.filter((candidate) => owned.has(candidate.id))
        if (candidates.length) return candidates
        cursor = page[page.length - 1]!.id
      }
    })
    return { service: new WalletService(context, repo, new CommissionService(context, 1000)), realCandidates }
  }

  it('reconstructs snapshot, legacy and zero entitlement once under overlapping scans and replay', async () => {
    const snapshot = await fixture({ snapshot: true })
    const legacy = await fixture({ status: 'FULFILLED' })
    const zero = await fixture({ snapshot: true, zero: true })
    const ids = [snapshot.order.id, legacy.order.id, zero.order.id]
    const { service } = scopedRecovery(ids)

    await Promise.all([service.reconcileSellerEarnings(1), service.reconcileSellerEarnings(1)])
    await expect(service.reconcileSellerEarnings(1)).resolves.toEqual({ attemptedCount: 0, succeededCount: 0, failedCount: 0 })

    const entries = await prisma.walletLedgerEntry.findMany({ where: { orderId: { in: ids } } })
    for (const data of [snapshot, legacy]) {
      expect(entries.filter((entry) => entry.orderId === data.order.id).map((entry) => [entry.type, entry.amount])
        .sort(([a], [b]) => String(a).localeCompare(String(b)))).toEqual([['commission_fee', -100n], ['order_earning', 1000n]])
    }
    expect(entries.filter((entry) => entry.orderId === zero.order.id).map((entry) => [entry.type, entry.amount])).toEqual([['order_earning', 0n]])
    for (const data of [snapshot, zero]) {
      expect((await prisma.shopSaleSnapshot.findUniqueOrThrow({ where: { shopOrderId: data.shopOrder.id } })).recognizedAt).toBeInstanceOf(Date)
    }
    const recovered = await prisma.order.findMany({ where: { id: { in: ids } } })
    expect(recovered.every((order) => order.updatedAt.getTime() === [snapshot, legacy, zero].find((data) => data.order.id === order.id)!.order.updatedAt.getTime())).toBe(true)
  })

  it('continues after an earlier malformed snapshot and leaves it retryable while excluding unpaid and partial orders', async () => {
    const failed = await fixture({ snapshot: true, id: `00000000-0000-4000-8000-${randomUUID().slice(-12)}` })
    const repaired = await fixture({ snapshot: true, id: `ffffffff-ffff-4fff-8fff-${randomUUID().slice(-12)}` })
    const partial = await fixture({ snapshot: true, status: 'PARTIALLY_FULFILLED' })
    const unpaid = await fixture({ snapshot: true, paymentStatus: 'PENDING' })
    await prisma.shopSaleSnapshot.update({ where: { shopOrderId: failed.shopOrder.id }, data: { originalCommission: 999n } })
    const { service } = scopedRecovery([failed.order.id, repaired.order.id, partial.order.id, unpaid.order.id])

    await expect(service.reconcileSellerEarnings(1)).resolves.toEqual({ attemptedCount: 2, succeededCount: 1, failedCount: 1 })
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: repaired.order.id, type: 'order_earning' } })).toBe(1)
    expect(await prisma.walletLedgerEntry.count({ where: { orderId: { in: [failed.order.id, partial.order.id, unpaid.order.id] } } })).toBe(0)
    expect((await prisma.shopSaleSnapshot.findUniqueOrThrow({ where: { shopOrderId: failed.shopOrder.id } })).recognizedAt).toBeNull()

    await prisma.shopSaleSnapshot.update({ where: { shopOrderId: failed.shopOrder.id }, data: { originalCommission: 100n } })
    await expect(service.reconcileSellerEarnings(1)).resolves.toEqual({ attemptedCount: 1, succeededCount: 1, failedCount: 0 })
  })
})
