import { describe, expect, it, vi } from 'vitest'
import { PrismaCatalogRepository } from './catalog.repository.ts'

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

describe('PrismaCatalogRepository', () => {
  it.each([
    ['price_asc', ['cheap', 'tie-a', 'tie-b', 'expensive']],
    ['price_desc', ['expensive', 'tie-a', 'tie-b', 'cheap']],
  ])('sorts a shop page by minimum active variant price with stable ids (%s)', async (sort, expected) => {
    const product = (id: string, prices: Array<[string, number]>) => ({ id, variants: prices.map(([status, price]) => ({ status, price })) })
    const findMany = vi.fn().mockResolvedValue([
      product('expensive', [['ACTIVE', 900]]), product('tie-b', [['ACTIVE', 500]]),
      product('cheap', [['INACTIVE', 10], ['ACTIVE', 100]]), product('tie-a', [['ACTIVE', 500]]),
      product('inactive-only', [['INACTIVE', 1]]),
    ])
    const repo = new PrismaCatalogRepository(createAppContext() as any, { product: { findMany } } as any)
    const result = await repo.findProducts({ shopId: 'shop-1', status: 'ACTIVE', publicOnly: true, sort, page: 1, limit: 12 })
    expect(result.data.map((item) => item.id)).toEqual(expected)
    expect(result.meta).toMatchObject({ nextCursor: null, totalCount: 4, page: 1, pageSize: 12, hasNextPage: false })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ shopId: 'shop-1', status: 'ACTIVE' }) }))
  })

  it('returns public listing metadata from the same filters used for items', async () => {
    const rows = [{ id: 'p1' }, { id: 'p2' }]
    const findMany = vi.fn().mockResolvedValue(rows)
    const count = vi.fn().mockResolvedValue(3)
    const transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    const repo = new PrismaCatalogRepository(createAppContext() as any, {
      $transaction: transaction,
      product: { findMany, count },
    } as any)

    const result = await repo.findProducts({
      keyword: 'cotton',
      categoryId: 'fashion',
      brandId: '44444444-4444-4444-8444-444444444444',
      minPrice: 100,
      maxPrice: 500,
      sort: 'newest',
      page: 2,
      limit: 1,
      status: 'ACTIVE',
      publicOnly: true,
    })

    expect(result.data).toEqual([{ id: 'p1' }])
    expect(result.items).toEqual([{ id: 'p1' }])
    expect(result.meta).toMatchObject({
      totalCount: 3,
      page: 2,
      pageSize: 1,
      hasNextPage: true,
      nextCursor: 'p1',
      query: {
        q: 'cotton',
        categoryId: 'fashion',
        brandId: '44444444-4444-4444-8444-444444444444',
        minPrice: 100,
        maxPrice: 500,
        sort: 'newest',
      },
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'ACTIVE',
        deletedAt: null,
        shop: { status: 'ACTIVE' },
      }),
      skip: 1,
      take: 2,
    }))
    expect(count).toHaveBeenCalledWith({
      where: findMany.mock.calls[0]![0].where,
    })
  })

  it('returns bounded public category, brand, and price facets from active product filters', async () => {
    const productGroupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { categoryId: 'cat-1', _count: 2 },
      ])
      .mockResolvedValueOnce([
        { brandId: 'brand-1', _count: 1 },
      ])
    const aggregate = vi.fn().mockResolvedValue({ _min: { price: BigInt(1000) }, _max: { price: BigInt(3000) } })
    const categoryFindMany = vi.fn().mockResolvedValue([{ id: 'cat-1', slug: 'fashion', name: 'Fashion' }])
    const brandFindMany = vi.fn().mockResolvedValue([{ id: 'brand-1', slug: 'acme', name: 'Acme' }])
    const variantFindFirst = vi.fn().mockResolvedValue({ currency: 'THB' })
    const transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
    const repo = new PrismaCatalogRepository(createAppContext() as any, {
      $transaction: transaction,
      product: { groupBy: productGroupBy },
      productVariant: { aggregate, findFirst: variantFindFirst },
      category: { findMany: categoryFindMany },
      brand: { findMany: brandFindMany },
    } as any)

    const result = await repo.findProductFacets({
      categoryId: 'fashion',
      brandId: 'brand-1',
      status: 'ACTIVE',
      publicOnly: true,
      limit: 20,
    })

    expect(result).toEqual({
      categories: [{ id: 'cat-1', slug: 'fashion', name: 'Fashion', count: 2, active: true }],
      brands: [{ id: 'brand-1', slug: 'acme', name: 'Acme', count: 1, active: true }],
      price: { min: 1000, max: 3000, currency: 'THB' },
    })
    expect(productGroupBy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      by: ['categoryId'],
      where: expect.objectContaining({
        status: 'ACTIVE',
        deletedAt: null,
        shop: { status: 'ACTIVE' },
        category: { slug: 'fashion', isActive: true },
      }),
      take: 20,
    }))
    expect(productGroupBy).toHaveBeenNthCalledWith(2, expect.objectContaining({
      by: ['brandId'],
      take: 20,
    }))
    expect(aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'ACTIVE',
        product: expect.objectContaining({
          status: 'ACTIVE',
          shop: { status: 'ACTIVE' },
        }),
      }),
      _min: { price: true },
      _max: { price: true },
    })
  })

  it('finds related products with public active filters and excludes the current product', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'related-category' }])
      .mockResolvedValueOnce([{ id: 'related-shop' }])
    const repo = new PrismaCatalogRepository(createAppContext() as any, {
      product: { findMany },
    } as any)
    const product = {
      id: '22222222-2222-4222-8222-222222222222',
      categoryId: '55555555-5555-4555-8555-555555555555',
      shopId: '11111111-1111-4111-8111-111111111111',
      brandId: '44444444-4444-4444-8444-444444444444',
    }

    const result = await repo.findRelatedProducts(product as any, 2)

    expect(result.map((item) => item.id)).toEqual(['related-category', 'related-shop'])
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        id: { notIn: [product.id] },
        status: 'ACTIVE',
        deletedAt: null,
        shop: { status: 'ACTIVE' },
        categoryId: product.categoryId,
      }),
      take: 2,
    }))
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        id: { notIn: [product.id, 'related-category'] },
        status: 'ACTIVE',
        deletedAt: null,
        shop: { status: 'ACTIVE' },
        OR: [
          { shopId: product.shopId },
          { brandId: product.brandId },
        ],
      }),
      take: 1,
    }))
  })
})
