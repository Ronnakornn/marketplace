import type { Prisma, PrismaClient, Product, ProductVariant, Review, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export interface SearchRepositoryFilters {
  q?: string
  categoryId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
}

export type SearchProductVariant = Pick<ProductVariant, 'id' | 'sku' | 'title' | 'price' | 'currency'> & {
  titleTh?: string | null
  titleEn?: string | null
  orderItems: Array<{
    quantity: number
  }>
}

export type SearchProductRecord = Pick<Product, 'id' | 'title' | 'slug' | 'description' | 'createdAt' | 'status'> & {
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
  variants: SearchProductVariant[]
  reviews: Array<Pick<Review, 'rating' | 'status'>>
}

export interface ISearchRepository {
  findSearchableProducts(filters: SearchRepositoryFilters): Promise<SearchProductRecord[]>
  findSuggestions(q: string, limit: number): Promise<Array<Pick<Product, 'id' | 'title'> & { titleTh?: string | null; titleEn?: string | null }>>
}

const searchProductSelect = {
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

  findSuggestions(q: string, limit: number): Promise<Array<Pick<Product, 'id' | 'title'> & { titleTh?: string | null; titleEn?: string | null }>> {
    this.logger.debug('PrismaSearchRepository.findSuggestions', { q, limit })
    return this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        shop: { status: 'ACTIVE' },
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { titleTh: { contains: q, mode: 'insensitive' } },
          { titleEn: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        titleTh: true,
        titleEn: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
  }

  private buildProductWhere(filters: SearchRepositoryFilters): Prisma.ProductWhereInput {
    return {
      status: 'ACTIVE',
      ...(filters.categoryId ? { category: { slug: filters.categoryId, isActive: true } } : {}),
      shop: {
        status: 'ACTIVE',
        ...(filters.shopId ? { id: filters.shopId } : {}),
      },
      variants: {
        some: (() => {
          const v: Prisma.ProductVariantWhereInput = { status: 'ACTIVE' }
          if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            v.price = {
              ...(filters.minPrice !== undefined ? { gte: BigInt(filters.minPrice) } : {}),
              ...(filters.maxPrice !== undefined ? { lte: BigInt(filters.maxPrice) } : {}),
            } as unknown as Prisma.BigIntFilter
          }
          return v
        })(),
      },
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: 'insensitive' } },
              { titleTh: { contains: filters.q, mode: 'insensitive' } },
              { titleEn: { contains: filters.q, mode: 'insensitive' } },
              { description: { contains: filters.q, mode: 'insensitive' } },
              { descriptionTh: { contains: filters.q, mode: 'insensitive' } },
              { descriptionEn: { contains: filters.q, mode: 'insensitive' } },
              { category: { name: { contains: filters.q, mode: 'insensitive' } } },
              { category: { nameTh: { contains: filters.q, mode: 'insensitive' } } },
              { category: { nameEn: { contains: filters.q, mode: 'insensitive' } } },
              { variants: { some: { sku: { contains: filters.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }
  }
}
