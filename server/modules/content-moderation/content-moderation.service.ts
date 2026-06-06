import type { ProductAnswerStatus, ProductQuestionStatus, ReviewReportStatus, ReviewStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AuditLogService } from '#server/modules/audit-log'
import { ContentModerationServiceError } from './content-moderation.errors.ts'
import type {
  ContentModerationListFilters,
  IContentModerationRepository,
  ModerationProductAnswerRecord,
  ModerationProductQuestionRecord,
  ModerationReviewRecord,
  ModerationReviewReportRecord,
} from './content-moderation.repository.ts'

const reviewStatuses = ['PENDING', 'PUBLISHED', 'REJECTED', 'HIDDEN'] as const satisfies readonly ReviewStatus[]
const reviewReportStatuses = ['OPEN', 'UNDER_REVIEW', 'RESOLVED_REMOVED', 'RESOLVED_DISMISSED', 'RESOLVED_HIDDEN'] as const satisfies readonly ReviewReportStatus[]
const productQuestionStatuses = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'] as const satisfies readonly ProductQuestionStatus[]
const productAnswerStatuses = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'] as const satisfies readonly ProductAnswerStatus[]

const reviewTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  PENDING: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['HIDDEN'],
  HIDDEN: ['PUBLISHED'],
  REJECTED: ['PUBLISHED'],
}

const reviewReportTransitions: Record<ReviewReportStatus, readonly ReviewReportStatus[]> = {
  OPEN: ['UNDER_REVIEW', 'RESOLVED_REMOVED', 'RESOLVED_DISMISSED'],
  UNDER_REVIEW: ['RESOLVED_REMOVED', 'RESOLVED_DISMISSED'],
  RESOLVED_REMOVED: [],
  RESOLVED_DISMISSED: [],
  RESOLVED_HIDDEN: [],
}

const productQuestionTransitions: Record<ProductQuestionStatus, readonly ProductQuestionStatus[]> = {
  PENDING: ['PUBLISHED', 'HIDDEN'],
  PUBLISHED: ['HIDDEN'],
  HIDDEN: ['PUBLISHED'],
  REJECTED: ['PUBLISHED'],
}

const productAnswerTransitions: Record<ProductAnswerStatus, readonly ProductAnswerStatus[]> = {
  PENDING: ['PUBLISHED', 'HIDDEN'],
  PUBLISHED: ['HIDDEN'],
  HIDDEN: ['PUBLISHED'],
  REJECTED: ['PUBLISHED'],
}

export interface ContentModerationActor {
  id: string
  role: Role
}

export interface ContentModerationQueryInput {
  page?: number | string
  limit?: number | string
  status?: string
  q?: string
}

export interface ContentModerationStatusInput {
  status: string
  note?: string
}

export interface ContentModerationListResponse<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ModerationReviewResponse {
  id: string
  status: ReviewStatus
  rating: number
  body: string | null
  moderationReason: string | null
  moderatedAt: Date | null
  reportCount: number
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; email: string }
  product: { id: string; title: string; slug: string; status: string }
  shop: { id: string; name: string; slug: string; status: string }
  orderItem: { id: string; productTitle: string; variantTitle: string; shopName: string; shopSlug: string }
}

export interface ModerationReviewReportResponse {
  id: string
  status: ReviewReportStatus
  reason: string
  detail: string | null
  moderationNote: string | null
  moderatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  reportedBy: { id: string; name: string; email: string }
  moderatedBy: { id: string; name: string; email: string } | null
  review: {
    id: string
    status: ReviewStatus
    rating: number
    body: string | null
    user: { id: string; name: string; email: string }
    product: { id: string; title: string; slug: string; status: string }
    shop: { id: string; name: string; slug: string; status: string }
  } | null
}

export interface ModerationProductQuestionResponse {
  id: string
  productId: string
  shopId: string
  userId: string
  question: string
  status: ProductQuestionStatus
  answerCount: number
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; email: string }
  product: { id: string; title: string; slug: string; status: string }
  shop: { id: string; name: string; slug: string; status: string }
}

