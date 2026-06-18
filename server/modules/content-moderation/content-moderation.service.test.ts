import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { AuditLogService } from '#server/modules/audit-log'
import type {
  IContentModerationRepository,
  ModerationProductAnswerRecord,
  ModerationProductQuestionRecord,
  ModerationReviewRecord,
  ModerationReviewReportRecord,
  UpdateReviewReportStatusResult,
} from './content-moderation.repository.ts'
import { ContentModerationService } from './content-moderation.service.ts'

function createAppContext(): AppContext {
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

const now = new Date('2026-06-01T00:00:00.000Z')

function review(overrides: Partial<ModerationReviewRecord> = {}): ModerationReviewRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    productId: '33333333-3333-4333-8333-333333333333',
    orderItemId: '44444444-4444-4444-8444-444444444444',
    rating: 4,
    body: 'Good product',
    status: 'PENDING',
    moderatedAt: null,
    moderationReason: null,
    createdAt: now,
    updatedAt: now,
    user: { id: '22222222-2222-4222-8222-222222222222', name: 'Buyer', email: 'buyer@example.com' },
    product: {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Product',
      slug: 'product',
      status: 'ACTIVE',
      shopId: '55555555-5555-4555-8555-555555555555',
      shop: { id: '55555555-5555-4555-8555-555555555555', name: 'Shop', slug: 'shop', status: 'ACTIVE' },
    },
    orderItem: {
      id: '44444444-4444-4444-8444-444444444444',
      productTitle: 'Product',
      variantTitle: 'Default',
      shopName: 'Shop',
      shopSlug: 'shop',
    },
    _count: { reports: 1 },
    ...overrides,
  } as ModerationReviewRecord
}

function report(overrides: Partial<ModerationReviewReportRecord> = {}): ModerationReviewReportRecord {
  const targetReview = review({ status: 'PUBLISHED' })
  return {
    id: '66666666-6666-4666-8666-666666666666',
    reviewId: targetReview.id,
    shopRatingId: null,
    reportedById: '77777777-7777-4777-8777-777777777777',
    moderatedById: null,
    reason: 'SPAM',
    detail: 'Looks fake',
    status: 'OPEN',
    moderationNote: null,
    moderatedAt: null,
    createdAt: now,
    updatedAt: now,
    review: {
      id: targetReview.id,
      rating: targetReview.rating,
      body: targetReview.body,
      status: targetReview.status,
      productId: targetReview.productId,
      user: targetReview.user,
      product: targetReview.product,
    },
    reportedBy: { id: '77777777-7777-4777-8777-777777777777', name: 'Reporter', email: 'reporter@example.com' },
    moderatedBy: null,
    ...overrides,
  } as ModerationReviewReportRecord
}

function question(overrides: Partial<ModerationProductQuestionRecord> = {}): ModerationProductQuestionRecord {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    productId: '33333333-3333-4333-8333-333333333333',
    shopId: '55555555-5555-4555-8555-555555555555',
    userId: '22222222-2222-4222-8222-222222222222',
    question: 'Is this authentic?',
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    user: { id: '22222222-2222-4222-8222-222222222222', name: 'Buyer', email: 'buyer@example.com' },
    product: {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Product',
      slug: 'product',
      status: 'ACTIVE',
      shopId: '55555555-5555-4555-8555-555555555555',
      shop: { id: '55555555-5555-4555-8555-555555555555', name: 'Shop', slug: 'shop', status: 'ACTIVE' },
    },
    _count: { answers: 2 },
    ...overrides,
  } as ModerationProductQuestionRecord
}

function answer(overrides: Partial<ModerationProductAnswerRecord> = {}): ModerationProductAnswerRecord {
  const targetQuestion = question({ status: 'PUBLISHED' })
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    questionId: targetQuestion.id,
    userId: '99999999-9999-4999-8999-999999999999',
    answer: 'Yes, it is authentic.',
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    user: { id: '99999999-9999-4999-8999-999999999999', name: 'Seller', email: 'seller@example.com' },
    question: {
      id: targetQuestion.id,
      question: targetQuestion.question,
      status: targetQuestion.status,
      productId: targetQuestion.productId,
      shopId: targetQuestion.shopId,
      userId: targetQuestion.userId,
      user: targetQuestion.user,
      product: targetQuestion.product,
    },
    ...overrides,
  } as ModerationProductAnswerRecord
}

