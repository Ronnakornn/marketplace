import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient, Prisma as PrismaSql } from '#generated/client/client.ts'
import { moneyInteger, moneyRoundedRatio } from '#server/lib/money.ts'
import { thresholdContext } from '#server/test-support/numeric-threshold.fixture.ts'
import { PrismaAdminRepository, type AdminDashboardCounts, type AdminReportMetrics } from './admin.repository.ts'

const url = process.env['COMMERCE_TEST_DATABASE_URL']
const delayedShipment = (now: Date) => PrismaSql.sql`s.status::text IN ('PENDING_PACK', 'PACKED', 'PENDING', 'READY')
  AND s."createdAt" + COALESCE(sale."dispatchSlaHours", 72) * INTERVAL '1 hour' < ${now}`
const delayedShipmentJoins = PrismaSql.sql`FROM "Shipment" s LEFT JOIN "ShopOrder" so ON so."orderId" = s."orderId" AND so."shopId" = s."shopId"
  LEFT JOIN "ShopSaleSnapshot" sale ON sale."shopOrderId" = so.id`

// Independent pre-optimization predicates keep payment status separate from order status.
async function referenceDashboard(prisma: PrismaClient): Promise<AdminDashboardCounts> {
    const [
      totalUsers,
      buyers,
      sellers,
      totalShops,
      activeShops,
      suspendedShops,
      totalProducts,
      activeProducts,
      bannedProducts,
      totalOrders,
      paidOrders,
      deliveredOrders,
      cancelledOrders,
      pendingRefunds,
      successRefunds,
      failedRefunds,
      pendingPayments,
      failedPayments,
      delayedShipments,
      returnEscalations,
      refundEscalations,
      pendingShops,
      pendingProducts,
      payoutApprovals,
      fraudOpen,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { shops: { some: { status: 'ACTIVE' } } } }),
      prisma.shop.count(),
      prisma.shop.count({ where: { status: 'ACTIVE' } }),
      prisma.shop.count({ where: { status: 'SUSPENDED' } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'ARCHIVED' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELED' } }),
      prisma.refund.count({ where: { status: 'PENDING' } }),
      prisma.refund.count({ where: { status: 'SUCCESS' } }),
      prisma.refund.count({ where: { status: 'FAILED' } }),
      prisma.order.count({ where: { paymentStatus: { in: ['PENDING', 'REQUIRES_ACTION'] } } }),
      prisma.order.count({ where: { paymentStatus: 'FAILED' } }),
      prisma.$queryRaw<Array<{ count: bigint }>>(PrismaSql.sql`SELECT COUNT(*) AS count ${delayedShipmentJoins} WHERE ${delayedShipment(new Date())}`).then(rows => Number(rows[0]?.count ?? 0n)),
      prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED'] } } }),
      prisma.refund.count({ where: { status: { in: ['PENDING', 'PROCESSING', 'FAILED'] } } }),
      prisma.shop.count({ where: { status: 'PENDING' } }),
      prisma.product.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.sellerPayout.count({ where: { status: { in: ['requested', 'approved'] } } }),
      prisma.fraudCase.count({ where: { status: { in: ['OPEN', 'REVIEWED'] } } }),
    ])

    return {
      users: { total: totalUsers, buyers, sellers },
      shops: { total: totalShops, active: activeShops, suspended: suspendedShops },
      products: { total: totalProducts, active: activeProducts, banned: bannedProducts },
      orders: { total: totalOrders, paid: paidOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
      refunds: { pending: pendingRefunds, success: successRefunds, failed: failedRefunds },
      exceptions: {
        pendingPayments,
        failedPayments,
        delayedShipments,
        returnEscalations,
        refundEscalations,
        pendingShops,
        pendingProducts,
        payoutApprovals,
        fraudOpen,
      },
    }
  }

