import { Elysia } from 'elysia'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { numericThresholdFixture, thresholdContext, thresholdDatabase } from '#server/test-support/numeric-threshold.fixture.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { PrismaUserRepository } from './user.repository.ts'
import { UserService } from './user.service.ts'
import { createUserRoutes } from './user.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }), api: {} } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

describe.skipIf(!process.env.COMMERCE_TEST_DATABASE_URL)('favorite status batch isolation on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => { db = thresholdDatabase() })
  afterAll(async () => { await db?.$disconnect() })

  it('returns only the authenticated buyer\'s statuses, deduplicates IDs, and updates after removal', async () => {
    const fixture = await numericThresholdFixture(db)
    const otherBuyer = await db.user.create({ data: { name: 'Other buyer', email: `favorite-${randomUUID()}@example.test` } })
    const otherProduct = await db.product.create({ data: { title: 'Other favorite', slug: `favorite-${randomUUID()}`, shopId: fixture.shop.id, status: 'ACTIVE' } })
    await db.favoriteProduct.createMany({ data: [
      { userId: fixture.buyer.id, productId: fixture.product.id },
      { userId: otherBuyer.id, productId: otherProduct.id },
    ] })
    const repo = new PrismaUserRepository(thresholdContext, db)
    const service = new UserService(thresholdContext, repo)
    const app = new Elysia().use(createUserRoutes({ userService: service } as unknown as ServiceContainer))
    const ids = [fixture.product.id, otherProduct.id, fixture.product.id]
    for (const [buyer, expected] of [
      [fixture.buyer, { [fixture.product.id]: true, [otherProduct.id]: false }],
      [otherBuyer, { [fixture.product.id]: false, [otherProduct.id]: true }],
    ] as const) {
      vi.mocked(getAuthContext).mockResolvedValue({ user: buyer } as unknown as Awaited<ReturnType<typeof getAuthContext>>)
      const response = await app.handle(new Request('http://localhost/api/me/favorites/statuses', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productIds: ids }),
      }))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(expected)
    }
    await service.removeFavoriteProduct(fixture.buyer.id, fixture.product.id)
    expect(await service.getFavoriteStatuses(fixture.buyer.id, ids)).toEqual({ [fixture.product.id]: false, [otherProduct.id]: false })
    expect(await service.getFavoriteStatus(otherBuyer.id, otherProduct.id)).toEqual({ favorited: true })
  })
})
