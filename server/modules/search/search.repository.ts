import { moneyInteger } from '#server/lib/money.ts'
import { Prisma, type PrismaClient, type Product, type ProductVariant, type Shop } from '#generated/client/client.ts'
import type { ContentLocale } from '#server/lib/localization.ts'
import { localeSortKey } from '#server/lib/sql-locale-order.ts'
import type { SearchSort } from './search.service.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const MAX_FACET_OPTIONS = 20
const TEXT_TRIM_CHARACTERS = ' \t\n\r\v\f\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'

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

export interface SearchPageFilters extends SearchRepositoryFilters {
  sort: SearchSort
  locale: ContentLocale
  rating?: number
  badges: string[]
  cursor?: string
  page: number
  limit: number
  newSince: Date
}

export interface SearchProductPage {
  products: SearchProductRecord[]
  total: number
  nextCursor: string | null
}

type SearchRankedRow = {
  id: string | null
  averageRating: number | null
  totalReviewCount: bigint | null
  soldCount: bigint | null
  position: bigint | null
  total: bigint
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
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'status'> & {
    addresses: Array<{
      city: string
      region: string | null
      country: string
    }>
  }
  images: Array<{
    url: string
  }>
  variants: SearchProductVariant[]
  metrics: {
    averageRating: number
    totalReviewCount: number
    soldCount: number
  }
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
    min: bigint | null
    max: bigint | null
    currency: string
  }
}