async function referenceReports(prisma: PrismaClient): Promise<AdminReportMetrics> {
    const [
      paidSales,
      paidOrderCount,
      totalOrders,
      pendingPaymentOrders,
      paidOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      refundedOrders,
      refundTotal,
      pendingRefunds,
      processingRefunds,
      successRefunds,
      failedRefunds,
      requestedPayouts,
      approvedPayouts,
      paidPayouts,
      pendingCommissions,
      approvedCommissions,
      voidCommissions,
      totalUsers,
      sellers,
      totalShops,
      totalProducts,
      activeProducts,
    ] = await Promise.all([
      prisma.order.aggregate({ where: { paymentStatus: 'SUCCEEDED' }, _sum: { grandTotal: true } }),
      prisma.order.count({ where: { paymentStatus: 'SUCCEEDED' } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'SHIPPED' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELED' } }),
      prisma.order.count({ where: { status: 'REFUNDED' } }),
      prisma.refund.aggregate({ _sum: { amount: true } }),
      prisma.refund.count({ where: { status: 'PENDING' } }),
      prisma.refund.count({ where: { status: 'PROCESSING' } }),
      prisma.refund.count({ where: { status: 'SUCCESS' } }),
      prisma.refund.count({ where: { status: 'FAILED' } }),
      prisma.sellerPayout.aggregate({ where: { status: 'requested' }, _sum: { amount: true }, _count: true }),
      prisma.sellerPayout.aggregate({ where: { status: 'approved' }, _sum: { amount: true }, _count: true }),
      prisma.sellerPayout.aggregate({ where: { status: 'paid' }, _sum: { amount: true }, _count: true }),
      prisma.affiliateCommission.aggregate({ where: { status: 'PENDING' }, _sum: { commission: true } }),
      prisma.affiliateCommission.aggregate({ where: { status: 'APPROVED' }, _sum: { commission: true } }),
      prisma.affiliateCommission.aggregate({ where: { status: 'VOID' }, _sum: { commission: true } }),
      prisma.user.count(),
      prisma.user.count({ where: { shops: { some: { status: 'ACTIVE' } } } }),
      prisma.shop.count(),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
    ])
    const grossCents = moneyInteger(paidSales._sum.grandTotal ?? 0)
    return {
      sales: {
        grossCents,
        paidOrderCount,
        averageOrderValueCents: paidOrderCount === 0 ? 0n : moneyRoundedRatio(grossCents, BigInt(paidOrderCount)),
      },
      orders: { total: totalOrders, pendingPayment: pendingPaymentOrders, paid: paidOrders, shipped: shippedOrders, delivered: deliveredOrders, cancelled: cancelledOrders, refunded: refundedOrders },
      refunds: { totalCents: moneyInteger(refundTotal._sum.amount ?? 0), pending: pendingRefunds, processing: processingRefunds, success: successRefunds, failed: failedRefunds },
      payouts: {
        requestedCents: moneyInteger(requestedPayouts._sum.amount ?? 0),
        approvedCents: moneyInteger(approvedPayouts._sum.amount ?? 0),
        paidCents: moneyInteger(paidPayouts._sum.amount ?? 0),
        requested: requestedPayouts._count,
        approved: approvedPayouts._count,
        paid: paidPayouts._count,
      },
      commissions: {
        pendingCents: moneyInteger(pendingCommissions._sum.commission ?? 0),
        approvedCents: moneyInteger(approvedCommissions._sum.commission ?? 0),
        voidCents: moneyInteger(voidCommissions._sum.commission ?? 0),
      },
      marketplace: { users: totalUsers, sellers, shops: totalShops, products: totalProducts, activeProducts },
    }
  }

describe.skipIf(!url)('Admin grouped metrics on PostgreSQL', () => {
  let db: PrismaClient
  let repo: PrismaAdminRepository
  const queries: string[] = []
  beforeAll(async () => {
    const parsed = new URL(url!)
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) throw new Error('Use a local disposable marketplace_test_* database')
    const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }), log: [{ emit: 'event', level: 'query' }] })
    client.$on('query', event => queries.push(event.query))
    db = client
    repo = new PrismaAdminRepository(thresholdContext, db)
    const user = await db.user.create({ data: { name: 'Metric seller', email: `${randomUUID()}@example.test`, role: 'USER' } })
    const profile = await db.sellerProfile.create({ data: { userId: user.id } })
    const affiliate = await db.affiliate.create({ data: { userId: user.id } })
    const link = await db.affiliateLink.create({ data: { affiliateId: affiliate.id, code: randomUUID(), targetType: 'shop', targetId: randomUUID() } })
    let shipmentShopId = ''
    for (const status of ['ACTIVE', 'ACTIVE', 'PENDING', 'SUSPENDED'] as const) {
      const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Metric shop', slug: randomUUID(), status, contactEmail: user.email, contactPhone: '0800000000' } })
      shipmentShopId = shop.id
      const wallet = await db.shopWallet.create({ data: { shopId: shop.id } })
      for (const payoutStatus of ['requested', 'approved', 'paid', 'rejected', 'cancelled'] as const) await db.sellerPayout.create({ data: { shopId: shop.id, walletId: wallet.id, requestedById: user.id, amount: 9007199254740993n, status: payoutStatus } })
      for (const productStatus of ['ACTIVE', 'PENDING_REVIEW', 'ARCHIVED', 'DRAFT'] as const) await db.product.create({ data: { shopId: shop.id, title: 'Metric product', slug: randomUUID(), status: productStatus } })
    }
    for (const status of ['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELED', 'REFUNDED'] as const) {
      for (const paymentStatus of ['PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'REFUNDED'] as const) {
        const cart = await db.cart.create({ data: { userId: user.id, status: 'CHECKED_OUT' } })
        const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: user.id, expiresAt: new Date(), grandTotal: 9007199254740993n } })
        const order = await db.order.create({ data: { checkoutId: checkout.id, userId: user.id, orderNumber: randomUUID(), status, paymentStatus, subtotal: 9007199254740993n, grandTotal: 9007199254740993n, shippingName: 'Test', shippingLine1: '1', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
        const payment = await db.payment.create({ data: { orderId: order.id, provider: 'mock', providerIntentId: randomUUID(), status: paymentStatus, amount: 9007199254740993n, currency: 'THB' } })
        await db.affiliateCommission.create({ data: { affiliateId: affiliate.id, linkId: link.id, orderId: order.id, eligiblesubtotal: 9007199254740993n, commissionBps: 100, commission: 9007199254740993n, status: status === 'PAID' ? 'APPROVED' : status === 'CANCELED' ? 'VOID' : 'PENDING' } })
        if (paymentStatus === 'PENDING') {
          const shopOrder = await db.shopOrder.create({ data: { orderId: order.id, shopId: shipmentShopId } })
          await db.shopSaleSnapshot.create({ data: { shopOrderId: shopOrder.id, currency: 'THB', commissionBase: 0n, commissionBps: 0, originalCommission: 0n, originalShipping: 0n, buyerShipping: 0n, sellerShippingWaiver: 0n, platformShippingSubsidy: 0n, dispatchSlaHours: 6 } })
          await db.shipment.create({ data: { orderId: order.id, shopId: shipmentShopId, status: 'PACKED', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
          await db.returnRequest.create({ data: { orderId: order.id, shopId: shipmentShopId, userId: user.id, status: status === 'CANCELED' ? 'CANCELLED' : 'REQUESTED' } })
        }
        for (const refundStatus of ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'] as const) await db.refund.create({ data: { orderId: order.id, paymentId: payment.id, status: refundStatus, amount: 9007199254740993n } })
      }
    }
  }, 30000)
  afterAll(async () => { await db?.$disconnect() })

  it('preserves every dashboard count across role, shop, product and independent payment statuses', async () => {
    expect(await repo.getDashboardCounts()).toEqual(await referenceDashboard(db))
  })

  it('preserves exact monetary sums and every report count with mixed payment/order statuses', async () => {
    const actual = await repo.getReportMetrics()
    expect(actual).toEqual(await referenceReports(db))
    expect(actual.sales.grossCents).toBeGreaterThan(9007199254740991n)
    expect(actual.refunds.totalCents).toBeGreaterThan(9007199254740991n)
    expect(actual.payouts.requestedCents).toBeGreaterThan(9007199254740991n)
    expect(actual.commissions.approvedCents).toBeGreaterThan(9007199254740991n)
  })

  it('uses ten dashboard operations and eight report operations', async () => {
    queries.length = 0
    await referenceDashboard(db)
    expect(queries).toHaveLength(25)
    queries.length = 0
    await repo.getDashboardCounts()
    expect(queries).toHaveLength(10)
    queries.length = 0
    await referenceReports(db)
    expect(queries).toHaveLength(25)
    queries.length = 0
    await repo.getReportMetrics()
    expect(queries).toHaveLength(8)
  })
})
