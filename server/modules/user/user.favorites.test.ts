import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createUserRoutes } from './user.routes.ts'
import { PrismaUserRepository } from './user.repository.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({ auth: { handler: () => new Response(null, { status: 404 }) } }))
vi.mock('#server/modules/auth/auth.context.ts', () => ({ getAuthContext: vi.fn() }))

const productId = '11111111-1111-4111-8111-111111111111'

function app() {
  const getFavoriteStatuses = vi.fn(async (_userId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, true])))
  const container = { userService: { getFavoriteStatuses } } as unknown as ServiceContainer
  return { api: new Elysia().use(createUserRoutes(container)), getFavoriteStatuses }
}

function request(body: unknown) {
  return new Request('http://localhost/api/me/favorites/statuses', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('favorite status batches', () => {
  beforeEach(() => {
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as Awaited<ReturnType<typeof getAuthContext>>)
  })

  it('derives the buyer from authentication and returns the requested statuses', async () => {
    const { api, getFavoriteStatuses } = app()
    const response = await api.handle(request({ productIds: [productId] }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ [productId]: true })
    expect(getFavoriteStatuses).toHaveBeenCalledWith('buyer-1', [productId])
  })

  it('requires authentication and bounds and validates every supplied UUID', async () => {
    const { api } = app()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    expect((await api.handle(request({ productIds: [productId] }))).status).toBe(401)
    vi.mocked(getAuthContext).mockResolvedValue({ user: { id: 'buyer-1', role: 'USER', status: 'ACTIVE' } } as Awaited<ReturnType<typeof getAuthContext>>)
    for (const productIds of [[], ['invalid'], Array.from({ length: 101 }, () => productId)]) {
      expect((await api.handle(request({ productIds }))).status).toBe(422)
    }
  })

  it('selects only favorite IDs belonging to this buyer and requested products', async () => {
    const findMany = vi.fn(async () => [{ productId }])
    const prisma = { favoriteProduct: { findMany } } as unknown as ConstructorParameters<typeof PrismaUserRepository>[1]
    const context = { logger: { debug: vi.fn(), info: vi.fn() } } as unknown as ConstructorParameters<typeof PrismaUserRepository>[0]
    const repo = new PrismaUserRepository(context, prisma)
    expect(await repo.findFavoriteProductIds('buyer-2', [productId])).toEqual([{ productId }])
    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: 'buyer-2', productId: { in: [productId] } }, select: { productId: true },
    })
  })

  it.each(['favorites', 'followed-shops'])('bounds and authenticates the %s collection query', async (path) => {
    const listFavoriteProducts = vi.fn(async () => ({ items: [], page: 2, hasMore: false }))
    const listFollowedShops = vi.fn(async () => ({ items: [], page: 2, hasMore: false }))
    const container = { userService: { listFavoriteProducts, listFollowedShops } } as unknown as ServiceContainer
    const api = new Elysia().use(createUserRoutes(container))
    expect((await api.handle(new Request(`http://localhost/api/me/${path}?page=2&limit=20`))).status).toBe(200)
    expect(path === 'favorites' ? listFavoriteProducts : listFollowedShops).toHaveBeenCalledWith('buyer-1', { page: 2, limit: 20 })
    for (const query of ['page=0', 'limit=51', 'page=1.5']) {
      expect((await api.handle(new Request(`http://localhost/api/me/${path}?${query}`))).status).toBe(422)
    }
    vi.mocked(getAuthContext).mockResolvedValue(null)
    expect((await api.handle(new Request(`http://localhost/api/me/${path}`))).status).toBe(401)
  })

  it('bounds variants and merges the first available variant beyond the fallback', async () => {
    const fallback = { id: 'first', title: 'First', price: 10n, currency: 'THB', inventory: { quantityOnHand: 2, quantityReserved: 2 } }
    const available = { ...fallback, id: 'later', price: 9007199254740993n, inventory: { quantityOnHand: 4, quantityReserved: 1 } }
    const rows = [{ id: 'favorite', productId, product: { variants: [fallback] } }]
    const findMany = vi.fn(async (_args: unknown) => rows)
    const findProducts = vi.fn(async (_args: unknown) => [{ id: productId, variants: [available] }])
    const quantityReserved = { name: 'quantityReserved' }
    const prisma = { favoriteProduct: { findMany }, product: { findMany: findProducts }, inventory: { fields: { quantityReserved } } } as unknown as ConstructorParameters<typeof PrismaUserRepository>[1]
    const context = { logger: { debug: vi.fn() } } as unknown as ConstructorParameters<typeof PrismaUserRepository>[0]
    const repo = new PrismaUserRepository(context, prisma)
    const result = await repo.listFavoriteProducts('buyer-1', 3, 20)
    expect(result[0]?.product.variants).toEqual([available])
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: { userId: 'buyer-1' }, take: 21, skip: 40, include: { product: { include: { variants: { take: 1 } } } } })
    expect(findProducts.mock.calls[0]?.[0]).toMatchObject({ where: { id: { in: [productId] } }, select: { variants: { take: 1, where: { inventory: { quantityOnHand: { gt: quantityReserved } } } } } })
    findProducts.mockResolvedValueOnce([{ id: productId, variants: [] }])
    expect((await repo.listFavoriteProducts('buyer-1', 1, 20))[0]?.product.variants).toEqual([fallback])
  })
})
