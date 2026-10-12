import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import { PrismaProductAnalyticsRepository } from './product-analytics.repository.ts'
import { decodeRankingPage } from './product-analytics-ranking.sql.ts'

const context: AppContext = {
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  config: { environment: 'test' },
}

describe('Analytics ranking pages', () => {
  it('skips database reads for an empty authorized scope', async () => {
    const queryRaw = vi.fn()
    const repo = new PrismaProductAnalyticsRepository(context, { $queryRaw: queryRaw } as unknown as PrismaClient)
    const range = { from: new Date('2026-10-03T17:00:00Z'), to: new Date('2026-10-04T16:59:59.999Z') }
    expect(await repo.findProductRankingPage([], range, { page: 1, limit: 20, sort: 'revenue' })).toEqual({ items: [], total: 0 })
    expect(await repo.findVariantRankingPage([], range, { page: 1, limit: 20, sort: 'sku' })).toEqual({ items: [], total: 0 })
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('decodes exact numeric money beyond signed int64 without changing count types', () => {
    expect(decodeRankingPage([{ id: 'product-a', views: '10', addToCart: '2', addToCartQuantity: '3', orders: '1', unitsSold: '2', revenue: '18446744073709551615', conversionRate: 0.1, currency: 'THB', total: '501' }])).toEqual({
      items: [{ id: 'product-a', views: 10, addToCart: 2, addToCartQuantity: 3, orders: 1, unitsSold: 2, revenue: 18446744073709551615n, conversionRate: 0.1, currency: 'THB' }], total: 501,
    })
  })

  it('preserves total for an empty page and rejects fractional monetary or unsafe count output', () => {
    const row = { id: null, views: null, addToCart: null, addToCartQuantity: null, orders: null, unitsSold: null, revenue: null, conversionRate: null, currency: null, total: '501' }
    expect(decodeRankingPage([row])).toEqual({ items: [], total: 501 })
    expect(() => decodeRankingPage([{ ...row, id: 'product-a', views: '0', addToCart: '0', addToCartQuantity: '0', orders: '0', unitsSold: '0', revenue: '1.5', conversionRate: 0 }])).toThrow('canonical integer')
    expect(() => decodeRankingPage([{ ...row, total: '9007199254740992' }])).toThrow('safe integer')
  })
})
