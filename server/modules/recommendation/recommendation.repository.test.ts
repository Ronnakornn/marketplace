import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaRecommendationRepository } from './recommendation.repository.ts'
import { RecommendationService } from './recommendation.service.ts'

describe('Recommendation paid sold counts', () => {
  it('excludes unpaid and canceled quantities from buyer-facing sold counts', async () => {
    const paidOnly = { order: { paymentStatus: 'SUCCEEDED' }, fulfillmentStatus: { not: 'CANCELED' } }
    const findMany = vi.fn(async (query: unknown) => {
      const selection = JSON.stringify(query)
      const quantities = selection.includes(JSON.stringify(paidOnly)) ? [2] : [2, 5, 4]
      return [{
        id: 'product-a', title: 'A', titleTh: null, titleEn: null,
        shopId: 'shop-a', categoryId: null, status: 'ACTIVE', createdAt: new Date('2026-10-01T00:00:00Z'),
        shop: { id: 'shop-a', name: 'Shop A', status: 'ACTIVE' },
        category: null, images: [], reviews: [],
        variants: [{
          id: 'variant-a', sku: 'A', title: 'Default', status: 'ACTIVE', price: 10000n, currency: 'THB',
          inventory: { quantityOnHand: 10, quantityReserved: 0 },
          orderItems: quantities.map((quantity) => ({ quantity })),
        }],
      }]
    })
    const context: AppContext = {
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      config: { environment: 'test' },
    }
    const db = { product: { findMany } } as unknown as PrismaClient
    const repository = new PrismaRecommendationRepository(context, db)
    const service = new RecommendationService(context, repository)

    const result = await service.getTrending({ limit: 2 })

    expect(result.items[0]?.soldCount).toBe(2)
    expect(findMany.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      select: expect.objectContaining({
        variants: expect.objectContaining({
          select: expect.objectContaining({ orderItems: { where: paidOnly, select: { quantity: true } } }),
        }),
      }),
    }))
  })
})
