import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { prisma } from '#server/lib/prisma.ts'
import { CatalogServiceError } from './catalog.errors.ts'
import { createCatalogRoutes } from './catalog.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

vi.mock('#server/lib/prisma.ts', () => ({
  prisma: {
    shop: {
      count: vi.fn(),
    },
    sellerApplication: {
      findFirst: vi.fn(),
    },
  },
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

function createCategorySpec(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-05-12T00:00:00.000Z')
  return {
    id: '66666666-6666-4666-8666-666666666666',
    categoryId: '55555555-5555-4555-8555-555555555555',
    attributeKey: 'color',
    displayName: 'Color',
    displayNameTh: null,
    displayNameEn: null,
    valueType: 'TEXT',
    isRequired: false,
    isFilterable: true,
    unit: null,
    allowedValues: null,
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
      listCategorySpecs: vi.fn(async () => [createCategorySpec({ isActive: true })]),
      listActiveBrands: vi.fn(async () => []),
      listPublicProducts: vi.fn(),
      getPublicProductDetail: vi.fn(),
      listRelatedProducts: vi.fn(),
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
      listAdminCategorySpecs: vi.fn(async () => [createCategorySpec({ isActive: false })]),
      createAdminCategorySpec: vi.fn(async (categoryId, body) => createCategorySpec({ categoryId, ...body, valueType: body.type })),
      updateAdminCategorySpec: vi.fn(async (categoryId, id, body) => createCategorySpec({ id, categoryId, ...body, valueType: body.type ?? 'TEXT' })),
      deactivateAdminCategorySpec: vi.fn(async (categoryId, id) => createCategorySpec({ categoryId, id, isActive: false })),
      reactivateAdminCategorySpec: vi.fn(async (categoryId, id) => createCategorySpec({ categoryId, id, isActive: true })),
      reorderAdminCategorySpecs: vi.fn(async () => [createCategorySpec()]),
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
      createProduct: vi.fn(async (_actor, body) => ({ id: '22222222-2222-4222-8222-222222222222', ...body })),
      updateProduct: vi.fn(async (_actor, id, body) => ({ id, ...body })),
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
    vi.mocked(prisma.shop.count).mockResolvedValue(1)
    vi.mocked(prisma.sellerApplication.findFirst).mockResolvedValue({ status: 'APPROVED' } as any)
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

  it('routes public category spec reads through active-only listCategorySpecs', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const response = await createApp(container).handle(new Request('http://localhost/api/categories/55555555-5555-4555-8555-555555555555/specs'))

    expect(response.status).toBe(200)
    expect(container.catalogService.listCategorySpecs).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555')
    expect(container.catalogService.listAdminCategorySpecs).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated and non-admin category spec mutations', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null)

    const unauthenticated = await createApp().handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555/specs'))
    expect(unauthenticated.status).toBe(401)

    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ role: 'SELLER' }) as any)
    const forbidden = await createApp().handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555/specs', {
      method: 'POST',
      body: JSON.stringify({ attributeKey: 'Color', displayName: 'Color', type: 'TEXT' }),
      headers: { 'content-type': 'application/json' },
    }))
    expect(forbidden.status).toBe(403)
  })

  it('routes admin category spec mutation requests to the service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)
    const app = createApp(container)
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const specId = '66666666-6666-4666-8666-666666666666'

    const list = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs`))
    const created = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs`, {
      method: 'POST',
      body: JSON.stringify({ attributeKey: ' Screen Size ', displayName: 'Screen Size', type: 'NUMBER', unit: 'inch' }),
      headers: { 'content-type': 'application/json' },
    }))
    const updated = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs/${specId}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Updated', type: 'TEXT' }),
      headers: { 'content-type': 'application/json' },
    }))
    const deactivated = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs/${specId}/deactivate`, { method: 'PATCH' }))
    const reactivated = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs/${specId}/reactivate`, { method: 'PATCH' }))
    const reordered = await app.handle(new Request(`http://localhost/api/admin/categories/${categoryId}/specs/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ specs: [{ id: specId }] }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(list.status).toBe(200)
    expect(created.status).toBe(200)
    expect(updated.status).toBe(200)
    expect(deactivated.status).toBe(200)
    expect(reactivated.status).toBe(200)
    expect(reordered.status).toBe(200)
    expect(container.catalogService.listAdminCategorySpecs).toHaveBeenCalledWith(categoryId)
    expect(container.catalogService.createAdminCategorySpec).toHaveBeenCalledWith(categoryId, {
      attributeKey: ' Screen Size ',
      displayName: 'Screen Size',
      type: 'NUMBER',
      unit: 'inch',
    })
    expect(container.catalogService.updateAdminCategorySpec).toHaveBeenCalledWith(categoryId, specId, { displayName: 'Updated', type: 'TEXT' })
    expect(container.catalogService.deactivateAdminCategorySpec).toHaveBeenCalledWith(categoryId, specId)
    expect(container.catalogService.reactivateAdminCategorySpec).toHaveBeenCalledWith(categoryId, specId)
    expect(container.catalogService.reorderAdminCategorySpecs).toHaveBeenCalledWith(categoryId, { specs: [{ id: specId }] })
  })

  it('validates admin category spec payload type values', async () => {
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext() as any)

    const response = await createApp().handle(new Request('http://localhost/api/admin/categories/55555555-5555-4555-8555-555555555555/specs', {
      method: 'POST',
      body: JSON.stringify({ attributeKey: 'Color', displayName: 'Color', type: 'INVALID' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(422)
  })

  it('routes seller product create, update, and submit-review requests to the service', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ id: 'seller-1', role: 'SELLER' }) as any)
    const app = createApp(container)
    const productId = '22222222-2222-4222-8222-222222222222'

    const created = await app.handle(new Request('http://localhost/api/seller/products', {
      method: 'POST',
      body: JSON.stringify({
        shopId: '11111111-1111-4111-8111-111111111111',
        categoryId: '55555555-5555-4555-8555-555555555555',
        title: 'Phone',
        attributes: [{ attributeKey: 'Weight', displayName: 'Weight', value: '1.5' }],
      }),
      headers: { 'content-type': 'application/json' },
    }))
    const updated = await app.handle(new Request(`http://localhost/api/seller/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        attributes: [{ attributeKey: 'Waterproof', displayName: 'Waterproof', value: 'yes' }],
      }),
      headers: { 'content-type': 'application/json' },
    }))
    const submitted = await app.handle(new Request(`http://localhost/api/seller/products/${productId}/submit-review`, { method: 'POST' }))

    expect(created.status).toBe(200)
    expect(updated.status).toBe(200)
    expect(submitted.status).toBe(200)
    expect(container.catalogService.createProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }), expect.objectContaining({
      categoryId: '55555555-5555-4555-8555-555555555555',
      attributes: [{ attributeKey: 'Weight', displayName: 'Weight', value: '1.5' }],
    }))
    expect(container.catalogService.updateProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }), productId, expect.objectContaining({
      attributes: [{ attributeKey: 'Waterproof', displayName: 'Waterproof', value: 'yes' }],
    }))
    expect(container.catalogService.submitProductReview).toHaveBeenCalledWith(expect.objectContaining({ id: 'seller-1' }), productId)
  })

  it('returns stable seller product spec validation errors from service failures', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(mockAuthContext({ id: 'seller-1', role: 'SELLER' }) as any)
    vi.mocked(container.catalogService.createProduct).mockRejectedValueOnce(
      new CatalogServiceError('Product is missing required category specs', 400, 'PRODUCT_SPEC_REQUIRED_MISSING', { missingSpecs: ['weight'] }),
    )
    vi.mocked(container.catalogService.updateProduct).mockRejectedValueOnce(
      new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', { attributeKey: 'weight' }),
    )
    vi.mocked(container.catalogService.submitProductReview).mockRejectedValueOnce(
      new CatalogServiceError('Product attribute does not match an active spec for this category', 400, 'PRODUCT_SPEC_ATTRIBUTE_INVALID', { attributeKey: 'archived_spec' }),
    )
    const app = createApp(container)
    const productId = '22222222-2222-4222-8222-222222222222'

    const createResponse = await app.handle(new Request('http://localhost/api/seller/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'Phone', categoryId: '55555555-5555-4555-8555-555555555555' }),
      headers: { 'content-type': 'application/json' },
    }))
    const updateResponse = await app.handle(new Request(`http://localhost/api/seller/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ attributes: [{ attributeKey: 'Weight', displayName: 'Weight', value: 'heavy' }] }),
      headers: { 'content-type': 'application/json' },
    }))
    const submitResponse = await app.handle(new Request(`http://localhost/api/seller/products/${productId}/submit-review`, { method: 'POST' }))

    await expect(createResponse.json()).resolves.toMatchObject({ error: { code: 'PRODUCT_SPEC_REQUIRED_MISSING' } })
    await expect(updateResponse.json()).resolves.toMatchObject({ error: { code: 'PRODUCT_SPEC_TYPE_INVALID' } })
    await expect(submitResponse.json()).resolves.toMatchObject({ error: { code: 'PRODUCT_SPEC_ATTRIBUTE_INVALID' } })
    expect(createResponse.status).toBe(400)
    expect(updateResponse.status).toBe(400)
    expect(submitResponse.status).toBe(400)
  })

  it('routes category-scoped public product filters with parsed attribute filters', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    vi.mocked(container.catalogService.listPublicProducts).mockResolvedValueOnce({ data: [], items: [], meta: { nextCursor: null, hasNextPage: false, totalCount: 0, page: 2, pageSize: 10, query: {} } })

    const response = await createApp(container).handle(new Request(
      'http://localhost/api/categories/55555555-5555-4555-8555-555555555555/products?attributeFilters=color:red,screen%20size:6.1%20inch&brandId=44444444-4444-4444-8444-444444444444&minPrice=100&maxPrice=2000&sort=newest&page=2&limit=10',
    ))

    expect(response.status).toBe(200)
    expect(container.catalogService.listPublicProducts).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: '55555555-5555-4555-8555-555555555555',
      brandId: '44444444-4444-4444-8444-444444444444',
      minPrice: 100,
      maxPrice: 2000,
      sort: 'newest',
      page: 2,
      limit: 10,
      attributes: [
        { key: 'color', value: 'red' },
        { key: 'screen size', value: '6.1 inch' },
      ],
    }))
  })

  it('routes related public products with validated query params before product detail fallback', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    vi.mocked(container.catalogService.listRelatedProducts).mockResolvedValueOnce([])
    const productId = '22222222-2222-4222-8222-222222222222'

    const response = await createApp(container).handle(new Request(`http://localhost/api/products/${productId}/related?locale=en&limit=6`))

    expect(response.status).toBe(200)
    expect(container.catalogService.listRelatedProducts).toHaveBeenCalledWith(productId, { locale: 'en', limit: 6 })
    expect(container.catalogService.getPublicProductDetail).not.toHaveBeenCalled()
  })

  it('rejects related public product limits above the validated maximum', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    const productId = '22222222-2222-4222-8222-222222222222'

    const response = await createApp(container).handle(new Request(`http://localhost/api/products/${productId}/related?limit=13`))

    expect(response.status).toBe(422)
    expect(container.catalogService.listRelatedProducts).not.toHaveBeenCalled()
  })

  it('returns stable public attribute filter validation errors from service failures', async () => {
    const container = createContainer()
    vi.mocked(getAuthContext).mockResolvedValue(null)
    vi.mocked(container.catalogService.listPublicProducts).mockRejectedValueOnce(
      new CatalogServiceError('Attribute filters require a category scope', 400, 'PRODUCT_SPEC_FILTER_INVALID', { attributeKey: 'color' }),
    )

    const response = await createApp(container).handle(new Request('http://localhost/api/products?attributeFilters=color:red'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'PRODUCT_SPEC_FILTER_INVALID',
        details: { attributeKey: 'color' },
      },
    })
  })
})
