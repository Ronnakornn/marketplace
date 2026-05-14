import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { ReviewServiceError } from './review.errors.ts'
import type { IReviewRepository, ProductReview, RatingSummaryRecord } from './review.repository.ts'

export interface ReviewActor {
  id: string
  role: Role
}

export interface CreateReviewInput {
  orderItemId: string
  rating: number
  comment?: string
  images?: string[]
}

export interface UpdateReviewInput {
  rating?: number
  comment?: string | null
  images?: string[]
}

export interface ReviewResponse {
  id: string
  productId: string
  orderItemId: string
  userId: string
  userName?: string
  rating: number
  comment: string | null
  images: string[]
  status: string
  createdAt: Date
  updatedAt: Date
  snapshot?: {
    productTitle: string
    productSlug: string
    variantTitle: string
    variantSku: string
    shopName: string
    shopSlug: string
  }
}

export interface RatingSummaryResponse {
  averageRating: number
  totalReviewCount: number
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}

export class ReviewService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IReviewRepository,
  ) {
    this.logger = appContext.logger
  }

  async listProductReviews(productId: string): Promise<ReviewResponse[]> {
    await this.assertActiveProduct(productId)
    const reviews = await this.repo.listProductReviews(productId)
    return reviews.map((review) => this.toResponse(review))
  }

  async getRatingSummary(productId: string): Promise<RatingSummaryResponse> {
    await this.assertActiveProduct(productId)
    const distribution = await this.repo.getRatingDistribution(productId)
    return this.toRatingSummary(distribution)
  }

  async createReview(actor: ReviewActor, input: CreateReviewInput): Promise<ReviewResponse> {
    this.assertBuyer(actor)
    this.validateRating(input.rating)
    this.logger.info('ReviewService.createReview', { actorId: actor.id, orderItemId: input.orderItemId })

    const orderItem = await this.repo.findOrderItemForReview(input.orderItemId)
    if (!orderItem) throw new ReviewServiceError('Order item not found', 404, 'ORDER_ITEM_NOT_FOUND')
    if (orderItem.order.userId !== actor.id) {
      throw new ReviewServiceError('Review is not allowed for this order item', 403, 'REVIEW_FORBIDDEN')
    }
    if (orderItem.fulfillmentStatus !== 'DELIVERED') {
      throw new ReviewServiceError('Order item must be delivered before review', 409, 'ORDER_ITEM_NOT_DELIVERED')
    }
    if (orderItem.review || await this.repo.findReviewByOrderItem(orderItem.id)) {
      throw new ReviewServiceError('Order item already has a review', 409, 'REVIEW_ALREADY_EXISTS')
    }

    const review = await this.repo.createReview({
      userId: actor.id,
      productId: orderItem.variant.productId,
      orderItemId: orderItem.id,
      rating: input.rating,
      body: this.normalizeComment(input.comment),
      images: this.normalizeImages(input.images),
    })
    return this.toResponse(review)
  }

  async updateReview(actor: ReviewActor, reviewId: string, input: UpdateReviewInput): Promise<ReviewResponse> {
    this.assertBuyer(actor)
    if (input.rating !== undefined) this.validateRating(input.rating)
    const review = await this.repo.findReviewById(reviewId)
    if (!review) throw new ReviewServiceError('Review not found', 404, 'REVIEW_NOT_FOUND')
    if (review.userId !== actor.id) {
      throw new ReviewServiceError('Review does not belong to buyer', 403, 'REVIEW_FORBIDDEN')
    }

    const updated = await this.repo.updateReview(review.id, {
      ...(input.rating === undefined ? {} : { rating: input.rating }),
      ...(input.comment === undefined ? {} : { body: this.normalizeComment(input.comment) }),
      ...(input.images === undefined ? {} : { images: this.normalizeImages(input.images) }),
    })
    return this.toResponse(updated)
  }

  async deleteReview(actor: ReviewActor, reviewId: string): Promise<{ ok: true }> {
    this.assertBuyer(actor)
    const review = await this.repo.findReviewById(reviewId)
    if (!review) throw new ReviewServiceError('Review not found', 404, 'REVIEW_NOT_FOUND')
    if (review.userId !== actor.id) {
      throw new ReviewServiceError('Review does not belong to buyer', 403, 'REVIEW_FORBIDDEN')
    }

    await this.repo.deleteReview(review.id)
    return { ok: true }
  }

  private assertBuyer(actor: ReviewActor): void {
    if (actor.role !== 'USER') {
      throw new ReviewServiceError('Only buyer accounts can write reviews', 403, 'REVIEW_FORBIDDEN')
    }
  }

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewServiceError('Rating must be an integer from 1 to 5', 400, 'INVALID_RATING')
    }
  }

  private async assertActiveProduct(productId: string): Promise<void> {
    const product = await this.repo.findActiveProduct(productId)
    if (!product) throw new ReviewServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
  }

  private normalizeComment(comment: string | null | undefined): string | null {
    if (comment === undefined || comment === null) return null
    const trimmed = comment.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private normalizeImages(images: string[] | undefined): string[] {
    return images?.map((image) => image.trim()).filter(Boolean) ?? []
  }

  private toResponse(review: ProductReview): ReviewResponse {
    return {
      id: review.id,
      productId: review.productId,
      orderItemId: review.orderItemId,
      userId: review.userId,
      userName: review.user.name,
      rating: review.rating,
      comment: review.body,
      images: review.images,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      snapshot: {
        productTitle: review.orderItem.productTitle,
        productSlug: review.orderItem.productSlug,
        variantTitle: review.orderItem.variantTitle,
        variantSku: review.orderItem.variantSku,
        shopName: review.orderItem.shopName,
        shopSlug: review.orderItem.shopSlug,
      },
    }
  }

  private toRatingSummary(rows: RatingSummaryRecord[]): RatingSummaryResponse {
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
