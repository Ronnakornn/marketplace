import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { OwnershipGuards } from '#server/modules/security'
import { ProductQuestionServiceError } from './product-question.errors.ts'
import type {
  IProductQuestionRepository,
  ProductQuestionAnswerStatusFilter,
  ProductQuestionRecord,
  ProductQuestionSort,
} from './product-question.repository.ts'

export interface ProductQuestionActor {
  id: string
  role: Role
}

export interface CreateProductQuestionInput {
  question: string
}

export interface CreateProductAnswerInput {
  answer: string
}

export interface ProductQuestionAnswerResponse {
  id: string
  answer: string
  status: 'PUBLISHED'
  createdAt: Date
  user: {
    id: string
    name: string
  }
}

export interface ProductQuestionResponse {
  id: string
  productId: string
  shopId: string
  question: string
  status: 'PUBLISHED'
  createdAt: Date
  user: {
    id: string
    name: string
  }
  answers: ProductQuestionAnswerResponse[]
}

export interface ProductQuestionListResponse {
  items: ProductQuestionResponse[]
  meta: {
    page: number
    limit: number
    totalCount: number
    hasNextPage: boolean
  }
}

export interface ListProductQuestionsInput {
  answerStatus?: ProductQuestionAnswerStatusFilter
  sort?: ProductQuestionSort
  page?: number
  limit?: number
}

export class ProductQuestionService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IProductQuestionRepository,
    private ownershipGuards: OwnershipGuards,
  ) {
    this.logger = appContext.logger
  }

  async listProductQuestions(productId: string, input: ListProductQuestionsInput = {}): Promise<ProductQuestionListResponse> {
    await this.requireActiveProduct(productId)
    const page = this.normalizePage(input.page)
    const limit = this.normalizeLimit(input.limit)
    const result = await this.repo.listPublishedQuestions(productId, {
      answerStatus: input.answerStatus ?? 'all',
      sort: input.sort ?? 'latest',
      page,
      limit,
    })
    return {
      items: result.items.map((question) => this.toQuestionResponse(question)),
      meta: {
        page,
        limit,
        totalCount: result.totalCount,
        hasNextPage: page * limit < result.totalCount,
      },
    }
  }

  async createQuestion(
    actor: ProductQuestionActor,
    productId: string,
    input: CreateProductQuestionInput,
  ): Promise<ProductQuestionResponse> {
    const question = this.normalizeRequiredText(input.question, 'Question is required', 'QUESTION_REQUIRED')
    const product = await this.requireActiveProduct(productId)

    this.logger.info('ProductQuestionService.createQuestion', { actorId: actor.id, productId })
    const created = await this.repo.createPublishedQuestion({
      productId: product.id,
      shopId: product.shopId,
      userId: actor.id,
      question,
    })
    return this.toQuestionResponse(created)
  }

  async createAnswer(
    actor: ProductQuestionActor,
    questionId: string,
    input: CreateProductAnswerInput,
  ): Promise<ProductQuestionAnswerResponse> {
    const answer = this.normalizeRequiredText(input.answer, 'Answer is required', 'ANSWER_REQUIRED')
    const question = await this.repo.findPublishedQuestionWithContext(questionId)
    if (!question) throw new ProductQuestionServiceError('Question not found', 404, 'QUESTION_NOT_FOUND')
    if (question.product.status !== 'ACTIVE' || question.product.shop.status !== 'ACTIVE') {
      throw new ProductQuestionServiceError('Question product not found', 404, 'PRODUCT_NOT_FOUND')
    }

    await this.ownershipGuards.assertSellerOwnsShop(actor.id, question.shopId)

    this.logger.info('ProductQuestionService.createAnswer', { actorId: actor.id, questionId })
    const created = await this.repo.createPublishedAnswer({
      questionId: question.id,
      userId: actor.id,
      answer,
    })
    return this.toAnswerResponse(created)
  }

  private async requireActiveProduct(productId: string) {
    const product = await this.repo.findActiveProductWithActiveShop(productId)
    if (!product) throw new ProductQuestionServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    return product
  }

  private normalizeRequiredText(value: string | undefined, message: string, code: string): string {
    const trimmed = value?.trim() ?? ''
    if (!trimmed) throw new ProductQuestionServiceError(message, 400, code)
    return trimmed
  }

  private normalizePage(page: number | undefined): number {
    if (page === undefined) return 1
    if (!Number.isInteger(page) || page < 1) {
      throw new ProductQuestionServiceError('Page must be a positive integer', 400, 'INVALID_PAGINATION')
    }
    return page
  }

  private normalizeLimit(limit: number | undefined): number {
    if (limit === undefined) return 5
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new ProductQuestionServiceError('Limit must be an integer from 1 to 20', 400, 'INVALID_PAGINATION')
    }
    return limit
  }

  private toQuestionResponse(question: ProductQuestionRecord): ProductQuestionResponse {
    return {
      id: question.id,
      productId: question.productId,
      shopId: question.shopId,
      question: question.question,
      status: 'PUBLISHED',
      createdAt: question.createdAt,
      user: {
        id: question.user.id,
        name: question.user.name,
      },
      answers: question.answers.map((answer) => this.toAnswerResponse(answer)),
    }
  }

  private toAnswerResponse(answer: ProductQuestionRecord['answers'][number]): ProductQuestionAnswerResponse {
    return {
      id: answer.id,
      answer: answer.answer,
      status: 'PUBLISHED',
      createdAt: answer.createdAt,
      user: {
        id: answer.user.id,
        name: answer.user.name,
      },
    }
  }
}
