import type {
  Order,
  OrderItem,
  PrismaClient,
  Product,
  ProductVariant,
  Review,
  ReviewMedia,
  Upload,
  User,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type ReviewOrderItem = OrderItem & {
  order: Pick<Order, 'id' | 'userId' | 'status'>
  variant: Pick<ProductVariant, 'id' | 'productId'> & {
    product: Pick<Product, 'id' | 'status'>
  }
  review: Pick<Review, 'id'> | null
}

export type ProductReview = Review & {
  user: Pick<User, 'id' | 'name'>
  orderItem: Pick<OrderItem, 'id' | 'productTitle' | 'productSlug' | 'variantTitle' | 'variantSku' | 'shopName' | 'shopSlug'>
  media: ReviewMedia[]
}

export type ReviewUpload = Pick<Upload, 'id' | 'userId' | 'usage' | 'status' | 'fileName' | 'contentType' | 'fileSize' | 'publicUrl'>

export interface ReviewMediaInput {
  uploadId: string
  uploadedById: string
  url: string
  mimeType: string
  sizeBytes: number
  altText: string | null
  sortOrder: number
}

export interface CreateReviewRecord {
  userId: string
  productId: string
  orderItemId: string
  rating: number
  body?: string | null
  media?: ReviewMediaInput[]
}

export interface UpdateReviewRecord {
  rating?: number
  body?: string | null
  media?: ReviewMediaInput[]
}

export interface RatingSummaryRecord {
  rating: number
  _count: {
    rating: number
  }
}

export interface IReviewRepository {
  findActiveProduct(productId: string): Promise<Pick<Product, 'id' | 'status'> | null>
  findOrderItemForReview(orderItemId: string): Promise<ReviewOrderItem | null>
  findReviewByOrderItem(orderItemId: string): Promise<Pick<Review, 'id'> | null>
  findReviewById(reviewId: string): Promise<Review | null>
  findUploadsByIds(uploadIds: string[]): Promise<ReviewUpload[]>
  createReview(input: CreateReviewRecord): Promise<ProductReview>
  updateReview(reviewId: string, input: UpdateReviewRecord): Promise<ProductReview>
  deleteReview(reviewId: string): Promise<Review>
  listProductReviews(productId: string): Promise<ProductReview[]>
  getRatingDistribution(productId: string): Promise<RatingSummaryRecord[]>
}

const productReviewInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  orderItem: {
    select: {
      id: true,
      productTitle: true,
      productSlug: true,
      variantTitle: true,
      variantSku: true,
      shopName: true,
      shopSlug: true,
    },
  },
  media: {
    orderBy: {
      sortOrder: 'asc',
    },
  },
} as const

export class PrismaReviewRepository implements IReviewRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findActiveProduct(productId: string): Promise<Pick<Product, 'id' | 'status'> | null> {
    this.logger.debug('PrismaReviewRepository.findActiveProduct', { productId })
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        status: true,
      },
    })
  }

  findOrderItemForReview(orderItemId: string): Promise<ReviewOrderItem | null> {
    this.logger.debug('PrismaReviewRepository.findOrderItemForReview', { orderItemId })
    return this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
        variant: {
          select: {
            id: true,
            productId: true,
            product: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
        review: {
          select: {
            id: true,
          },
        },
      },
    })
  }

  findReviewByOrderItem(orderItemId: string): Promise<Pick<Review, 'id'> | null> {
    this.logger.debug('PrismaReviewRepository.findReviewByOrderItem', { orderItemId })
    return this.prisma.review.findUnique({
      where: { orderItemId },
      select: { id: true },
    })
  }

  findReviewById(reviewId: string): Promise<Review | null> {
    this.logger.debug('PrismaReviewRepository.findReviewById', { reviewId })
    return this.prisma.review.findUnique({
      where: { id: reviewId },
    })
  }

  findUploadsByIds(uploadIds: string[]): Promise<ReviewUpload[]> {
    this.logger.debug('PrismaReviewRepository.findUploadsByIds', { count: uploadIds.length })
    return this.prisma.upload.findMany({
      where: {
        id: { in: uploadIds },
      },
      select: {
        id: true,
        userId: true,
        usage: true,
        status: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        publicUrl: true,
      },
    })
  }

  createReview(input: CreateReviewRecord): Promise<ProductReview> {
    this.logger.info('PrismaReviewRepository.createReview', {
      userId: input.userId,
      productId: input.productId,
      orderItemId: input.orderItemId,
    })
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId: input.userId,
          productId: input.productId,
          orderItemId: input.orderItemId,
          rating: input.rating,
          body: input.body,
          status: 'PUBLISHED',
          media: input.media?.length
            ? {
                create: input.media.map((media) => ({
                  uploadedById: media.uploadedById,
                  type: 'IMAGE',
                  url: media.url,
                  altText: media.altText,
                  sortOrder: media.sortOrder,
                  mimeType: media.mimeType,
                  sizeBytes: media.sizeBytes,
                })),
              }
            : undefined,
        },
        include: productReviewInclude,
      })
      return review
    })
  }

  updateReview(reviewId: string, input: UpdateReviewRecord): Promise<ProductReview> {
    this.logger.info('PrismaReviewRepository.updateReview', { reviewId })
    return this.prisma.$transaction(async (tx) => {
      if (input.media) {
        await tx.reviewMedia.deleteMany({
          where: { reviewId },
        })
      }

      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(input.rating === undefined ? {} : { rating: input.rating }),
          ...(input.body === undefined ? {} : { body: input.body }),
          ...(input.media === undefined || input.media.length === 0
            ? {}
            : {
                media: {
                  create: input.media.map((media) => ({
                    uploadedById: media.uploadedById,
                    type: 'IMAGE',
                    url: media.url,
                    altText: media.altText,
                    sortOrder: media.sortOrder,
                    mimeType: media.mimeType,
                    sizeBytes: media.sizeBytes,
                  })),
                },
              }),
        },
        include: productReviewInclude,
      })
      return review
    })
  }

  deleteReview(reviewId: string): Promise<Review> {
    this.logger.info('PrismaReviewRepository.deleteReview', { reviewId })
    return this.prisma.review.delete({
      where: { id: reviewId },
    })
  }

  listProductReviews(productId: string): Promise<ProductReview[]> {
    this.logger.debug('PrismaReviewRepository.listProductReviews', { productId })
    return this.prisma.review.findMany({
      where: {
        productId,
        status: 'PUBLISHED',
      },
      include: productReviewInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getRatingDistribution(productId: string): Promise<RatingSummaryRecord[]> {
    this.logger.debug('PrismaReviewRepository.getRatingDistribution', { productId })
    const rows = await this.prisma.review.groupBy({
      by: ['rating'],
      where: {
        productId,
        status: 'PUBLISHED',
      },
      _count: {
        rating: true,
      },
    } as never)
    return rows as RatingSummaryRecord[]
  }
}
