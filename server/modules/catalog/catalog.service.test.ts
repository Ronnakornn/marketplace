import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductStatus, Role } from '#generated/client/enums.ts'
import { CacheService, type CacheClient } from '#server/modules/cache'
import type { ICatalogRepository } from './catalog.repository.ts'
import { CatalogService } from './catalog.service.ts'

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  }
}

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): ICatalogRepository {
  return {
    findActiveCategories: vi.fn(),
    findCategoryWithSpecs: vi.fn(),
    findAdminCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    updateCategoryActiveState: vi.fn(),
    reorderSiblingCategories: vi.fn(),
    findAdminCategorySpecs: vi.fn(),
    createCategorySpec: vi.fn(),
    updateCategorySpec: vi.fn(),
    updateCategorySpecActiveState: vi.fn(),
    reorderCategorySpecs: vi.fn(),
    findActiveBrands: vi.fn(),
    findBrandById: vi.fn(),
    findShopById: vi.fn(),
    findFirstShopByOwnerId: vi.fn(),
    findProductById: vi.fn(),
    findProducts: vi.fn(),
    findUploadById: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createProductImage: vi.fn(),
    updateProductImage: vi.fn(),
    deleteProductImage: vi.fn(),
    upsertProductVideo: vi.fn(),
    deleteProductVideo: vi.fn(),
    replaceProductOptions: vi.fn(),
    updateProductImagesOrder: vi.fn(),
    createVariant: vi.fn(),
    updateVariant: vi.fn(),
    deleteVariant: vi.fn(),
    findVariantById: vi.fn(),
    updateVariantInventory: vi.fn(),
    findLatestModerationCase: vi.fn(),
    createModerationAction: vi.fn(),
  }
}

function createCacheService() {
  const store = new Map<string, string>()
  const client: CacheClient = {
    get: vi.fn(async (key) => store.get(key) ?? null),
    set: vi.fn(async (key, value) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys) => {
      keys.forEach((key) => store.delete(key))
      return keys.length
    }),
    keys: vi.fn(async () => []),
  }
  return new CacheService(createAppContext(), {
    enabled: true,
    redisUrl: 'redis://localhost:6379',
    defaultTtlSeconds: 300,
    productTtlSeconds: 120,
    searchTtlSeconds: 60,
    sellerDashboardTtlSeconds: 30,
    keyPrefix: 'v1',
  }, client)
}

function createActor(overrides: Partial<{ id: string; role: Role }> = {}) {
  return {
    id: overrides.id ?? 'seller-1',
    role: overrides.role ?? 'USER',
  }
}

function createProduct(overrides: Partial<{
  id: string;
  shopId: string;
  categoryId: string | null;
  brandId: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  category: { id: string; name: string; slug: string } | null;
  shop: { id: string; name: string; slug: string; ownerId: string; status: 'ACTIVE' };
  variants: never[];
  images: any[];
  video: any | null;
  brand: any | null;
  sellerProfileId: string | null;
  sellerIdentityHash: string | null;
  productFingerprintHash: string | null;
  duplicateStatus: string | null;
  duplicateOfProductId: string | null; // Add duplicateOfProductId property here
  deletedAt: Date | null; // Add deletedAt property here
}> = {}): any {
  const now = new Date('2026-05-12T00:00:00.000Z')
  const shopId = overrides.shopId ?? '11111111-1111-4111-8111-111111111111'

  return {
    id: overrides.id ?? '22222222-2222-4222-8222-222222222222',
    shopId,
    categoryId: overrides.categoryId ?? null,
    brandId: overrides.brandId ?? null,
    title: overrides.title ?? 'Test Product',
    slug: overrides.slug ?? 'test-product',
    description: overrides.description ?? null,
    status: overrides.status ?? 'DRAFT',
    createdAt: now,
    updatedAt: now,
    category: overrides.categoryId
      ? {
          id: overrides.categoryId,
          name: 'Fashion',
          slug: 'fashion',
          isActive: true,
        }
      : null,
    brand: null,
    images: overrides.images ?? [],
    video: overrides.video ?? null,
    attributes: [],
    highlights: [],
    shop: {
      id: shopId,
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: overrides.ownerId ?? 'seller-1',
      status: 'ACTIVE' as const,
    },
    variants: [],
    options: [],
    sellerProfileId: overrides.sellerProfileId ?? null,
    sellerIdentityHash: overrides.sellerIdentityHash ?? null,
    productFingerprintHash: overrides.productFingerprintHash ?? null,
    duplicateStatus: overrides.duplicateStatus ?? null,
    duplicateOfProductId: overrides.duplicateOfProductId ?? null,
    deletedAt: overrides.deletedAt ?? null,
  }
}

