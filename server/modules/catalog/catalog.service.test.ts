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
    findShopById: vi.fn(),
    findFirstShopByOwnerId: vi.fn(),
    findProductById: vi.fn(),
    findProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createVariant: vi.fn(),
    updateVariant: vi.fn(),
    deleteVariant: vi.fn(),
    findVariantById: vi.fn(),
    updateVariantInventory: vi.fn(),
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
        }
      : null,
    shop: {
      id: shopId,
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: overrides.ownerId ?? 'seller-1',
      status: 'ACTIVE' as const,
    },
    variants: [],
    sellerProfileId: overrides.sellerProfileId ?? null,
    sellerIdentityHash: overrides.sellerIdentityHash ?? null,
    productFingerprintHash: overrides.productFingerprintHash ?? null,
    duplicateStatus: overrides.duplicateStatus ?? null,
    duplicateOfProductId: overrides.duplicateOfProductId ?? null,
    deletedAt: overrides.deletedAt ?? null,
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
    })
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
      title: 'Island Bag',
      slug: 'island-bag',
      description: 'Summer collection',
      status: 'DRAFT',
    })
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

    expect(repo.createVariant).toHaveBeenCalledWith({
      productId: product.id,
      sku: 'SKU-1',
      title: 'Blue',
      price: 1299,
      currency: 'USD',
    })
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
})
