import type { Prisma, PrismaClient, Product, ProductVariant, Review, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const MAX_FACET_OPTIONS = 20

export interface SearchRepositoryFilters {
  q?: string
  categoryId?: string
  brandId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  attributeFilters?: Array<{ key: string; value: string }>
  inStock?: boolean
}

export type SearchProductVariant = Pick<ProductVariant, 'id' | 'sku' | 'title' | 'price' | 'currency'> & {
  titleTh?: string | null
  titleEn?: string | null
  optionValues: Array<{
    optionValue: {
      id: string
      value: string
      valueTh?: string | null
      valueEn?: string | null
      option: {
        id: string
        name: string
        nameTh?: string | null
        nameEn?: string | null
      }
    }
  }>
  orderItems: Array<{
    quantity: number
  }>
  inventory: {
    quantityOnHand: number
    quantityReserved: number
  } | null
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
  options: Array<{
    id: string
    name: string
    nameTh?: string | null
    nameEn?: string | null
    values: Array<{
      id: string
      value: string
      valueTh?: string | null
      valueEn?: string | null
    }>
  }>
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'>
  variants: SearchProductVariant[]
  reviews: Array<Pick<Review, 'rating' | 'status'>>
}

export interface SearchProductFacets {
  categories: Array<{
    id: string
    slug: string
    name: string
    count: number
    active: boolean
  }>
  brands: Array<{
    id: string
    name: string
    slug?: string
    count: number
    active: boolean
  }>
  price: {
    min: number | null
    max: number | null
    currency: string
  }
}

export interface ISearchRepository {
  findSearchableProducts(filters: SearchRepositoryFilters): Promise<SearchProductRecord[]>
  findProductFacets(filters: SearchRepositoryFilters): Promise<SearchProductFacets>
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
      optionValues: {
        select: {
          optionValue: {
            select: {
              id: true,
              value: true,
              valueTh: true,
              valueEn: true,
              option: {
                select: {
                  id: true,
                  name: true,
                  nameTh: true,
                  nameEn: true,
                },
              },
            },
          },
        },
      },
      orderItems: {
        select: {
          quantity: true,
        },
      },
      inventory: {
        select: {
          quantityOnHand: true,
          quantityReserved: true,
        },
      },
    },
  },
  options: {
    select: {
      id: true,
      name: true,
      nameTh: true,
      nameEn: true,
      values: {
        select: {
          id: true,
          value: true,
          valueTh: true,
          valueEn: true,
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

  async findProductFacets(filters: SearchRepositoryFilters): Promise<SearchProductFacets> {
    this.logger.debug('PrismaSearchRepository.findProductFacets', { filters })
    const where = this.buildProductWhere(filters)
    const variantWhere = this.buildVariantFacetWhere(where)
    const [categoryGroups, brandGroups, priceRange] = await this.prisma.$transaction([
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { ...where, categoryId: { not: null } },
        _count: true,
        orderBy: { _count: { categoryId: 'desc' } },
        take: MAX_FACET_OPTIONS,
      }),
      this.prisma.product.groupBy({
        by: ['brandId'],
        where: { ...where, brandId: { not: null } },
        _count: true,
        orderBy: { _count: { brandId: 'desc' } },
        take: MAX_FACET_OPTIONS,
      }),
      this.prisma.productVariant.aggregate({
        where: variantWhere,
        _min: { price: true },
        _max: { price: true },
      }),
    ])

    const categoryIds = categoryGroups.map((group) => group.categoryId).filter((id): id is string => Boolean(id))
    const brandIds = brandGroups.map((group) => group.brandId).filter((id): id is string => Boolean(id))
    const [categories, brands, firstVariant] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: { id: { in: categoryIds }, isActive: true },
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.brand.findMany({
        where: { id: { in: brandIds }, isActive: true },
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.productVariant.findFirst({
        where: variantWhere,
        select: { currency: true },
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      }),
    ])

    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const brandById = new Map(brands.map((brand) => [brand.id, brand]))

    return {
      categories: categoryGroups
        .flatMap((group) => {
          if (!group.categoryId) return []
          const category = categoryById.get(group.categoryId)
          if (!category) return []
          return [{
            id: category.id,
            slug: category.slug,
            name: category.name,
            count: this.productGroupCount(group),
            active: filters.categoryId === category.slug || filters.categoryId === category.id,
          }]
        }),
      brands: brandGroups
        .flatMap((group) => {
          if (!group.brandId) return []
          const brand = brandById.get(group.brandId)
          if (!brand) return []
          return [{
            id: brand.id,
            name: brand.name,
            slug: brand.slug,
            count: this.productGroupCount(group),
            active: filters.brandId === brand.id || filters.brandId === brand.slug,
          }]
        }),
      price: {
        min: priceRange._min.price === null ? null : Number(priceRange._min.price),
        max: priceRange._max.price === null ? null : Number(priceRange._max.price),
        currency: firstVariant?.currency ?? 'THB',
      },
    }
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
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.attributeFilters && filters.attributeFilters.length > 0
        ? {
            AND: filters.attributeFilters.map((filter) => ({
              attributes: {
                some: {
                  isFilterable: true,
                  attributeKey: filter.key,
                  value: { equals: filter.value, mode: 'insensitive' },
                },
              },
            })),
          }
        : {}),
      shop: {
        status: 'ACTIVE',
        ...(filters.shopId ? { id: filters.shopId } : {}),
      },
      variants: {
        some: (() => {
          const v: Prisma.ProductVariantWhereInput = { status: 'ACTIVE' }
          if (filters.inStock) {
            v.inventory = {
              quantityOnHand: { gt: 0 },
            }
          }
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

  private buildVariantFacetWhere(productWhere: Prisma.ProductWhereInput): Prisma.ProductVariantWhereInput {
    return {
      status: 'ACTIVE',
      product: productWhere,
    }
  }

  private productGroupCount(group: { _count?: unknown }): number {
    if (typeof group._count === 'number') return group._count
    if (typeof group._count === 'object' && group._count && '_all' in group._count && typeof group._count._all === 'number') {
      return group._count._all
    }
    return 0
  }
}
