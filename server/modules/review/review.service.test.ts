import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewStatus } from '#generated/client/enums.ts'
import type { IReviewRepository, ProductReview, ReviewOrderItem, ReviewUpload } from './review.repository.ts'
import { ReviewService } from './review.service.ts'

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

function createAppContext() {
  return {
    logger: createLogger(),
    config: { environment: 'test' },
  }
}

function createRepoMock(): IReviewRepository {
  return {
    findActiveProduct: vi.fn(),
    findOrderItemForReview: vi.fn(),
    findReviewByOrderItem: vi.fn(),
    findReviewById: vi.fn(),
    findUploadsByIds: vi.fn(),
    createReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
    listProductReviews: vi.fn(),
    getRatingDistribution: vi.fn(),
  }
}

const now = new Date('2026-05-13T00:00:00.000Z')

function createOrderItem(overrides: Partial<ReviewOrderItem> = {}): ReviewOrderItem {
  return {
    id: 'item-1',
    orderId: 'order-1',
    shopId: 'shop-1',
    variantId: 'variant-1',
    productTitle: 'Cotton Tee',
    productSlug: 'cotton-tee',
    variantTitle: 'Black / M',
    variantSku: 'TEE-BLK-M',
    shopName: 'Urban Thread',
    shopSlug: 'urban-thread',
    quantity: 1,
    unitPrice: 1200,
    lineTotal: 1200,
    currency: 'USD',
    fulfillmentStatus: 'DELIVERED',
    order: {
      id: 'order-1',
      userId: 'buyer-1',
      status: 'DELIVERED',
    },
    variant: {
      id: 'variant-1',
      productId: 'product-1',
      product: {
        id: 'product-1',
        status: 'ACTIVE',
      },
    },
    review: null,
    ...overrides,
  } as ReviewOrderItem
}

function createReview(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: 'review-1',
    userId: 'buyer-1',
    productId: 'product-1',
    orderItemId: 'item-1',
    rating: 5,
    body: 'Great fit',
    status: 'PUBLISHED' as ReviewStatus,
    createdAt: now,
    updatedAt: now,
    user: {
      id: 'buyer-1',
      name: 'Jane Buyer',
    },
    orderItem: {
      id: 'item-1',
      productTitle: 'Cotton Tee',
      productSlug: 'cotton-tee',
      variantTitle: 'Black / M',
      variantSku: 'TEE-BLK-M',
      shopName: 'Urban Thread',
      shopSlug: 'urban-thread',
    },
    media: [
      {
        id: 'media-1',
        reviewId: 'review-1',
        shopRatingId: null,
        uploadedById: 'buyer-1',
        type: 'IMAGE',
        url: 'https://cdn.example.com/review.jpg',
        thumbnailUrl: null,
        altText: 'review',
        sortOrder: 0,
        width: null,
        height: null,
        durationSec: null,
        sizeBytes: 1234,
        mimeType: 'image/jpeg',
        createdAt: now,
      },
    ],
    ...overrides,
  } as ProductReview
}

function createUpload(overrides: Partial<ReviewUpload> = {}): ReviewUpload {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'buyer-1',
    usage: 'REVIEW_IMAGE',
    status: 'COMPLETED',
    fileName: 'review.jpg',
    contentType: 'image/jpeg',
    fileSize: 1234,
    publicUrl: 'https://cdn.example.com/review.jpg',
    ...overrides,
  }
}

