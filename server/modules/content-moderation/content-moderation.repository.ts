import type {
  OrderItem,
  Prisma,
  PrismaClient,
  Product,
  ProductAnswer,
  ProductQuestion,
  Review,
  ReviewReport,
  Shop,
  User,
} from '#generated/client/client.ts'
import type { ProductAnswerStatus, ProductQuestionStatus, ReviewReportStatus, ReviewStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface ContentModerationPaginationInput {
  page: number
  limit: number
}

export interface ContentModerationPaginatedResult<T> {
  items: T[]
  total: number
}

export interface ContentModerationListFilters<TStatus extends string> {
  status?: TStatus
  q?: string
}

export type ModerationReviewRecord = Review & {
  user: Pick<User, 'id' | 'name' | 'email'>
  product: Pick<Product, 'id' | 'title' | 'slug' | 'status' | 'shopId'> & {
    shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  }
  orderItem: Pick<OrderItem, 'id' | 'productTitle' | 'variantTitle' | 'shopName' | 'shopSlug'>
  _count: {
    reports: number
  }
}

export type ModerationReviewReportRecord = ReviewReport & {
  review: (Pick<Review, 'id' | 'rating' | 'body' | 'status' | 'productId'> & {
    user: Pick<User, 'id' | 'name' | 'email'>
    product: Pick<Product, 'id' | 'title' | 'slug' | 'status' | 'shopId'> & {
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
    }
  }) | null
  reportedBy: Pick<User, 'id' | 'name' | 'email'>
  moderatedBy: Pick<User, 'id' | 'name' | 'email'> | null
}

export type ModerationProductQuestionRecord = ProductQuestion & {
  user: Pick<User, 'id' | 'name' | 'email'>
  product: Pick<Product, 'id' | 'title' | 'slug' | 'status' | 'shopId'> & {
    shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  }
  _count: {
    answers: number
  }
}

export type ModerationProductAnswerRecord = ProductAnswer & {
  user: Pick<User, 'id' | 'name' | 'email'>
  question: Pick<ProductQuestion, 'id' | 'question' | 'status' | 'productId' | 'shopId' | 'userId'> & {
    user: Pick<User, 'id' | 'name' | 'email'>
    product: Pick<Product, 'id' | 'title' | 'slug' | 'status' | 'shopId'> & {
      shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
    }
  }
}

export interface UpdateReviewReportStatusResult {
  report: ModerationReviewReportRecord
  reviewBeforeStatus?: ReviewStatus
  reviewAfterStatus?: ReviewStatus
}

export interface IContentModerationRepository {
  listReviews(
    filters: ContentModerationListFilters<ReviewStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationReviewRecord>>
  findReviewById(reviewId: string): Promise<ModerationReviewRecord | null>
  updateReviewStatus(reviewId: string, input: { status: ReviewStatus; note?: string | null }): Promise<ModerationReviewRecord>
  listReviewReports(
    filters: ContentModerationListFilters<ReviewReportStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationReviewReportRecord>>
  findReviewReportById(reportId: string): Promise<ModerationReviewReportRecord | null>
  updateReviewReportStatus(
    reportId: string,
    input: { status: ReviewReportStatus; moderatorId: string; note?: string | null },
  ): Promise<UpdateReviewReportStatusResult>
  listQuestions(
    filters: ContentModerationListFilters<ProductQuestionStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationProductQuestionRecord>>
  findQuestionById(questionId: string): Promise<ModerationProductQuestionRecord | null>
  updateQuestionStatus(questionId: string, input: { status: ProductQuestionStatus }): Promise<ModerationProductQuestionRecord>
  listAnswers(
    filters: ContentModerationListFilters<ProductAnswerStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationProductAnswerRecord>>
  findAnswerById(answerId: string): Promise<ModerationProductAnswerRecord | null>
  updateAnswerStatus(answerId: string, input: { status: ProductAnswerStatus }): Promise<ModerationProductAnswerRecord>
}

const reviewInclude = {
  user: { select: { id: true, name: true, email: true } },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      shopId: true,
      shop: { select: { id: true, name: true, slug: true, status: true } },
    },
  },
  orderItem: {
    select: {
      id: true,
      productTitle: true,
      variantTitle: true,
      shopName: true,
      shopSlug: true,
    },
  },
  _count: { select: { reports: true } },
} as const

const reviewReportInclude = {
  review: {
    select: {
      id: true,
      rating: true,
      body: true,
      status: true,
      productId: true,
      user: { select: { id: true, name: true, email: true } },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          shopId: true,
          shop: { select: { id: true, name: true, slug: true, status: true } },
        },
      },
    },
  },
  reportedBy: { select: { id: true, name: true, email: true } },
  moderatedBy: { select: { id: true, name: true, email: true } },
} as const

const productQuestionInclude = {
  user: { select: { id: true, name: true, email: true } },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      shopId: true,
      shop: { select: { id: true, name: true, slug: true, status: true } },
    },
  },
  _count: { select: { answers: true } },
} as const

