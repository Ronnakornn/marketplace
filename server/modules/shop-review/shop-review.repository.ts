import type {
  Order,
  Prisma,
  PrismaClient,
  Shop,
  ShopOrder,
  ShopRating,
  User,
} from '#generated/client/client.ts'
import type { ReviewStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type ActiveShopRecord = Pick<Shop, 'id' | 'status' | 'name' | 'slug'>

export type ShopOrderForRatingRecord = Pick<ShopOrder, 'id' | 'shopId' | 'status' | 'fulfillmentStatus'> & {
  order: Pick<Order, 'id' | 'userId' | 'status' | 'paymentStatus'>
  shop: Pick<Shop, 'id' | 'ownerId' | 'status' | 'name' | 'slug'>
}

export type ShopReviewRecord = ShopRating & {
  user: Pick<User, 'id' | 'name'>
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'ownerId' | 'status'>
  shopOrder: Pick<ShopOrder, 'id' | 'orderId' | 'shopId' | 'status' | 'fulfillmentStatus'>
  moderatedBy: Pick<User, 'id' | 'name'> | null
}

export interface ShopRatingDistributionRecord {
  rating: number
  _count: {
    rating: number
  }
}

export interface CreateShopReviewRecord {
  userId: string
  shopId: string
  shopOrderId: string
  rating: number
  body: string | null
}

export interface ModerateShopReviewRecord {
  status: ReviewStatus
  moderatedAt: Date
  moderatedById: string
  moderationReason: string | null
}

export interface ListAdminShopReviewFilters {
  status?: ReviewStatus
  shopId?: string
  limit: number
}

export interface PublishedShopReviewPage {
  items: ShopReviewRecord[]
  totalCount: number
}

export interface IShopReviewRepository {
  findActiveShopById(shopId: string): Promise<ActiveShopRecord | null>
  findShopOrderForRating(shopOrderId: string): Promise<ShopOrderForRatingRecord | null>
  findShopRatingByUnique(shopId: string, userId: string, shopOrderId: string): Promise<Pick<ShopRating, 'id'> | null>
  findShopRatingById(shopRatingId: string): Promise<ShopReviewRecord | null>
  createShopRating(input: CreateShopReviewRecord): Promise<ShopReviewRecord>
  moderateShopRating(shopRatingId: string, input: ModerateShopReviewRecord): Promise<ShopReviewRecord>
  listPublishedShopRatings(shopId: string, limit: number): Promise<ShopReviewRecord[]>
  listPublishedShopRatingsPage(shopId: string, page: number, limit: number): Promise<PublishedShopReviewPage>
  listAdminShopRatings(filters: ListAdminShopReviewFilters): Promise<ShopReviewRecord[]>
  getPublishedShopRatingDistribution(shopId: string): Promise<ShopRatingDistributionRecord[]>
}

const shopReviewInclude = {
  user: { select: { id: true, name: true } },
  shop: { select: { id: true, name: true, slug: true, ownerId: true, status: true } },
  shopOrder: { select: { id: true, orderId: true, shopId: true, status: true, fulfillmentStatus: true } },
  moderatedBy: { select: { id: true, name: true } },
} as const

export class PrismaShopReviewRepository implements IShopReviewRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findActiveShopById(shopId: string): Promise<ActiveShopRecord | null> {
    this.logger.debug('PrismaShopReviewRepository.findActiveShopById', { shopId })
    return this.prisma.shop.findFirst({
      where: { id: shopId, status: 'ACTIVE' },
      select: { id: true, status: true, name: true, slug: true },
    })
  }

  findShopOrderForRating(shopOrderId: string): Promise<ShopOrderForRatingRecord | null> {
    this.logger.debug('PrismaShopReviewRepository.findShopOrderForRating', { shopOrderId })
    return this.prisma.shopOrder.findUnique({
      where: { id: shopOrderId },
      select: {
        id: true,
        shopId: true,
        status: true,
        fulfillmentStatus: true,
        order: {
          select: {
            id: true,
            userId: true,
            status: true,
            paymentStatus: true,
          },
        },
        shop: {
          select: {
            id: true,
            ownerId: true,
            status: true,
            name: true,
            slug: true,
          },
        },
      },
    })
  }

  findShopRatingByUnique(shopId: string, userId: string, shopOrderId: string): Promise<Pick<ShopRating, 'id'> | null> {
    this.logger.debug('PrismaShopReviewRepository.findShopRatingByUnique', { shopId, userId, shopOrderId })
    return this.prisma.shopRating.findUnique({
      where: { shopId_userId_shopOrderId: { shopId, userId, shopOrderId } },
      select: { id: true },
    })
  }

  findShopRatingById(shopRatingId: string): Promise<ShopReviewRecord | null> {
    this.logger.debug('PrismaShopReviewRepository.findShopRatingById', { shopRatingId })
    return this.prisma.shopRating.findUnique({
      where: { id: shopRatingId },
      include: shopReviewInclude,
    })
  }

  async createShopRating(input: CreateShopReviewRecord): Promise<ShopReviewRecord> {
    this.logger.info('PrismaShopReviewRepository.createShopRating', {
      userId: input.userId,
      shopId: input.shopId,
      shopOrderId: input.shopOrderId,
    })

    const shopRatingId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shopRating.create({
        data: {
          userId: input.userId,
          shopId: input.shopId,
          shopOrderId: input.shopOrderId,
          rating: input.rating,
          body: input.body,
          status: 'PENDING',
        },
        select: { id: true },
      })

      await this.syncShopRatingSummaryWithTx(tx, input.shopId)
      return created.id
    })

    const review = await this.findShopRatingById(shopRatingId)
    if (!review) {
      throw new Error('Shop review not found after create')
    }
    return review
  }

  async moderateShopRating(shopRatingId: string, input: ModerateShopReviewRecord): Promise<ShopReviewRecord> {
    this.logger.info('PrismaShopReviewRepository.moderateShopRating', {
      shopRatingId,
      status: input.status,
      moderatedById: input.moderatedById,
    })

    const reviewId = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.shopRating.update({
        where: { id: shopRatingId },
        data: {
          status: input.status,
          moderatedAt: input.moderatedAt,
          moderatedById: input.moderatedById,
          moderationReason: input.moderationReason,
        },
        select: { id: true, shopId: true },
      })

      await this.syncShopRatingSummaryWithTx(tx, updated.shopId)
      return updated.id
    })

    const review = await this.findShopRatingById(reviewId)
    if (!review) {
      throw new Error('Shop review not found after moderation')
    }
    return review
  }

  listPublishedShopRatings(shopId: string, limit: number): Promise<ShopReviewRecord[]> {
    this.logger.debug('PrismaShopReviewRepository.listPublishedShopRatings', { shopId, limit })
    return this.prisma.shopRating.findMany({
      where: {
        shopId,
        status: 'PUBLISHED',
      },
      include: shopReviewInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
  }

  async listPublishedShopRatingsPage(shopId: string, page: number, limit: number): Promise<PublishedShopReviewPage> {
    this.logger.debug('PrismaShopReviewRepository.listPublishedShopRatingsPage', { shopId, page, limit })
    const where = { shopId, status: 'PUBLISHED' as const }
    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.shopRating.findMany({ where, include: shopReviewInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.shopRating.count({ where }),
    ])
    return { items, totalCount }
  }

  listAdminShopRatings(filters: ListAdminShopReviewFilters): Promise<ShopReviewRecord[]> {
    this.logger.debug('PrismaShopReviewRepository.listAdminShopRatings', { ...filters })
    return this.prisma.shopRating.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.shopId ? { shopId: filters.shopId } : {}),
      },
      include: shopReviewInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    })
  }

  async getPublishedShopRatingDistribution(shopId: string): Promise<ShopRatingDistributionRecord[]> {
    this.logger.debug('PrismaShopReviewRepository.getPublishedShopRatingDistribution', { shopId })
    const rows = await this.prisma.shopRating.groupBy({
      by: ['rating'],
      where: {
        shopId,
        status: 'PUBLISHED',
      },
      _count: {
        rating: true,
      },
    } as never)

    return rows as ShopRatingDistributionRecord[]
  }

  private async syncShopRatingSummaryWithTx(tx: Prisma.TransactionClient, shopId: string): Promise<void> {
    const aggregate = await tx.shopRating.aggregate({
      where: {
        shopId,
        status: 'PUBLISHED',
      },
      _avg: { rating: true },
      _count: { _all: true },
    })

    const average = aggregate._avg.rating === null ? 0 : Number(aggregate._avg.rating.toFixed(2))
    const count = aggregate._count._all

    await tx.shop.update({
      where: { id: shopId },
      data: {
        ratingAverage: average,
        ratingCount: count,
      },
    })
  }
}