describe('ReviewService', () => {
  let repo: IReviewRepository
  let service: ReviewService

  beforeEach(() => {
    repo = createRepoMock()
    service = new ReviewService(createAppContext(), repo)
    vi.mocked(repo.findActiveProduct).mockResolvedValue({ id: 'product-1', status: 'ACTIVE' })
    vi.mocked(repo.findOrderItemForReview).mockResolvedValue(createOrderItem())
    vi.mocked(repo.findReviewByOrderItem).mockResolvedValue(null)
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([])
    vi.mocked(repo.createReview).mockResolvedValue(createReview())
    vi.clearAllMocks()
  })

  it('lets buyer review delivered own order item', async () => {
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([createUpload()])

    const result = await service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      comment: ' Great fit ',
      uploadIds: ['11111111-1111-4111-8111-111111111111'],
    })

    expect(repo.createReview).toHaveBeenCalledWith({
      userId: 'buyer-1',
      productId: 'product-1',
      orderItemId: 'item-1',
      rating: 5,
      body: 'Great fit',
      media: [{
        uploadId: '11111111-1111-4111-8111-111111111111',
        uploadedById: 'buyer-1',
        url: 'https://cdn.example.com/review.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
        altText: 'review',
        sortOrder: 0,
      }],
    })
    expect(result).toMatchObject({
      id: 'review-1',
      rating: 5,
      comment: 'Great fit',
      images: ['https://cdn.example.com/review.jpg'],
      media: [{
        id: 'media-1',
        type: 'IMAGE',
        url: 'https://cdn.example.com/review.jpg',
        altText: 'review',
        sortOrder: 0,
        width: null,
        height: null,
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
      }],
      snapshot: {
        productTitle: 'Cotton Tee',
      },
    })
  })

  it('rejects undelivered, other buyer, duplicate, seller-role, and invalid rating reviews', async () => {
    vi.mocked(repo.findOrderItemForReview).mockResolvedValue(createOrderItem({ fulfillmentStatus: 'SHIPPED' }))
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, { orderItemId: 'item-1', rating: 5 }))
      .rejects.toMatchObject({ code: 'ORDER_ITEM_NOT_DELIVERED' })

    vi.mocked(repo.findOrderItemForReview).mockResolvedValue(createOrderItem({
      order: { id: 'order-1', userId: 'other-buyer', status: 'DELIVERED' },
    }))
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, { orderItemId: 'item-1', rating: 5 }))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    vi.mocked(repo.findOrderItemForReview).mockResolvedValue(createOrderItem({ review: { id: 'review-1' } }))
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, { orderItemId: 'item-1', rating: 5 }))
      .rejects.toMatchObject({ code: 'REVIEW_ALREADY_EXISTS' })

    await expect(service.createReview({ id: 'seller-1', role: 'USER' }, { orderItemId: 'item-1', rating: 5 }))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, { orderItemId: 'item-1', rating: 6 }))
      .rejects.toMatchObject({ code: 'INVALID_RATING' })
  })

  it('rejects invalid review image uploads', async () => {
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([createUpload({ status: 'PENDING' })])
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      uploadIds: ['11111111-1111-4111-8111-111111111111'],
    })).rejects.toMatchObject({ code: 'REVIEW_MEDIA_UPLOAD_INCOMPLETE' })

    vi.mocked(repo.findUploadsByIds).mockResolvedValue([createUpload({ userId: 'other-buyer' })])
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      uploadIds: ['11111111-1111-4111-8111-111111111111'],
    })).rejects.toMatchObject({ code: 'REVIEW_MEDIA_FORBIDDEN' })

    vi.mocked(repo.findUploadsByIds).mockResolvedValue([createUpload({ usage: 'PRODUCT_IMAGE' })])
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      uploadIds: ['11111111-1111-4111-8111-111111111111'],
    })).rejects.toMatchObject({ code: 'REVIEW_MEDIA_UPLOAD_INVALID' })

    vi.mocked(repo.findUploadsByIds).mockResolvedValue([createUpload({ publicUrl: null })])
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      uploadIds: ['11111111-1111-4111-8111-111111111111'],
    })).rejects.toMatchObject({ code: 'REVIEW_MEDIA_UPLOAD_INVALID' })
  })

  it('enforces the review image count limit', async () => {
    await expect(service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      uploadIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
        '66666666-6666-4666-8666-666666666666',
      ],
    })).rejects.toMatchObject({ code: 'REVIEW_MEDIA_LIMIT_EXCEEDED' })
    expect(repo.findUploadsByIds).not.toHaveBeenCalled()
  })

  it('lets buyer update and delete own review only', async () => {
    vi.mocked(repo.findReviewById).mockResolvedValue(createReview())
    vi.mocked(repo.updateReview).mockResolvedValue(createReview({ rating: 4, body: 'Updated' }))
    vi.mocked(repo.deleteReview).mockResolvedValue(createReview())

    const updated = await service.updateReview({ id: 'buyer-1', role: 'USER' }, 'review-1', {
      rating: 4,
      comment: 'Updated',
      uploadIds: [],
    })
    expect(repo.updateReview).toHaveBeenCalledWith('review-1', { rating: 4, body: 'Updated', media: [] })
    expect(updated.rating).toBe(4)

    await expect(service.updateReview({ id: 'other-buyer', role: 'USER' }, 'review-1', { rating: 4 }))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    await expect(service.deleteReview({ id: 'other-buyer', role: 'USER' }, 'review-1'))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    await expect(service.deleteReview({ id: 'buyer-1', role: 'USER' }, 'review-1')).resolves.toEqual({ ok: true })
  })

  it('replaces review media on update when uploadIds are provided', async () => {
    const replacementUpload = createUpload({
      id: '22222222-2222-4222-8222-222222222222',
      fileName: 'updated-photo.avif',
      contentType: 'image/avif',
      fileSize: 4321,
      publicUrl: 'https://cdn.example.com/updated-photo.avif',
    })
    vi.mocked(repo.findReviewById).mockResolvedValue(createReview())
    vi.mocked(repo.findUploadsByIds).mockResolvedValue([replacementUpload])
    vi.mocked(repo.updateReview).mockResolvedValue(createReview({
      media: [{
        id: 'media-2',
        reviewId: 'review-1',
        shopRatingId: null,
        uploadedById: 'buyer-1',
        type: 'IMAGE',
        url: replacementUpload.publicUrl!,
        thumbnailUrl: null,
        altText: 'updated-photo',
        sortOrder: 0,
        width: null,
        height: null,
        durationSec: null,
        sizeBytes: replacementUpload.fileSize,
        mimeType: replacementUpload.contentType,
        createdAt: now,
      }],
    }))

    const result = await service.updateReview({ id: 'buyer-1', role: 'USER' }, 'review-1', {
      uploadIds: ['22222222-2222-4222-8222-222222222222'],
    })

    expect(repo.findUploadsByIds).toHaveBeenCalledWith(['22222222-2222-4222-8222-222222222222'])
    expect(repo.updateReview).toHaveBeenCalledWith('review-1', {
      media: [{
        uploadId: '22222222-2222-4222-8222-222222222222',
        uploadedById: 'buyer-1',
        url: 'https://cdn.example.com/updated-photo.avif',
        mimeType: 'image/avif',
        sizeBytes: 4321,
        altText: 'updated-photo',
        sortOrder: 0,
      }],
    })
    expect(result.images).toEqual(['https://cdn.example.com/updated-photo.avif'])
  })

  it('lists public product reviews and returns rating summary', async () => {
    vi.mocked(repo.listProductReviews).mockResolvedValue({ items: [createReview()], totalCount: 1 })
    vi.mocked(repo.getRatingDistribution).mockResolvedValue([
      { rating: 5, _count: { rating: 2 } },
      { rating: 3, _count: { rating: 1 } },
    ])

    const reviews = await service.listProductReviews('product-1')
    expect(repo.findActiveProduct).toHaveBeenCalledWith('product-1')
    expect(reviews.items).toHaveLength(1)
    expect(reviews.items[0]!.userName).toBe('Jane Buyer')
    expect(reviews.meta).toEqual({
      page: 1,
      limit: 5,
      totalCount: 1,
      hasNextPage: false,
    })

    const summary = await service.getRatingSummary('product-1')
    expect(summary).toEqual({
      averageRating: 4.33,
      totalReviewCount: 3,
      distribution: {
        1: 0,
        2: 0,
        3: 1,
        4: 0,
        5: 2,
      },
    })
  })
})
