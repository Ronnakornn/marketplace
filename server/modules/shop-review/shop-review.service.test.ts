import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ActiveShopRecord,
  IShopReviewRepository,
  ShopOrderForRatingRecord,
  ShopReviewRecord,
} from './shop-review.repository.ts'
import { ShopReviewService } from './shop-review.service.ts'

function createAppContext() {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: { environment: 'test' },
  }
}

const now = new Date('2026-05-26T00:00:00.000Z')

function createShopOrder(overrides: Partial<ShopOrderForRatingRecord> = {}): ShopOrderForRatingRecord {
  return {
    id: 'shop-order-1',
    shopId: 'shop-1',
    status: 'DELIVERED',
    fulfillmentStatus: 'DELIVERED',
    order: {
      id: 'order-1',
      userId: 'buyer-1',
      status: 'DELIVERED',
      paymentStatus: 'SUCCEEDED',
    },
    shop: {
      id: 'shop-1',
      ownerId: 'seller-1',
      status: 'ACTIVE',
      name: 'Shop One',
      slug: 'shop-one',
    },
    ...overrides,
  }
}

function createShopReview(overrides: Partial<ShopReviewRecord> = {}): ShopReviewRecord {
  return {
    id: 'shop-review-1',
    shopId: 'shop-1',
    userId: 'buyer-1',
    shopOrderId: 'shop-order-1',
    rating: 5,
    body: 'Great service',
    status: 'PENDING',
    moderatedAt: null,
    moderatedById: null,
    moderationReason: null,
    createdAt: now,
    updatedAt: now,
    user: { id: 'buyer-1', name: 'Buyer One' },
    shop: { id: 'shop-1', name: 'Shop One', slug: 'shop-one', ownerId: 'seller-1', status: 'ACTIVE' },
    shopOrder: { id: 'shop-order-1', orderId: 'order-1', shopId: 'shop-1', status: 'DELIVERED', fulfillmentStatus: 'DELIVERED' },
    moderatedBy: null,
    ...overrides,
  } as ShopReviewRecord
}

function createRepo(): IShopReviewRepository {
  const activeShop: ActiveShopRecord = { id: 'shop-1', status: 'ACTIVE', name: 'Shop One', slug: 'shop-one' }

  return {
    findActiveShopById: vi.fn(async () => activeShop),
    findShopOrderForRating: vi.fn(async () => createShopOrder()),
    findShopRatingByUnique: vi.fn(async () => null),
    findShopRatingById: vi.fn(async () => createShopReview()),
    createShopRating: vi.fn(async () => createShopReview()),
    moderateShopRating: vi.fn(async () => createShopReview({
      status: 'PUBLISHED',
      moderatedAt: now,
      moderatedById: 'admin-1',
      moderationReason: null,
      moderatedBy: { id: 'admin-1', name: 'Admin One' },
    })),
    listPublishedShopRatings: vi.fn(async () => [createShopReview({ status: 'PUBLISHED' })]),
    listAdminShopRatings: vi.fn(async () => [createShopReview()]),
    getPublishedShopRatingDistribution: vi.fn(async () => [
      { rating: 5, _count: { rating: 2 } },
      { rating: 4, _count: { rating: 1 } },
    ]),
  }
}

describe('ShopReviewService', () => {
  let repo: IShopReviewRepository
  let service: ShopReviewService
  let cacheInvalidation: { invalidateSellerDashboard: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    repo = createRepo()
    cacheInvalidation = {
      invalidateSellerDashboard: vi.fn(async () => 1),
    }
    service = new ShopReviewService(createAppContext(), repo, cacheInvalidation as any)
  })

  it('creates pending shop review for eligible buyer', async () => {
    const result = await service.createShopReview({ id: 'buyer-1', role: 'USER' }, {
      shopOrderId: 'shop-order-1',
      rating: 5,
      comment: ' Great service ',
    })

    expect(repo.createShopRating).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'buyer-1',
      shopId: 'shop-1',
      shopOrderId: 'shop-order-1',
      rating: 5,
      body: 'Great service',
    }))
    expect(cacheInvalidation.invalidateSellerDashboard).toHaveBeenCalledWith('shop-1')
    expect(result.status).toBe('PENDING')
  })

  it('rejects duplicate or undelivered shop review creation', async () => {
    vi.mocked(repo.findShopRatingByUnique).mockResolvedValue({ id: 'existing' })

    await expect(service.createShopReview({ id: 'buyer-1', role: 'USER' }, {
      shopOrderId: 'shop-order-1',
      rating: 5,
    })).rejects.toMatchObject({ code: 'SHOP_REVIEW_ALREADY_EXISTS' })

    vi.mocked(repo.findShopRatingByUnique).mockResolvedValue(null)
    vi.mocked(repo.findShopOrderForRating).mockResolvedValue(createShopOrder({ fulfillmentStatus: 'SHIPPED' }))

    await expect(service.createShopReview({ id: 'buyer-1', role: 'USER' }, {
      shopOrderId: 'shop-order-1',
      rating: 5,
    })).rejects.toMatchObject({ code: 'SHOP_ORDER_NOT_DELIVERED' })
  })

  it('returns published shop reviews and summary for active shop only', async () => {
    const reviews = await service.listShopReviews('shop-1', 20)
    expect(reviews[0]!.status).toBe('PUBLISHED')

    const summary = await service.getShopRatingSummary('shop-1')
    expect(summary).toEqual({
      averageRating: 4.67,
      totalReviewCount: 3,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 1,
        5: 2,
      },
    })
  })

  it('allows admin moderation with decision mapping', async () => {
    const result = await service.moderateShopReview({ id: 'admin-1', role: 'ADMIN' }, 'shop-review-1', {
      decision: 'APPROVE',
    })

    expect(repo.moderateShopRating).toHaveBeenCalledWith('shop-review-1', expect.objectContaining({
      status: 'PUBLISHED',
      moderatedById: 'admin-1',
    }))
    expect(cacheInvalidation.invalidateSellerDashboard).toHaveBeenCalledWith('shop-1')
    expect(result.status).toBe('PUBLISHED')
  })

  it('requires reason for reject and hide moderation decisions', async () => {
    await expect(service.moderateShopReview({ id: 'admin-1', role: 'ADMIN' }, 'shop-review-1', {
      decision: 'REJECT',
    })).rejects.toMatchObject({ code: 'MODERATION_REASON_REQUIRED' })

    await expect(service.moderateShopReview({ id: 'admin-1', role: 'ADMIN' }, 'shop-review-1', {
      decision: 'HIDE',
      moderationReason: 'Policy violation',
    })).resolves.toMatchObject({ id: 'shop-review-1' })
  })
})
