import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaShipmentRepository } from './shipment.repository.ts'
import { ShipmentService } from './shipment.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('sibling shipment transactions on PostgreSQL', () => {
  let db: PrismaClient
  let service: ShipmentService
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    service = new ShipmentService(context, new PrismaShipmentRepository(context, db))
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture() {
    const tag = randomUUID()
    const seller = await db.user.create({ data: { email: `${tag}@example.test`, name: 'Shipment concurrency' } })
    const profile = await db.sellerProfile.create({ data: { userId: seller.id } })
    const cart = await db.cart.create({ data: { userId: seller.id, status: 'CHECKED_OUT' } })
    const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: seller.id, status: 'COMPLETED', subtotal: 2000n, grandTotal: 2000n, currency: 'THB', expiresAt: new Date() } })
    const order = await db.order.create({ data: { checkoutId: checkout.id, userId: seller.id, orderNumber: tag, status: 'PAID', paymentStatus: 'SUCCEEDED', subtotal: 2000n, grandTotal: 2000n, currency: 'THB', shippingName: 'Buyer', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10110', shippingCountry: 'TH' } })
    for (let index = 0; index < 2; index++) {
      const shop = await db.shop.create({ data: { ownerId: seller.id, sellerProfileId: profile.id, name: `Shop ${index}`, slug: `${tag}-${index}`, contactEmail: seller.email, contactPhone: '0800000000', status: 'ACTIVE' } })
      const product = await db.product.create({ data: { shopId: shop.id, title: 'Test item', slug: `${tag}-${index}`, status: 'ACTIVE' } })
      const variant = await db.productVariant.create({ data: { productId: product.id, sku: `${tag}-${index}`, title: 'Default', price: 1000n } })
      await db.orderItem.create({ data: { orderId: order.id, shopId: shop.id, variantId: variant.id, productTitle: product.title, productSlug: product.slug, variantTitle: variant.title, variantSku: variant.sku, shopName: shop.name, shopSlug: shop.slug, quantity: 1, unitPrice: 1000n, lineTotal: 1000n, currency: 'THB' } })
    }
    const shipments = await service.createShipmentsForPaidOrder(order.id)
    await Promise.all(shipments.map((shipment) => service.packSellerShipment(seller, shipment.id)))
    return { seller, order, shipments }
  }

  it('concurrent sibling dispatches finish with a shipped parent and both shipped items', async () => {
    const f = await fixture()
    await Promise.all(f.shipments.map((shipment) => service.shipSellerShipment(f.seller, shipment.id, { carrier: 'Test carrier', trackingNo: shipment.id })))
    const order = await db.order.findUniqueOrThrow({ where: { id: f.order.id }, include: { shipments: true, items: true } })
    expect(order.status).toBe('SHIPPED')
    expect(order.shipments.map((shipment) => shipment.status)).toEqual(['SHIPPED', 'SHIPPED'])
    expect(order.items.map((item) => item.fulfillmentStatus)).toEqual(['SHIPPED', 'SHIPPED'])
  })

  it('concurrent sibling deliveries finish with a delivered parent instead of losing the final aggregate update', async () => {
    const f = await fixture()
    await Promise.all(f.shipments.map((shipment) => service.shipSellerShipment(f.seller, shipment.id, { carrier: 'Test carrier', trackingNo: shipment.id })))
    await Promise.all(f.shipments.map((shipment) => service.deliverAdminShipment({ id: f.seller.id, role: 'ADMIN' }, shipment.id, { evidenceReference: `carrier-delivery-${shipment.id}` })))
    const order = await db.order.findUniqueOrThrow({ where: { id: f.order.id }, include: { shipments: true, items: true } })
    expect(order.status).toBe('DELIVERED')
    expect(order.shipments.map((shipment) => shipment.status)).toEqual(['DELIVERED', 'DELIVERED'])
    expect(order.items.map((item) => item.fulfillmentStatus)).toEqual(['DELIVERED', 'DELIVERED'])
  })
})
