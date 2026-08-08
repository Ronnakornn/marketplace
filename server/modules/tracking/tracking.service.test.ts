import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { ITrackingRepository, TrackingProductRecord } from './tracking.repository.ts'
import { TrackingService } from './tracking.service.ts'

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
    createProductViewLog: vi.fn(),
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

describe('TrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepoMock()
    service = new TrackingService(createAppContext(), repo)
    vi.mocked(repo.findActiveProduct).mockResolvedValue({ id: productId, shopId })
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
      minPrice: 1000,
      currency: 'THB',
      shop: { id: shopId, name: 'Shop One', slug: 'shop-one' },
    }])
  })
})
