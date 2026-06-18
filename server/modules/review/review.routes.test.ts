import { Elysia } from 'elysia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthContext } from '#server/modules/auth/auth.context.ts'
import { createReviewRoutes } from './review.routes.ts'

vi.mock('#server/modules/auth/auth.ts', () => ({
  auth: {
    handler: () => new Response(null, { status: 404 }),
  },
}))

vi.mock('#server/modules/auth/auth.context.ts', () => ({
  getAuthContext: vi.fn(),
}))

function createContainer() {
  return {
    reviewService: {
      listProductReviews: vi.fn().mockResolvedValue([]),
      getRatingSummary: vi.fn().mockResolvedValue({
        averageRating: 0,
        totalReviewCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }),
      createReview: vi.fn().mockResolvedValue({ id: 'review-1' }),
      updateReview: vi.fn().mockResolvedValue({ id: 'review-1' }),
      deleteReview: vi.fn().mockResolvedValue({ ok: true }),
    },
  } as any
}

function createApp(container = createContainer()) {
  return new Elysia().use(createReviewRoutes(container))
}

function mockAuth() {
  vi.mocked(getAuthContext).mockResolvedValue({
    user: {
      id: 'buyer-1',
      email: 'buyer@example.com',
      name: 'Buyer',
      role: 'USER',
      status: 'ACTIVE',
    },
  } as any)
}

describe('review routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows public product review listing with default query shape', async () => {
    const container = createContainer()
    const response = await createApp(container).handle(
      new Request('http://localhost/api/products/11111111-1111-4111-8111-111111111111/reviews'),
    )

    expect(response.status).toBe(200)
    expect(container.reviewService.listProductReviews)
      .toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {})
  })

  it('passes public product review discovery query controls to the service', async () => {
    const container = createContainer()
    const response = await createApp(container).handle(
      new Request('http://localhost/api/products/11111111-1111-4111-8111-111111111111/reviews?rating=5&hasMedia=true&hasComment=true&sort=rating_desc&page=2&limit=10'),
    )

    expect(response.status).toBe(200)
    expect(container.reviewService.listProductReviews)
      .toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        rating: 5,
        hasMedia: true,
        hasComment: true,
        sort: 'rating_desc',
        page: 2,
        limit: 10,
      })
  })

  it('rejects invalid public product review discovery query controls', async () => {
    const response = await createApp().handle(
      new Request('http://localhost/api/products/11111111-1111-4111-8111-111111111111/reviews?rating=6&sort=unknown&limit=30'),
    )

    expect(response.status).toBe(422)
  })

  it('passes review create uploadIds to the service', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderItemId: '11111111-1111-4111-8111-111111111111',
        rating: 5,
        comment: 'Great',
        uploadIds: ['22222222-2222-4222-8222-222222222222'],
      }),
    }))

    expect(response.status).toBe(200)
    expect(container.reviewService.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'buyer-1' }),
      {
        orderItemId: '11111111-1111-4111-8111-111111111111',
        rating: 5,
        comment: 'Great',
        uploadIds: ['22222222-2222-4222-8222-222222222222'],
      },
    )
  })

  it('passes review update uploadIds to the service', async () => {
    mockAuth()
    const container = createContainer()
    const response = await createApp(container).handle(new Request('http://localhost/api/reviews/33333333-3333-4333-8333-333333333333', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        uploadIds: ['22222222-2222-4222-8222-222222222222'],
      }),
    }))

    expect(response.status).toBe(200)
    expect(container.reviewService.updateReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'buyer-1' }),
      '33333333-3333-4333-8333-333333333333',
      {
        uploadIds: ['22222222-2222-4222-8222-222222222222'],
      },
    )
  })
})