function createRepo(): IContentModerationRepository {
  return {
    listReviews: vi.fn().mockResolvedValue({ items: [review()], total: 1 }),
    findReviewById: vi.fn().mockResolvedValue(review()),
    updateReviewStatus: vi.fn(async (_reviewId, input) => review({
      status: input.status,
      moderationReason: input.note ?? null,
      moderatedAt: now,
    })),
    listReviewReports: vi.fn().mockResolvedValue({ items: [report()], total: 1 }),
    findReviewReportById: vi.fn().mockResolvedValue(report()),
    updateReviewReportStatus: vi.fn(async (_reportId, input): Promise<UpdateReviewReportStatusResult> => ({
      report: report({
        status: input.status,
        moderationNote: input.note ?? null,
        moderatedById: input.moderatorId,
        moderatedAt: now,
      }),
      reviewBeforeStatus: input.status === 'RESOLVED_REMOVED' ? 'PUBLISHED' : undefined,
      reviewAfterStatus: input.status === 'RESOLVED_REMOVED' ? 'HIDDEN' : undefined,
    })),
    listQuestions: vi.fn().mockResolvedValue({ items: [question()], total: 1 }),
    findQuestionById: vi.fn().mockResolvedValue(question()),
    updateQuestionStatus: vi.fn(async (_questionId, input) => question({ status: input.status })),
    listAnswers: vi.fn().mockResolvedValue({ items: [answer()], total: 1 }),
    findAnswerById: vi.fn().mockResolvedValue(answer()),
    updateAnswerStatus: vi.fn(async (_answerId, input) => answer({ status: input.status })),
  }
}

function createAuditLogService(): Pick<AuditLogService, 'createAuditLogBestEffort'> {
  return {
    createAuditLogBestEffort: vi.fn().mockResolvedValue(undefined),
  }
}

const admin = { id: '99999999-9999-4999-8999-999999999999', role: 'ADMIN' as const }
const buyer = { id: '22222222-2222-4222-8222-222222222222', role: 'USER' as const }

