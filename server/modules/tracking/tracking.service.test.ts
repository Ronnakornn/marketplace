import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import type { ITrackingRepository, TrackingProductRecord } from './tracking.repository.ts'
import { TrackingService } from './tracking.service.ts'
import { MAX_IMPRESSION_BATCH_BYTES, MAX_IMPRESSION_BATCH_EVENTS } from './tracking.limits.ts'

const productId = '11111111-1111-4111-8111-111111111111'
const shopId = '22222222-2222-4222-8222-222222222222'

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

function createAppContext(): AppContext {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): ITrackingRepository {
  return {
    findActiveProduct: vi.fn(),
    findActiveProducts: vi.fn(),
    createProductViewLog: vi.fn(),
    createProductViewLogs: vi.fn(),
    createProductAddToCartLog: vi.fn(),
    createSearchQueryLog: vi.fn(),
    findRecentlyViewedProducts: vi.fn(),
    hasRecentShopEvent: vi.fn(),
    createShopEventLog: vi.fn(),
  }
}

function createViewedProduct(overrides: Partial<TrackingProductRecord> = {}): TrackingProductRecord {
  return {
    id: productId,
    title: 'Cotton Tee',
    slug: 'cotton-tee',
    images: [{ url: '/tee.jpg', altText: null, isPrimary: true, sortOrder: 0 }],
    variants: [{ id: 'variant-1', price: BigInt(1000), currency: 'THB', status: 'ACTIVE' }],
    shop: { id: shopId, name: 'Shop One', slug: 'shop-one', status: 'ACTIVE' },
    ...overrides,
  }
}

let repo: ITrackingRepository
let service: TrackingService
let catalogService: CatalogService

