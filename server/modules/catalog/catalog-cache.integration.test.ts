import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '#generated/client/client.ts'
import { CacheInvalidation, CacheService } from '#server/modules/cache'
import { createRedisCacheClient } from '#server/modules/cache/cache.client.ts'
import { PrismaCatalogRepository } from './catalog.repository.ts'
import { CatalogService } from './catalog.service.ts'

const url = process.env.COMMERCE_TEST_DATABASE_URL
const redisUrl = process.env.CACHE_TEST_REDIS_URL
const context = { logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, config: { environment: 'test' } }
describe.skipIf(!url || !redisUrl)('catalog invalidation on real Redis and PostgreSQL', () => {
  let prisma: PrismaClient
  let cache: CacheService
  let service: CatalogService
  let client: ReturnType<typeof createRedisCacheClient>
  const prefix = `catalog-test-${randomUUID()}`
  beforeAll(() => {
    const database = new URL(url!)
    const redis = new URL(redisUrl!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/marketplace_test_')
      || !['localhost', '127.0.0.1'].includes(redis.hostname) || !redis.port || redis.port === '6379' || !/^\/[1-9]\d*$/.test(redis.pathname)) throw new Error('Use disposable local test database and nonstandard-port Redis with nonzero DB')
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) })
    const config = { enabled: true, redisUrl: redisUrl!, keyPrefix: prefix, defaultTtlSeconds: 300, productTtlSeconds: 300, searchTtlSeconds: 300, sellerDashboardTtlSeconds: 300 }
    client = createRedisCacheClient(config)
    cache = new CacheService(context, config, client)
    service = new CatalogService(context, new PrismaCatalogRepository(context, prisma), cache, new CacheInvalidation(cache))
  })
  afterAll(async () => {
    await cache?.deleteByPattern(`${prefix}:*`)
    await client?.quit?.()
    await prisma?.$disconnect()
  })
  it('refreshes warmed slug and UUID details after seller edits and rejects stale visibility', async () => {
    const tag = randomUUID()
    const user = await prisma.user.create({ data: { name: 'Cache seller', email: `${tag}@example.test` } })
    const profile = await prisma.sellerProfile.create({ data: { userId: user.id } })
    const shop = await prisma.shop.create({ data: { ownerId: user.id, sellerProfileId: profile.id, name: 'Cache shop', slug: tag, status: 'ACTIVE', contactEmail: user.email, contactPhone: '0800000000' } })
    const category = await prisma.category.create({ data: { name: 'Cache category', slug: tag } })
    const product = await prisma.product.create({ data: { shopId: shop.id, categoryId: category.id, title: 'Cache product', slug: `cache-${tag}`, status: 'ACTIVE', images: { create: { url: '/test-cache-product.png', isPrimary: true } } } })
    const variant = await prisma.productVariant.create({ data: { productId: product.id, title: 'Default', sku: tag, price: 10000, inventory: { create: { quantityOnHand: 10 } } } })
    for (const identifier of [product.slug, product.id]) for (const locale of ['th', 'en']) {
      expect(Number((await service.getPublicProductDetail(identifier, locale)).variants[0]!.price)).toBe(10000)
    }
    // Assert a real cache hit is possible; a disabled/failing cache cannot pass.
    expect(await client!.get(cache.keys.productDetail(product.id, 'en'))).not.toBeNull()
    const listing = { shopId: shop.id, limit: 12 }
    for (let i = 0; i < 2; i++) {
      expect((await service.listPublicProducts(listing)).facets?.price).toMatchObject({ min: 10000, max: 10000 })
    }
    await service.updateVariant({ id: user.id, role: 'USER' }, product.id, variant.id, { price: 12500 })
    expect((await service.listPublicProducts(listing)).facets?.price).toMatchObject({ min: 12500, max: 12500 })
    for (const identifier of [product.slug, product.id]) for (const locale of ['th', 'en']) {
      expect(Number((await service.getPublicProductDetail(identifier, locale)).variants[0]!.price)).toBe(12500)
    }
    await service.updateSellerInventory({ id: user.id, role: 'USER' }, variant.id, { quantityOnHand: 3 })
    expect((await service.getPublicProductDetail(product.slug, 'en')).variants[0]!.inventory?.quantityOnHand).toBe(3)
    const renamedSlug = `renamed-${tag}`
    await service.updateProduct({ id: user.id, role: 'USER' }, product.id, { slug: renamedSlug })
    await expect(service.getPublicProductDetail(product.slug, 'en')).rejects.toMatchObject({ status: 404 })
    expect((await service.getPublicProductDetail(renamedSlug, 'en')).id).toBe(product.id)
    // The detail is now warm; changed shop visibility must still block access.
    await prisma.shop.update({ where: { id: shop.id }, data: { status: 'SUSPENDED' } })
    await expect(service.getPublicProductDetail(renamedSlug, 'en')).rejects.toMatchObject({ status: 404 })
    await expect(service.getPublicProductDetail(product.id, 'en')).rejects.toMatchObject({ status: 404 })
  })
})
