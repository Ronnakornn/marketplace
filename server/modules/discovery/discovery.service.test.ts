import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import type { TrackingService } from '#server/modules/tracking'
import type { IDiscoveryRepository } from './discovery.repository.ts'
import { DiscoveryService } from './discovery.service.ts'

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

function createRepoMock(): IDiscoveryRepository {
  return {
    findHomeBanners: vi.fn(),
    findActiveFlashSale: vi.fn(),
    findFeaturedShops: vi.fn(),
  }
}

function createServiceMocks() {
  return {
    catalogService: {
      listCategories: vi.fn(),
    } as unknown as CatalogService,
    recommendationService: {
      getTrending: vi.fn(),
      getHomeFeed: vi.fn(),
    } as unknown as RecommendationService,
    promotionService: {
      listPublicCoupons: vi.fn(),
    } as unknown as PromotionService,
    trackingService: {
      getRecentlyViewedProducts: vi.fn(),
    } as unknown as TrackingService,
  }
}

describe('DiscoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('composes homepage sections while omitting unavailable optional data', async () => {
    const repo = createRepoMock()
    const { catalogService, recommendationService, promotionService, trackingService } = createServiceMocks()
    vi.mocked(repo.findHomeBanners).mockResolvedValue([])
    vi.mocked(repo.findActiveFlashSale).mockResolvedValue({
      id: 'flash-1',
      title: 'Flash Sale',
      description: null,
      startsAt: new Date('2026-06-03T01:00:00.000Z'),
      endsAt: new Date('2026-06-03T03:00:00.000Z'),
      items: [],
    })
    vi.mocked(repo.findFeaturedShops).mockResolvedValue([])
    vi.mocked(catalogService.listCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Fashion', slug: 'fashion', sortOrder: 1, isActive: true },
    ])
    vi.mocked(recommendationService.getTrending).mockResolvedValue({
      items: [{ productId: 'p1', title: 'Tee', minPrice: 1000 }],
      pagination: { page: 1, limit: 4, hasNextPage: false },
    })
    vi.mocked(recommendationService.getHomeFeed).mockResolvedValue({
      sections: {
        trending: [],
        newest: [{ productId: 'p2', title: 'New Tee', minPrice: 1200 }],
        recommendedCategories: [],
      },
      pagination: { page: 1, limit: 4 },
    })
    vi.mocked(promotionService.listPublicCoupons).mockResolvedValue([])
    vi.mocked(trackingService.getRecentlyViewedProducts).mockResolvedValue([])

    const service = new DiscoveryService(createAppContext(), repo, catalogService, recommendationService, promotionService, trackingService)
    const result = await service.getHome({ limit: 4, locale: 'en' })

    expect(repo.findHomeBanners).toHaveBeenCalledWith(8, expect.any(Date))
    expect(repo.findActiveFlashSale).toHaveBeenCalledWith(4, expect.any(Date))
    expect(result.sections).toEqual({
      categories: [{ id: 'cat-1', name: 'Fashion', slug: 'fashion', sortOrder: 1, isActive: true }],
      recommendedProducts: [{ productId: 'p1', title: 'Tee', minPrice: 1000 }],
      newArrivals: [{ productId: 'p2', title: 'New Tee', minPrice: 1200 }],
      recentlyViewed: [],
    })
    expect(result.meta).toMatchObject({ limit: 4 })
  })

  it('includes real optional merchandising sections when records exist', async () => {
    const repo = createRepoMock()
    const { catalogService, recommendationService, promotionService, trackingService } = createServiceMocks()
    vi.mocked(repo.findHomeBanners).mockResolvedValue([
      {
        id: 'banner-1',
        placement: 'HOME_HERO',
        title: 'Campaign',
        subtitle: null,
        imageUrl: '/banner.jpg',
        mobileImageUrl: null,
        targetUrl: '/search?q=campaign',
        sortOrder: 1,
      },
    ])
    vi.mocked(repo.findActiveFlashSale).mockResolvedValue({
      id: 'flash-1',
      title: 'Flash Sale',
      description: null,
      startsAt: new Date('2026-06-03T01:00:00.000Z'),
      endsAt: new Date('2026-06-03T03:00:00.000Z'),
      items: [{
        id: 'item-1',
        salePrice: BigInt(900),
        originalPrice: BigInt(1200),
        stockLimit: 10,
        soldCount: 2,
        perUserLimit: 1,
        product: {
          id: 'p1',
          title: 'Tee',
          slug: 'tee',
          images: [{ url: '/tee.jpg', altText: null, isPrimary: true, sortOrder: 0 }],
          shop: { id: 'shop-1', name: 'Shop', slug: 'shop', status: 'ACTIVE' },
        },
        variant: { id: 'v1', sku: 'TEE-1', title: 'Default', currency: 'THB', status: 'ACTIVE' },
      }],
    })
    vi.mocked(repo.findFeaturedShops).mockResolvedValue([{
      id: 'shop-1',
      name: 'Shop',
      slug: 'shop',
      logoUrl: null,
      coverUrl: null,
      ratingAverage: 4.5 as any,
      ratingCount: 10,
      followerCount: 20,
      productCount: 5,
    }])
    vi.mocked(catalogService.listCategories).mockResolvedValue([])
    vi.mocked(recommendationService.getTrending).mockResolvedValue({ items: [], pagination: { page: 1, limit: 12, hasNextPage: false } })
    vi.mocked(recommendationService.getHomeFeed).mockResolvedValue({ sections: { trending: [], newest: [], recommendedCategories: [] }, pagination: { page: 1, limit: 12 } })
    vi.mocked(promotionService.listPublicCoupons).mockResolvedValue([{ id: 'coupon-1', code: 'SAVE', title: 'SAVE', description: null } as any])
    vi.mocked(trackingService.getRecentlyViewedProducts).mockResolvedValue([])

    const service = new DiscoveryService(createAppContext(), repo, catalogService, recommendationService, promotionService, trackingService)
    const result = await service.getHome({})

    expect(result.sections.banners).toHaveLength(1)
    expect(result.sections.flashSale?.items[0]).toMatchObject({ salePrice: 900, originalPrice: 1200 })
    expect(result.sections.featuredShops?.[0]).toMatchObject({ id: 'shop-1', ratingAverage: 4.5 })
    expect(result.sections.promotions).toHaveLength(1)
  })
})