export interface ModerationProductAnswerResponse {
  id: string
  questionId: string
  userId: string
  answer: string
  status: ProductAnswerStatus
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; email: string }
  question: {
    id: string
    question: string
    status: ProductQuestionStatus
    user: { id: string; name: string; email: string }
    product: { id: string; title: string; slug: string; status: string }
    shop: { id: string; name: string; slug: string; status: string }
  }
}

export class ContentModerationService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IContentModerationRepository,
    private auditLogService?: AuditLogService,
  ) {
    this.logger = appContext.logger
  }

  async listReviews(
    actor: ContentModerationActor,
    input: ContentModerationQueryInput = {},
  ): Promise<ContentModerationListResponse<ModerationReviewResponse>> {
    this.logger.debug('ContentModerationService.listReviews', { actorId: actor.id })
    this.assertAdmin(actor)
    const query = this.normalizeQuery(input)
    const filters: ContentModerationListFilters<ReviewStatus> = {
      status: input.status === undefined ? undefined : this.parseReviewStatus(input.status),
      q: query.q,
    }
    const result = await this.repo.listReviews(filters, query)
    return this.toListResponse(result.items.map((item) => this.toReviewResponse(item)), result.total, query)
  }

  async listReviewReports(
    actor: ContentModerationActor,
    input: ContentModerationQueryInput = {},
  ): Promise<ContentModerationListResponse<ModerationReviewReportResponse>> {
    this.logger.debug('ContentModerationService.listReviewReports', { actorId: actor.id })
    this.assertAdmin(actor)
    const query = this.normalizeQuery(input)
    const filters: ContentModerationListFilters<ReviewReportStatus> = {
      status: input.status === undefined ? undefined : this.parseReviewReportStatus(input.status),
      q: query.q,
    }
    const result = await this.repo.listReviewReports(filters, query)
    return this.toListResponse(result.items.map((item) => this.toReviewReportResponse(item)), result.total, query)
  }

  async listQuestions(
    actor: ContentModerationActor,
    input: ContentModerationQueryInput = {},
  ): Promise<ContentModerationListResponse<ModerationProductQuestionResponse>> {
    this.logger.debug('ContentModerationService.listQuestions', { actorId: actor.id })
    this.assertAdmin(actor)
    const query = this.normalizeQuery(input)
    const filters: ContentModerationListFilters<ProductQuestionStatus> = {
      status: input.status === undefined ? undefined : this.parseProductQuestionStatus(input.status),
      q: query.q,
    }
    const result = await this.repo.listQuestions(filters, query)
    return this.toListResponse(result.items.map((item) => this.toProductQuestionResponse(item)), result.total, query)
  }

  async listAnswers(
    actor: ContentModerationActor,
    input: ContentModerationQueryInput = {},
  ): Promise<ContentModerationListResponse<ModerationProductAnswerResponse>> {
    this.logger.debug('ContentModerationService.listAnswers', { actorId: actor.id })
    this.assertAdmin(actor)
    const query = this.normalizeQuery(input)
    const filters: ContentModerationListFilters<ProductAnswerStatus> = {
      status: input.status === undefined ? undefined : this.parseProductAnswerStatus(input.status),
      q: query.q,
    }
    const result = await this.repo.listAnswers(filters, query)
    return this.toListResponse(result.items.map((item) => this.toProductAnswerResponse(item)), result.total, query)
  }

  async updateReviewStatus(
    actor: ContentModerationActor,
    reviewId: string,
    input: ContentModerationStatusInput,
  ): Promise<ModerationReviewResponse> {
    this.logger.info('ContentModerationService.updateReviewStatus', { actorId: actor.id, reviewId })
    this.assertAdmin(actor)
    const status = this.parseReviewStatus(input.status)
    const note = this.normalizeNote(input.note)
    const review = await this.repo.findReviewById(reviewId)
    if (!review) throw new ContentModerationServiceError('Review not found', 404, 'REVIEW_NOT_FOUND')
    this.assertReviewTransition(review.status, status)
    this.assertReviewNote(review.status, status, note)

    const updated = await this.repo.updateReviewStatus(review.id, { status, note })
    await this.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'REVIEW_STATUS_CHANGED',
      entityType: 'Review',
      entityId: review.id,
      before: { status: review.status },
      after: { status: updated.status },
      metadata: {
        note,
        productId: review.productId,
        shopId: review.product.shopId,
        userId: review.userId,
      },
      nonCritical: true,
    })
    return this.toReviewResponse(updated)
  }

  async updateReviewReportStatus(
    actor: ContentModerationActor,
    reportId: string,
    input: ContentModerationStatusInput,
  ): Promise<ModerationReviewReportResponse> {
    this.logger.info('ContentModerationService.updateReviewReportStatus', { actorId: actor.id, reportId })
    this.assertAdmin(actor)
    const status = this.parseReviewReportStatus(input.status)
    const note = this.normalizeNote(input.note)
    const report = await this.repo.findReviewReportById(reportId)
    if (!report) throw new ContentModerationServiceError('Review report not found', 404, 'REVIEW_REPORT_NOT_FOUND')
    this.assertReviewReportTransition(report.status, status)
    this.assertReviewReportNote(status, note)

    const result = await this.repo.updateReviewReportStatus(report.id, { status, moderatorId: actor.id, note })
    await this.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'REVIEW_REPORT_STATUS_CHANGED',
      entityType: 'ReviewReport',
      entityId: report.id,
      before: { status: report.status },
      after: { status: result.report.status },
      metadata: {
        note,
        reviewId: report.reviewId,
        shopRatingId: report.shopRatingId,
        reason: report.reason,
        reviewStatusBefore: result.reviewBeforeStatus,
        reviewStatusAfter: result.reviewAfterStatus,
      },
      nonCritical: true,
    })
    return this.toReviewReportResponse(result.report)
  }

  async updateQuestionStatus(
    actor: ContentModerationActor,
    questionId: string,
    input: ContentModerationStatusInput,
  ): Promise<ModerationProductQuestionResponse> {
    this.logger.info('ContentModerationService.updateQuestionStatus', { actorId: actor.id, questionId })
    this.assertAdmin(actor)
    const status = this.parseProductQuestionStatus(input.status)
    const note = this.normalizeNote(input.note)
    const question = await this.repo.findQuestionById(questionId)
    if (!question) throw new ContentModerationServiceError('Product question not found', 404, 'PRODUCT_QUESTION_NOT_FOUND')
    this.assertProductQuestionTransition(question.status, status)
    this.assertProductQuestionNote(status, note)

    const updated = await this.repo.updateQuestionStatus(question.id, { status })
    await this.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'PRODUCT_QUESTION_STATUS_CHANGED',
      entityType: 'ProductQuestion',
      entityId: question.id,
      before: { status: question.status },
      after: { status: updated.status },
      metadata: {
        note,
        productId: question.productId,
        shopId: question.shopId,
        userId: question.userId,
      },
      nonCritical: true,
    })
    return this.toProductQuestionResponse(updated)
  }

  async updateAnswerStatus(
    actor: ContentModerationActor,
    answerId: string,
    input: ContentModerationStatusInput,
  ): Promise<ModerationProductAnswerResponse> {
    this.logger.info('ContentModerationService.updateAnswerStatus', { actorId: actor.id, answerId })
    this.assertAdmin(actor)
    const status = this.parseProductAnswerStatus(input.status)
    const note = this.normalizeNote(input.note)
    const answer = await this.repo.findAnswerById(answerId)
    if (!answer) throw new ContentModerationServiceError('Product answer not found', 404, 'PRODUCT_ANSWER_NOT_FOUND')
    this.assertProductAnswerTransition(answer.status, status)
    this.assertProductAnswerNote(status, note)

    const updated = await this.repo.updateAnswerStatus(answer.id, { status })
    await this.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'PRODUCT_ANSWER_STATUS_CHANGED',
      entityType: 'ProductAnswer',
      entityId: answer.id,
      before: { status: answer.status },
      after: { status: updated.status },
      metadata: {
        note,
        questionId: answer.questionId,
        productId: answer.question.productId,
        shopId: answer.question.shopId,
        userId: answer.userId,
        questionUserId: answer.question.userId,
      },
      nonCritical: true,
    })
    return this.toProductAnswerResponse(updated)
  }

  private assertAdmin(actor: ContentModerationActor): void {
    if (actor.role !== 'ADMIN') {
      throw new ContentModerationServiceError('Content moderation requires admin role', 403, 'CONTENT_MODERATION_FORBIDDEN')
    }
  }

  private async createAuditLogBestEffort(input: Parameters<AuditLogService['createAuditLogBestEffort']>[0]): Promise<void> {
    try {
      await this.auditLogService?.createAuditLogBestEffort(input)
    } catch (error) {
      this.logger.warn('Content moderation audit logging failed', {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private normalizeQuery(input: ContentModerationQueryInput): { page: number; limit: number; q?: string } {
    const page = Number(input.page ?? 1)
    const requestedLimit = Number(input.limit ?? 20)
    const limit = Math.min(requestedLimit, 100)
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
      throw new ContentModerationServiceError('Invalid moderation pagination filter', 400, 'INVALID_MODERATION_FILTER')
    }
    const q = input.q?.trim()
    return { page, limit, q: q ? q : undefined }
  }

  private parseReviewStatus(status: string): ReviewStatus {
    if (!reviewStatuses.includes(status as ReviewStatus)) {
      throw new ContentModerationServiceError('Invalid review status', 400, 'INVALID_REVIEW_STATUS')
    }
    return status as ReviewStatus
  }

  private parseReviewReportStatus(status: string): ReviewReportStatus {
    if (!reviewReportStatuses.includes(status as ReviewReportStatus)) {
      throw new ContentModerationServiceError('Invalid review report status', 400, 'INVALID_REVIEW_REPORT_STATUS')
    }
    return status as ReviewReportStatus
  }

  private parseProductQuestionStatus(status: string): ProductQuestionStatus {
    if (!productQuestionStatuses.includes(status as ProductQuestionStatus)) {
      throw new ContentModerationServiceError('Invalid product question status', 400, 'INVALID_PRODUCT_QUESTION_STATUS')
    }
    return status as ProductQuestionStatus
  }

  private parseProductAnswerStatus(status: string): ProductAnswerStatus {
    if (!productAnswerStatuses.includes(status as ProductAnswerStatus)) {
      throw new ContentModerationServiceError('Invalid product answer status', 400, 'INVALID_PRODUCT_ANSWER_STATUS')
    }
    return status as ProductAnswerStatus
  }

  private normalizeNote(note: string | undefined): string | null {
    const trimmed = note?.trim()
    return trimmed ? trimmed : null
  }

  private assertReviewTransition(from: ReviewStatus, to: ReviewStatus): void {
    if (!reviewTransitions[from].includes(to)) {
      throw new ContentModerationServiceError('Invalid review status transition', 400, 'INVALID_REVIEW_STATUS_TRANSITION', {
        from,
        to,
      })
    }
  }

  private assertReviewReportTransition(from: ReviewReportStatus, to: ReviewReportStatus): void {
    if (!reviewReportTransitions[from].includes(to)) {
      throw new ContentModerationServiceError('Invalid review report status transition', 400, 'INVALID_REVIEW_REPORT_STATUS_TRANSITION', {
        from,
        to,
      })
    }
  }

  private assertProductQuestionTransition(from: ProductQuestionStatus, to: ProductQuestionStatus): void {
    if (!productQuestionTransitions[from].includes(to)) {
      throw new ContentModerationServiceError('Invalid product question status transition', 400, 'INVALID_PRODUCT_QUESTION_STATUS_TRANSITION', {
        from,
        to,
      })
    }
  }

  private assertProductAnswerTransition(from: ProductAnswerStatus, to: ProductAnswerStatus): void {
    if (!productAnswerTransitions[from].includes(to)) {
      throw new ContentModerationServiceError('Invalid product answer status transition', 400, 'INVALID_PRODUCT_ANSWER_STATUS_TRANSITION', {
        from,
        to,
      })
    }
  }

  private assertReviewNote(from: ReviewStatus, to: ReviewStatus, note: string | null): void {
    if ((from === 'PENDING' && to === 'REJECTED') || (from === 'PUBLISHED' && to === 'HIDDEN')) {
      this.assertNote(note, 'Moderation note is required for this review status change', 'REVIEW_MODERATION_NOTE_REQUIRED')
    }
  }

  private assertReviewReportNote(to: ReviewReportStatus, note: string | null): void {
    if (to === 'RESOLVED_DISMISSED') {
      this.assertNote(note, 'Moderation note is required when dismissing a review report', 'REVIEW_REPORT_MODERATION_NOTE_REQUIRED')
    }
  }

  private assertProductQuestionNote(to: ProductQuestionStatus, note: string | null): void {
    if (to === 'HIDDEN') {
      this.assertNote(note, 'Moderation note is required when hiding a product question', 'PRODUCT_QUESTION_MODERATION_NOTE_REQUIRED')
    }
  }

  private assertProductAnswerNote(to: ProductAnswerStatus, note: string | null): void {
    if (to === 'HIDDEN') {
      this.assertNote(note, 'Moderation note is required when hiding a product answer', 'PRODUCT_ANSWER_MODERATION_NOTE_REQUIRED')
    }
  }

  private assertNote(note: string | null, message: string, code: string): void {
    if (!note) throw new ContentModerationServiceError(message, 400, code)
  }

  private toListResponse<T>(items: T[], total: number, query: { page: number; limit: number }): ContentModerationListResponse<T> {
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    }
  }

  private toReviewResponse(review: ModerationReviewRecord): ModerationReviewResponse {
    return {
      id: review.id,
      status: review.status,
      rating: review.rating,
      body: review.body,
      moderationReason: review.moderationReason,
      moderatedAt: review.moderatedAt,
      reportCount: review._count.reports,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: review.user,
      product: {
        id: review.product.id,
        title: review.product.title,
        slug: review.product.slug,
        status: review.product.status,
      },
      shop: review.product.shop,
      orderItem: review.orderItem,
    }
  }

  private toReviewReportResponse(report: ModerationReviewReportRecord): ModerationReviewReportResponse {
    return {
      id: report.id,
      status: report.status,
      reason: report.reason,
      detail: report.detail,
      moderationNote: report.moderationNote,
      moderatedAt: report.moderatedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      reportedBy: report.reportedBy,
      moderatedBy: report.moderatedBy,
      review: report.review
        ? {
            id: report.review.id,
            status: report.review.status,
            rating: report.review.rating,
            body: report.review.body,
            user: report.review.user,
            product: {
              id: report.review.product.id,
              title: report.review.product.title,
              slug: report.review.product.slug,
              status: report.review.product.status,
            },
            shop: report.review.product.shop,
          }
        : null,
    }
  }

  private toProductQuestionResponse(question: ModerationProductQuestionRecord): ModerationProductQuestionResponse {
    return {
      id: question.id,
      productId: question.productId,
      shopId: question.shopId,
      userId: question.userId,
      question: question.question,
      status: question.status,
      answerCount: question._count.answers,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
      user: question.user,
      product: {
        id: question.product.id,
        title: question.product.title,
        slug: question.product.slug,
        status: question.product.status,
      },
      shop: question.product.shop,
    }
  }

  private toProductAnswerResponse(answer: ModerationProductAnswerRecord): ModerationProductAnswerResponse {
    return {
      id: answer.id,
      questionId: answer.questionId,
      userId: answer.userId,
      answer: answer.answer,
      status: answer.status,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
      user: answer.user,
      question: {
        id: answer.question.id,
        question: answer.question.question,
        status: answer.question.status,
        user: answer.question.user,
        product: {
          id: answer.question.product.id,
          title: answer.question.product.title,
          slug: answer.question.product.slug,
          status: answer.question.product.status,
        },
        shop: answer.question.product.shop,
      },
    }
  }
}
