import type { Prisma, PrismaClient, Product, ProductVariant, Review, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface SearchRepositoryFilters {
  q?: string
  shopId?: string
  minPriceCents?: number
  maxPriceCents?: number
}

export type SearchProductVariant = Pick<ProductVariant, 'id' | 'sku' | 'title' | 'priceCents' | 'currency'> & {
  orderItems: Array<{
    quantity: number
  }>
}

export type SearchProductRecord = Pick<Product, 'id' | 'title' | 'slug' | 'description' | 'createdAt' | 'status'> & {
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  variants: SearchProductVariant[]
  reviews: Array<Pick<Review, 'rating' | 'status'>>
}

export interface ISearchRepository {
  findSearchableProducts(filters: SearchRepositoryFilters): Promise<SearchProductRecord[]>
  findSuggestions(q: string, limit: number): Promise<Array<Pick<Product, 'id' | 'title'>>>
}

const searchProductSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
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
  variants: {
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      sku: true,
      title: true,
      priceCents: true,
      currency: true,
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

export class PrismaSearchRepository implements ISearchRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findSearchableProducts(filters: SearchRepositoryFilters): Promise<SearchProductRecord[]> {
    this.logger.debug('PrismaSearchRepository.findSearchableProducts', { filters })
    return this.prisma.product.findMany({
      where: this.buildProductWhere(filters),
      select: searchProductSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
  }

  findSuggestions(q: string, limit: number): Promise<Array<Pick<Product, 'id' | 'title'>>> {
    this.logger.debug('PrismaSearchRepository.findSuggestions', { q, limit })
    return this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        shop: { status: 'ACTIVE' },
        title: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
  }

  private buildProductWhere(filters: SearchRepositoryFilters): Prisma.ProductWhereInput {
    return {
      status: 'ACTIVE',
      shop: {
        status: 'ACTIVE',
        ...(filters.shopId ? { id: filters.shopId } : {}),
      },
      variants: {
        some: {
          status: 'ACTIVE',
          priceCents: {
            ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}),
            ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}),
          },
        },
      },
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: filters.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }
  }
}
