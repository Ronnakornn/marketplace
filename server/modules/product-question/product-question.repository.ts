import type {
  PrismaClient,
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

export interface IProductQuestionRepository {
  findActiveProductWithActiveShop(productId: string): Promise<ProductQuestionProduct | null>
  listPublishedQuestions(productId: string): Promise<ProductQuestionRecord[]>
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

  listPublishedQuestions(productId: string): Promise<ProductQuestionRecord[]> {
    this.logger.debug('PrismaProductQuestionRepository.listPublishedQuestions', { productId })
    return this.prisma.productQuestion.findMany({
      where: {
        productId,
        status: 'PUBLISHED',
      },
      include: productQuestionInclude,
      orderBy: {
        createdAt: 'desc',
      },
    })
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
