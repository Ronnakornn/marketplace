import type { FlashSale, FlashSaleItem, FlashSaleReservation, Inventory, MarketingBanner, Prisma, PrismaClient, Product, ProductImage, ProductVariant, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type DiscoveryBannerRecord = Pick<MarketingBanner, 'id' | 'placement' | 'title' | 'subtitle' | 'imageUrl' | 'mobileImageUrl' | 'targetUrl' | 'sortOrder'> & Partial<Pick<MarketingBanner, 'metadata' | 'startsAt' | 'endsAt'>>

export type DiscoveryFeaturedShopRecord = Pick<Shop, 'id' | 'name' | 'slug' | 'logoUrl' | 'coverUrl' | 'ratingAverage' | 'ratingCount' | 'followerCount' | 'productCount'>

export type DiscoveryFlashSaleRecord = Pick<FlashSale, 'id' | 'title' | 'description' | 'startsAt' | 'endsAt'> & {
  items: Array<Pick<FlashSaleItem, 'id' | 'salePrice' | 'originalPrice' | 'stockLimit' | 'soldCount' | 'perUserLimit'> & {
    reservations: Array<Pick<FlashSaleReservation, 'quantity'>>
    product: Pick<Product, 'id' | 'title' | 'slug'> & {
      images: Array<Pick<ProductImage, 'url' | 'altText' | 'isPrimary' | 'sortOrder'>>
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
    }
    variant: Pick<ProductVariant, 'id' | 'sku' | 'title' | 'currency' | 'status'> & {
      inventory: Pick<Inventory, 'quantityOnHand' | 'quantityReserved'> | null
    }
  }>
}

export interface IDiscoveryRepository {
  findHomeBanners(limit: number, now: Date): Promise<DiscoveryBannerRecord[]>
  findActiveFlashSale(limit: number, now: Date): Promise<DiscoveryFlashSaleRecord | null>
  findFeaturedShops(limit: number): Promise<DiscoveryFeaturedShopRecord[]>
}

export class PrismaDiscoveryRepository implements IDiscoveryRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findHomeBanners(limit: number, now: Date): Promise<DiscoveryBannerRecord[]> {
    this.logger.debug('PrismaDiscoveryRepository.findHomeBanners', { limit })
    const where = {
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    } satisfies Prisma.MarketingBannerWhereInput
    const select = {
        id: true,
        placement: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        mobileImageUrl: true,
        targetUrl: true,
        sortOrder: true,
        metadata: true,
        startsAt: true,
        endsAt: true,
    } as const
    const orderBy = [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }] as const
    const [banners, popups] = await Promise.all([
      this.prisma.marketingBanner.findMany({ where: { ...where, placement: { in: ['HOME_HERO', 'HOME_HIGHLIGHT'] } }, select, orderBy: [...orderBy], take: limit }),
      this.prisma.marketingBanner.findMany({ where: { ...where, placement: 'HOME_POPUP' }, select, orderBy: [...orderBy], take: 1 }),
    ])
    return [...banners, ...popups]
  }

  findActiveFlashSale(limit: number, now: Date): Promise<DiscoveryFlashSaleRecord | null> {
    this.logger.debug('PrismaDiscoveryRepository.findActiveFlashSale', { limit })
    return this.prisma.flashSale.findFirst({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        items: {
          where: {
            isActive: true,
            shop: { status: 'ACTIVE' },
            product: { status: 'ACTIVE', deletedAt: null, shop: { status: 'ACTIVE' } },
            variant: { status: 'ACTIVE' },
          },
          select: {
            id: true,
            salePrice: true,
            originalPrice: true,
            stockLimit: true,
            soldCount: true,
            perUserLimit: true,
            reservations: {
              where: { status: 'ACTIVE', expiresAt: { gt: now } },
              select: { quantity: true },
            },
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                images: {
                  select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
                  take: 1,
                },
                shop: {
                  select: { id: true, name: true, slug: true, status: true },
                },
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                title: true,
                currency: true,
                status: true,
                inventory: { select: { quantityOnHand: true, quantityReserved: true } },
              },
            },
          },
          orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
          take: limit,
        },
      },
      orderBy: [{ endsAt: 'asc' }, { startsAt: 'desc' }],
    })
  }

  findFeaturedShops(limit: number): Promise<DiscoveryFeaturedShopRecord[]> {
    this.logger.debug('PrismaDiscoveryRepository.findFeaturedShops', { limit })
    return this.prisma.shop.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        products: {
          some: {
            status: 'ACTIVE',
            deletedAt: null,
            variants: { some: { status: 'ACTIVE' } },
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        coverUrl: true,
        ratingAverage: true,
        ratingCount: true,
        followerCount: true,
        productCount: true,
      },
      orderBy: [
        { ratingAverage: 'desc' },
        { ratingCount: 'desc' },
        { followerCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    })
  }
}
