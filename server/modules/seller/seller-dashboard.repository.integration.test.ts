import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import type { OrderStatus, PaymentStatus, ShipmentStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { reportingDayRange, reportingMonthRange } from '#server/lib/reporting-calendar.ts'
import { PrismaSellerDashboardRepository } from './seller-dashboard.repository.ts'

const url = process.env['COMMERCE_TEST_DATABASE_URL']
const context: AppContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}
const now = new Date('2026-10-01T12:00:00.000Z')
const periods = { today: reportingDayRange(now), month: reportingMonthRange(now) }
const large = 9007199254740993n

describe.skipIf(!url)('Seller dashboard aggregates on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaSellerDashboardRepository
  let shopId: string
  let otherShopId: string
  let productId: string
  let variantId: string
  let userId: string
  let firstOrderId: string

  async function createSale(amount: bigint, createdAt: string, status: OrderStatus = 'PAID', paymentStatus: PaymentStatus = 'SUCCEEDED', targetShopId = shopId) {
    const cart = await db.cart.create({ data: { userId, status: 'CHECKED_OUT' } })
    const checkout = await db.checkout.create({ data: {
      cartId: cart.id, userId, status: 'COMPLETED', subtotal: amount, grandTotal: amount, expiresAt: now,
    } })
    const order = await db.order.create({ data: {
      checkoutId: checkout.id, userId, orderNumber: randomUUID(), status, paymentStatus,
      subtotal: amount, grandTotal: amount, createdAt: new Date(createdAt),
      shippingName: 'Buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH',
    } })
    await db.orderItem.create({ data: {
      orderId: order.id, shopId: targetShopId, variantId, quantity: 1, unitPrice: amount, lineTotal: amount,
      productTitle: 'Product', productSlug: 'product', variantTitle: 'Variant', variantSku: 'sku', shopName: 'Shop', shopSlug: 'shop',
    } })
    return order.id
  }

  async function createVariant(sku: string, stock: { quantityOnHand: number; quantityReserved: number; reorderLevel: number } | null, updatedAt: string, targetProductId = productId) {
    return db.productVariant.create({ data: {
      productId: targetProductId, sku, title: sku, price: 1n, updatedAt: new Date(updatedAt),
      ...(stock ? { inventory: { create: stock } } : {}),
    } })
  }

  beforeAll(async () => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    repo = new PrismaSellerDashboardRepository(context, db)
    const tag = randomUUID()
    const seller = await db.user.create({ data: { name: 'Dashboard seller', email: `${tag}@example.test` } })
    userId = seller.id
    const profile = await db.sellerProfile.create({ data: { userId } })
    const shopData = { ownerId: userId, sellerProfileId: profile.id, status: 'ACTIVE' as const, contactEmail: seller.email, contactPhone: '0800000000' }
    const shop = await db.shop.create({ data: { ...shopData, name: tag, slug: tag } })
    shopId = shop.id
    const otherShop = await db.shop.create({ data: { ...shopData, name: `${tag}-other`, slug: `${tag}-other` } })
    otherShopId = otherShop.id
    const product = await db.product.create({ data: { shopId, title: tag, slug: tag, status: 'ACTIVE' } })
    productId = product.id
    variantId = (await createVariant('sales-no-inventory', null, '2026-10-01T00:00:00.000Z')).id
    firstOrderId = await createSale(1n, '2026-09-30T16:59:59.999Z')
    await createSale(large, '2026-09-30T17:00:00.000Z')
    await createSale(4n, '2026-10-01T16:59:59.999Z')
    await createSale(8n, '2026-10-01T17:00:00.000Z')
    await createSale(16n, '2026-10-31T16:59:59.999Z')
    await createSale(32n, '2026-10-31T17:00:00.000Z')
    for (const status of ['PROCESSING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_FULFILLED', 'FULFILLED'] satisfies OrderStatus[]) {
      await createSale(2n, '2026-10-01T00:00:00.000Z', status)
    }
    for (const status of ['PENDING_PAYMENT', 'CANCELED', 'REFUNDED'] satisfies OrderStatus[]) {
      await createSale(1000n, '2026-10-01T00:00:00.000Z', status)
    }
    for (const paymentStatus of ['REQUIRES_ACTION', 'PENDING', 'FAILED', 'CANCELED', 'REFUNDED'] satisfies PaymentStatus[]) {
      await createSale(1000n, '2026-10-01T00:00:00.000Z', 'PAID', paymentStatus)
    }
    await createSale(2000n, '2026-10-01T00:00:00.000Z', 'PAID', 'SUCCEEDED', otherShopId)
    for (const status of ['PENDING_PACK', 'PENDING_PACK', 'SHIPPED', 'DELIVERED', 'CANCELED', 'PACKED', 'READY', 'PENDING'] satisfies ShipmentStatus[]) {
      const orderId = await createSale(0n, '2026-10-01T00:00:00.000Z')
      await db.shipment.create({ data: { orderId, shopId, status } })
    }
    await db.shipment.create({ data: { orderId: firstOrderId, shopId: otherShopId, status: 'PENDING_PACK' } })
    await createVariant('threshold', { quantityOnHand: 10, quantityReserved: 8, reorderLevel: 2 }, '2026-10-02T00:00:00.000Z')
    await createVariant('negative', { quantityOnHand: 1, quantityReserved: 3, reorderLevel: 0 }, '2026-10-03T00:00:00.000Z')
    await createVariant('healthy', { quantityOnHand: 10, quantityReserved: 1, reorderLevel: 2 }, '2026-10-04T00:00:00.000Z')
    const otherProduct = await db.product.create({ data: { shopId: otherShopId, title: `${tag}-other`, slug: `${tag}-other` } })
    await createVariant('other-low', { quantityOnHand: 0, quantityReserved: 0, reorderLevel: 2 }, '2026-10-05T00:00:00.000Z', otherProduct.id)
  })

  afterAll(async () => { await db?.$disconnect() })

  it('sums exact money with inclusive Bangkok bounds and legacy payment/order statuses', async () => {
    expect(await repo.aggregateSales([shopId], periods)).toEqual({
      todaySalesCents: large + 14n,
      thisMonthSalesCents: large + 38n,
      totalSalesCents: large + 71n,
    })
    expect(await repo.aggregateSales([otherShopId], periods)).toEqual({
      todaySalesCents: 2000n, thisMonthSalesCents: 2000n, totalSalesCents: 2000n,
    })
  })

  it('returns zero values for a shop scope with no records', async () => {
    const absentShop = randomUUID()
    expect(await repo.aggregateSales([absentShop], periods)).toEqual({ todaySalesCents: 0n, thisMonthSalesCents: 0n, totalSalesCents: 0n })
    expect(await repo.countShipmentsByStatus([absentShop])).toEqual([])
    expect(await repo.findLowStockVariants([absentShop])).toEqual([])
  })

  it('counts every shipment status and isolates the requested shop', async () => {
    const groups = await repo.countShipmentsByStatus([shopId])
    expect(Object.fromEntries(groups.map(({ status, count }) => [status, count]))).toEqual({
      PENDING_PACK: 2, SHIPPED: 1, DELIVERED: 1, CANCELED: 1, PACKED: 1, READY: 1, PENDING: 1,
    })
  })

  it('filters inventory arithmetic in the database and preserves descending variant update order', async () => {
    const rows = await repo.findLowStockVariants([shopId])
    expect(rows.map((row) => row.sku)).toEqual(['negative', 'threshold'])
    expect(rows.map((row) => row.inventory.quantityOnHand - row.inventory.quantityReserved)).toEqual([-2, 2])
    expect(rows.every((row) => row.productId === productId)).toBe(true)
  })

  it('returns zero aggregates and no stock rows for an empty shop scope', async () => {
    expect(await repo.aggregateSales([], periods)).toEqual({ todaySalesCents: 0n, thisMonthSalesCents: 0n, totalSalesCents: 0n })
    expect(await repo.countShipmentsByStatus([])).toEqual([])
    expect(await repo.findLowStockVariants([])).toEqual([])
  })

  it('keeps lifetime sums exact when valid stored amounts exceed bigint column range in aggregate', async () => {
    const owner = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: {
      ownerId: true, sellerProfileId: true, contactEmail: true, contactPhone: true,
    } })
    const largeShop = await db.shop.create({ data: { ...owner, name: 'Large totals', slug: randomUUID(), status: 'ACTIVE' } })
    const amount = 9_000_000_000_000_000_000n
    await createSale(amount, '2026-10-01T00:00:00.000Z', 'PAID', 'SUCCEEDED', largeShop.id)
    await createSale(amount, '2026-10-01T00:00:00.000Z', 'PAID', 'SUCCEEDED', largeShop.id)

    expect(await repo.aggregateSales([largeShop.id], periods)).toEqual({
      todaySalesCents: 18_000_000_000_000_000_000n,
      thisMonthSalesCents: 18_000_000_000_000_000_000n,
      totalSalesCents: 18_000_000_000_000_000_000n,
    })
  })
})
