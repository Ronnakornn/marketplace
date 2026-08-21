import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { ReviewServiceError } from './review.errors.ts'
import type { IReviewRepository, ProductReview, RatingSummaryRecord, ReviewMediaInput, ReviewSort, ReviewUpload } from './review.repository.ts'

const MAX_REVIEW_IMAGE_COUNT = 5

export interface ReviewActor {
  id: string
  role: Role
}

export interface CreateReviewInput {
  orderItemId: string
  rating: number
  comment?: string
  uploadIds?: string[]
}

export interface UpdateReviewInput {
  rating?: number
  comment?: string | null
  uploadIds?: string[]
}

export interface ReviewMediaResponse {
  id: string
  type: 'IMAGE'
  url: string
  altText: string | null
  sortOrder: number
  width: number | null
  height: number | null
  mimeType: string | null
  sizeBytes: number | null
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
  media: ReviewMediaResponse[]
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

export interface ListProductReviewsInput {
  rating?: 1 | 2 | 3 | 4 | 5
  hasMedia?: boolean
  hasComment?: boolean
  sort?: ReviewSort
  page?: number
  limit?: number
}

export interface PaginatedReviewResponse {
  items: ReviewResponse[]
  meta: {
    page: number
    limit: number
    totalCount: number
    hasNextPage: boolean
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

  async listProductReviews(productId: string, input: ListProductReviewsInput = {}): Promise<PaginatedReviewResponse> {
    await this.assertActiveProduct(productId)
    const page = this.normalizePage(input.page)
    const limit = this.normalizeLimit(input.limit)
    const sort = input.sort ?? 'latest'
    const result = await this.repo.listProductReviews(productId, {
      ...(input.rating ? { rating: input.rating } : {}),
      ...(input.hasMedia === undefined ? {} : { hasMedia: input.hasMedia }),
      ...(input.hasComment === undefined ? {} : { hasComment: input.hasComment }),
      sort,
      page,
      limit,
    })
    return {
      items: result.items.map((review) => this.toResponse(review)),
      meta: {
        page,
        limit,
        totalCount: result.totalCount,
        hasNextPage: page * limit < result.totalCount,
      },
    }
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
    const media = await this.resolveReviewMedia(actor, input.uploadIds)

    const review = await this.repo.createReview({
      userId: actor.id,
      productId: orderItem.variant.productId,
      orderItemId: orderItem.id,
      rating: input.rating,
      body: this.normalizeComment(input.comment),
      media,
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
    const media = input.uploadIds === undefined
      ? undefined
      : await this.resolveReviewMedia(actor, input.uploadIds)

    const updated = await this.repo.updateReview(review.id, {
      ...(input.rating === undefined ? {} : { rating: input.rating }),
      ...(input.comment === undefined ? {} : { body: this.normalizeComment(input.comment) }),
      ...(media === undefined ? {} : { media }),
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
    if (actor.role === 'ADMIN') {
      throw new ReviewServiceError('Only buyer accounts can write reviews', 403, 'REVIEW_FORBIDDEN')
    }
  }

  private validateRating(rating: number): void {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewServiceError('Rating must be an integer from 1 to 5', 400, 'INVALID_RATING')
    }
  }

  private normalizePage(page: number | undefined): number {
    if (page === undefined) return 1
    if (!Number.isInteger(page) || page < 1) {
      throw new ReviewServiceError('Page must be a positive integer', 400, 'INVALID_PAGINATION')
    }
    return page
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) return 5
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new ReviewServiceError('Limit must be an integer from 1 to 20', 400, 'INVALID_PAGINATION')
    }
    return limit
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

  private normalizeUploadIds(uploadIds: string[] | undefined): string[] {
    const normalized = uploadIds?.map((uploadId) => uploadId.trim()).filter(Boolean) ?? []
    return [...new Set(normalized)]
  }

  private async resolveReviewMedia(actor: ReviewActor, uploadIds: string[] | undefined): Promise<ReviewMediaInput[]> {
    const normalizedUploadIds = this.normalizeUploadIds(uploadIds)
    if (normalizedUploadIds.length > MAX_REVIEW_IMAGE_COUNT) {
      throw new ReviewServiceError('A review can include at most 5 images', 400, 'REVIEW_MEDIA_LIMIT_EXCEEDED', {
        maxImages: MAX_REVIEW_IMAGE_COUNT,
      })
    }
    if (normalizedUploadIds.length === 0) return []

    const uploads = await this.repo.findUploadsByIds(normalizedUploadIds)
    const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]))

    return normalizedUploadIds.map((uploadId, index) => {
      const upload = uploadsById.get(uploadId)
      if (!upload) throw new ReviewServiceError('Review image upload not found', 404, 'UPLOAD_NOT_FOUND')
      this.assertValidReviewImageUpload(actor, upload)
      return {
        uploadId: upload.id,
        uploadedById: actor.id,
        url: upload.publicUrl!,
        mimeType: upload.contentType,
        sizeBytes: upload.fileSize,
        altText: this.toAltText(upload.fileName),
        sortOrder: index,
      }
    })
  }

  private assertValidReviewImageUpload(actor: ReviewActor, upload: ReviewUpload): void {
    if (actor.role !== 'ADMIN' && upload.userId !== actor.id) {
      throw new ReviewServiceError('Review image upload does not belong to buyer', 403, 'REVIEW_MEDIA_FORBIDDEN')
    }
    if (upload.status !== 'COMPLETED') {
      throw new ReviewServiceError('Review image upload must be completed', 400, 'REVIEW_MEDIA_UPLOAD_INCOMPLETE')
    }
    if (upload.usage !== 'REVIEW_IMAGE' || !upload.contentType.startsWith('image/')) {
      throw new ReviewServiceError('Review media upload must be a review image', 400, 'REVIEW_MEDIA_UPLOAD_INVALID')
    }
    if (!upload.publicUrl) {
      throw new ReviewServiceError('Review image upload does not have a public URL', 400, 'REVIEW_MEDIA_UPLOAD_INVALID')
    }
  }

  private toAltText(fileName: string): string | null {
    const baseName = fileName.trim().replace(/\\/g, '/').split('/').pop() ?? ''
    const withoutExtension = baseName.replace(/\.[^.]+$/, '').trim()
    return withoutExtension.length > 0 ? withoutExtension : null
  }

  private toResponse(review: ProductReview): ReviewResponse {
    const media = review.media.map((item) => ({
      id: item.id,
      type: item.type as 'IMAGE',
      url: item.url,
      altText: item.altText,
      sortOrder: item.sortOrder,
      width: item.width,
      height: item.height,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
    }))
    return {
      id: review.id,
      productId: review.productId,
      orderItemId: review.orderItemId,
      userId: review.userId,
      userName: review.user.name,
      rating: review.rating,
      comment: review.body,
      images: media.map((item) => item.url),
      media,
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
