import type { Prisma, PrismaClient, Product, ProductVariant, Review, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'

export interface VectorSearchInput {
  embedding: number[]
  limit: number
  locale: string
  model: string
}

export interface VectorSearchMatch {
  product: AiSearchProductRecord
  score: number
}

export type AiSearchProductVariant = Pick<ProductVariant, 'id' | 'sku' | 'title' | 'price' | 'currency'> & {
  titleTh?: string | null
  titleEn?: string | null
  inventory: {
    quantityOnHand: number
    quantityReserved: number
  } | null
  orderItems: Array<{ quantity: number }>
}

export type AiSearchProductRecord = Pick<Product, 'id' | 'title' | 'slug' | 'description' | 'createdAt' | 'status'> & {
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  category: {
    id: string
    name: string
    nameTh?: string | null
    nameEn?: string | null
    slug: string
  } | null
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  variants: AiSearchProductVariant[]
  reviews: Array<Pick<Review, 'rating' | 'status'>>
}

export interface IVectorSearchAdapter {
  searchProducts(input: VectorSearchInput): Promise<VectorSearchMatch[]>
}

interface VectorRow {
  productId: string
  score: number
}

const aiSearchProductSelect = {
  id: true,
  title: true,
  titleTh: true,
  titleEn: true,
  slug: true,
  description: true,
  descriptionTh: true,
  descriptionEn: true,
  createdAt: true,
  status: true,
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      nameTh: true,
      nameEn: true,
      slug: true,
    },
  },
  variants: {
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      sku: true,
      title: true,
      titleTh: true,
      titleEn: true,
      price: true,
      currency: true,
      inventory: {
        select: {
          quantityOnHand: true,
          quantityReserved: true,
        },
      },
      orderItems: {
        select: {
          quantity: true,
        },
      },
    },
  },
  reviews: {
    where: {
      status: 'PUBLISHED',
    },
    select: {
      rating: true,
      status: true,
    },
  },
} as const

export class PgVectorSearchAdapter implements IVectorSearchAdapter {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async searchProducts(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    this.logger.debug('PgVectorSearchAdapter.searchProducts', { limit: input.limit, locale: input.locale, model: input.model })
    try {
      const rows = await this.findNearestEmbeddingRows(input)
      if (rows.length === 0) return []

      const scoreByProductId = new Map(rows.map((row) => [row.productId, Number(row.score)]))
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: rows.map((row) => row.productId) },
          ...this.publicProductWhere(),
        },
        select: aiSearchProductSelect,
      })

      return products
        .map((product) => ({
          product,
          score: scoreByProductId.get(product.id) ?? 0,
        }))
        .sort((a, b) => b.score - a.score)
    } catch (error) {
      this.logger.warn('PgVectorSearchAdapter.searchProducts failed', {
        code: 'VECTOR_SEARCH_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
      })
      throw new AiSearchServiceError('Vector search is unavailable', 503, 'VECTOR_SEARCH_UNAVAILABLE')
    }
  }

  private findNearestEmbeddingRows(input: VectorSearchInput): Promise<VectorRow[]> {
    const vector = `[${input.embedding.join(',')}]`
    return this.prisma.$queryRawUnsafe<VectorRow[]>(
      `
        SELECT pe."productId", (1 - (pe."embedding" <=> $1::vector))::float8 AS score
        FROM "ProductEmbedding" pe
        JOIN "Product" p ON p."id" = pe."productId"
        JOIN "Shop" s ON s."id" = p."shopId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE pe."model" = $2
          AND pe."locale" IN ($3, 'default')
          AND p."status" = 'ACTIVE'
          AND s."status" = 'ACTIVE'
          AND (p."categoryId" IS NULL OR c."isActive" = true)
          AND EXISTS (
            SELECT 1 FROM "ProductVariant" pv
            WHERE pv."productId" = p."id" AND pv."status" = 'ACTIVE'
          )
        ORDER BY pe."embedding" <=> $1::vector
        LIMIT $4
      `,
      vector,
      input.model,
      input.locale,
      input.limit,
    )
  }

  private publicProductWhere(): Prisma.ProductWhereInput {
    return {
      status: 'ACTIVE',
      shop: { status: 'ACTIVE' },
      variants: { some: { status: 'ACTIVE' } },
      OR: [
        { categoryId: null },
        { category: { isActive: true } },
      ],
    }
  }
}
