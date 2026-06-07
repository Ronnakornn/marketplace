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
