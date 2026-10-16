import { moneyInteger } from '#server/lib/money.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import type { PromotionService } from '#server/modules/promotion/promotion.service.ts'
import type { RecommendationService } from '#server/modules/recommendation/recommendation.service.ts'
import type { TrackingService } from '#server/modules/tracking'
import { publicAssetUrl } from '#server/lib/public-assets.ts'
import { DiscoveryServiceError } from './discovery.errors.ts'
import type { DiscoveryBannerRecord, DiscoveryFeaturedShopRecord, DiscoveryFlashSaleRecord, IDiscoveryRepository } from './discovery.repository.ts'

const DEFAULT_HOME_LIMIT = 12
const MAX_HOME_LIMIT = 24
const BANNER_LIMIT = 8
const SHOP_LIMIT = 8

export interface DiscoveryHomeInput {
  limit?: number
  locale?: string
  sessionId?: string
  userId?: string
}

export interface DiscoveryHomeResponse {
  sections: {
    banners?: ReturnType<DiscoveryService['toBanner']>[]
    popups?: ReturnType<DiscoveryService['toBanner']>[]
    categories?: Awaited<ReturnType<CatalogService['listCategories']>>
    flashSale?: Awaited<ReturnType<DiscoveryService['toFlashSale']>>
    recommendedProducts?: Awaited<ReturnType<RecommendationService['getTrending']>>['items']
    newArrivals?: Awaited<ReturnType<RecommendationService['getHomeFeed']>>['sections']['newest']
    featuredShops?: ReturnType<DiscoveryService['toFeaturedShop']>[]
    recentlyViewed?: Awaited<ReturnType<TrackingService['getRecentlyViewedProducts']>>
    promotions?: Awaited<ReturnType<PromotionService['listPublicCoupons']>>['data']
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
    private trackingService: TrackingService,
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
      recentlyViewed,
    ] = await Promise.all([
      this.repo.findHomeBanners(BANNER_LIMIT, now),
      this.catalogService.listCategories(locale),
      this.repo.findActiveFlashSale(limit, now),
      this.recommendationService.getTrending({ limit, locale }),
      this.recommendationService.getHomeFeed({ limit, locale }),
      this.repo.findFeaturedShops(SHOP_LIMIT),
      this.promotionService.listPublicCoupons(locale, { page: 1, limit: 8 }).then(page => page.data),
      this.trackingService.getRecentlyViewedProducts({
        userId: input.userId,
        sessionId: input.sessionId,
        limit,
      }),
    ])

    const normalizedFlashSale = flashSale && flashSale.items.length > 0
      ? await this.toFlashSale(flashSale)
      : null
    const regularBanners = banners.filter(banner => banner.placement !== 'HOME_POPUP')
    const popups = banners.filter(banner => banner.placement === 'HOME_POPUP')

    return {
      sections: {
        ...(regularBanners.length > 0 ? { banners: regularBanners.map((banner) => this.toBanner(banner)) } : {}),
        ...(popups.length > 0 ? { popups: popups.map((banner) => this.toBanner(banner)) } : {}),
        categories,
        ...(normalizedFlashSale ? { flashSale: normalizedFlashSale } : {}),
        recommendedProducts: recommended.items,
        newArrivals: homeFeed.sections.newest,
        ...(featuredShops.length > 0 ? { featuredShops: featuredShops.map((shop) => this.toFeaturedShop(shop)) } : {}),
        recentlyViewed,
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
    const metadata = banner.metadata && typeof banner.metadata === 'object' && !Array.isArray(banner.metadata) ? banner.metadata : {}
    const localized = (key: string) => typeof metadata[key] === 'string' ? metadata[key] : null
    const frequency = metadata.popupFrequency
    const popupFrequency: 'SESSION' | 'DAILY' | 'ALWAYS' = frequency === 'DAILY' || frequency === 'ALWAYS' ? frequency : 'SESSION'
    return {
      id: banner.id,
      placement: banner.placement,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: publicAssetUrl(banner.imageUrl),
      mobileImageUrl: publicAssetUrl(banner.mobileImageUrl),
      targetUrl: banner.targetUrl,
      sortOrder: banner.sortOrder,
      startsAt: banner.startsAt?.toISOString() ?? null,
      endsAt: banner.endsAt?.toISOString() ?? null,
      popupFrequency,
      titleTh: localized('titleTh'),
      titleEn: localized('titleEn'),
      bodyTh: localized('bodyTh'),
      bodyEn: localized('bodyEn'),
    }
  }

  private async toFlashSale(flashSale: DiscoveryFlashSaleRecord) {
    const metrics = await this.catalogService.getPublicProductMetrics(flashSale.items.map((item) => item.product.id))
    const metricsByProductId = new Map(metrics.map((metric) => [metric.productId, metric]))
    return {
      id: flashSale.id,
      title: flashSale.title,
      description: flashSale.description,
      startsAt: flashSale.startsAt,
      endsAt: flashSale.endsAt,
      items: flashSale.items.map((item) => {
        const activeReservationCount = item.reservations.reduce((total, reservation) => total + reservation.quantity, 0)
        const campaignAvailable = Math.max(0, item.stockLimit - item.soldCount - activeReservationCount)
        const inventoryAvailable = item.variant.inventory
          ? Math.max(0, item.variant.inventory.quantityOnHand - item.variant.inventory.quantityReserved)
          : 0
        const metric = metricsByProductId.get(item.product.id)
        return {
          id: item.id,
          salePrice: moneyInteger(item.salePrice),
          originalPrice: moneyInteger(item.originalPrice),
          stockLimit: item.stockLimit,
          soldCount: item.soldCount,
          availableStock: Math.min(campaignAvailable, inventoryAvailable),
          rating: metric?.rating ?? 0,
          perUserLimit: item.perUserLimit,
          product: {
            id: item.product.id,
            title: item.product.title,
            slug: item.product.slug,
            coverImage: publicAssetUrl(item.product.images[0]?.url),
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
        }
      }),
    }
  }

  private toFeaturedShop(shop: DiscoveryFeaturedShopRecord) {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoUrl: publicAssetUrl(shop.logoUrl),
      coverUrl: publicAssetUrl(shop.coverUrl),
      ratingAverage: Number(shop.ratingAverage),
      ratingCount: shop.ratingCount,
      followerCount: shop.followerCount,
      productCount: shop.productCount,
    }
  }
}
