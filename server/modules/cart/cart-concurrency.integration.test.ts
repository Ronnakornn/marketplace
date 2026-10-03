import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { PrismaCartRepository } from './cart.repository.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }

describe.skipIf(!url)('active cart creation on PostgreSQL', () => {
  let prisma: PrismaClient
  beforeAll(() => {
    const parsed = new URL(url!)
    if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/marketplace_test_')) {
      throw new Error('Use a local disposable marketplace_test_* database')
    }
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
  })
  afterAll(async () => { await prisma?.$disconnect() })
  async function fixture() {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Commerce test', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Test shop', slug: tag, contactEmail: user.email, contactPhone: '0800000000', status: 'ACTIVE' } })
    const product = await prisma.product.create({ data: { shopId: shop.id, title: 'Test item', slug: tag, status: 'ACTIVE' } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: tag, title: 'Default', price: 1000, inventory: { create: { quantityOnHand: 10 } } } })
    return { user, variant }
  }
  it('concurrent first visits share one cart and later reads retain items added to it', async () => {
    const { user, variant } = await fixture()
    const visits = 6
    let reads = 0
    let release!: () => void
    const initialReads = new Promise<void>((resolve) => { release = resolve })
    // Force the actual empty SELECTs to overlap; retain all real query results.
    // The post-lock recheck is deliberately outside this first-read barrier.
    const synchronized = prisma.$extends({ query: { cart: { async findFirst({ args, query }) {
      const result = await query(args)
      if (args.where?.userId === user.id && reads < visits) {
        reads += 1
        if (reads === visits) release()
        await initialReads
      }
      return result
    } } } }) as unknown as PrismaClient
    const repo = new PrismaCartRepository(context, synchronized)
    const carts = await Promise.all(Array.from({ length: visits }, () => repo.findOrCreateActiveCart(user.id)))
    expect(new Set(carts.map((cart) => cart.id)).size).toBe(1)
    expect(await prisma.cart.count({ where: { userId: user.id, status: 'ACTIVE' } })).toBe(1)
    await repo.createItem({ cartId: carts[0]!.id, variantId: variant.id, quantity: 2, unitPrice: 1000, currency: 'THB' })
    const followingRead = await repo.findOrCreateActiveCart(user.id)
    expect(followingRead.id).toBe(carts[0]!.id)
    expect(followingRead.items).toEqual([expect.objectContaining({ variantId: variant.id, quantity: 2 })])
  })
})
