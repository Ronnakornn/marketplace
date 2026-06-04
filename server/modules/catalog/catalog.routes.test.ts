import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createCatalogRoutes } from './catalog.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createCategory(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-05-12T00:00:00.000Z')
  return {
    id: '55555555-5555-4555-8555-555555555555',
    parentId: null,
    name: 'Fashion',
    nameTh: null,
    nameEn: null,
    slug: 'fashion',
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createContainer() {
  return {
    catalogService: {
      listCategories: vi.fn(async () => [createCategory()]),
      listActiveBrands: vi.fn(async () => []),
      listPublicProducts: vi.fn(),
      getPublicProductDetail: vi.fn(),
      listPublicShopProducts: vi.fn(),
      listSellerProducts: vi.fn(),
      getSellerProductDetail: vi.fn(),
      submitProductReview: vi.fn(),
      listAdminCategories: vi.fn(async () => [createCategory({ isActive: false })]),
      createAdminCategory: vi.fn(async (body) => createCategory({ ...body, slug: body.slug ?? 'fashion' })),
      updateAdminCategory: vi.fn(async (_id, body) => createCategory(body)),
      deactivateAdminCategory: vi.fn(async (id) => createCategory({ id, isActive: false })),
      reactivateAdminCategory: vi.fn(async (id) => createCategory({ id, isActive: true })),
      reorderAdminCategories: vi.fn(async () => [createCategory()]),
      listAdminProducts: vi.fn(),
      listModerationProducts: vi.fn(),
      getAdminProductDetail: vi.fn(),
      updateAdminProduct: vi.fn(),
      createAdminVariant: vi.fn(),
      updateAdminVariant: vi.fn(),
      deleteAdminVariant: vi.fn(),
      approveProduct: vi.fn(),
      rejectProduct: vi.fn(),
      suspendProduct: vi.fn(),
      restoreProduct: vi.fn(),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      archiveProduct: vi.fn(),
      createProductImage: vi.fn(),
      updateProductImage: vi.fn(),
      deleteProductImage: vi.fn(),
      updateProductImagesOrder: vi.fn(),
      upsertProductVideo: vi.fn(),
      deleteProductVideo: vi.fn(),
      updateProductOptions: vi.fn(),
      createVariant: vi.fn(),
      updateVariant: vi.fn(),
      deleteVariant: vi.fn(),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createCatalogRoutes(container))
}

function mockAuthContext(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      ...overrides,
    },
  }
}

describe('catalog admin category routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated and non-admin category mutations', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const unauthenticated = await createApp().handle(new Request('http://localhost/api/admin/categories'))
    expect(unauthenticated.status).toBe(401)

    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ role: 'SELLER' }) as any)
    const forbidden = await createApp().handle(new Request('http://localhost/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Fashion' }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(forbidden.status).toBe(403)
  })

  it('routes admin category create/update/deactivate/reactivate/reorder requests to the service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)
    const app = createApp(container)

    const list = await app.handle(new Request('http://localhost/api/admin/categories'))
    const created = await app.handle(new Request('http://localhost/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: ' Mobile Phones ', slug: 'Mobile Phones' }),
      headers: { 'content-type': 'application/json' },
    }))
    const updated = await app.handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'content-type': 'application/json' },
    }))
    const deactivated = await app.handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555/deactivate', { method: 'PATCH' }))
    const reactivated = await app.handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555/reactivate', { method: 'PATCH' }))
    const reordered = await app.handle(new Request('http://localhost/api/admin/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ parentId: null, categories: [{ id: '55555555-5555-4555-8555-555555555555' }] }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(list.status).toBe(200)
    expect(created.status).toBe(200)
    expect(updated.status).toBe(200)
    expect(deactivated.status).toBe(200)
    expect(reactivated.status).toBe(200)
    expect(reordered.status).toBe(200)
    expect(container.catalogService.listAdminCategories).toHaveBeenCalled()
    expect(container.catalogService.createAdminCategory).toHaveBeenCalledWith({ name: ' Mobile Phones ', slug: 'Mobile Phones' })
    expect(container.catalogService.updateAdminCategory).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555', { name: 'Updated' })
    expect(container.catalogService.deactivateAdminCategory).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555')
    expect(container.catalogService.reactivateAdminCategory).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555')
    expect(container.catalogService.reorderAdminCategories).toHaveBeenCalledWith({
      parentId: null,
      categories: [{ id: '55555555-5555-4555-8555-555555555555' }],
    })
  })

  it('keeps public category reads active-only through listCategories', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp(container).handle(new Request('http://localhost/api/categories'))

    expect(response.status).toBe(200)
    expect(container.catalogService.listCategories).toHaveBeenCalled()
    expect(container.catalogService.listAdminCategories).not.toHaveBeenCalled()
  })
})