describe('ContentModerationService', () => {
  let repo: IContentModerationRepository
  let auditLogService: Pick<AuditLogService, 'createAuditLogBestEffort'>
  let service: ContentModerationService

  beforeEach(() => {
    vi.clearAllMocks()
    repo = createRepo()
    auditLogService = createAuditLogService()
    service = new ContentModerationService(createAppContext(), repo, auditLogService as AuditLogService)
  })

  it('lists reviews with filters and pagination context', async () => {
    const result = await service.listReviews(admin, { page: '2', limit: '5', status: 'PENDING', q: 'product' })

    expect(result.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 })
    expect(result.items[0]).toMatchObject({ id: '11111111-1111-4111-8111-111111111111', reportCount: 1 })
    expect(repo.listReviews).toHaveBeenCalledWith({ status: 'PENDING', q: 'product' }, { page: 2, limit: 5, q: 'product' })
  })

  it('lists review reports with filters and target review context', async () => {
    const result = await service.listReviewReports(admin, { status: 'OPEN' })

    expect(result.items[0]?.review).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      product: { id: '33333333-3333-4333-8333-333333333333' },
      shop: { id: '55555555-5555-4555-8555-555555555555' },
    })
    expect(repo.listReviewReports).toHaveBeenCalledWith({ status: 'OPEN', q: undefined }, { page: 1, limit: 20, q: undefined })
  })

  it('rejects non-admin moderation access', async () => {
    await expect(service.listReviews(buyer)).rejects.toMatchObject({ code: 'CONTENT_MODERATION_FORBIDDEN' })
  })

  it('updates review status for a valid transition and writes audit log', async () => {
    const result = await service.updateReviewStatus(admin, '11111111-1111-4111-8111-111111111111', { status: 'PUBLISHED' })

    expect(result.status).toBe('PUBLISHED')
    expect(repo.updateReviewStatus).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
      status: 'PUBLISHED',
      note: null,
    })
    expect(auditLogService.createAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'REVIEW_STATUS_CHANGED',
      entityType: 'Review',
      before: { status: 'PENDING' },
      after: { status: 'PUBLISHED' },
      nonCritical: true,
    }))
  })

  it('requires a note when rejecting a pending review', async () => {
    await expect(service.updateReviewStatus(admin, '11111111-1111-4111-8111-111111111111', { status: 'REJECTED' }))
      .rejects.toMatchObject({ code: 'REVIEW_MODERATION_NOTE_REQUIRED' })
    expect(repo.updateReviewStatus).not.toHaveBeenCalled()
  })

  it('rejects invalid review status transitions', async () => {
    vi.mocked(repo.findReviewById).mockResolvedValueOnce(review({ status: 'PUBLISHED' }))

    await expect(service.updateReviewStatus(admin, '11111111-1111-4111-8111-111111111111', { status: 'REJECTED', note: 'bad' }))
      .rejects.toMatchObject({ code: 'INVALID_REVIEW_STATUS_TRANSITION' })
  })

  it('resolves a review report as removed and includes review hide side effect in audit metadata', async () => {
    const result = await service.updateReviewReportStatus(admin, '66666666-6666-4666-8666-666666666666', {
      status: 'RESOLVED_REMOVED',
      note: 'Policy violation',
    })

    expect(result.status).toBe('RESOLVED_REMOVED')
    expect(repo.updateReviewReportStatus).toHaveBeenCalledWith('66666666-6666-4666-8666-666666666666', {
      status: 'RESOLVED_REMOVED',
      moderatorId: admin.id,
      note: 'Policy violation',
    })
    expect(auditLogService.createAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'REVIEW_REPORT_STATUS_CHANGED',
      metadata: expect.objectContaining({
        reviewId: '11111111-1111-4111-8111-111111111111',
        reviewStatusBefore: 'PUBLISHED',
        reviewStatusAfter: 'HIDDEN',
      }),
    }))
  })

  it('requires a note when dismissing a review report', async () => {
    await expect(service.updateReviewReportStatus(admin, '66666666-6666-4666-8666-666666666666', { status: 'RESOLVED_DISMISSED' }))
      .rejects.toMatchObject({ code: 'REVIEW_REPORT_MODERATION_NOTE_REQUIRED' })
  })

  it('rejects invalid review report status transitions', async () => {
    vi.mocked(repo.findReviewReportById).mockResolvedValueOnce(report({ status: 'RESOLVED_REMOVED' }))

    await expect(service.updateReviewReportStatus(admin, '66666666-6666-4666-8666-666666666666', { status: 'UNDER_REVIEW' }))
      .rejects.toMatchObject({ code: 'INVALID_REVIEW_REPORT_STATUS_TRANSITION' })
  })

  it('lists product questions with filters and product/shop/user context', async () => {
    const result = await service.listQuestions(admin, { page: '1', limit: '10', status: 'PENDING', q: 'authentic' })

    expect(result.items[0]).toMatchObject({
      id: '88888888-8888-4888-8888-888888888888',
      answerCount: 2,
      product: { id: '33333333-3333-4333-8333-333333333333' },
      shop: { id: '55555555-5555-4555-8555-555555555555' },
      user: { id: '22222222-2222-4222-8222-222222222222' },
    })
    expect(repo.listQuestions).toHaveBeenCalledWith({ status: 'PENDING', q: 'authentic' }, { page: 1, limit: 10, q: 'authentic' })
  })

  it('lists product answers with filters and question/product/shop/user context', async () => {
    const result = await service.listAnswers(admin, { status: 'PENDING' })

    expect(result.items[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      question: {
        id: '88888888-8888-4888-8888-888888888888',
        product: { id: '33333333-3333-4333-8333-333333333333' },
        shop: { id: '55555555-5555-4555-8555-555555555555' },
        user: { id: '22222222-2222-4222-8222-222222222222' },
      },
    })
    expect(repo.listAnswers).toHaveBeenCalledWith({ status: 'PENDING', q: undefined }, { page: 1, limit: 20, q: undefined })
  })

  it('updates question status for a valid transition and writes audit log', async () => {
    const result = await service.updateQuestionStatus(admin, '88888888-8888-4888-8888-888888888888', { status: 'PUBLISHED' })

    expect(result.status).toBe('PUBLISHED')
    expect(repo.updateQuestionStatus).toHaveBeenCalledWith('88888888-8888-4888-8888-888888888888', { status: 'PUBLISHED' })
    expect(auditLogService.createAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PRODUCT_QUESTION_STATUS_CHANGED',
      entityType: 'ProductQuestion',
      before: { status: 'PENDING' },
      after: { status: 'PUBLISHED' },
      nonCritical: true,
    }))
  })

  it('requires a note when hiding a product question', async () => {
    await expect(service.updateQuestionStatus(admin, '88888888-8888-4888-8888-888888888888', { status: 'HIDDEN' }))
      .rejects.toMatchObject({ code: 'PRODUCT_QUESTION_MODERATION_NOTE_REQUIRED' })
    expect(repo.updateQuestionStatus).not.toHaveBeenCalled()
  })

  it('rejects invalid product question transitions', async () => {
    vi.mocked(repo.findQuestionById).mockResolvedValueOnce(question({ status: 'PUBLISHED' }))

    await expect(service.updateQuestionStatus(admin, '88888888-8888-4888-8888-888888888888', { status: 'REJECTED', note: 'bad' }))
      .rejects.toMatchObject({ code: 'INVALID_PRODUCT_QUESTION_STATUS_TRANSITION' })
  })

  it('updates answer status for a valid transition and writes audit log', async () => {
    const result = await service.updateAnswerStatus(admin, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { status: 'PUBLISHED' })

    expect(result.status).toBe('PUBLISHED')
    expect(repo.updateAnswerStatus).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { status: 'PUBLISHED' })
    expect(auditLogService.createAuditLogBestEffort).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PRODUCT_ANSWER_STATUS_CHANGED',
      entityType: 'ProductAnswer',
      before: { status: 'PENDING' },
      after: { status: 'PUBLISHED' },
      metadata: expect.objectContaining({
        questionId: '88888888-8888-4888-8888-888888888888',
        productId: '33333333-3333-4333-8333-333333333333',
        shopId: '55555555-5555-4555-8555-555555555555',
      }),
    }))
  })

  it('requires a note when hiding a product answer', async () => {
    await expect(service.updateAnswerStatus(admin, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { status: 'HIDDEN' }))
      .rejects.toMatchObject({ code: 'PRODUCT_ANSWER_MODERATION_NOTE_REQUIRED' })
    expect(repo.updateAnswerStatus).not.toHaveBeenCalled()
  })

  it('rejects invalid product answer transitions', async () => {
    vi.mocked(repo.findAnswerById).mockResolvedValueOnce(answer({ status: 'PUBLISHED' }))

    await expect(service.updateAnswerStatus(admin, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { status: 'REJECTED', note: 'bad' }))
      .rejects.toMatchObject({ code: 'INVALID_PRODUCT_ANSWER_STATUS_TRANSITION' })
  })

  it('does not fail moderation when best-effort audit logging fails', async () => {
    vi.mocked(auditLogService.createAuditLogBestEffort).mockRejectedValueOnce(new Error('audit unavailable'))

    await expect(service.updateReviewStatus(admin, '11111111-1111-4111-8111-111111111111', { status: 'PUBLISHED' }))
      .resolves.toMatchObject({ status: 'PUBLISHED' })
  })
})
