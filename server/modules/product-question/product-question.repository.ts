import type {
  PrismaClient,
  Prisma,
  Product,
  ProductAnswer,
  ProductQuestion,
  Shop,
  User,
} from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type ProductQuestionProduct = Pick<Product, 'id' | 'shopId' | 'status'> & {
  shop: Pick<Shop, 'id' | 'ownerId' | 'status'>
}

export type ProductQuestionRecord = ProductQuestion & {
  user: Pick<User, 'id' | 'name'>
  answers: Array<ProductAnswer & {
    user: Pick<User, 'id' | 'name'>
  }>
}

export type ProductQuestionWithContext = ProductQuestion & {
  product: Pick<Product, 'id' | 'shopId' | 'status'> & {
    shop: Pick<Shop, 'id' | 'ownerId' | 'status'>
  }
}

export interface CreateProductQuestionRecord {
  productId: string
  shopId: string
  userId: string
  question: string
}

export interface CreateProductAnswerRecord {
  questionId: string
  userId: string
  answer: string
}

export type ProductQuestionAnswerStatusFilter = 'all' | 'answered' | 'unanswered'
export type ProductQuestionSort = 'latest' | 'oldest'

export interface ListProductQuestionsInput {
  answerStatus: ProductQuestionAnswerStatusFilter
  sort: ProductQuestionSort
  page: number
  limit: number
}

export interface PaginatedProductQuestions {
  items: ProductQuestionRecord[]
  totalCount: number
}

export interface IProductQuestionRepository {
  findActiveProductWithActiveShop(productId: string): Promise<ProductQuestionProduct | null>
  listPublishedQuestions(productId: string, input: ListProductQuestionsInput): Promise<PaginatedProductQuestions>
  createPublishedQuestion(input: CreateProductQuestionRecord): Promise<ProductQuestionRecord>
  findPublishedQuestionWithContext(questionId: string): Promise<ProductQuestionWithContext | null>
  createPublishedAnswer(input: CreateProductAnswerRecord): Promise<ProductAnswer & { user: Pick<User, 'id' | 'name'> }>
}

const productQuestionInclude = {
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  answers: {
    where: {
      status: 'PUBLISHED',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const

export class PrismaProductQuestionRepository implements IProductQuestionRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findActiveProductWithActiveShop(productId: string): Promise<ProductQuestionProduct | null> {
    this.logger.debug('PrismaProductQuestionRepository.findActiveProductWithActiveShop', { productId })
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        status: 'ACTIVE',
        shop: {
          status: 'ACTIVE',
        },
      },
      select: {
        id: true,
        shopId: true,
        status: true,
        shop: {
          select: {
            id: true,
            ownerId: true,
            status: true,
          },
        },
      },
    })
  }

  async listPublishedQuestions(
    productId: string,
    input: ListProductQuestionsInput = { answerStatus: 'all', sort: 'latest', page: 1, limit: 5 },
  ): Promise<PaginatedProductQuestions> {
    this.logger.debug('PrismaProductQuestionRepository.listPublishedQuestions', { productId, input })
    const answerFilter: Prisma.ProductQuestionWhereInput = input.answerStatus === 'answered'
      ? { answers: { some: { status: 'PUBLISHED' as const } } }
      : input.answerStatus === 'unanswered'
        ? { answers: { none: { status: 'PUBLISHED' as const } } }
        : {}
    const where: Prisma.ProductQuestionWhereInput = {
      productId,
      status: 'PUBLISHED',
      product: {
        status: 'ACTIVE',
        shop: {
          status: 'ACTIVE',
        },
      },
      ...answerFilter,
    }
    const orderBy = input.sort === 'oldest'
      ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
      : [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
    const [items, totalCount] = await this.prisma.$transaction([
      this.prisma.productQuestion.findMany({
      where,
      include: productQuestionInclude,
      orderBy,
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
      this.prisma.productQuestion.count({ where }),
    ])
    return { items, totalCount }
  }

  createPublishedQuestion(input: CreateProductQuestionRecord): Promise<ProductQuestionRecord> {
    this.logger.info('PrismaProductQuestionRepository.createPublishedQuestion', {
      productId: input.productId,
      shopId: input.shopId,
      userId: input.userId,
    })
    return this.prisma.productQuestion.create({
      data: {
        productId: input.productId,
        shopId: input.shopId,
        userId: input.userId,
        question: input.question,
        status: 'PUBLISHED',
      },
      include: productQuestionInclude,
    })
  }

  findPublishedQuestionWithContext(questionId: string): Promise<ProductQuestionWithContext | null> {
    this.logger.debug('PrismaProductQuestionRepository.findPublishedQuestionWithContext', { questionId })
    return this.prisma.productQuestion.findFirst({
      where: {
        id: questionId,
        status: 'PUBLISHED',
      },
      include: {
        product: {
          select: {
            id: true,
            shopId: true,
            status: true,
            shop: {
              select: {
                id: true,
                ownerId: true,
                status: true,
              },
            },
          },
        },
      },
    })
  }

  createPublishedAnswer(input: CreateProductAnswerRecord): Promise<ProductAnswer & { user: Pick<User, 'id' | 'name'> }> {
    this.logger.info('PrismaProductQuestionRepository.createPublishedAnswer', {
      questionId: input.questionId,
      userId: input.userId,
    })
    return this.prisma.productAnswer.create({
      data: {
        questionId: input.questionId,
        userId: input.userId,
        answer: input.answer,
        status: 'PUBLISHED',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  }
}
