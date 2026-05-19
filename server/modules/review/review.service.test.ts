import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewStatus } from '#generated/client/enums.ts'
import type { IReviewRepository, ProductReview, ReviewOrderItem } from './review.repository.ts'
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
    images: ['https://example.com/review.jpg'],
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
    ...overrides,
  } as ProductReview
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
    vi.mocked(repo.createReview).mockResolvedValue(createReview())
    vi.clearAllMocks()
  })

  it('lets buyer review delivered own order item', async () => {
    const result = await service.createReview({ id: 'buyer-1', role: 'USER' }, {
      orderItemId: 'item-1',
      rating: 5,
      comment: ' Great fit ',
      images: [' https://example.com/review.jpg '],
    })

    expect(repo.createReview).toHaveBeenCalledWith({
      userId: 'buyer-1',
      productId: 'product-1',
      orderItemId: 'item-1',
      rating: 5,
      body: 'Great fit',
      images: ['https://example.com/review.jpg'],
    })
    expect(result).toMatchObject({
      id: 'review-1',
      rating: 5,
      comment: 'Great fit',
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

  it('lets buyer update and delete own review only', async () => {
    vi.mocked(repo.findReviewById).mockResolvedValue(createReview())
    vi.mocked(repo.updateReview).mockResolvedValue(createReview({ rating: 4, body: 'Updated' }))
    vi.mocked(repo.deleteReview).mockResolvedValue(createReview())

    const updated = await service.updateReview({ id: 'buyer-1', role: 'USER' }, 'review-1', {
      rating: 4,
      comment: 'Updated',
    })
    expect(repo.updateReview).toHaveBeenCalledWith('review-1', { rating: 4, body: 'Updated' })
    expect(updated.rating).toBe(4)

    await expect(service.updateReview({ id: 'other-buyer', role: 'USER' }, 'review-1', { rating: 4 }))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    await expect(service.deleteReview({ id: 'other-buyer', role: 'USER' }, 'review-1'))
      .rejects.toMatchObject({ code: 'REVIEW_FORBIDDEN' })

    await expect(service.deleteReview({ id: 'buyer-1', role: 'USER' }, 'review-1')).resolves.toEqual({ ok: true })
  })

  it('lists public product reviews and returns rating summary', async () => {
    vi.mocked(repo.listProductReviews).mockResolvedValue([createReview()])
    vi.mocked(repo.getRatingDistribution).mockResolvedValue([
      { rating: 5, _count: { rating: 2 } },
      { rating: 3, _count: { rating: 1 } },
    ])

    const reviews = await service.listProductReviews('product-1')
    expect(repo.findActiveProduct).toHaveBeenCalledWith('product-1')
    expect(reviews).toHaveLength(1)
    expect(reviews[0]!.userName).toBe('Jane Buyer')

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
