import type { ReviewStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { CacheInvalidation } from '#server/modules/cache'
import { ShopReviewServiceError } from './shop-review.errors.ts'
import type {
  IShopReviewRepository,
  ShopRatingDistributionRecord,
  ShopReviewRecord,
} from './shop-review.repository.ts'

const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'] as const
const MODERATION_DECISIONS = ['APPROVE', 'REJECT', 'HIDE'] as const
const DEFAULT_LIST_LIMIT = 20
const MAX_LIST_LIMIT = 100

export interface ShopReviewActor {
  id: string
  role: Role
}

export interface CreateShopReviewInput {
  shopOrderId: string
  rating: number
  comment?: string | null
}

export interface ModerateShopReviewInput {
  decision: 'APPROVE' | 'REJECT' | 'HIDE'
  moderationReason?: string | null
}

export interface ShopReviewResponse {
  id: string
  shopId: string
  shopName: string
  shopSlug: string
  shopOrderId: string
  userId: string
  userName: string
  rating: number
  comment: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  moderatedAt: Date | null
  moderatedById: string | null
  moderationReason: string | null
}

export interface ShopRatingSummaryResponse {
  averageRating: number
  totalReviewCount: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface PublicShopReviewFeed {
  items: PublicShopReviewResponse[]
  meta: { page: number; pageSize: number; totalCount: number; hasNextPage: boolean }
}

export interface PublicShopReviewResponse {
  id: string
  userName: string
  rating: number
  comment: string | null
  createdAt: Date
}

export class ShopReviewService {
  constructor(
    _appContext: AppContext,
    private repo: IShopReviewRepository,
    private cacheInvalidation?: CacheInvalidation,
  ) {}

  async listShopReviews(shopId: string, limit?: number): Promise<ShopReviewResponse[]> {
    await this.assertActiveShop(shopId)
    const reviews = await this.repo.listPublishedShopRatings(shopId, this.normalizeLimit(limit))
    return reviews.map((review) => this.toResponse(review))
  }

  async listShopReviewFeed(shopId: string, page = 1, limit = 10): Promise<PublicShopReviewFeed> {
    await this.assertActiveShop(shopId)
    if (!Number.isInteger(page) || page < 1) throw new ShopReviewServiceError('Page must be a positive integer', 400, 'SHOP_REVIEW_QUERY_INVALID')
    const pageSize = this.normalizeLimit(limit)
    const result = await this.repo.listPublishedShopRatingsPage(shopId, page, pageSize)
    return { items: result.items.map((review) => ({ id: review.id, userName: review.user.name, rating: review.rating, comment: review.body, createdAt: review.createdAt })), meta: { page, pageSize, totalCount: result.totalCount, hasNextPage: page * pageSize < result.totalCount } }
  }

  async getShopRatingSummary(shopId: string): Promise<ShopRatingSummaryResponse> {
    await this.assertActiveShop(shopId)
    const distribution = await this.repo.getPublishedShopRatingDistribution(shopId)
    return this.toSummary(distribution)
  }

  async createShopReview(actor: ShopReviewActor, input: CreateShopReviewInput): Promise<ShopReviewResponse> {
    this.assertBuyer(actor)
    this.validateRating(input.rating)

    const shopOrder = await this.repo.findShopOrderForRating(input.shopOrderId)
    if (!shopOrder) throw new ShopReviewServiceError('Shop order not found', 404, 'SHOP_ORDER_NOT_FOUND')
    if (shopOrder.order.userId !== actor.id) {
      throw new ShopReviewServiceError('Shop review is not allowed for this order', 403, 'SHOP_REVIEW_FORBIDDEN')
    }
    if (shopOrder.shop.ownerId === actor.id) {
      throw new ShopReviewServiceError('Buyer cannot review own shop', 403, 'SHOP_REVIEW_FORBIDDEN')
    }
    if (shopOrder.shop.status !== 'ACTIVE') {
      throw new ShopReviewServiceError('Shop is not active', 409, 'SHOP_REVIEW_FORBIDDEN')
    }
    if (shopOrder.fulfillmentStatus !== 'DELIVERED') {
      throw new ShopReviewServiceError('Shop order must be delivered before review', 409, 'SHOP_ORDER_NOT_DELIVERED')
    }

    const existing = await this.repo.findShopRatingByUnique(shopOrder.shopId, actor.id, shopOrder.id)
    if (existing) {
      throw new ShopReviewServiceError('Shop order already has a review', 409, 'SHOP_REVIEW_ALREADY_EXISTS')
    }

    const created = await this.repo.createShopRating({
      userId: actor.id,
      shopId: shopOrder.shopId,
      shopOrderId: shopOrder.id,
      rating: input.rating,
      body: this.normalizeComment(input.comment),
    })
    await this.cacheInvalidation?.invalidateSellerDashboard(created.shopId)

    return this.toResponse(created)
  }

  async listAdminShopReviews(
    actor: ShopReviewActor,
    input: { status?: string; shopId?: string; limit?: number },
  ): Promise<ShopReviewResponse[]> {
    this.assertAdmin(actor)
    const status = input.status
      ? this.parseEnum<ReviewStatus>(input.status, REVIEW_STATUSES, 'Invalid review status')
      : undefined

    const reviews = await this.repo.listAdminShopRatings({
      status,
      shopId: input.shopId,
      limit: this.normalizeLimit(input.limit),
    })
    return reviews.map((review) => this.toResponse(review))
  }

  async moderateShopReview(
    actor: ShopReviewActor,
    shopRatingId: string,
    input: ModerateShopReviewInput,
  ): Promise<ShopReviewResponse> {
    this.assertAdmin(actor)
    const review = await this.repo.findShopRatingById(shopRatingId)
    if (!review) throw new ShopReviewServiceError('Shop review not found', 404, 'SHOP_REVIEW_NOT_FOUND')

    const decision = this.parseEnum<ModerateShopReviewInput['decision']>(
      input.decision,
      MODERATION_DECISIONS,
      'Invalid moderation decision',
    )

    const moderationReason = this.normalizeComment(input.moderationReason)
    if ((decision === 'REJECT' || decision === 'HIDE') && !moderationReason) {
      throw new ShopReviewServiceError('Moderation reason is required', 400, 'MODERATION_REASON_REQUIRED')
    }

    const status = this.toModerationStatus(decision)
    const moderated = await this.repo.moderateShopRating(review.id, {
      status,
      moderatedAt: new Date(),
      moderatedById: actor.id,
      moderationReason,
    })
    await this.cacheInvalidation?.invalidateSellerDashboard(moderated.shopId)

    return this.toResponse(moderated)
  }

  private async assertActiveShop(shopId: string): Promise<void> {
    const shop = await this.repo.findActiveShopById(shopId)
    if (!shop) throw new ShopReviewServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
  }

  private assertBuyer(actor: ShopReviewActor): void {
    if (actor.role === 'ADMIN') {
      throw new ShopReviewServiceError('Only buyer accounts can write shop reviews', 403, 'SHOP_REVIEW_FORBIDDEN')
    }
  }

  private assertAdmin(actor: ShopReviewActor): void {
    if (actor.role !== 'ADMIN') {
      throw new ShopReviewServiceError('Admin access required', 403, 'SHOP_REVIEW_FORBIDDEN')
    }
  }

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ShopReviewServiceError('Rating must be an integer from 1 to 5', 400, 'INVALID_RATING')
    }
  }

  private normalizeLimit(limit?: number): number {
    const value = limit ?? DEFAULT_LIST_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_LIST_LIMIT) {
      throw new ShopReviewServiceError('Limit must be between 1 and 100', 400, 'SHOP_REVIEW_QUERY_INVALID')
    }
    return value
  }

  private normalizeComment(comment: string | null | undefined): string | null {
    if (comment === undefined || comment === null) return null
    const trimmed = comment.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private parseEnum<T extends string>(value: string, allowed: readonly string[], message: string): T {
    if (!allowed.includes(value)) {
      throw new ShopReviewServiceError(message, 400, 'SHOP_REVIEW_QUERY_INVALID')
    }
    return value as T
  }

  private toModerationStatus(decision: ModerateShopReviewInput['decision']): ReviewStatus {
    if (decision === 'APPROVE') return 'PUBLISHED'
    if (decision === 'REJECT') return 'REJECTED'
    return 'HIDDEN'
  }

  private toResponse(review: ShopReviewRecord): ShopReviewResponse {
    return {
      id: review.id,
      shopId: review.shopId,
      shopName: review.shop.name,
      shopSlug: review.shop.slug,
      shopOrderId: review.shopOrderId,
      userId: review.userId,
      userName: review.user.name,
      rating: review.rating,
      comment: review.body,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      moderatedAt: review.moderatedAt,
      moderatedById: review.moderatedById,
      moderationReason: review.moderationReason,
    }
  }

  private toSummary(rows: ShopRatingDistributionRecord[]): ShopRatingSummaryResponse {
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    }

    for (const row of rows) {
      if (row.rating >= 1 && row.rating <= 5) {
        distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating
      }
    }

    const totalReviewCount = Object.values(distribution).reduce((total, count) => total + count, 0)
    const totalRating = Object.entries(distribution).reduce(
      (total, [rating, count]) => total + Number(rating) * count,
      0,
    )

    return {
      averageRating: totalReviewCount === 0 ? 0 : Number((totalRating / totalReviewCount).toFixed(2)),
      totalReviewCount,
      distribution,
    }
  }
}
