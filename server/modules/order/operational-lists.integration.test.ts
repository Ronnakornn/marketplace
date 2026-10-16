import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { toMoneyDto } from '#server/lib/money.ts'
import { PrismaInventoryRepository } from '#server/modules/inventory/inventory.repository.ts'
import { PrismaShipmentRepository } from '#server/modules/shipment/shipment.repository.ts'
import { PrismaOrderRepository } from './order.repository.ts'
import { OrderService } from './order.service.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('bounded operational lists on PostgreSQL', () => {
  let db: PrismaClient
  let fixture: Awaited<ReturnType<typeof createFixture>>
  beforeAll(async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a disposable local marketplace_test_* database')
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) })
    fixture = await createFixture()
  }, 30_000)
  afterAll(async () => { await db?.$disconnect() })

  async function createFixture() {
    const tag = randomUUID()
    const buyer = await db.user.create({ data: { name: 'List buyer', email: `${tag}-buyer@example.test` } })
    const otherBuyer = await db.user.create({ data: { name: 'Other list buyer', email: `${tag}-other@example.test` } })
    const owners = await Promise.all([0, 1].map(async (index) => {
      const user = await db.user.create({ data: { name: `List seller ${index}`, email: `${tag}-seller-${index}@example.test` } })
      const profile = await db.sellerProfile.create({ data: { userId: user.id } })
      const shop = await db.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: `Shop ${index}`, slug: `${tag}-${index}`, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
      const product = await db.product.create({ data: { shopId: shop.id, title: `Catalog ${index}`, slug: `${tag}-${index}` } })
      return { user, shop, product }
    }))
    const own = owners[0]!
    const foreign = owners[1]!
    const at = new Date('2026-01-01T00:00:00Z')
    const variantIds = Array.from({ length: 65 }, () => randomUUID())
    await db.productVariant.createMany({ data: variantIds.map((id, index) => ({ id, productId: own.product.id, sku: `${tag}-${index === 64 ? 'Needle%_' : index}`, title: `Variant ${index}`, price: 1000n })) })
    await db.inventory.createMany({ data: variantIds.map((variantId, index) => ({ variantId, quantityOnHand: index % 3 === 0 ? 2 : index % 3 === 1 ? 4 : 20, quantityReserved: 2, reorderLevel: 5, updatedAt: at })) })
    const foreignVariant = await db.productVariant.create({ data: { productId: foreign.product.id, sku: `${tag}-foreign`, title: 'Foreign', price: 200n, inventory: { create: { quantityOnHand: 1 } } } })
    const records = Array.from({ length: 66 }, (_, index) => ({
      id: randomUUID(), checkoutId: randomUUID(), cartId: randomUUID(), itemId: randomUUID(), shipmentId: randomUUID(),
      userId: index === 65 ? otherBuyer.id : buyer.id,
      shop: index === 65 ? foreign.shop : own.shop,
      variantId: index === 65 ? foreignVariant.id : variantIds[index]!,
    }))
    await db.cart.createMany({ data: records.map((row) => ({ id: row.cartId, userId: row.userId, status: 'CHECKED_OUT' })) })
    await db.checkout.createMany({ data: records.map((row) => ({ id: row.checkoutId, cartId: row.cartId, userId: row.userId, status: 'COMPLETED', expiresAt: at })) })
    await db.order.createMany({ data: records.map((row, index) => ({ id: row.id, checkoutId: row.checkoutId, userId: row.userId,
      orderNumber: `${tag}-ORD-${index}`, status: index % 2 === 0 ? 'PAID' : 'CANCELED', paymentStatus: index % 2 === 0 ? 'SUCCEEDED' : 'CANCELED',
      subtotal: 9007199254740993123n, grandTotal: 9007199254740993123n, currency: 'THB',
      shippingName: index === 64 ? 'Needle recipient' : 'List recipient', shippingLine1: '1 Test Road', shippingCity: 'Bangkok', shippingPostalCode: '10100', shippingCountry: 'TH', createdAt: at,
    })) })
    await db.shopOrder.createMany({ data: records.map((row) => ({ orderId: row.id, shopId: row.shop.id, subtotal: 9007199254740993123n, grandTotal: 9007199254740993123n, currency: 'THB' })) })
    await db.orderItem.createMany({ data: records.map((row, index) => ({ id: row.itemId, orderId: row.id, shopId: row.shop.id, variantId: row.variantId,
      productTitle: index === 64 ? 'Needle item' : 'List item', productSlug: own.product.slug, variantTitle: 'Default', variantSku: `${tag}-${index}`, shopName: row.shop.name, shopSlug: row.shop.slug,
      quantity: 1, unitPrice: 9007199254740993123n, lineTotal: 9007199254740993123n, currency: 'THB',
    })) })
    await db.shipment.createMany({ data: records.map((row, index) => ({ id: row.shipmentId, orderId: row.id, shopId: row.shop.id, status: index % 2 === 0 ? 'PENDING_PACK' : 'SHIPPED', createdAt: at })) })
    await db.shipmentItem.createMany({ data: records.map((row) => ({ shipmentId: row.shipmentId, orderItemId: row.itemId, quantity: 1 })) })
    const mixed = records[0]!
    await db.orderItem.create({ data: { orderId: mixed.id, shopId: foreign.shop.id, variantId: foreignVariant.id,
      productTitle: 'Foreign secret snapshot', productSlug: foreign.product.slug, variantTitle: 'Secret', variantSku: foreignVariant.sku,
      shopName: foreign.shop.name, shopSlug: foreign.shop.slug, quantity: 1, unitPrice: 200n, lineTotal: 200n } })
    await db.shopOrder.create({ data: { orderId: mixed.id, shopId: foreign.shop.id, subtotal: 200n, grandTotal: 200n } })
    return { buyer, otherBuyer, own, foreign, records, mixed, variantIds }
  }

  it('reaches every buyer order beyond fifty with stable tied-time pages and exact totals', async () => {
    const repo = new PrismaOrderRepository(context, db)
    const first = await repo.findBuyerOrders(fixture.buyer.id, { limit: 50 })
    const second = await repo.findBuyerOrders(fixture.buyer.id, { page: 2, limit: 50 })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(15)
    expect(second.meta).toEqual({ page: 2, limit: 50, totalCount: 65, totalPages: 2, hasNextPage: false, hasPreviousPage: true })
    expect([...first.data, ...second.data].map((row) => row.id)).toEqual(fixture.records.slice(0, 65).map((row) => row.id).sort().reverse())
    expect(first.data[0]).not.toHaveProperty('shipments')
    expect(first.data[0]?.items[0]).not.toHaveProperty('saleSnapshot')
    const empty = await repo.findBuyerOrders(fixture.buyer.id, { page: 10, limit: 50 })
    expect(empty.data).toEqual([])
    expect(empty.meta.totalCount).toBe(65)
  })

  it('filters buyer and seller orders before paging without exposing another shop through search', async () => {
    const repo = new PrismaOrderRepository(context, db)
    const filtered = await repo.findBuyerOrders(fixture.buyer.id, { q: 'needle', status: 'PAID', limit: 1 })
    expect(filtered.meta.totalCount).toBe(1)
    expect(filtered.data[0]?.id).toBe(fixture.records[64]!.id)
    expect((await repo.findBuyerOrders(fixture.buyer.id, { status: 'CANCELED', limit: 1 })).meta.totalCount).toBe(32)
    expect((await repo.findBuyerOrders(fixture.otherBuyer.id, {})).meta.totalCount).toBe(1)
    expect((await repo.findSellerOrders([fixture.own.shop.id], { q: 'Foreign secret' })).data).toEqual([])
    expect((await repo.findBuyerOrders(fixture.buyer.id, { q: '%_' })).data).toEqual([])
    expect((await repo.findSellerOrders([fixture.own.shop.id], { shopId: fixture.foreign.shop.id })).meta.totalCount).toBe(0)
    const service = new OrderService(context, repo)
    const ownOrder = await service.listSellerOrders(fixture.own.user, { q: '-ORD-0' })
    expect(ownOrder.data).toHaveLength(1)
    expect(ownOrder.data[0]!.items.every((item) => item.shopId === fixture.own.shop.id)).toBe(true)
    expect(toMoneyDto(ownOrder.data[0]!).totals.grandTotal).toBe('9007199254740993123')
  })

  it('pages seller shipments with scoped recipient, item and status search', async () => {
    const repo = new PrismaShipmentRepository(context, db)
    const first = await repo.findSellerShipments([fixture.own.shop.id], { limit: 50 })
    const second = await repo.findSellerShipments([fixture.own.shop.id], { limit: 50, page: 2 })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(15)
    expect(second.meta.totalCount).toBe(65)
    expect(new Set([...first.data, ...second.data].map((row) => row.id)).size).toBe(65)
    const filtered = await repo.findSellerShipments([fixture.own.shop.id], { q: 'needle recipient', status: 'PENDING_PACK', limit: 1 })
    expect(filtered.meta.totalCount).toBe(1)
    expect(filtered.data[0]?.orderId).toBe(fixture.records[64]!.id)
    expect((await repo.findSellerShipments([fixture.own.shop.id], { status: 'SHIPPED', limit: 1 })).meta.totalCount).toBe(32)
    expect((await repo.findSellerShipments([fixture.own.shop.id], { q: 'Foreign secret' })).meta.totalCount).toBe(0)
    expect((await repo.findSellerShipments([fixture.own.shop.id], { q: '%_' })).meta.totalCount).toBe(0)
    expect((await repo.findSellerShipments([fixture.own.shop.id], { shopId: fixture.foreign.shop.id })).data).toEqual([])
    expect(first.data[0]?.order).not.toHaveProperty('shipments')
  })

  it('filters inventory stock arithmetic and literal search before paging without cross-shop leakage', async () => {
    const repo = new PrismaInventoryRepository(context, db)
    const first = await repo.listSellerInventory([fixture.own.shop.id], { limit: 50 })
    const second = await repo.listSellerInventory([fixture.own.shop.id], { limit: 50, page: 2 })
    expect(first.data).toHaveLength(50)
    expect(second.data).toHaveLength(15)
    expect(second.meta.totalCount).toBe(65)
    expect(new Set([...first.data, ...second.data].map((row) => row.id)).size).toBe(65)
    const low = await repo.listSellerInventory([fixture.own.shop.id], { status: 'low', limit: 1 })
    const out = await repo.listSellerInventory([fixture.own.shop.id], { status: 'out', limit: 1 })
    expect(low.meta.totalCount).toBe(22)
    expect(out.meta.totalCount).toBe(22)
    const literal = await repo.listSellerInventory([fixture.own.shop.id], { q: '%_', status: 'low' })
    expect(literal.meta.totalCount).toBe(1)
    expect(literal.data[0]?.variantId).toBe(fixture.variantIds[64])
    expect((await repo.listSellerInventory([fixture.own.shop.id], { shopId: fixture.foreign.shop.id })).meta.totalCount).toBe(0)
    expect((await repo.listSellerInventory([fixture.own.shop.id], { page: 9, limit: 50 })).meta.totalCount).toBe(65)
  })
})
