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
})
