import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaReturnRepository } from './return.repository.ts'
import { ReturnService } from './return.service.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const applicationName = `return-partial-${randomUUID()}`
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('partial Return admission and mutation locks on PostgreSQL', () => {
  let db: PrismaClient
  let returns: ReturnService
  beforeAll(() => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) throw new Error('Use a disposable local marketplace_test_* database')
    url.searchParams.set('application_name', applicationName)
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) })
    returns = new ReturnService(context, new PrismaReturnRepository(context, db))
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(itemCount = 1, snapshotted = true) {
    const buyer = await db.user.create({ data: { name: 'Partial buyer', email: `${randomUUID()}@example.test` } })
    const seller = await db.user.create({ data: { name: 'Partial seller', email: `${randomUUID()}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
    const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: 'Partial shop', slug: randomUUID(), status: 'ACTIVE', contactEmail: seller.email, contactPhone: '0800000000' } })
    const cart = await db.cart.create({ data: { userId: buyer.id, status: 'CHECKED_OUT' } })
    const gross = BigInt(itemCount) * 102n
    const cash = BigInt(itemCount) * 101n
    const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: buyer.id, status: 'COMPLETED', subtotal: gross, discountTotal: BigInt(itemCount), grandTotal: cash, expiresAt: new Date() } })
    const order = await db.order.create({ data: { checkoutId: checkout.id, userId: buyer.id, orderNumber: randomUUID(), status: 'DELIVERED', paymentStatus: 'SUCCEEDED', subtotal: gross, discountTotal: BigInt(itemCount), grandTotal: cash,
      shippingName: 'Buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
    const shopOrder = await db.shopOrder.create({ data: { orderId: order.id, shopId: shop.id, status: 'DELIVERED', fulfillmentStatus: 'DELIVERED', subtotal: gross, discountTotal: BigInt(itemCount), grandTotal: cash } })
    const payment = await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: 'SUCCEEDED', amount: cash, currency: 'THB', paidAt: new Date() } })
    if (snapshotted) await db.shopSaleSnapshot.create({ data: { shopOrderId: shopOrder.id, currency: 'THB', commissionBase: cash, commissionBps: 1000, originalCommission: cash / 10n,
      originalShipping: 0n, buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n } })
    const items = []
    for (let index = 0; index < itemCount; index++) {
      const product = await db.product.create({ data: { shopId: shop.id, title: 'Partial item', slug: randomUUID() } })
      const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: randomUUID(), price: 34n } })
      const item = await db.orderItem.create({ data: { orderId: order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug, variantTitle: variant.title, variantSku: variant.sku,
        shopName: shop.name, shopSlug: shop.slug, quantity: 3, unitPrice: 34n, lineTotal: 102n, currency: 'THB', fulfillmentStatus: 'DELIVERED' } })
      if (snapshotted) await db.itemSaleSnapshot.create({ data: { orderItemId: item.id, shopOrderId: shopOrder.id, originalQuantity: 3, grossMerchandise: 102n, sellerCouponDiscount: 1n,
        platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: 101n } })
      items.push(item)
    }
    const shipment = await db.shipment.create({ data: { orderId: order.id, shopId: shop.id, status: 'DELIVERED', deliveredAt: new Date(),
      items: { create: items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })) } } })
    const input = { orderId: order.id, orderItemId: items[0]!.id, quantity: 1, reason: 'Damaged' }
    return { buyer, seller, shop, shopOrder, order, payment, items, shipment, input }
  }

  it('accepts exactly one concurrent same-item request', async () => {
    const f = await fixture()
    const outcomes = await Promise.allSettled([returns.createReturn(f.buyer, f.input), returns.createReturn(f.buyer, f.input)])
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(row => row.status === 'rejected')).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: 'RETURN_ALREADY_EXISTS' }) })])
    expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(1)
    expect(await db.returnItem.findMany({ where: { orderItemId: f.items[0]!.id }, select: { quantity: true } })).toEqual([{ quantity: 1 }])
  })

  it('admits the exact seventh-day deadline and rejects one millisecond later on stored shipment evidence', async () => {
    const accepted = await fixture()
    const expired = await fixture()
    const instant = Date.now()
    const deliveredAt = new Date(instant - 7 * 24 * 60 * 60 * 1000)
    await db.shipment.updateMany({ where: { id: { in: [accepted.shipment.id, expired.shipment.id] } }, data: { deliveredAt } })
    const clock = vi.spyOn(Date, 'now').mockReturnValue(instant)
    try {
      await expect(returns.createReturn(accepted.buyer, accepted.input)).resolves.toMatchObject({ status: 'requested' })
      clock.mockReturnValue(instant + 1)
      await expect(returns.createReturn(expired.buyer, expired.input)).rejects.toMatchObject({ code: 'RETURN_WINDOW_EXPIRED' })
      expect(await db.returnRequest.count({ where: { orderId: expired.order.id } })).toBe(0)
    } finally {
      clock.mockRestore()
    }
  })

  it('fails closed for a historical delivered order with no delivery timestamp', async () => {
    const f = await fixture()
    await db.shipment.update({ where: { id: f.shipment.id }, data: { deliveredAt: null } })
    await expect(returns.createReturn(f.buyer, f.input)).rejects.toMatchObject({ code: 'RETURN_DELIVERY_EVIDENCE_MISSING' })
    expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(0)
  })

  it('waits for another shop and starts the window at that shop delivery', async () => {
    const f = await fixture()
    const seller = await db.user.create({ data: { name: 'Second shop seller', email: `${randomUUID()}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
    const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: 'Second shop', slug: randomUUID(), status: 'ACTIVE', contactEmail: seller.email, contactPhone: '0800000000' } })
    const product = await db.product.create({ data: { shopId: shop.id, title: 'Second item', slug: randomUUID() } })
    const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: randomUUID(), price: 34n } })
    const item = await db.orderItem.create({ data: { orderId: f.order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug,
      variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug, quantity: 3, unitPrice: 34n, lineTotal: 102n, currency: 'THB', fulfillmentStatus: 'SHIPPED' } })
    const shopOrder = await db.shopOrder.create({ data: { orderId: f.order.id, shopId: shop.id, status: 'SHIPPED', fulfillmentStatus: 'SHIPPED', subtotal: 102n, discountTotal: 1n, grandTotal: 101n } })
    await db.shopSaleSnapshot.create({ data: { shopOrderId: shopOrder.id, currency: 'THB', commissionBase: 101n, commissionBps: 1000, originalCommission: 10n,
      originalShipping: 0n, buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n } })
    await db.itemSaleSnapshot.create({ data: { orderItemId: item.id, shopOrderId: shopOrder.id, originalQuantity: 3, grossMerchandise: 102n, sellerCouponDiscount: 1n,
      platformCouponDiscount: 0n, coinDiscount: 0n, buyerMerchandise: 101n } })
    const shipment = await db.shipment.create({ data: { orderId: f.order.id, shopId: shop.id, status: 'SHIPPED', shippedAt: new Date(),
      items: { create: { orderItemId: item.id, quantity: 3 } } } })
    const totals = { subtotal: 204n, discountTotal: 2n, grandTotal: 202n }
    await db.checkout.update({ where: { id: f.order.checkoutId }, data: totals })
    await db.order.update({ where: { id: f.order.id }, data: { ...totals, status: 'PARTIALLY_FULFILLED' } })
    await db.payment.update({ where: { id: f.payment.id }, data: { amount: 202n } })
    await db.shipment.update({ where: { id: f.shipment.id }, data: { deliveredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    await expect(returns.createReturn(f.buyer, f.input)).rejects.toMatchObject({ code: 'ORDER_NOT_DELIVERED' })
    expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(0)
    await db.$transaction([
      db.shipment.update({ where: { id: shipment.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } }),
      db.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: 'DELIVERED' } }),
      db.shopOrder.update({ where: { id: shopOrder.id }, data: { status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' } }),
      db.order.update({ where: { id: f.order.id }, data: { status: 'DELIVERED' } }),
    ])
    await expect(returns.createReturn(f.buyer, f.input)).resolves.toMatchObject({ status: 'requested' })
  })

  it('checks the admission deadline after waiting for the Order lock', async () => {
    const f = await fixture()
    const deadline = Date.now() + 60000
    await db.shipment.update({ where: { id: f.shipment.id }, data: { deliveredAt: new Date(deadline - 7 * 24 * 60 * 60 * 1000) } })
    let release!: () => void
    let ready!: () => void
    const locked = new Promise<void>(resolve => { ready = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const holder = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${f.order.id}::uuid FOR UPDATE`
      ready()
      await gate
    })
    await locked
    const admission = returns.createReturn(f.buyer, f.input)
    try {
      await expect.poll(async () => {
        const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE application_name = ${applicationName}
          AND wait_event_type = 'Lock' AND query LIKE '%FROM "Order"%FOR UPDATE%'
        ) AS waiting`
        return rows[0]?.waiting ?? false
      }, { timeout: 2000 }).toBe(true)
      vi.spyOn(Date, 'now').mockReturnValue(deadline + 1)
      release()
      await holder
      await expect(admission).rejects.toMatchObject({ code: 'RETURN_WINDOW_EXPIRED' })
      expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(0)
    } finally {
      release()
      await holder
      vi.restoreAllMocks()
    }
  })

  it('allows different items in one order to hold separate active returns', async () => {
    const f = await fixture(2)
    const created = await Promise.all([returns.createReturn(f.buyer, f.input), returns.createReturn(f.buyer, { ...f.input, orderItemId: f.items[1]!.id })])
    expect(created.map(row => row.status)).toEqual(['requested', 'requested'])
    const approved = await Promise.all(created.map(row => returns.approveSellerReturn(f.seller, row.id)))
    expect(approved.map(row => row.refund?.amount)).toEqual([33n, 33n])
    expect(await db.refund.count({ where: { orderId: f.order.id, status: 'PENDING' } })).toBe(2)
  })

  it('serializes cancellation versus approval and leaves no orphan refund', async () => {
    const f = await fixture()
    const requested = await returns.createReturn(f.buyer, f.input)
    const outcomes = await Promise.allSettled([returns.approveSellerReturn(f.seller, requested.id), returns.cancelBuyerReturn(f.buyer, requested.id)])
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter(row => row.status === 'rejected')).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: 'INVALID_RETURN_STATE' }) })])
    const actual = await db.returnRequest.findUniqueOrThrow({ where: { id: requested.id } })
    expect(['APPROVED', 'CANCELLED']).toContain(actual.status)
    expect(await db.refund.count({ where: { returnRequestId: requested.id } })).toBe(actual.status === 'APPROVED' ? 1 : 0)
  })

  it('rereads terminal Return state after waiting for the parent Order lock', async () => {
    const f = await fixture()
    const requested = await returns.createReturn(f.buyer, f.input)
    let release!: () => void
    let ready!: () => void
    const locked = new Promise<void>(resolve => { ready = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const terminal = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${f.order.id}::uuid FOR UPDATE`
      await tx.returnRequest.update({ where: { id: requested.id }, data: { status: 'COMPLETED' } })
      ready()
      await gate
    })
    await locked
    const approval = returns.approveSellerReturn(f.seller, requested.id)
    try {
      await expect.poll(async () => {
        const rows = await db.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE application_name = ${applicationName}
          AND wait_event_type = 'Lock' AND query LIKE '%FROM "Order"%FOR UPDATE%'
        ) AS waiting`
        return rows[0]?.waiting ?? false
      }, { timeout: 2000 }).toBe(true)
    } finally {
      release()
    }
    await terminal
    await expect(approval).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect((await db.returnRequest.findUniqueOrThrow({ where: { id: requested.id } })).status).toBe('COMPLETED')
    expect(await db.refund.count({ where: { returnRequestId: requested.id } })).toBe(0)
  })

  it('defaults to the remaining quantity after a successful original partial refund', async () => {
    const f = await fixture()
    const original = await db.returnRequest.create({ data: { orderId: f.order.id, shopId: f.shop.id, userId: f.buyer.id, status: 'COMPLETED', items: { create: { orderItemId: f.items[0]!.id, quantity: 1 } } } })
    await db.refund.create({ data: { orderId: f.order.id, paymentId: f.payment.id, returnRequestId: original.id, status: 'SUCCESS', amount: 33n,
      itemAllocations: { create: { orderItemId: f.items[0]!.id, quantity: 1, successfulQuantityBefore: 0, cashMerchandise: 33n, platformCouponReversal: 0n, coinFundingReversal: 0n } },
      shopAllocations: { create: { shopOrderId: f.shopOrder.id, commissionReversal: 3n } } } })
    const requested = await returns.createReturn(f.buyer, { orderId: f.order.id, orderItemId: f.items[0]!.id, reason: 'Remaining damaged units' })
    expect(requested.items.map(row => row.quantity)).toEqual([2])
    const approved = await returns.approveSellerReturn(f.seller, requested.id)
    expect(approved.refund?.amount).toBe(68n)
    expect(await db.refundItemAllocation.findMany({ where: { refund: { returnRequestId: requested.id } }, select: { quantity: true, successfulQuantityBefore: true, cashMerchandise: true } }))
      .toEqual([{ quantity: 2, successfulQuantityBefore: 1, cashMerchandise: 68n }])
  })

  it('rejects an active direct refund even when there is no active Return', async () => {
    const f = await fixture()
    await db.refund.create({ data: { orderId: f.order.id, paymentId: f.payment.id, status: 'PENDING', amount: 33n,
      itemAllocations: { create: { orderItemId: f.items[0]!.id, quantity: 1, cashMerchandise: 33n, platformCouponReversal: 0n, coinFundingReversal: 0n } },
      shopAllocations: { create: { shopOrderId: f.shopOrder.id } } } })
    await expect(returns.createReturn(f.buyer, f.input)).rejects.toMatchObject({ code: 'RETURN_ALREADY_EXISTS' })
    expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(0)
  })

  it('rejects legacy partials and corrupted original snapshots without admitting a Return', async () => {
    const legacy = await fixture(1, false)
    await expect(returns.createReturn(legacy.buyer, legacy.input)).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    const corrupt = await fixture()
    await db.itemSaleSnapshot.update({ where: { orderItemId: corrupt.items[0]!.id }, data: { originalQuantity: 4 } })
    await expect(returns.createReturn(corrupt.buyer, corrupt.input)).rejects.toMatchObject({ code: 'INVALID_RETURN_STATE' })
    expect(await db.returnRequest.count({ where: { orderId: { in: [legacy.order.id, corrupt.order.id] } } })).toBe(0)
  })

  it.each([0, -1, 0.5, 4, 2147483648])('rejects invalid partial quantity %s', async quantity => {
    const f = await fixture()
    await expect(returns.createReturn(f.buyer, { ...f.input, quantity })).rejects.toMatchObject({ code: 'INVALID_RETURN_QUANTITY' })
    expect(await db.returnRequest.count({ where: { orderId: f.order.id } })).toBe(0)
  })
})