describe('TrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    catalogService = {
      getPublicProductMetrics: vi.fn().mockResolvedValue([{ productId, rating: 4.8, ratingCount: 12, soldCount: 34 }]),
    } as unknown as CatalogService
    service = new TrackingService(createAppContext(), repo, catalogService)
    vi.mocked(repo.findActiveProduct).mockResolvedValue({ id: productId, shopId })
    vi.mocked(repo.findActiveProducts).mockResolvedValue([{ id: productId, shopId }])
  })

  it('rejects malformed product events before writing', async () => {
    await expect(service.trackEvent({}, {
      eventType: 'product_click',
      productId: 'not-a-uuid',
    })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_INVALID' })

    expect(repo.createProductViewLog).not.toHaveBeenCalled()
  })

  it('records product click and impression events as product view logs', async () => {
    await service.trackEvent({ userId: '33333333-3333-4333-8333-333333333333' }, {
      eventType: 'product_click',
      productId,
      shopId,
      sessionId: 'anon-session',
      source: 'search_results',
      position: 2,
    })

    expect(repo.findActiveProduct).toHaveBeenCalledWith(productId)
    expect(repo.createProductViewLog).toHaveBeenCalledWith(expect.objectContaining({
      productId,
      shopId,
      userId: '33333333-3333-4333-8333-333333333333',
      sessionId: 'anon-session',
      source: 'search_results',
      metadata: expect.objectContaining({ eventType: 'product_click', position: 2 }),
    }))
  })

  it('records product_viewed events as product view logs for backward-compatible discovery tracking', async () => {
    await service.trackEvent({}, {
      eventType: 'product_viewed',
      productId,
      sessionId: 'anon-session',
    })

    expect(repo.createProductViewLog).toHaveBeenCalledWith(expect.objectContaining({
      productId,
      shopId,
      sessionId: 'anon-session',
      metadata: expect.objectContaining({ eventType: 'product_viewed' }),
    }))
  })

  it('bulk reads unique products and preserves every impression with independent metadata', async () => {
    const events = [0, 1].map(position => ({
      eventType: 'product_impression' as const,
      productId,
      shopId,
      sessionId: `session-${position}`,
      source: `source-${position}`,
      referrer: `https://example.test/${position}`,
      position,
      timestamp: `2026-10-19T00:00:0${position}.000Z`,
      filters: { brand: 'ผ้าฝ้าย' },
    }))
    await expect(service.trackProductImpressions({ userId: 'buyer' }, { events })).resolves.toEqual({ ok: true })
    expect(repo.findActiveProducts).toHaveBeenCalledExactlyOnceWith([productId])
    expect(repo.findActiveProduct).not.toHaveBeenCalled()
    expect(repo.createProductViewLog).not.toHaveBeenCalled()
    expect(repo.createProductViewLogs).toHaveBeenCalledExactlyOnceWith(events.map(event => ({
      productId,
      shopId,
      userId: 'buyer',
      sessionId: event.sessionId,
      source: event.source,
      referrer: event.referrer,
      metadata: { eventType: event.eventType, position: event.position, timestamp: event.timestamp, filters: event.filters },
    })))
  })

  it.each([
    { productId: 'ABCDEF12-ABCD-4ABC-8ABC-ABCDEF123456', shopId: 'fedcba98-fedc-4fed-8fed-fedcba987654' },
    { productId: 'abcdef12-abcd-4abc-8abc-abcdef123456', shopId: 'FEDCBA98-FEDC-4FED-8FED-FEDCBA987654' },
    { productId: 'aBcDeF12-AbCd-4aBc-8AbC-aBcDeF123456', shopId: 'FeDcBa98-fEdC-4fEd-8FeD-fEdCbA987654' },
  ])('matches batch product and shop UUIDs irrespective of case while retaining every event %j', async inputIds => {
    const canonicalProductId = 'abcdef12-abcd-4abc-8abc-abcdef123456'
    const canonicalShopId = 'fedcba98-fedc-4fed-8fed-fedcba987654'
    vi.mocked(repo.findActiveProducts).mockResolvedValue([{ id: canonicalProductId, shopId: canonicalShopId }])
    const events = [
      { productId: canonicalProductId, shopId: canonicalShopId },
      inputIds,
    ].map((ids, position) => ({
      ...ids,
      eventType: 'product_impression' as const,
      sessionId: `session-${position}`,
      source: `source-${position}`,
      referrer: `https://example.test/${position}`,
      position,
      timestamp: `2026-10-19T00:00:0${position}.000Z`,
      categoryId: 'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEF123456',
      filters: { label: `Case-${position}` },
    }))

    await expect(service.trackProductImpressions({ userId: 'buyer' }, { events })).resolves.toEqual({ ok: true })

    expect(repo.findActiveProducts).toHaveBeenCalledExactlyOnceWith([canonicalProductId])
    expect(repo.createProductViewLogs).toHaveBeenCalledExactlyOnceWith(events.map(event => ({
      productId: canonicalProductId,
      shopId: canonicalShopId,
      userId: 'buyer',
      sessionId: event.sessionId,
      source: event.source,
      referrer: event.referrer,
      metadata: {
        eventType: event.eventType,
        categoryId: event.categoryId,
        position: event.position,
        timestamp: event.timestamp,
        filters: event.filters,
      },
    })))
  })

  it('rejects a foreign mixed-case shop UUID without writing a valid mixed-case prefix', async () => {
    vi.mocked(repo.findActiveProducts).mockResolvedValue([{
      id: 'abcdef12-abcd-4abc-8abc-abcdef123456',
      shopId: 'fedcba98-fedc-4fed-8fed-fedcba987654',
    }])

    await expect(service.trackProductImpressions({}, { events: [
      { eventType: 'product_impression', productId: 'ABCDEF12-ABCD-4ABC-8ABC-ABCDEF123456', shopId: 'FEDCBA98-FEDC-4FED-8FED-FEDCBA987654' },
      { eventType: 'product_impression', productId: 'abcdef12-abcd-4abc-8abc-abcdef123456', shopId: 'ABCDEFAB-ABCD-4ABC-8ABC-ABCDEF123456' },
    ] })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_INVALID' })

    expect(repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it.each([
    { productId: 'malformed' },
    { source: 'x'.repeat(65) },
    { sessionId: 'x'.repeat(129) },
    { timestamp: 'invalid' },
    { position: 1.5 },
    { eventType: 'product_click' as never },
  ])('rejects an invalid later impression before any product read or insert %j', async invalid => {
    await expect(service.trackProductImpressions({}, { events: [
      { eventType: 'product_impression', productId },
      { eventType: 'product_impression', productId, ...invalid },
    ] })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_INVALID' })
    expect(repo.findActiveProducts).not.toHaveBeenCalled()
    expect(repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('rejects the entire mixed-shop batch and does not write the valid prefix', async () => {
    await expect(service.trackProductImpressions({}, { events: [
      { eventType: 'product_impression', productId, shopId },
      { eventType: 'product_impression', productId, shopId: '33333333-3333-4333-8333-333333333333' },
    ] })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_INVALID' })
    expect(repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('rejects all impressions when one product is inactive or missing', async () => {
    await expect(service.trackProductImpressions({}, { events: [
      { eventType: 'product_impression', productId },
      { eventType: 'product_impression', productId: '33333333-3333-4333-8333-333333333333' },
    ] })).rejects.toMatchObject({ code: 'TRACKING_PRODUCT_NOT_FOUND' })
    expect(repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('bounds batch count and UTF8 encoded bytes before reading products', async () => {
    for (const events of [[], Array.from({ length: MAX_IMPRESSION_BATCH_EVENTS + 1 }, () => ({ eventType: 'product_impression' as const, productId }))]) {
      await expect(service.trackProductImpressions({}, { events })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_INVALID' })
    }
    const events = [{ eventType: 'product_impression' as const, productId, filters: { label: 'ก'.repeat(MAX_IMPRESSION_BATCH_BYTES / 2) } }]
    expect(JSON.stringify({ events }).length).toBeLessThan(MAX_IMPRESSION_BATCH_BYTES)
    await expect(service.trackProductImpressions({}, { events })).rejects.toMatchObject({ code: 'TRACKING_PAYLOAD_TOO_LARGE' })
    expect(repo.findActiveProducts).not.toHaveBeenCalled()
    expect(repo.createProductViewLogs).not.toHaveBeenCalled()
  })

  it('accepts featured-shop recommendation clicks without requiring a product id', async () => {
    vi.mocked(repo.hasRecentShopEvent).mockResolvedValue(false)

    await service.trackEvent({}, {
      eventType: 'recommendation_clicked',
      shopId,
      sessionId: 'anon-session',
      source: 'marketplace_home_featured_shops',
      position: 0,
    })

    expect(repo.findActiveProduct).not.toHaveBeenCalled()
    expect(repo.createShopEventLog).toHaveBeenCalledWith(expect.objectContaining({
      shopId,
      sessionId: 'anon-session',
      source: 'marketplace_home_featured_shops',
      eventType: 'VIEW',
    }))
  })

  it('records bounded shop events and deduplicates recent shop views', async () => {
    vi.mocked(repo.hasRecentShopEvent).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    await service.trackEvent({}, { eventType: 'shop_viewed', shopId, sessionId: 'anon-session', source: 'storefront' })
    await service.trackEvent({}, { eventType: 'shop_viewed', shopId, sessionId: 'anon-session', source: 'storefront' })
    expect(repo.createShopEventLog).toHaveBeenCalledTimes(1)
    expect(repo.createShopEventLog).toHaveBeenCalledWith({ shopId, sessionId: 'anon-session', source: 'storefront', eventType: 'VIEW' })
  })

  it('records successful follow and chat events without arbitrary metadata', async () => {
    await service.trackEvent({ userId: '33333333-3333-4333-8333-333333333333' }, { eventType: 'shop_followed', shopId, source: 'storefront' })
    await service.trackEvent({ userId: '33333333-3333-4333-8333-333333333333' }, { eventType: 'shop_chat_opened', shopId, source: 'storefront' })
    expect(repo.createShopEventLog).toHaveBeenNthCalledWith(1, expect.objectContaining({ eventType: 'FOLLOW', shopId }))
    expect(repo.createShopEventLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ eventType: 'CHAT_OPEN', shopId }))
  })

  it('records add-to-cart events with trusted product variant and shop context', async () => {
    await service.recordProductAddToCart({
      productId,
      variantId: '33333333-3333-4333-8333-333333333333',
      shopId,
      userId: '44444444-4444-4444-8444-444444444444',
      sessionId: ' anon-session ',
      quantity: 2,
      source: ' product_detail ',
    })

    expect(repo.createProductAddToCartLog).toHaveBeenCalledWith(expect.objectContaining({
      productId,
      variantId: '33333333-3333-4333-8333-333333333333',
      shopId,
      userId: '44444444-4444-4444-8444-444444444444',
      sessionId: 'anon-session',
      quantity: 2,
      source: 'product_detail',
      metadata: { eventType: 'product_added_to_cart' },
    }))
  })

  it('logs submitted search queries with normalized query and result count', async () => {
    await service.trackEvent({}, {
      eventType: 'search_submitted',
      query: '  Cotton   Tee ',
      sessionId: 'anon-session',
      resultCount: 4,
    })

    expect(repo.createSearchQueryLog).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'anon-session',
      query: 'Cotton   Tee',
      normalizedQuery: 'cotton tee',
      resultCount: 4,
      clickedEntityType: 'SEARCH',
    }))
  })

  it('returns recently viewed products for an anonymous session', async () => {
    vi.mocked(repo.findRecentlyViewedProducts).mockResolvedValue([createViewedProduct()])

    const result = await service.getRecentlyViewedProducts({ sessionId: 'anon-session', limit: 6 })

    expect(repo.findRecentlyViewedProducts).toHaveBeenCalledWith({ sessionId: 'anon-session', userId: undefined, limit: 6 })
    expect(result).toEqual([{
      productId,
      title: 'Cotton Tee',
      slug: 'cotton-tee',
      coverImage: '/tee.jpg',
      minPrice: 1000n,
      currency: 'THB',
      rating: 4.8,
      soldCount: 34,
      shop: { id: shopId, name: 'Shop One', slug: 'shop-one' },
    }])
  })
})