function createUpload(overrides: Partial<{
  id: string
  userId: string
  usage: 'PRODUCT_IMAGE' | 'PRODUCT_VIDEO' | 'SHOP_IMAGE'
  status: 'PENDING' | 'COMPLETED'
  fileName: string
  contentType: string
  fileSize: number
  publicUrl: string | null
}> = {}): any {
  const now = new Date('2026-05-12T00:00:00.000Z')
  return {
    id: overrides.id ?? '77777777-7777-4777-8777-777777777777',
    userId: overrides.userId ?? 'seller-1',
    usage: overrides.usage ?? 'PRODUCT_IMAGE',
    status: overrides.status ?? 'COMPLETED',
    fileName: overrides.fileName ?? 'image.avif',
    contentType: overrides.contentType ?? 'image/avif',
    fileSize: overrides.fileSize ?? 1024,
    key: 'uploads/product_image/seller-1/2026/05/image.avif',
    publicUrl: overrides.publicUrl ?? 'https://cdn.example.test/image.avif',
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}
function createVariant(overrides: Partial<{
  id: string
  productId: string
  sku: string
  title: string
  price: bigint
  currency: string
}> = {}): any {
  const now = new Date('2026-05-12T00:00:00.000Z')

  return {
    id: overrides.id ?? '33333333-3333-4333-8333-333333333333',
    productId: overrides.productId ?? '22222222-2222-4222-8222-222222222222',
    sku: overrides.sku ?? 'SKU-1',
    title: overrides.title ?? 'Blue',
    price: BigInt(overrides.price ?? 1299),
    currency: 'USD',
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    optionCombinationKey: null,
    optionValues: [],
  }
}

function createCategory(overrides: Partial<{
  id: string
  parentId: string | null
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
}> = {}): any {
  const now = new Date('2026-05-12T00:00:00.000Z')
  return {
    id: overrides.id ?? '55555555-5555-4555-8555-555555555555',
    parentId: overrides.parentId ?? null,
    name: overrides.name ?? 'Fashion',
    nameTh: null,
    nameEn: null,
    slug: overrides.slug ?? 'fashion',
    sortOrder: overrides.sortOrder ?? 0,
    isActive: overrides.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  }
}

function createCategorySpec(overrides: Record<string, unknown> = {}): any {
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

describe('CatalogService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists public products as ACTIVE only with pagination and filters', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({
      data: [createProduct({ status: 'ACTIVE' })],
      meta: {
        nextCursor: '22222222-2222-4222-8222-222222222222',
        hasNextPage: true,
      },
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({
      keyword: ' bag ',
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: 100,
      maxPrice: 2000,
      cursor: '99999999-9999-4999-8999-999999999999',
      limit: 10,
    })).resolves.toMatchObject({
      meta: { hasNextPage: true },
    })

    expect(repo.findProducts).toHaveBeenCalledWith({
      keyword: 'bag',
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: 100,
      maxPrice: 2000,
      cursor: '99999999-9999-4999-8999-999999999999',
      limit: 10,
      status: 'ACTIVE',
      publicOnly: true,
    })
  })

  it('passes public brand and filterable attribute filters to the repository', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({ data: [], meta: { nextCursor: null, hasNextPage: false } })
    const service = new CatalogService(createAppContext(), repo)

    await service.listPublicProducts({
      brandId: '44444444-4444-4444-8444-444444444444',
      attributes: { Color: 'Red', 'Screen Size': '6.1 inch' },
    })

    expect(repo.findProducts).toHaveBeenCalledWith(expect.objectContaining({
      brandId: '44444444-4444-4444-8444-444444444444',
      attributeFilters: [
        { key: 'color', value: 'Red' },
        { key: 'screen_size', value: '6.1 inch' },
      ],
      status: 'ACTIVE',
      publicOnly: true,
    }))
  })

  it('product list uses cache after first database fallback', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({ data: [], meta: { nextCursor: null, hasNextPage: false } })
    const service = new CatalogService(createAppContext(), repo, createCacheService())

    await service.listPublicProducts({ keyword: 'tee' })
    await service.listPublicProducts({ keyword: 'tee' })

    expect(repo.findProducts).toHaveBeenCalledTimes(1)
  })

  it('product detail uses cache after first database fallback', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProductById).mockResolvedValue(createProduct({ status: 'ACTIVE' }))
    const service = new CatalogService(createAppContext(), repo, createCacheService())

    await service.getPublicProductDetail('22222222-2222-4222-8222-222222222222')
    await service.getPublicProductDetail('22222222-2222-4222-8222-222222222222')

    expect(repo.findProductById).toHaveBeenCalledTimes(1)
  })

  it('lists only active public categories through the repository', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findActiveCategories).mockResolvedValue([createCategory({ isActive: true })])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listCategories()).resolves.toHaveLength(1)

    expect(repo.findActiveCategories).toHaveBeenCalled()
    expect(repo.findAdminCategories).not.toHaveBeenCalled()
  })

  it('creates admin categories with normalized unique slugs and parent validation', async () => {
    const repo = createRepoMock()
    const parent = createCategory({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Root', slug: 'root' })
    vi.mocked(repo.findAdminCategories).mockResolvedValue([parent])
    vi.mocked(repo.createCategory).mockResolvedValue(createCategory({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      parentId: parent.id,
      name: 'Mobile Phones',
      slug: 'mobile-phones',
    }))
    const cacheInvalidation = { invalidateCatalogDiscoveryAndSearch: vi.fn(async () => 0) }
    const service = new CatalogService(createAppContext(), repo, undefined, cacheInvalidation as any)

    await service.createAdminCategory({
      parentId: parent.id,
      name: ' Mobile Phones ',
      slug: ' Mobile Phones! ',
    })

    expect(repo.createCategory).toHaveBeenCalledWith(expect.objectContaining({
      parentId: parent.id,
      name: 'Mobile Phones',
      slug: 'mobile-phones',
    }))
    expect(cacheInvalidation.invalidateCatalogDiscoveryAndSearch).toHaveBeenCalled()

    await expect(service.createAdminCategory({ parentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Missing Parent' }))
      .rejects.toMatchObject({ code: 'CATEGORY_PARENT_NOT_FOUND' })
    await expect(service.createAdminCategory({ name: 'Duplicate', slug: 'ROOT' }))
      .rejects.toMatchObject({ code: 'CATEGORY_SLUG_DUPLICATE' })
  })

  it('updates admin categories while rejecting parent cycles', async () => {
    const repo = createRepoMock()
    const root = createCategory({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Root', slug: 'root' })
    const child = createCategory({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', parentId: root.id, name: 'Child', slug: 'child' })
    vi.mocked(repo.findAdminCategories).mockResolvedValue([root, child])
    vi.mocked(repo.updateCategory).mockResolvedValue({ ...child, name: 'Updated Child' })
    const cacheInvalidation = { invalidateCatalogDiscoveryAndSearch: vi.fn(async () => 0) }
    const service = new CatalogService(createAppContext(), repo, undefined, cacheInvalidation as any)

    await service.updateAdminCategory(child.id, { name: ' Updated Child ', slug: 'Updated Child' })

    expect(repo.updateCategory).toHaveBeenCalledWith(child.id, expect.objectContaining({
      name: 'Updated Child',
      slug: 'updated-child',
    }))
    await expect(service.updateAdminCategory(root.id, { parentId: child.id }))
      .rejects.toMatchObject({ code: 'CATEGORY_PARENT_CYCLE' })
  })

  it('deactivates and reactivates admin categories without deleting product references', async () => {
    const repo = createRepoMock()
    const category = createCategory()
    vi.mocked(repo.findAdminCategories).mockResolvedValue([category])
    vi.mocked(repo.updateCategoryActiveState).mockResolvedValue({ ...category, isActive: false })
    const cacheInvalidation = { invalidateCatalogDiscoveryAndSearch: vi.fn(async () => 0) }
    const service = new CatalogService(createAppContext(), repo, undefined, cacheInvalidation as any)

    await service.deactivateAdminCategory(category.id)
    vi.mocked(repo.updateCategoryActiveState).mockResolvedValue({ ...category, isActive: true })
    await service.reactivateAdminCategory(category.id)

    expect(repo.updateCategoryActiveState).toHaveBeenCalledWith(category.id, false)
    expect(repo.updateCategoryActiveState).toHaveBeenCalledWith(category.id, true)
    expect(repo.updateCategory).not.toHaveBeenCalledWith(category.id, expect.objectContaining({ product: expect.anything() }))
  })

  it('reorders only sibling admin categories', async () => {
    const repo = createRepoMock()
    const parentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const siblingA = createCategory({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', parentId, name: 'A', slug: 'a' })
    const siblingB = createCategory({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', parentId, name: 'B', slug: 'b' })
    const other = createCategory({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', parentId: null, name: 'Other', slug: 'other' })
    vi.mocked(repo.findAdminCategories).mockResolvedValue([createCategory({ id: parentId }), siblingA, siblingB, other])
    vi.mocked(repo.reorderSiblingCategories).mockResolvedValue([siblingB, siblingA])
    const service = new CatalogService(createAppContext(), repo)

    await service.reorderAdminCategories({
      parentId,
      categories: [{ id: siblingB.id }, { id: siblingA.id, sortOrder: 2 }],
    })

    expect(repo.reorderSiblingCategories).toHaveBeenCalledWith(parentId, [
      { id: siblingB.id, sortOrder: 0 },
      { id: siblingA.id, sortOrder: 2 },
    ])
    await expect(service.reorderAdminCategories({ parentId, categories: [{ id: other.id }] }))
      .rejects.toMatchObject({ code: 'CATEGORY_REORDER_SIBLING_MISMATCH' })
  })

  it('lists public category specs through active category spec lookup only', async () => {
    const repo = createRepoMock()
    const spec = createCategorySpec({ isActive: true })
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({
      id: spec.categoryId,
      isActive: true,
      attributeDefinitions: [spec],
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listCategorySpecs(spec.categoryId)).resolves.toEqual([spec])

    expect(repo.findCategoryWithSpecs).toHaveBeenCalledWith(spec.categoryId)
    expect(repo.findAdminCategorySpecs).not.toHaveBeenCalled()
  })

  it('creates and updates admin category specs with normalized unique attribute keys', async () => {
    const repo = createRepoMock()
    const category = createCategory()
    const existingSpec = createCategorySpec({ attributeKey: 'screen_size' })
    vi.mocked(repo.findAdminCategories).mockResolvedValue([category])
    vi.mocked(repo.findAdminCategorySpecs).mockResolvedValue([existingSpec])
    vi.mocked(repo.createCategorySpec).mockResolvedValue(createCategorySpec({ attributeKey: 'material', displayName: 'Material' }))
    vi.mocked(repo.updateCategorySpec).mockResolvedValue(createCategorySpec({ id: existingSpec.id, attributeKey: 'screen_size', displayName: 'Screen Size' }))
    const cacheInvalidation = { invalidateCatalogDiscoveryAndSearch: vi.fn(async () => 0) }
    const service = new CatalogService(createAppContext(), repo, undefined, cacheInvalidation as any)

    await service.createAdminCategorySpec(category.id, {
      attributeKey: ' Material ',
      displayName: ' Material ',
      type: 'TEXT',
      isRequired: true,
      isFilterable: true,
      unit: ' cm ',
    })
    await service.updateAdminCategorySpec(category.id, existingSpec.id, {
      displayName: ' Screen Size ',
      type: 'NUMBER',
      unit: ' inch ',
    })

    expect(repo.createCategorySpec).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: category.id,
      attributeKey: 'material',
      displayName: 'Material',
      valueType: 'TEXT',
      isRequired: true,
      isFilterable: true,
      unit: 'cm',
    }))
    expect(repo.updateCategorySpec).toHaveBeenCalledWith(existingSpec.id, expect.objectContaining({
      displayName: 'Screen Size',
      valueType: 'NUMBER',
      unit: 'inch',
    }))
    expect(cacheInvalidation.invalidateCatalogDiscoveryAndSearch).toHaveBeenCalledTimes(2)

    await expect(service.createAdminCategorySpec(category.id, {
      attributeKey: 'Screen Size',
      displayName: 'Duplicate',
      type: 'TEXT',
    })).rejects.toMatchObject({ code: 'CATEGORY_SPEC_ATTRIBUTE_DUPLICATE' })
    await expect(service.createAdminCategorySpec(category.id, {
      attributeKey: ' ',
      displayName: 'Invalid',
      type: 'TEXT',
    })).rejects.toMatchObject({ code: 'CATEGORY_SPEC_VALIDATION_FAILED' })
  })

  it('deactivates, reactivates, and reorders admin category specs within the selected category', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const specA = createCategorySpec({ id: '66666666-6666-4666-8666-666666666666', categoryId, attributeKey: 'color' })
    const specB = createCategorySpec({ id: '77777777-7777-4777-8777-777777777777', categoryId, attributeKey: 'size' })
    vi.mocked(repo.findAdminCategorySpecs).mockResolvedValue([specA, specB])
    vi.mocked(repo.updateCategorySpecActiveState).mockResolvedValueOnce({ ...specA, isActive: false }).mockResolvedValueOnce({ ...specA, isActive: true })
    vi.mocked(repo.reorderCategorySpecs).mockResolvedValue([specB, specA])
    const service = new CatalogService(createAppContext(), repo)

    await service.deactivateAdminCategorySpec(categoryId, specA.id)
    await service.reactivateAdminCategorySpec(categoryId, specA.id)
    await service.reorderAdminCategorySpecs(categoryId, { specs: [{ id: specB.id }, { id: specA.id, sortOrder: 3 }] })

    expect(repo.updateCategorySpecActiveState).toHaveBeenCalledWith(specA.id, false)
    expect(repo.updateCategorySpecActiveState).toHaveBeenCalledWith(specA.id, true)
    expect(repo.reorderCategorySpecs).toHaveBeenCalledWith(categoryId, [
      { id: specB.id, sortOrder: 0 },
      { id: specA.id, sortOrder: 3 },
    ])
    await expect(service.reorderAdminCategorySpecs(categoryId, { specs: [{ id: specA.id }, { id: specA.id }] }))
      .rejects.toMatchObject({ code: 'CATEGORY_SPEC_REORDER_INVALID' })
    await expect(service.reorderAdminCategorySpecs(categoryId, { specs: [{ id: '88888888-8888-4888-8888-888888888888' }] }))
      .rejects.toMatchObject({ code: 'CATEGORY_SPEC_NOT_FOUND' })
  })

  it('rejects inactive products from public detail', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProductById).mockResolvedValue(createProduct({ status: 'DRAFT' }))
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.getPublicProductDetail('22222222-2222-4222-8222-222222222222')).rejects.toMatchObject({
      status: 404,
      code: 'PRODUCT_NOT_FOUND',
    })
  })

  it('lists seller products for the seller shop and supports status', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findFirstShopByOwnerId).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      ownerId: 'seller-1',
      status: 'ACTIVE',
    })
    vi.mocked(repo.findProducts).mockResolvedValue({ data: [], meta: { nextCursor: null, hasNextPage: false } })
    const service = new CatalogService(createAppContext(), repo)

    await service.listSellerProducts(createActor(), { status: 'DRAFT', limit: 5 })

    expect(repo.findProducts).toHaveBeenCalledWith({
      keyword: undefined,
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: undefined,
      maxPrice: undefined,
      cursor: undefined,
      limit: 5,
      status: 'DRAFT',
    })
  })

  it('creates a product for the shop owner', async () => {
    const repo = createRepoMock()
    const shopId = '11111111-1111-4111-8111-111111111111'
    const product = createProduct({ shopId, ownerId: 'seller-1', title: 'Island Bag', slug: 'island-bag' })
    vi.mocked(repo.findShopById).mockResolvedValue({ id: shopId, ownerId: 'seller-1', status: 'ACTIVE' })
    vi.mocked(repo.createProduct).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await service.createProduct(createActor(), {
      shopId,
      title: ' Island Bag ',
      description: ' Summer collection ',
    })

    expect(repo.createProduct).toHaveBeenCalledWith({
      shopId,
      categoryId: null,
      brandId: null,
      title: 'Island Bag',
      slug: 'island-bag',
      description: 'Summer collection',
      metaTitle: null,
      metaDescription: null,
      warrantyInfo: null,
      condition: null,
      countryOfOrigin: null,
      status: 'DRAFT',
    })
  })

  it('normalizes product enrichment on seller create and update after ownership checks', async () => {
    const repo = createRepoMock()
    const shopId = '11111111-1111-4111-8111-111111111111'
    const product = createProduct({ shopId, ownerId: 'seller-1' })
    vi.mocked(repo.findShopById).mockResolvedValue({ id: shopId, ownerId: 'seller-1', status: 'ACTIVE' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.createProduct).mockResolvedValue(product)
    vi.mocked(repo.updateProduct).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await service.createProduct(createActor(), {
      shopId,
      title: 'Phone',
      highlights: [{ text: ' Fast charging ', sortOrder: 2 }],
      attributes: [{ displayName: ' Color ', value: ' Black ', isFilterable: true }],
      warrantyInfo: ' 1 year ',
    })
    await service.updateProduct(createActor(), product.id, {
      attributes: [{ attributeKey: 'Screen Size', displayName: 'Screen Size', value: '6.1 inch', isFilterable: true }],
    })

    expect(repo.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      warrantyInfo: '1 year',
      highlights: [{ text: 'Fast charging', sortOrder: 2 }],
      attributes: [expect.objectContaining({ attributeKey: 'color', displayName: 'Color', value: 'Black', isFilterable: true })],
    }))
    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, expect.objectContaining({
      attributes: [expect.objectContaining({ attributeKey: 'screen_size', value: '6.1 inch' })],
    }))
  })

  it('rejects duplicate normalized product attribute keys', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findShopById).mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', ownerId: 'seller-1', status: 'ACTIVE' })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createProduct(createActor(), {
      shopId: '11111111-1111-4111-8111-111111111111',
      title: 'Phone',
      attributes: [
        { displayName: 'Color', value: 'Black' },
        { displayName: 'color', value: 'White' },
      ],
    })).rejects.toMatchObject({ code: 'PRODUCT_VALIDATION_FAILED' })
  })

  it('prevents a seller from managing another shop catalog', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findShopById).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      ownerId: 'seller-2',
      status: 'ACTIVE',
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(
      service.createProduct(createActor({ id: 'seller-1' }), {
        shopId: '11111111-1111-4111-8111-111111111111',
        title: 'Product',
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'PRODUCT_FORBIDDEN',
    })
  })

  it('archives seller-owned products instead of hard deleting them', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateProduct).mockResolvedValue(createProduct({ status: 'ARCHIVED' }))
    const service = new CatalogService(createAppContext(), repo)

    await service.archiveProduct(createActor(), product.id)

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, { status: 'ARCHIVED' })
  })

  it('lists active brands for product forms', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findActiveBrands).mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Acme',
        nameTh: null,
        nameEn: null,
        slug: 'acme',
        code: 'ACME',
        description: null,
        descriptionTh: null,
        descriptionEn: null,
        logoUrl: null,
        websiteUrl: null,
        countryCode: null,
        sortOrder: 0,
        isFeatured: false,
        isActive: true,
        createdAt: new Date('2026-05-12T00:00:00.000Z'),
        updatedAt: new Date('2026-05-12T00:00:00.000Z'),
      },
    ])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listActiveBrands()).resolves.toHaveLength(1)
    expect(repo.findActiveBrands).toHaveBeenCalled()
  })

  it('rejects publishing products without category, image, and active priced variant', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.updateProduct(createActor(), product.id, { status: 'ACTIVE' })).rejects.toMatchObject({
      status: 400,
      code: 'PRODUCT_PUBLISH_NOT_READY',
    })
  })

  it('allows publishing products with required category, image, and active priced variant', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      categoryId: '55555555-5555-4555-8555-555555555555',
      images: [{ id: 'img-1', productId: '22222222-2222-4222-8222-222222222222', url: '/products/a.jpg', sortOrder: 0, isPrimary: true }],
    })
    product.variants = [createVariant({ productId: product.id, price: BigInt(1299) })]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: product.categoryId, isActive: true, attributeDefinitions: [] } as any)
    vi.mocked(repo.updateProduct).mockResolvedValue({ ...product, status: 'ACTIVE' })
    const service = new CatalogService(createAppContext(), repo)

    await service.updateProduct(createActor(), product.id, { status: 'ACTIVE' })

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, { status: 'ACTIVE' })
  })

  it('submit review moves ready draft products to pending review', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      categoryId: '55555555-5555-4555-8555-555555555555',
      images: [{ id: 'img-1', productId: '22222222-2222-4222-8222-222222222222', url: '/products/a.jpg', sortOrder: 0, isPrimary: true }],
    })
    product.variants = [createVariant({ productId: product.id, price: BigInt(1299) })]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: product.categoryId, isActive: true, attributeDefinitions: [] } as any)
    vi.mocked(repo.updateProduct).mockResolvedValue({ ...product, status: 'PENDING_REVIEW' })
    vi.mocked(repo.createModerationAction).mockResolvedValue({} as any)
    const service = new CatalogService(createAppContext(), repo)

    await service.submitProductReview(createActor(), product.id)

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, { status: 'PENDING_REVIEW' })
    expect(repo.createModerationAction).toHaveBeenCalledWith(product.id, 'seller-1', 'ESCALATE', 'Submitted for review')
  })

  it('publish readiness requires required category specs and a primary image', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      categoryId: '55555555-5555-4555-8555-555555555555',
      images: [{ id: 'img-1', isPrimary: false }],
    })
    product.variants = [createVariant({ productId: product.id, price: BigInt(1299) })]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({
      id: product.categoryId,
      isActive: true,
      attributeDefinitions: [{ attributeKey: 'color', isRequired: true }],
    } as any)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.submitProductReview(createActor(), product.id)).rejects.toMatchObject({
      code: 'PRODUCT_PUBLISH_NOT_READY',
    })
  })

  it('publish readiness ignores inactive required category specs from active-only repository lookup', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      categoryId: '55555555-5555-4555-8555-555555555555',
      images: [{ id: 'img-1', isPrimary: true }],
    })
    product.variants = [createVariant({ productId: product.id, price: BigInt(1299) })]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({
      id: product.categoryId,
      isActive: true,
      attributeDefinitions: [],
    } as any)
    vi.mocked(repo.updateProduct).mockResolvedValue({ ...product, status: 'PENDING_REVIEW' })
    vi.mocked(repo.createModerationAction).mockResolvedValue({} as any)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.submitProductReview(createActor(), product.id)).resolves.toMatchObject({ status: 'PENDING_REVIEW' })
  })

  it('creates product images only after seller ownership validation', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const image = {
      id: '66666666-6666-4666-8666-666666666666',
      productId: product.id,
      uploadId: null,
      url: '/products/a.jpg',
      altText: 'Front',
      sortOrder: 0,
      isPrimary: true,
      width: 800,
      height: 600,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    }
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.createProductImage).mockResolvedValue(image)
    const service = new CatalogService(createAppContext(), repo)

    await service.createProductImage(createActor(), product.id, {
      url: ' /products/a.jpg ',
      altText: ' Front ',
      isPrimary: true,
      width: 800,
      height: 600,
    })

    expect(repo.createProductImage).toHaveBeenCalledWith({
      productId: product.id,
      url: '/products/a.jpg',
      altText: 'Front',
      isPrimary: true,
      width: 800,
      height: 600,
    })
  })

  it('attaches a completed seller-owned image upload', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const upload = createUpload()
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findUploadById).mockResolvedValue(upload)
    vi.mocked(repo.createProductImage).mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      productId: product.id,
      uploadId: upload.id,
      url: upload.publicUrl,
      altText: null,
      sortOrder: 0,
      isPrimary: false,
      width: null,
      height: null,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    } as any)
    const service = new CatalogService(createAppContext(), repo)

    await service.createProductImage(createActor(), product.id, { uploadId: upload.id, url: '/fallback.jpg' })

    expect(repo.createProductImage).toHaveBeenCalledWith(expect.objectContaining({
      productId: product.id,
      uploadId: upload.id,
      url: upload.publicUrl,
    }))
  })

  it('rejects incomplete, wrong-owner, and non-image product image uploads', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    vi.mocked(repo.findUploadById).mockResolvedValueOnce(createUpload({ status: 'PENDING' }))
    await expect(service.createProductImage(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'UPLOAD_NOT_COMPLETED' })

    vi.mocked(repo.findUploadById).mockResolvedValueOnce(createUpload({ userId: 'seller-2' }))
    await expect(service.createProductImage(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' })

    vi.mocked(repo.findUploadById).mockResolvedValueOnce(createUpload({ usage: 'SHOP_IMAGE', contentType: 'image/avif' }))
    await expect(service.createProductImage(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'PRODUCT_IMAGE_UPLOAD_INVALID' })
  })

  it('rejects the 11th product image', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      images: Array.from({ length: 10 }, (_, index) => ({ id: `image-${index}` })),
    })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createProductImage(createActor(), product.id, { url: '/products/extra.jpg' }))
      .rejects.toMatchObject({ code: 'PRODUCT_IMAGE_LIMIT_EXCEEDED' })
  })

  it('attaches a valid product video upload', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const upload = createUpload({
      usage: 'PRODUCT_VIDEO',
      fileName: 'demo.mp4',
      contentType: 'video/mp4',
      fileSize: 1024,
      publicUrl: 'https://cdn.example.test/demo.mp4',
    })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findUploadById).mockResolvedValue(upload)
    vi.mocked(repo.upsertProductVideo).mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      productId: product.id,
      uploadId: upload.id,
      url: upload.publicUrl,
      contentType: upload.contentType,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      sortOrder: 0,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    } as any)
    const service = new CatalogService(createAppContext(), repo)

    await service.upsertProductVideo(createActor(), product.id, { uploadId: upload.id })

    expect(repo.upsertProductVideo).toHaveBeenCalledWith(expect.objectContaining({
      productId: product.id,
      uploadId: upload.id,
      url: upload.publicUrl,
      contentType: 'video/mp4',
      fileName: 'demo.mp4',
      fileSize: 1024,
    }))
  })

  it('rejects invalid product video MIME type, file size, and second video', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    vi.mocked(repo.findUploadById).mockResolvedValueOnce(createUpload({ usage: 'PRODUCT_VIDEO', contentType: 'video/quicktime' }))
    await expect(service.upsertProductVideo(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'PRODUCT_VIDEO_UPLOAD_INVALID' })

    vi.mocked(repo.findUploadById).mockResolvedValueOnce(createUpload({ usage: 'PRODUCT_VIDEO', contentType: 'video/mp4', fileSize: 25 * 1024 * 1024 + 1 }))
    await expect(service.upsertProductVideo(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'PRODUCT_VIDEO_UPLOAD_INVALID' })

    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ ownerId: 'seller-1', video: { id: 'video-1' } }))
    await expect(service.upsertProductVideo(createActor(), product.id, { uploadId: '77777777-7777-4777-8777-777777777777' }))
      .rejects.toMatchObject({ code: 'PRODUCT_VIDEO_LIMIT_EXCEEDED' })
  })

  it('updates product image primary metadata through the parent product scope', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const image = {
      id: '66666666-6666-4666-8666-666666666666',
      productId: product.id,
      uploadId: null,
      url: 'https://cdn.example.test/a.jpg',
      altText: null,
      sortOrder: 1,
      isPrimary: true,
      width: null,
      height: null,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    }
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateProductImage).mockResolvedValue(image)
    const service = new CatalogService(createAppContext(), repo)

    await service.updateProductImage(createActor(), product.id, image.id, { isPrimary: true, sortOrder: 1 })

    expect(repo.updateProductImage).toHaveBeenCalledWith(product.id, image.id, {
      isPrimary: true,
      sortOrder: 1,
    })
  })

  it('reorders product images and keeps exactly one primary image', async () => {
    const repo = createRepoMock()
    const product = createProduct({
      ownerId: 'seller-1',
      images: [
        { id: '66666666-6666-4666-8666-666666666666', isPrimary: true },
        { id: '99999999-9999-4999-8999-999999999999', isPrimary: false },
      ],
    })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateProductImagesOrder).mockResolvedValue([] as any)
    const service = new CatalogService(createAppContext(), repo)

    await service.updateProductImagesOrder(createActor(), product.id, {
      primaryImageId: '99999999-9999-4999-8999-999999999999',
      images: [
        { id: '99999999-9999-4999-8999-999999999999' },
        { id: '66666666-6666-4666-8666-666666666666' },
      ],
    })

    expect(repo.updateProductImagesOrder).toHaveBeenCalledWith(product.id, [
      { id: '99999999-9999-4999-8999-999999999999', sortOrder: 0, isPrimary: true },
      { id: '66666666-6666-4666-8666-666666666666', sortOrder: 1, isPrimary: false },
    ])
  })

  it('creates variants for seller-owned products', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.createVariant).mockResolvedValue(createVariant({ productId: product.id }))
    const service = new CatalogService(createAppContext(), repo)

    await service.createVariant(createActor(), product.id, {
      sku: ' SKU-1 ',
      title: ' Blue ',
      price: 1299,
    })

    expect(repo.createVariant).toHaveBeenCalledWith(expect.objectContaining({
      productId: product.id,
      sku: 'SKU-1',
      title: 'Blue',
      price: 1299,
      currency: 'USD',
    }))
  })

  it('creates variants with selected option values', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    product.options = [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId: product.id,
      name: 'Color',
      nameTh: null,
      nameEn: null,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      values: [{
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        optionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        value: 'Blue',
        valueTh: null,
        valueEn: null,
        displayType: 'TEXT',
        colorHex: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    }]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.createVariant).mockResolvedValue(createVariant({ productId: product.id }))
    const service = new CatalogService(createAppContext(), repo)

    await service.createVariant(createActor(), product.id, {
      sku: 'SKU-1',
      title: 'Blue',
      price: 1299,
      optionValueIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    })

    expect(repo.createVariant).toHaveBeenCalledWith(expect.objectContaining({
      optionValueIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      optionCombinationKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))
  })

  it('rejects duplicate SKU and duplicate option combinations before creating variants', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    product.options = [{
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      productId: product.id,
      name: 'Color',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      values: [{
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        optionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        value: 'Blue',
        displayType: 'TEXT',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    }] as any
    product.variants = [{
      ...createVariant({ productId: product.id, sku: 'SKU-1' }),
      optionCombinationKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createVariant(createActor(), product.id, {
      sku: 'sku-1',
      title: 'Blue',
      price: 1299,
      optionValueIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    })).rejects.toMatchObject({ code: 'VARIANT_SKU_DUPLICATE' })

    await expect(service.createVariant(createActor(), product.id, {
      sku: 'SKU-2',
      title: 'Blue 2',
      price: 1299,
      optionValueIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    })).rejects.toMatchObject({ code: 'VARIANT_OPTION_COMBINATION_DUPLICATE' })
  })

  it('rejects non-positive variant price', async () => {
    const repo = createRepoMock()
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createVariant(createActor(), '22222222-2222-4222-8222-222222222222', {
      sku: 'SKU-1',
      title: 'Blue',
      price: 0,
    })).rejects.toMatchObject({
      status: 400,
      code: 'VARIANT_VALIDATION_FAILED',
    })
  })

  it('updates variants only when they belong to the requested owned product', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findVariantById).mockResolvedValue({
      ...createVariant({ productId: product.id }),
      product,
    })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateVariant).mockResolvedValue(createVariant({ title: 'Red', price: BigInt(1499) }))
    const service = new CatalogService(createAppContext(), repo)

    await service.updateVariant(createActor(), product.id, '33333333-3333-4333-8333-333333333333', {
      title: ' Red ',
      price: 1499,
    })

    expect(repo.updateVariant).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333', {
      title: 'Red',
      price: 1499,
    })
  })

  it('passes normalized variant shipping dimensions through create and update', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const variant = createVariant({ productId: product.id })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findVariantById).mockResolvedValue({ ...variant, product })
    vi.mocked(repo.createVariant).mockResolvedValue(variant)
    vi.mocked(repo.updateVariant).mockResolvedValue(variant)
    const service = new CatalogService(createAppContext(), repo)

    await service.createVariant(createActor(), product.id, {
      sku: 'SKU-2',
      title: 'Box',
      price: 1000,
      weightGrams: 500,
      lengthMm: 200,
      widthMm: 100,
      heightMm: 50,
    })
    await service.updateVariant(createActor(), product.id, variant.id, { weightGrams: null })

    expect(repo.createVariant).toHaveBeenCalledWith(expect.objectContaining({
      weightGrams: 500,
      lengthMm: 200,
      widthMm: 100,
      heightMm: 50,
    }))
    expect(repo.updateVariant).toHaveBeenCalledWith(variant.id, { weightGrams: null })
  })

  it('deletes variants only after ownership validation', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const variant = createVariant({ productId: product.id })
    vi.mocked(repo.findVariantById).mockResolvedValue({ ...variant, product })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.deleteVariant).mockResolvedValue(variant)
    const service = new CatalogService(createAppContext(), repo)

    await service.deleteVariant(createActor(), product.id, variant.id)

    expect(repo.deleteVariant).toHaveBeenCalledWith(variant.id)
  })

  it('updates seller inventory while preserving reserved stock ownership rules', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    const variant = createVariant({ productId: product.id })
    vi.mocked(repo.findVariantById).mockResolvedValue({ ...variant, product })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateVariantInventory).mockResolvedValue({
      id: 'inventory-1',
      quantityOnHand: 12,
      quantityReserved: 3,
      reorderLevel: 4,
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.updateSellerInventory(createActor(), variant.id, {
      quantityOnHand: 12,
      reorderLevel: 4,
    })).resolves.toMatchObject({ quantityOnHand: 12, quantityReserved: 3, reorderLevel: 4 })

    expect(repo.updateVariantInventory).toHaveBeenCalledWith(variant.id, {
      quantityOnHand: 12,
      reorderLevel: 4,
    })
  })

  it('rejects invalid seller inventory quantities', async () => {
    const repo = createRepoMock()
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.updateSellerInventory(createActor(), 'variant-1', {
      quantityOnHand: -1,
    })).rejects.toMatchObject({
      status: 400,
      code: 'INVENTORY_VALIDATION_FAILED',
    })
  })

  it('maps duplicate SKU or slug errors to conflict', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.createVariant).mockRejectedValue({ code: 'P2002' })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createVariant(createActor(), product.id, {
      sku: 'SKU-1',
      title: 'Blue',
      price: 1299,
    })).rejects.toMatchObject({
      status: 409,
      code: 'CATALOG_CONFLICT',
    })
  })

  it('admin moderation approve, reject, suspend, and restore update status with reasons where required', async () => {
    const repo = createRepoMock()
    const admin = createActor({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ status: 'PENDING_REVIEW' }))
    vi.mocked(repo.updateProduct).mockResolvedValueOnce(createProduct({ status: 'ACTIVE' }))
    vi.mocked(repo.createModerationAction).mockResolvedValue({} as any)
    const service = new CatalogService(createAppContext(), repo)

    await service.approveProduct(admin, '22222222-2222-4222-8222-222222222222')
    await expect(service.rejectProduct(admin, '22222222-2222-4222-8222-222222222222', { reason: ' ' }))
      .rejects.toMatchObject({ code: 'PRODUCT_MODERATION_REASON_REQUIRED' })

    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ status: 'ACTIVE' }))
    vi.mocked(repo.updateProduct).mockResolvedValueOnce(createProduct({ status: 'SUSPENDED' }))
    await service.suspendProduct(admin, '22222222-2222-4222-8222-222222222222', { reason: 'Policy' })

    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ status: 'SUSPENDED' }))
    vi.mocked(repo.updateProduct).mockResolvedValueOnce(createProduct({ status: 'ACTIVE' }))
    await service.restoreProduct(admin, '22222222-2222-4222-8222-222222222222')

    expect(repo.updateProduct).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', { status: 'ACTIVE' })
    expect(repo.updateProduct).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', { status: 'SUSPENDED' })
  })
})