const productAnswerInclude = {
  user: { select: { id: true, name: true, email: true } },
  question: {
    select: {
      id: true,
      question: true,
      status: true,
      productId: true,
      shopId: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          shopId: true,
          shop: { select: { id: true, name: true, slug: true, status: true } },
        },
      },
    },
  },
} as const

export class PrismaContentModerationRepository implements IContentModerationRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async listReviews(
    filters: ContentModerationListFilters<ReviewStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationReviewRecord>> {
    this.logger.debug('PrismaContentModerationRepository.listReviews', { filters, pagination })
    const where = this.reviewWhere(filters)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.review.count({ where }),
    ])
    return { items, total }
  }

  findReviewById(reviewId: string): Promise<ModerationReviewRecord | null> {
    this.logger.debug('PrismaContentModerationRepository.findReviewById', { reviewId })
    return this.prisma.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    })
  }

  updateReviewStatus(reviewId: string, input: { status: ReviewStatus; note?: string | null }): Promise<ModerationReviewRecord> {
    this.logger.info('PrismaContentModerationRepository.updateReviewStatus', { reviewId, status: input.status })
    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: input.status,
        moderationReason: input.note ?? null,
        moderatedAt: new Date(),
      },
      include: reviewInclude,
    })
  }

  async listReviewReports(
    filters: ContentModerationListFilters<ReviewReportStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationReviewReportRecord>> {
    this.logger.debug('PrismaContentModerationRepository.listReviewReports', { filters, pagination })
    const where = this.reviewReportWhere(filters)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reviewReport.findMany({
        where,
        include: reviewReportInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.reviewReport.count({ where }),
    ])
    return { items, total }
  }

  findReviewReportById(reportId: string): Promise<ModerationReviewReportRecord | null> {
    this.logger.debug('PrismaContentModerationRepository.findReviewReportById', { reportId })
    return this.prisma.reviewReport.findUnique({
      where: { id: reportId },
      include: reviewReportInclude,
    })
  }

  async updateReviewReportStatus(
    reportId: string,
    input: { status: ReviewReportStatus; moderatorId: string; note?: string | null },
  ): Promise<UpdateReviewReportStatusResult> {
    this.logger.info('PrismaContentModerationRepository.updateReviewReportStatus', { reportId, status: input.status })
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.reviewReport.findUnique({
        where: { id: reportId },
        include: { review: { select: { id: true, status: true } } },
      })
      let reviewBeforeStatus: ReviewStatus | undefined
      let reviewAfterStatus: ReviewStatus | undefined

      if (input.status === 'RESOLVED_REMOVED' && existing?.review) {
        reviewBeforeStatus = existing.review.status
        const updatedReview = await tx.review.update({
          where: { id: existing.review.id },
          data: {
            status: 'HIDDEN',
            moderationReason: input.note ?? null,
            moderatedAt: new Date(),
          },
          select: { status: true },
        })
        reviewAfterStatus = updatedReview.status
      }

      const report = await tx.reviewReport.update({
        where: { id: reportId },
        data: {
          status: input.status,
          moderatedById: input.moderatorId,
          moderationNote: input.note ?? null,
          moderatedAt: new Date(),
        },
        include: reviewReportInclude,
      })
      return { report, reviewBeforeStatus, reviewAfterStatus }
    })
  }

  async listQuestions(
    filters: ContentModerationListFilters<ProductQuestionStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationProductQuestionRecord>> {
    this.logger.debug('PrismaContentModerationRepository.listQuestions', { filters, pagination })
    const where = this.questionWhere(filters)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productQuestion.findMany({
        where,
        include: productQuestionInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.productQuestion.count({ where }),
    ])
    return { items, total }
  }

  findQuestionById(questionId: string): Promise<ModerationProductQuestionRecord | null> {
    this.logger.debug('PrismaContentModerationRepository.findQuestionById', { questionId })
    return this.prisma.productQuestion.findUnique({
      where: { id: questionId },
      include: productQuestionInclude,
    })
  }

  updateQuestionStatus(questionId: string, input: { status: ProductQuestionStatus }): Promise<ModerationProductQuestionRecord> {
    this.logger.info('PrismaContentModerationRepository.updateQuestionStatus', { questionId, status: input.status })
    return this.prisma.productQuestion.update({
      where: { id: questionId },
      data: { status: input.status },
      include: productQuestionInclude,
    })
  }

  async listAnswers(
    filters: ContentModerationListFilters<ProductAnswerStatus>,
    pagination: ContentModerationPaginationInput,
  ): Promise<ContentModerationPaginatedResult<ModerationProductAnswerRecord>> {
    this.logger.debug('PrismaContentModerationRepository.listAnswers', { filters, pagination })
    const where = this.answerWhere(filters)
    const [items, total] = await this.prisma.$transaction([
      this.prisma.productAnswer.findMany({
        where,
        include: productAnswerInclude,
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.prisma.productAnswer.count({ where }),
    ])
    return { items, total }
  }

  findAnswerById(answerId: string): Promise<ModerationProductAnswerRecord | null> {
    this.logger.debug('PrismaContentModerationRepository.findAnswerById', { answerId })
    return this.prisma.productAnswer.findUnique({
      where: { id: answerId },
      include: productAnswerInclude,
    })
  }

  updateAnswerStatus(answerId: string, input: { status: ProductAnswerStatus }): Promise<ModerationProductAnswerRecord> {
    this.logger.info('PrismaContentModerationRepository.updateAnswerStatus', { answerId, status: input.status })
    return this.prisma.productAnswer.update({
      where: { id: answerId },
      data: { status: input.status },
      include: productAnswerInclude,
    })
  }

  private reviewWhere(filters: ContentModerationListFilters<ReviewStatus>): Prisma.ReviewWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { body: { contains: filters.q, mode: 'insensitive' } },
              { product: { title: { contains: filters.q, mode: 'insensitive' } } },
              { user: { name: { contains: filters.q, mode: 'insensitive' } } },
              { user: { email: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
  }

  private reviewReportWhere(filters: ContentModerationListFilters<ReviewReportStatus>): Prisma.ReviewReportWhereInput {
    return {
      reviewId: { not: null },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { detail: { contains: filters.q, mode: 'insensitive' } },
              { review: { body: { contains: filters.q, mode: 'insensitive' } } },
              { review: { product: { title: { contains: filters.q, mode: 'insensitive' } } } },
              { reportedBy: { name: { contains: filters.q, mode: 'insensitive' } } },
              { reportedBy: { email: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
  }

  private questionWhere(filters: ContentModerationListFilters<ProductQuestionStatus>): Prisma.ProductQuestionWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { question: { contains: filters.q, mode: 'insensitive' } },
              { product: { title: { contains: filters.q, mode: 'insensitive' } } },
              { product: { shop: { name: { contains: filters.q, mode: 'insensitive' } } } },
              { user: { name: { contains: filters.q, mode: 'insensitive' } } },
              { user: { email: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
  }

  private answerWhere(filters: ContentModerationListFilters<ProductAnswerStatus>): Prisma.ProductAnswerWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { answer: { contains: filters.q, mode: 'insensitive' } },
              { question: { question: { contains: filters.q, mode: 'insensitive' } } },
              { question: { product: { title: { contains: filters.q, mode: 'insensitive' } } } },
              { question: { product: { shop: { name: { contains: filters.q, mode: 'insensitive' } } } } },
              { user: { name: { contains: filters.q, mode: 'insensitive' } } },
              { user: { email: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
  }
}
