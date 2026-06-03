import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import { DiscoveryServiceError } from './discovery.errors.ts'
import type { DiscoveryBannerRecord, DiscoveryFeaturedShopRecord, DiscoveryFlashSaleRecord, IDiscoveryRepository } from './discovery.repository.ts'

const DEFAULT_HOME_LIMIT = 12
const MAX_HOME_LIMIT = 24
const BANNER_LIMIT = 8
const SHOP_LIMIT = 8

export interface DiscoveryHomeInput {
  limit?: number
  locale?: string
}

export interface DiscoveryHomeResponse {
  sections: {
    banners?: ReturnType<DiscoveryService['toBanner']>[]
    categories?: Awaited<ReturnType<CatalogService['listCategories']>>
    flashSale?: ReturnType<DiscoveryService['toFlashSale']>
    recommendedProducts?: Awaited<ReturnType<RecommendationService['getTrending']>>['items']
    newArrivals?: Awaited<ReturnType<RecommendationService['getHomeFeed']>>['sections']['newest']
    featuredShops?: ReturnType<DiscoveryService['toFeaturedShop']>[]
    recentlyViewed?: []
    promotions?: Awaited<ReturnType<PromotionService['listPublicCoupons']>>
  }
  meta: {
    limit: number
    generatedAt: string
  }
}

export class DiscoveryService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IDiscoveryRepository,
    private catalogService: CatalogService,
    private recommendationService: RecommendationService,
    private promotionService: PromotionService,
  ) {
    this.logger = appContext.logger
  }

  async getHome(input: DiscoveryHomeInput): Promise<DiscoveryHomeResponse> {
    const limit = this.normalizeLimit(input.limit)
    const locale = input.locale
    const now = new Date()
    this.logger.debug('DiscoveryService.getHome', { limit, locale })

    const [
      banners,
      categories,
      flashSale,
      recommended,
      homeFeed,
      featuredShops,
      promotions,
    ] = await Promise.all([
      this.repo.findHomeBanners(BANNER_LIMIT, now),
      this.catalogService.listCategories(locale),
      this.repo.findActiveFlashSale(limit, now),
      this.recommendationService.getTrending({ limit, locale }),
      this.recommendationService.getHomeFeed({ limit, locale }),
      this.repo.findFeaturedShops(SHOP_LIMIT),
      this.promotionService.listPublicCoupons(locale),
    ])

    return {
      sections: {
        ...(banners.length > 0 ? { banners: banners.map((banner) => this.toBanner(banner)) } : {}),
        categories,
        ...(flashSale && flashSale.items.length > 0 ? { flashSale: this.toFlashSale(flashSale) } : {}),
        recommendedProducts: recommended.items,
        newArrivals: homeFeed.sections.newest,
        ...(featuredShops.length > 0 ? { featuredShops: featuredShops.map((shop) => this.toFeaturedShop(shop)) } : {}),
        recentlyViewed: [],
        ...(promotions.length > 0 ? { promotions } : {}),
      },
      meta: {
        limit,
        generatedAt: now.toISOString(),
      },
    }
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_HOME_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_HOME_LIMIT) {
      throw new DiscoveryServiceError(`Limit must be between 1 and ${MAX_HOME_LIMIT}`, 400, 'DISCOVERY_QUERY_INVALID')
    }
    return value
  }

  private toBanner(banner: DiscoveryBannerRecord) {
    return {
      id: banner.id,
      placement: banner.placement,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl,
      targetUrl: banner.targetUrl,
      sortOrder: banner.sortOrder,
    }
  }

  private toFlashSale(flashSale: DiscoveryFlashSaleRecord) {
    return {
      id: flashSale.id,
      title: flashSale.title,
      description: flashSale.description,
      startsAt: flashSale.startsAt,
      endsAt: flashSale.endsAt,
      items: flashSale.items.map((item) => ({
        id: item.id,
        salePrice: Number(item.salePrice),
        originalPrice: Number(item.originalPrice),
        stockLimit: item.stockLimit,
        soldCount: item.soldCount,
        perUserLimit: item.perUserLimit,
        product: {
          id: item.product.id,
          title: item.product.title,
          slug: item.product.slug,
          coverImage: item.product.images[0]?.url ?? null,
          shop: {
            id: item.product.shop.id,
            name: item.product.shop.name,
            slug: item.product.shop.slug,
          },
        },
        variant: {
          id: item.variant.id,
          sku: item.variant.sku,
          title: item.variant.title,
          currency: item.variant.currency,
        },
      })),
    }
  }

  private toFeaturedShop(shop: DiscoveryFeaturedShopRecord) {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoUrl: shop.logoUrl,
      coverUrl: shop.coverUrl,
      ratingAverage: Number(shop.ratingAverage),
      ratingCount: shop.ratingCount,
      followerCount: shop.followerCount,
      productCount: shop.productCount,
    }
  }
}
