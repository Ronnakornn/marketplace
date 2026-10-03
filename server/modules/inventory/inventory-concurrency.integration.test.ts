import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { InventoryService } from './inventory.service.ts'
import { PrismaInventoryRepository } from './inventory.repository.ts'

const databaseUrl = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!databaseUrl)('inventory reservation arithmetic on PostgreSQL', () => {
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
    const key = randomUUID()
    const buyer = await db.user.create({ data: { name: 'Numeric inventory', email: `${key}@example.test` } })
    const profile = await db.sellerProfile.create({ data: { userId: buyer.id } })
    const shop = await db.shop.create({ data: { ownerId: buyer.id, sellerProfileId: profile.id, name: 'Stock shop', slug: key,
      contactEmail: buyer.email, contactPhone: '+66800000000' } })
    const product = await db.product.create({ data: { shopId: shop.id, title: 'Stock item', slug: key } })
    const variant = await db.productVariant.create({ data: { productId: product.id, title: 'Default', sku: key, price: 1000,
      inventory: { create: { quantityOnHand: 10, quantityReserved: 6 } } } })
    const inventory = await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })
    const cart = await db.cart.create({ data: { userId: buyer.id } })
    const checkout = await db.checkout.create({ data: { cartId: cart.id, userId: buyer.id, expiresAt: new Date(Date.now() + 60_000) } })
    const reservation = await db.inventoryReservation.create({ data: {
      checkoutId: checkout.id, inventoryId: inventory.id, quantity: 3, expiresAt: checkout.expiresAt,
    } })
    await db.inventoryReservation.create({ data: {
      checkoutId: checkout.id, inventoryId: inventory.id, quantity: 3, expiresAt: checkout.expiresAt,
    } })
    return { inventory, reservation }
  }

  it.each(['commit', 'release', 'expire'] as const)('applies concurrent %s exactly once', async action => {
    const data = await fixture()
    let firstRead!: () => void
    let secondRead!: () => void
    let release!: () => void
    const firstSeen = new Promise<void>(resolve => { firstRead = resolve })
    const secondSeen = new Promise<void>(resolve => { secondRead = resolve })
    const hold = new Promise<void>(resolve => { release = resolve })
    let reads = 0
    const instrumented = db.$extends({ query: { inventory: { async findUnique({ args, query }) {
      const result = await query(args)
      if (args.where.id === data.inventory.id) {
        reads++
        if (reads === 1) { firstRead(); await hold }
        else secondRead()
      }
      return result
    } } } })
    const service = new InventoryService(context, new PrismaInventoryRepository(context, instrumented as unknown as PrismaClient))
    const mutate = () => action === 'commit' ? service.commitReservation({ reservationId: data.reservation.id })
      : action === 'release' ? service.releaseReservation({ reservationId: data.reservation.id })
        : service.expireReservation({ reservationId: data.reservation.id })
    const first = mutate()
    await firstSeen
    const second = mutate()
    const pending = Promise.allSettled([first, second])
    await Promise.race([secondSeen, new Promise(resolve => setTimeout(resolve, 150))])
    release()
    const results = await pending
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { status: 409, code: 'RESERVATION_NOT_ACTIVE' } })
    expect(await db.inventory.findUniqueOrThrow({ where: { id: data.inventory.id } })).toMatchObject({
      quantityOnHand: action === 'commit' ? 7 : 10, quantityReserved: 3,
    })
    const movements = await db.inventoryMovement.findMany({ where: { inventoryId: data.inventory.id } })
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({ quantityReservedBefore: 6, quantityReservedAfter: 3, quantityDelta: -3 })
  })
})
