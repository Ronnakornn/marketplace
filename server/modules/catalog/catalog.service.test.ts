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
    findCategorySpecsByAttributeKeys: vi.fn(),
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
    findProductMetrics: vi.fn(async (productIds: string[]) => productIds.map((productId) => ({
      productId,
      rating: 0,
      ratingCount: 0,
      soldCount: 0,
    }))),
    findRelatedProducts: vi.fn(),
    findProducts: vi.fn(),
    findProductFacets: vi.fn(async () => ({
      categories: [],
      brands: [],
      price: { min: null, max: null, currency: 'THB' },
    })),
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
    currency: 'THB',
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
        totalCount: 11,
        page: 2,
        pageSize: 10,
        hasNextPage: true,
        query: {
          q: 'bag',
          minPrice: 100,
          maxPrice: 2000,
          sort: 'newest',
        },
      },
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({
      keyword: ' bag ',
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: 100,
      maxPrice: 2000,
      sort: ' newest ',
      cursor: '99999999-9999-4999-8999-999999999999',
      page: 2,
      limit: 10,
    })).resolves.toMatchObject({
      items: [expect.objectContaining({ status: 'ACTIVE' })],
      meta: {
        totalCount: 11,
        page: 2,
        pageSize: 10,
        hasNextPage: true,
        query: {
          q: 'bag',
          minPrice: 100,
          maxPrice: 2000,
          sort: 'newest',
        },
      },
      facets: {
        categories: [],
        brands: [],
        price: { min: null, max: null, currency: 'THB' },
      },
    })

    expect(repo.findProducts).toHaveBeenCalledWith({
      keyword: 'bag',
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: 100,
      maxPrice: 2000,
      sort: 'newest',
      cursor: '99999999-9999-4999-8999-999999999999',
      page: 2,
      limit: 10,
      status: 'ACTIVE',
      publicOnly: true,
    })
    expect(repo.findProductFacets).toHaveBeenCalledWith({
      keyword: 'bag',
      shopId: '11111111-1111-4111-8111-111111111111',
      minPrice: 100,
      maxPrice: 2000,
      sort: 'newest',
      cursor: '99999999-9999-4999-8999-999999999999',
      page: 2,
      limit: 10,
      status: 'ACTIVE',
      publicOnly: true,
    })
  })

  it('adds real review and paid-order metrics to public products', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({
      data: [createProduct({ id: '22222222-2222-4222-8222-222222222222', status: 'ACTIVE' })],
      meta: { nextCursor: null, hasNextPage: false },
    })
    vi.mocked(repo.findProductMetrics).mockResolvedValue([{
      productId: '22222222-2222-4222-8222-222222222222',
      rating: 4.25,
      ratingCount: 8,
      soldCount: 17,
    }])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({})).resolves.toMatchObject({
      items: [{
        rating: 4.25,
        ratingSummary: { averageRating: 4.25, totalReviewCount: 8 },
        soldCount: 17,
      }],
    })
  })

  it('uses storefront paging defaults and falls back from invalid sort values', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({ data: [], meta: { nextCursor: null, totalCount: 0, page: 1, pageSize: 12, hasNextPage: false, query: {} } })
    const service = new CatalogService(createAppContext(), repo)
    await service.listPublicShopProducts('shop-1', { keyword: ' bag ', categoryId: 'fashion', sort: 'invalid' })
    expect(repo.findProducts).toHaveBeenCalledWith(expect.objectContaining({
      shopId: 'shop-1', keyword: 'bag', categoryId: 'fashion', sort: 'newest', page: 1, limit: 12,
      status: 'ACTIVE', publicOnly: true,
    }))
    expect(repo.findProductFacets).toHaveBeenLastCalledWith(expect.not.objectContaining({ categoryId: expect.anything() }))
  })

  it('returns empty facet metadata when public listing facets cannot be calculated', async () => {
    const repo = createRepoMock()
    vi.mocked(repo.findProducts).mockResolvedValue({
      data: [],
      meta: { nextCursor: null, totalCount: 0, page: 1, pageSize: 20, hasNextPage: false, query: {} },
    })
    vi.mocked(repo.findProductFacets).mockRejectedValue(new Error('facet aggregate failed'))
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({})).resolves.toMatchObject({
      items: [],
      facets: {
        categories: [],
        brands: [],
        price: { min: null, max: null, currency: 'THB' },
      },
    })
  })

  it('passes public brand and filterable attribute filters to the repository', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({
      id: categoryId,
      isActive: true,
      attributeDefinitions: [
        createCategorySpec({ categoryId, attributeKey: 'color', isActive: true, isFilterable: true }),
        createCategorySpec({ id: '66666666-6666-4666-8666-666666666667', categoryId, attributeKey: 'screen_size', isActive: true, isFilterable: true }),
      ],
    })
    vi.mocked(repo.findProducts).mockResolvedValue({ data: [], meta: { nextCursor: null, hasNextPage: false } })
    const service = new CatalogService(createAppContext(), repo)

    await service.listPublicProducts({
      categoryId,
      brandId: '44444444-4444-4444-8444-444444444444',
      attributes: { Color: 'Red', 'Screen Size': '6.1 inch' },
    })

    expect(repo.findProducts).toHaveBeenCalledWith(expect.objectContaining({
      categoryId,
      brandId: '44444444-4444-4444-8444-444444444444',
      attributeFilters: [
        { key: 'color', value: 'Red' },
        { key: 'screen_size', value: '6.1 inch' },
      ],
      status: 'ACTIVE',
      publicOnly: true,
    }))
  })

  it('rejects public attribute filters without category scope', async () => {
    const repo = createRepoMock()
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({
      attributes: { Color: 'Red' },
    })).rejects.toMatchObject({
      status: 400,
      code: 'PRODUCT_SPEC_FILTER_INVALID',
    })

    expect(repo.findCategoryWithSpecs).not.toHaveBeenCalled()
    expect(repo.findProducts).not.toHaveBeenCalled()
  })

  it('rejects unknown and non-filterable public attribute filters for scoped category', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({
      id: categoryId,
      isActive: true,
      attributeDefinitions: [
        createCategorySpec({ categoryId, attributeKey: 'color', isActive: true, isFilterable: true }),
        createCategorySpec({ id: '66666666-6666-4666-8666-666666666667', categoryId, attributeKey: 'internal_code', isActive: true, isFilterable: false }),
      ],
    })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listPublicProducts({
      categoryId,
      attributes: { Material: 'Cotton' },
    })).rejects.toMatchObject({
      status: 400,
      code: 'PRODUCT_SPEC_FILTER_INVALID',
      details: { attributeKey: 'material' },
    })

    await expect(service.listPublicProducts({
      categoryId,
      attributes: { 'Internal Code': 'A1' },
    })).rejects.toMatchObject({
      status: 400,
      code: 'PRODUCT_SPEC_FILTER_INVALID',
      details: { attributeKey: 'internal_code' },
    })

    expect(repo.findProducts).not.toHaveBeenCalled()
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

  it('product detail returns variant option matrix with stock and hides private media URLs', async () => {
    const repo = createRepoMock()
    const product = createProduct({ status: 'ACTIVE' })
    product.images = [
      { id: 'image-private', url: 'https://storage.example/product.jpg?X-Amz-Signature=secret', isPrimary: true, sortOrder: 0 },
      { id: 'image-public', url: '/uploads/product_image/product-1/public.jpg', isPrimary: false, sortOrder: 1 },
    ]
    product.video = { id: 'video-private', url: 'https://storage.example/video.mp4?token=secret', contentType: 'video/mp4', fileName: 'demo.mp4' }
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
        colorHex: '#0000ff',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
    }]
    product.variants = [{
      ...createVariant({ productId: product.id }),
      inventory: {
        id: 'inventory-1',
        quantityOnHand: 5,
        quantityReserved: 2,
        reorderLevel: 1,
        updatedAt: new Date(),
      },
      optionValues: [{
        id: 'link-1',
        variantId: '33333333-3333-4333-8333-333333333333',
        optionValueId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        createdAt: new Date(),
        optionValue: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          optionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          value: 'Blue',
          valueTh: null,
          valueEn: null,
          displayType: 'TEXT',
          colorHex: '#0000ff',
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          option: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            productId: product.id,
            name: 'Color',
            nameTh: null,
            nameEn: null,
            sortOrder: 0,
          },
        },
      }],
    }]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    const detail = await service.getPublicProductDetail(product.id)

    expect(detail.images).toEqual([expect.objectContaining({ id: 'image-public' })])
    expect(detail.video).toBeNull()
    expect(detail.options[0]?.values[0]).toMatchObject({ value: 'Blue', colorHex: '#0000ff' })
    expect(detail.variants[0]?.inventory).toMatchObject({ quantityOnHand: 5, quantityReserved: 2 })
    expect(detail.variants[0]?.optionValues[0]?.optionValue).toMatchObject({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      value: 'Blue',
      option: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Color' },
    })
  })

  it('lists related products from the active public source product with a small validated limit', async () => {
    const repo = createRepoMock()
    const source = createProduct({
      status: 'ACTIVE',
      categoryId: '55555555-5555-4555-8555-555555555555',
      brandId: '44444444-4444-4444-8444-444444444444',
    })
    const related = createProduct({
      id: '99999999-9999-4999-8999-999999999999',
      status: 'ACTIVE',
      categoryId: source.categoryId,
    })
    vi.mocked(repo.findProductById).mockResolvedValue(source)
    vi.mocked(repo.findRelatedProducts).mockResolvedValue([related])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.listRelatedProducts(source.id, { limit: 6, locale: 'en' })).resolves.toEqual([{
      ...related,
      rating: 0,
      ratingSummary: { averageRating: 0, totalReviewCount: 0 },
      soldCount: 0,
    }])

    expect(repo.findRelatedProducts).toHaveBeenCalledWith(source, 6)
    await expect(service.listRelatedProducts(source.id, { limit: 13 })).rejects.toMatchObject({
      code: 'CATALOG_QUERY_INVALID',
    })
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

  it('validates and normalizes product attributes against active category specs', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const specs = [
      createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', valueType: 'TEXT', isRequired: true, isFilterable: true }),
      createCategorySpec({ id: '66666666-6666-4666-8666-666666666667', categoryId, attributeKey: 'weight', displayName: 'Weight', valueType: 'NUMBER', isRequired: true, isFilterable: true }),
      createCategorySpec({ id: '66666666-6666-4666-8666-666666666668', categoryId, attributeKey: 'waterproof', displayName: 'Waterproof', valueType: 'BOOLEAN', isRequired: false, isFilterable: true }),
      createCategorySpec({ id: '66666666-6666-4666-8666-666666666669', categoryId, attributeKey: 'color', displayName: 'Color', valueType: 'SELECT', isRequired: false, isFilterable: true }),
      createCategorySpec({ id: '66666666-6666-4666-8666-666666666670', categoryId, attributeKey: 'features', displayName: 'Features', valueType: 'MULTI_SELECT', isRequired: false, isFilterable: false }),
    ]
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: specs })
    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValue(specs)
    const service = new CatalogService(createAppContext(), repo)

    const normalized = await service.validateProductAttributesForCategory(categoryId, [
      { attributeKey: ' Material ', displayName: 'Seller Material', value: ' cotton ' },
      { attributeKey: 'Weight', displayName: 'Seller Weight', value: '001.50' },
      { attributeKey: 'Waterproof', displayName: 'Seller Waterproof', value: 'YES' },
      { attributeKey: 'Color', displayName: 'Seller Color', value: ' Red ' },
      { attributeKey: 'Features', displayName: 'Seller Features', value: ' GPS, , Bluetooth ' },
      { attributeKey: 'Care Instructions', displayName: 'Care Instructions', value: ' Hand wash ' },
    ])

    expect(normalized).toEqual([
      expect.objectContaining({ attributeKey: 'material', displayName: 'Material', value: 'cotton', isFilterable: true }),
      expect.objectContaining({ attributeKey: 'weight', displayName: 'Weight', value: '1.5', isFilterable: true }),
      expect.objectContaining({ attributeKey: 'waterproof', displayName: 'Waterproof', value: 'true', isFilterable: true }),
      expect.objectContaining({ attributeKey: 'color', displayName: 'Color', value: 'Red', isFilterable: true }),
      expect.objectContaining({ attributeKey: 'features', displayName: 'Features', value: 'GPS, Bluetooth', isFilterable: false }),
      expect.objectContaining({ attributeKey: 'care_instructions', displayName: 'Care Instructions', value: 'Hand wash', isFilterable: false }),
    ])
    expect(repo.findCategorySpecsByAttributeKeys).toHaveBeenCalledWith([
      'material',
      'weight',
      'waterproof',
      'color',
      'features',
      'care_instructions',
    ])
  })

  it('rejects missing required and duplicate submitted product spec keys', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const requiredSpec = createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', valueType: 'TEXT', isRequired: true })
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [requiredSpec] })
    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValue([requiredSpec])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.validateProductAttributesForCategory(categoryId, []))
      .rejects.toMatchObject({ code: 'PRODUCT_SPEC_REQUIRED_MISSING' })

    await expect(service.validateProductAttributesForCategory(categoryId, [
      { attributeKey: 'Material', displayName: 'Material', value: 'Cotton' },
      { attributeKey: ' material ', displayName: 'Material again', value: 'Wool' },
    ])).rejects.toMatchObject({ code: 'PRODUCT_SPEC_ATTRIBUTE_DUPLICATE' })
  })

  it('rejects invalid product spec values for each supported type', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const service = new CatalogService(createAppContext(), repo)

    for (const spec of [
      createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', valueType: 'TEXT' }),
      createCategorySpec({ categoryId, attributeKey: 'weight', displayName: 'Weight', valueType: 'NUMBER' }),
      createCategorySpec({ categoryId, attributeKey: 'waterproof', displayName: 'Waterproof', valueType: 'BOOLEAN' }),
      createCategorySpec({ categoryId, attributeKey: 'color', displayName: 'Color', valueType: 'SELECT' }),
      createCategorySpec({ categoryId, attributeKey: 'features', displayName: 'Features', valueType: 'MULTI_SELECT' }),
    ]) {
      vi.mocked(repo.findCategoryWithSpecs).mockResolvedValueOnce({ id: categoryId, isActive: true, attributeDefinitions: [spec] })
      vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValueOnce([spec])
      const value = spec.valueType === 'NUMBER'
        ? 'not-a-number'
        : spec.valueType === 'BOOLEAN'
          ? 'maybe'
          : ' '

      await expect(service.validateProductAttributesForCategory(categoryId, [
        { attributeKey: spec.attributeKey, displayName: spec.displayName, value },
      ])).rejects.toMatchObject({ code: 'PRODUCT_SPEC_TYPE_INVALID' })
    }
  })

  it('rejects product attributes targeting inactive or wrong-category specs', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const inactiveSpec = createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', valueType: 'TEXT', isActive: false })
    const wrongCategorySpec = createCategorySpec({
      id: '77777777-7777-4777-8777-777777777777',
      categoryId: '77777777-7777-4777-8777-777777777778',
      attributeKey: 'capacity',
      displayName: 'Capacity',
      valueType: 'NUMBER',
    })
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [] })
    const service = new CatalogService(createAppContext(), repo)

    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValueOnce([inactiveSpec])
    await expect(service.validateProductAttributesForCategory(categoryId, [
      { attributeKey: 'Material', displayName: 'Material', value: 'Cotton' },
    ])).rejects.toMatchObject({ code: 'PRODUCT_SPEC_ATTRIBUTE_INVALID' })

    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValueOnce([wrongCategorySpec])
    await expect(service.validateProductAttributesForCategory(categoryId, [
      { attributeKey: 'Capacity', displayName: 'Capacity', value: '128' },
    ])).rejects.toMatchObject({ code: 'PRODUCT_SPEC_ATTRIBUTE_INVALID' })
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

  it('enforces required active category specs during seller create', async () => {
    const repo = createRepoMock()
    const shopId = '11111111-1111-4111-8111-111111111111'
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const requiredSpec = createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', isRequired: true })
    vi.mocked(repo.findShopById).mockResolvedValue({ id: shopId, ownerId: 'seller-1', status: 'ACTIVE' })
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [requiredSpec] })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.createProduct(createActor(), {
      shopId,
      categoryId,
      title: 'Phone',
    })).rejects.toMatchObject({ code: 'PRODUCT_SPEC_REQUIRED_MISSING' })
    expect(repo.createProduct).not.toHaveBeenCalled()
  })

  it('derives category-defined attribute metadata during seller create and preserves free-form attributes', async () => {
    const repo = createRepoMock()
    const shopId = '11111111-1111-4111-8111-111111111111'
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const spec = createCategorySpec({
      categoryId,
      attributeKey: 'weight',
      displayName: 'Package Weight',
      valueType: 'NUMBER',
      isRequired: true,
      isFilterable: true,
    })
    vi.mocked(repo.findShopById).mockResolvedValue({ id: shopId, ownerId: 'seller-1', status: 'ACTIVE' })
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [spec] })
    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValue([spec])
    vi.mocked(repo.createProduct).mockResolvedValue(createProduct({ shopId, categoryId, ownerId: 'seller-1' }))
    const service = new CatalogService(createAppContext(), repo)

    await service.createProduct(createActor(), {
      shopId,
      categoryId,
      title: 'Phone',
      attributes: [
        { attributeKey: 'Weight', displayName: 'Seller Weight', value: ' 001.50 ', isFilterable: false },
        { attributeKey: 'Care Instructions', displayName: 'Care Instructions', value: ' Keep dry ' },
      ],
    })

    expect(repo.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      attributes: [
        expect.objectContaining({ attributeKey: 'weight', displayName: 'Package Weight', value: '1.5', isFilterable: true }),
        expect.objectContaining({ attributeKey: 'care_instructions', displayName: 'Care Instructions', value: 'Keep dry', isFilterable: false }),
      ],
    }))
  })

  it('validates seller update attributes against the effective category and rejects invalid values', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const product = createProduct({ ownerId: 'seller-1', categoryId })
    const spec = createCategorySpec({ categoryId, attributeKey: 'weight', displayName: 'Weight', valueType: 'NUMBER', isRequired: true })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [spec] })
    vi.mocked(repo.findCategorySpecsByAttributeKeys).mockResolvedValue([spec])
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.updateProduct(createActor(), product.id, {
      attributes: [{ attributeKey: 'Weight', displayName: 'Weight', value: 'heavy' }],
    })).rejects.toMatchObject({ code: 'PRODUCT_SPEC_TYPE_INVALID' })
    expect(repo.updateProduct).not.toHaveBeenCalled()
  })

  it('preserves historical inactive attributes when seller update does not replace attributes', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1', categoryId: '55555555-5555-4555-8555-555555555555' })
    product.attributes = [{
      id: 'attribute-1',
      productId: product.id,
      attributeKey: 'archived_spec',
      displayName: 'Archived Spec',
      displayNameTh: null,
      displayNameEn: null,
      value: 'Legacy',
      valueTh: null,
      valueEn: null,
      sortOrder: 0,
      isFilterable: false,
      createdAt: new Date('2026-05-12T00:00:00.000Z'),
      updatedAt: new Date('2026-05-12T00:00:00.000Z'),
    }]
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.updateProduct).mockResolvedValue({ ...product, title: 'Updated' })
    const service = new CatalogService(createAppContext(), repo)

    await service.updateProduct(createActor(), product.id, { title: ' Updated ' })

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, expect.not.objectContaining({
      attributes: expect.anything(),
    }))
  })

  it('publish rejects missing active required specs with stable spec error code', async () => {
    const repo = createRepoMock()
    const categoryId = '55555555-5555-4555-8555-555555555555'
    const product = createProduct({
      ownerId: 'seller-1',
      categoryId,
      images: [{ id: 'img-1', isPrimary: true }],
    })
    product.variants = [createVariant({ productId: product.id, price: BigInt(1299) })]
    const requiredSpec = createCategorySpec({ categoryId, attributeKey: 'material', displayName: 'Material', isRequired: true })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    vi.mocked(repo.findCategoryWithSpecs).mockResolvedValue({ id: categoryId, isActive: true, attributeDefinitions: [requiredSpec] })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.publishProduct(createActor(), product.id))
      .rejects.toMatchObject({ code: 'PRODUCT_SPEC_REQUIRED_MISSING' })
    expect(repo.updateProduct).not.toHaveBeenCalled()
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

    await expect(service.publishProduct(createActor(), product.id)).rejects.toMatchObject({
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

    await service.publishProduct(createActor(), product.id)

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, { status: 'ACTIVE' })
  })

  it('publishes ready draft products without admin approval', async () => {
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

    await service.publishProduct(createActor(), product.id)

    expect(repo.updateProduct).toHaveBeenCalledWith(product.id, { status: 'ACTIVE' })
    expect(repo.createModerationAction).not.toHaveBeenCalled()
  })

  it('does not let sellers republish an admin-suspended product', async () => {
    const repo = createRepoMock()
    const product = createProduct({ ownerId: 'seller-1', status: 'SUSPENDED' })
    vi.mocked(repo.findProductById).mockResolvedValue(product)
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.publishProduct(createActor(), product.id)).rejects.toMatchObject({
      code: 'PRODUCT_PUBLISH_STATUS_INVALID',
    })
    expect(repo.updateProduct).not.toHaveBeenCalled()
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

    await expect(service.publishProduct(createActor(), product.id)).rejects.toMatchObject({
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
    vi.mocked(repo.updateProduct).mockResolvedValue({ ...product, status: 'ACTIVE' })
    const service = new CatalogService(createAppContext(), repo)

    await expect(service.publishProduct(createActor(), product.id)).resolves.toMatchObject({ status: 'ACTIVE' })
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
      currency: 'THB',
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

  it('admin moderation suspends active products and restores suspended products', async () => {
    const repo = createRepoMock()
    const admin = createActor({ id: 'admin-1', role: 'ADMIN' })
    const service = new CatalogService(createAppContext(), repo)

    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ status: 'ACTIVE' }))
    vi.mocked(repo.updateProduct).mockResolvedValueOnce(createProduct({ status: 'SUSPENDED' }))
    vi.mocked(repo.createModerationAction).mockResolvedValue({} as any)
    await service.suspendProduct(admin, '22222222-2222-4222-8222-222222222222', { reason: 'Policy' })

    vi.mocked(repo.findProductById).mockResolvedValueOnce(createProduct({ status: 'SUSPENDED' }))
    vi.mocked(repo.updateProduct).mockResolvedValueOnce(createProduct({ status: 'ACTIVE' }))
    await service.restoreProduct(admin, '22222222-2222-4222-8222-222222222222')

    expect(repo.updateProduct).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', { status: 'ACTIVE' })
    expect(repo.updateProduct).toHaveBeenCalledWith('22222222-2222-4222-8222-222222222222', { status: 'SUSPENDED' })
  })
})
