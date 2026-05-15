import type { Category, Prisma, PrismaClient, Product, ProductVariant, Shop } from '#generated/client/client.ts'
import type { ProductStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ProductListFilters {
  keyword?: string
  categoryId?: string
  shopId?: string
  status?: ProductStatus
  minPriceCents?: number
  maxPriceCents?: number
  cursor?: string
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    nextCursor: string | null
    hasNextPage: boolean
  }
}

export type CatalogCategoryListItem = Pick<Category, 'id' | 'name' | 'slug' | 'sortOrder'> & {
  nameTh?: string | null
  nameEn?: string | null
}

export interface CreateProductRecord {
  shopId: string
  categoryId?: string | null
  title: string
  titleTh?: string | null
  titleEn?: string | null
  slug: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  status: ProductStatus
}

export interface UpdateProductRecord {
  categoryId?: string | null
  title?: string
  titleTh?: string | null
  titleEn?: string | null
  slug?: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  status?: ProductStatus
}

export interface CreateVariantRecord {
  productId: string
  sku: string
  title: string
  titleTh?: string | null
  titleEn?: string | null
  priceCents: number
  currency: string
}

export interface UpdateVariantRecord {
  sku?: string
  title?: string
  titleTh?: string | null
  titleEn?: string | null
  priceCents?: number
  currency?: string
}

export type CatalogProductListItem = Omit<Product, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
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
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'ownerId' | 'status'>
  variants: Array<(Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
    titleTh?: string | null
    titleEn?: string | null
  }) & {
    inventory: {
      id: string
      quantityOnHand: number
      quantityReserved: number
      reorderLevel: number
      updatedAt: Date
    } | null
  }>
}

export type CatalogProductDetail = CatalogProductListItem

export type CatalogVariantRecord = Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
  titleTh?: string | null
  titleEn?: string | null
}

export type CatalogProductRecord = Omit<Product, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
}

export interface ICatalogRepository {
  findActiveCategories(): Promise<CatalogCategoryListItem[]>
  findShopById(id: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findFirstShopByOwnerId(ownerId: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findProductById(id: string): Promise<CatalogProductDetail | null>
  findProducts(filters: ProductListFilters): Promise<PaginatedResult<CatalogProductListItem>>
  createProduct(data: CreateProductRecord): Promise<CatalogProductDetail>
  updateProduct(id: string, data: UpdateProductRecord): Promise<CatalogProductDetail>
  createVariant(data: CreateVariantRecord): Promise<CatalogVariantRecord>
  updateVariant(id: string, data: UpdateVariantRecord): Promise<CatalogVariantRecord>
  deleteVariant(id: string): Promise<CatalogVariantRecord>
  findVariantById(id: string): Promise<(CatalogVariantRecord & { product: CatalogProductRecord }) | null>
}

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      nameTh: true,
      nameEn: true,
      slug: true,
    },
  },
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      status: true,
    },
  },
  variants: {
    include: {
      inventory: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} as const

export class PrismaCatalogRepository implements ICatalogRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findActiveCategories(): Promise<CatalogCategoryListItem[]> {
    this.logger.debug('PrismaCatalogRepository.findActiveCategories')
    return this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameTh: true,
        nameEn: true,
        slug: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  findShopById(id: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null> {
    this.logger.debug('PrismaCatalogRepository.findShopById', { id })
    return this.prisma.shop.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    })
  }

  findFirstShopByOwnerId(ownerId: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null> {
    this.logger.debug('PrismaCatalogRepository.findFirstShopByOwnerId', { ownerId })
    return this.prisma.shop.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, ownerId: true, status: true },
    })
  }

  findProductById(id: string): Promise<CatalogProductDetail | null> {
    this.logger.debug('PrismaCatalogRepository.findProductById', { id })
    return this.prisma.product.findFirst({
      where: {
        OR: [
          ...(UUID_PATTERN.test(id) ? [{ id }] : []),
          { slug: id },
        ],
      },
      include: productInclude,
    })
  }

  async findProducts(filters: ProductListFilters): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('PrismaCatalogRepository.findProducts', { filters })
    const where = this.buildProductWhere(filters)
    const rows = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      take: filters.limit + 1,
    })
    const hasNextPage = rows.length > filters.limit
    const data = hasNextPage ? rows.slice(0, filters.limit) : rows

    return {
      data,
      meta: {
        nextCursor: hasNextPage ? data.at(-1)?.id ?? null : null,
        hasNextPage,
      },
    }
  }

  createProduct(data: CreateProductRecord): Promise<CatalogProductDetail> {
    this.logger.info('PrismaCatalogRepository.createProduct', { shopId: data.shopId, slug: data.slug })
    return this.prisma.product.create({
      data,
      include: productInclude,
    })
  }

  updateProduct(id: string, data: UpdateProductRecord): Promise<CatalogProductDetail> {
    this.logger.info('PrismaCatalogRepository.updateProduct', { id })
    return this.prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    })
  }

  createVariant(data: CreateVariantRecord): Promise<CatalogVariantRecord> {
    this.logger.info('PrismaCatalogRepository.createVariant', { productId: data.productId, sku: data.sku })
    return this.prisma.productVariant.create({ data })
  }

  updateVariant(id: string, data: UpdateVariantRecord): Promise<CatalogVariantRecord> {
    this.logger.info('PrismaCatalogRepository.updateVariant', { id })
    return this.prisma.productVariant.update({
      where: { id },
      data,
    })
  }

  deleteVariant(id: string): Promise<CatalogVariantRecord> {
    this.logger.info('PrismaCatalogRepository.deleteVariant', { id })
    return this.prisma.productVariant.delete({
      where: { id },
    })
  }

  findVariantById(id: string): Promise<(CatalogVariantRecord & { product: CatalogProductRecord }) | null> {
    this.logger.debug('PrismaCatalogRepository.findVariantById', { id })
    return this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    })
  }

  private buildProductWhere(filters: ProductListFilters): Prisma.ProductWhereInput {
    return {
      ...(filters.categoryId ? { category: { slug: filters.categoryId, isActive: true } } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.keyword
        ? {
            OR: [
              { title: { contains: filters.keyword, mode: 'insensitive' } },
              { titleTh: { contains: filters.keyword, mode: 'insensitive' } },
              { titleEn: { contains: filters.keyword, mode: 'insensitive' } },
              { description: { contains: filters.keyword, mode: 'insensitive' } },
              { descriptionTh: { contains: filters.keyword, mode: 'insensitive' } },
              { descriptionEn: { contains: filters.keyword, mode: 'insensitive' } },
              { slug: { contains: filters.keyword, mode: 'insensitive' } },
              { category: { name: { contains: filters.keyword, mode: 'insensitive' } } },
              { category: { nameTh: { contains: filters.keyword, mode: 'insensitive' } } },
              { category: { nameEn: { contains: filters.keyword, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined
        ? {
            variants: {
              some: {
                priceCents: {
                  ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}),
                  ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}),
                },
              },
            },
          }
        : {}),
    }
  }
}