export interface ISearchRepository {
  findSearchPage(filters: SearchPageFilters): Promise<SearchProductPage>
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
      addresses: {
        where: { type: 'PICKUP' },
        select: { city: true, region: true, country: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
  },
  images: {
    select: { url: true },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 1,
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
} satisfies Prisma.ProductSelect

export class PrismaSearchRepository implements ISearchRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  async findSearchPage(filters: SearchPageFilters): Promise<SearchProductPage> {
    this.logger.debug('PrismaSearchRepository.findSearchPage', { filters })
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SearchRankedRow[]>(this.buildSearchPageQuery(filters))
      const pageRows = rows.filter((row): row is SearchRankedRow & { id: string } => row.id !== null)
      const total = Number(rows[0]?.total ?? 0n)
      if (pageRows.length === 0) return { products: [], total, nextCursor: null }
      const products = await tx.product.findMany({
        where: { id: { in: pageRows.map((row) => row.id) } },
        select: searchProductSelect,
      })
      const byId = new Map(products.map((product) => [product.id, product]))
      return {
        products: pageRows.flatMap((row) => {
          const product = byId.get(row.id)
          return product ? [{ ...product, metrics: {
            averageRating: row.averageRating ?? 0,
            totalReviewCount: Number(row.totalReviewCount ?? 0n),
            soldCount: Number(row.soldCount ?? 0n),
          } }] : []
        }),
        total,
        nextCursor: (pageRows.at(-1)?.position ?? 0n) < BigInt(total) ? pageRows.at(-1)!.id : null,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
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
        min: priceRange._min.price === null ? null : moneyInteger(priceRange._min.price),
        max: priceRange._max.price === null ? null : moneyInteger(priceRange._max.price),
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

  private buildSearchPageQuery(filters: SearchPageFilters): Prisma.Sql {
    const pageBeforeMetrics = (filters.sort === 'newest' || filters.sort === 'relevance')
      && filters.rating === undefined && !filters.badges.includes('best_seller')
    const predicates = [Prisma.sql`p.status = 'ACTIVE' AND s.status = 'ACTIVE'`]
    if (filters.categoryId) predicates.push(Prisma.sql`c.slug = ${filters.categoryId} AND c."isActive"`)
    if (filters.brandId) predicates.push(Prisma.sql`p."brandId" = ${filters.brandId}::uuid`)
    if (filters.shopId) predicates.push(Prisma.sql`p."shopId" = ${filters.shopId}::uuid`)
    for (const attribute of filters.attributeFilters ?? []) {
      predicates.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ProductAttribute" a WHERE a."productId" = p.id AND a."isFilterable"
        AND a."attributeKey" = ${attribute.key} AND a.value ILIKE ${attribute.value}
      )`)
    }
    const variantPredicates = [Prisma.sql`v."productId" = p.id AND v.status = 'ACTIVE'`]
    if (filters.minPrice !== undefined) variantPredicates.push(Prisma.sql`v.price >= ${BigInt(filters.minPrice)}`)
    if (filters.maxPrice !== undefined) variantPredicates.push(Prisma.sql`v.price <= ${BigInt(filters.maxPrice)}`)
    if (filters.inStock) variantPredicates.push(Prisma.sql`i."quantityOnHand" > i."quantityReserved"`)
    predicates.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ProductVariant" v LEFT JOIN "Inventory" i ON i."variantId" = v.id
      WHERE ${Prisma.join(variantPredicates, ' AND ')}
    )`)
    if (filters.q) {
      const pattern = `%${filters.q}%`
      predicates.push(Prisma.sql`(
        p.title ILIKE ${pattern} OR p."titleTh" ILIKE ${pattern} OR p."titleEn" ILIKE ${pattern}
        OR p.description ILIKE ${pattern} OR p."descriptionTh" ILIKE ${pattern} OR p."descriptionEn" ILIKE ${pattern}
        OR c.name ILIKE ${pattern} OR c."nameTh" ILIKE ${pattern} OR c."nameEn" ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM "ProductVariant" sku WHERE sku."productId" = p.id AND sku.sku ILIKE ${pattern})
      )`)
    }
    const metricPredicates: Prisma.Sql[] = []
    if (filters.rating !== undefined) metricPredicates.push(Prisma.sql`"averageRating" >= ${filters.rating}`)
    for (const badge of filters.badges) {
      switch (badge) {
        case 'new': metricPredicates.push(Prisma.sql`"createdAt" >= ${filters.newSince}`); break
        case 'best_seller': metricPredicates.push(Prisma.sql`"soldCount" >= 100`); break
        case 'in_stock': metricPredicates.push(Prisma.sql`"hasStock"`); break
        default: metricPredicates.push(Prisma.sql`FALSE`)
      }
    }
    if (pageBeforeMetrics) {
      for (const badge of filters.badges) {
        switch (badge) {
          case 'new': predicates.push(Prisma.sql`p."createdAt" >= ${filters.newSince}`); break
          case 'in_stock': predicates.push(Prisma.sql`EXISTS (
            SELECT 1 FROM "ProductVariant" stock JOIN "Inventory" inventory ON inventory."variantId" = stock.id
            WHERE stock."productId" = p.id AND stock.status = 'ACTIVE'
              AND inventory."quantityOnHand" > inventory."quantityReserved"
          )`); break
          default: predicates.push(Prisma.sql`FALSE`)
        }
      }
    }
    const stable = Prisma.sql`"createdAt" DESC, id DESC`
    const titleTie = Prisma.sql`${localeSortKey(Prisma.sql`"localizedTitle"`)} ASC, ${stable}`
    const ordering: Record<SearchSort, Prisma.Sql> = {
      relevance: stable,
      newest: stable,
      price_asc: Prisma.sql`"minPrice" ASC, ${titleTie}`,
      price_desc: Prisma.sql`"minPrice" DESC, ${titleTie}`,
      top_sales: Prisma.sql`"soldCount" DESC, ${titleTie}`,
      rating: Prisma.sql`"averageRating" DESC, "totalReviewCount" DESC, ${titleTie}`,
    }
    const start = filters.cursor
      ? Prisma.sql`COALESCE((SELECT position FROM ranked WHERE id::text = ${filters.cursor}), 0)`
      : Prisma.sql`${(filters.page - 1) * filters.limit}::bigint`
    const rankedPage = Prisma.sql`ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY ${ordering[filters.sort]}) AS position
      FROM ${pageBeforeMetrics ? Prisma.sql`candidates` : Prisma.sql`filtered`}
    ), page AS MATERIALIZED (
      SELECT * FROM ranked WHERE position > ${start} AND position <= ${start} + ${filters.limit} ORDER BY position
    )`
    return Prisma.sql`
      WITH candidates AS (
        SELECT p.id, p."createdAt", COALESCE(
          NULLIF(BTRIM(CASE WHEN ${filters.locale} = 'th' THEN p."titleTh" ELSE p."titleEn" END, ${TEXT_TRIM_CHARACTERS}), ''),
          NULLIF(BTRIM(CASE WHEN ${filters.locale} = 'th' THEN p."titleEn" ELSE p."titleTh" END, ${TEXT_TRIM_CHARACTERS}), ''),
          NULLIF(BTRIM(p.title, ${TEXT_TRIM_CHARACTERS}), ''), p.title) AS "localizedTitle"
        FROM "Product" p JOIN "Shop" s ON s.id = p."shopId" LEFT JOIN "Category" c ON c.id = p."categoryId"
        WHERE ${Prisma.join(predicates, ' AND ')}
      ), ${pageBeforeMetrics ? Prisma.sql`${rankedPage},` : Prisma.empty}
      metric_candidates AS (SELECT * FROM ${pageBeforeMetrics ? Prisma.sql`page` : Prisma.sql`candidates`}), variant_metrics AS (
        SELECT v."productId", MIN(v.price) AS "minPrice", BOOL_OR(COALESCE(i."quantityOnHand" > i."quantityReserved", FALSE)) AS "hasStock"
        FROM "ProductVariant" v JOIN metric_candidates p ON p.id = v."productId"
        LEFT JOIN "Inventory" i ON i."variantId" = v.id WHERE v.status = 'ACTIVE' GROUP BY v."productId"
      ), review_metrics AS (
        SELECT r."productId", COUNT(*) AS "totalReviewCount", SUM(r.rating)::double precision / COUNT(*)::double precision AS average
        FROM "Review" r JOIN metric_candidates p ON p.id = r."productId" WHERE r.status = 'PUBLISHED' GROUP BY r."productId"
      ), review_binary AS (
        SELECT *, float8send(average) AS bits FROM review_metrics
      ), review_exact AS (
        -- toFixed rounds the exact IEEE double; numeric ROUND changes half-way averages such as 1.005.
        SELECT *, 4503599627370496::numeric + (get_byte(bits, 1) & 15)::numeric * 281474976710656
          + get_byte(bits, 2)::numeric * 1099511627776 + get_byte(bits, 3)::numeric * 4294967296
          + get_byte(bits, 4)::numeric * 16777216 + get_byte(bits, 5)::numeric * 65536
          + get_byte(bits, 6)::numeric * 256 + get_byte(bits, 7)::numeric AS significand,
          (1::bigint << (1075 - ((get_byte(bits, 0) & 127) * 16 + (get_byte(bits, 1) >> 4))))::numeric AS denominator
        FROM review_binary
      ), sales_metrics AS (
        SELECT v."productId", SUM(oi.quantity)::bigint AS "soldCount"
        FROM "OrderItem" oi JOIN "ProductVariant" v ON v.id = oi."variantId" AND v.status = 'ACTIVE'
        JOIN metric_candidates p ON p.id = v."productId" JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."paymentStatus" = 'SUCCEEDED' AND o.status <> 'CANCELED' AND oi."fulfillmentStatus" <> 'CANCELED'
        GROUP BY v."productId"
      ), metrics AS (
        SELECT p.*, v."minPrice", v."hasStock", COALESCE(r."totalReviewCount", 0) AS "totalReviewCount",
          COALESCE((div(r.significand * 200 + r.denominator, r.denominator * 2) / 100)::double precision, 0) AS "averageRating",
          COALESCE(s."soldCount", 0) AS "soldCount"
        FROM metric_candidates p JOIN variant_metrics v ON v."productId" = p.id
        LEFT JOIN review_exact r ON r."productId" = p.id LEFT JOIN sales_metrics s ON s."productId" = p.id
      ), ${pageBeforeMetrics ? Prisma.empty : Prisma.sql`filtered AS (
        SELECT * FROM metrics ${metricPredicates.length ? Prisma.sql`WHERE ${Prisma.join(metricPredicates, ' AND ')}` : Prisma.empty}
      ), ${rankedPage},`} total AS (SELECT COUNT(*) AS total FROM ${pageBeforeMetrics ? Prisma.sql`candidates` : Prisma.sql`filtered`})
      SELECT result.id, result."averageRating", result."totalReviewCount", result."soldCount", result.position, total.total
      FROM total LEFT JOIN ${pageBeforeMetrics ? Prisma.sql`metrics` : Prisma.sql`page`} result ON TRUE ORDER BY result.position
    `
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
              quantityOnHand: { gt: this.prisma.inventory.fields.quantityReserved },
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
