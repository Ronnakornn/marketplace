import type { Brand, Category, Prisma, PrismaClient, Product, ProductAttribute, ProductHighlight, ProductImage, ProductVariant, ProductVideo, Shop, Upload } from '#generated/client/client.ts'
import type { ProductStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ProductListFilters {
  keyword?: string
  categoryId?: string
  brandId?: string
  shopId?: string
  status?: ProductStatus
  minPrice?: number
  maxPrice?: number
  attributeFilters?: ProductAttributeFilter[]
  publicOnly?: boolean
  cursor?: string
  limit: number
}

export interface ProductAttributeFilter {
  key: string
  value: string
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

export type CatalogBrandListItem = Pick<Brand, 'id' | 'name' | 'nameTh' | 'nameEn' | 'slug' | 'code' | 'description' | 'descriptionTh' | 'descriptionEn' | 'logoUrl' | 'websiteUrl' | 'countryCode' | 'sortOrder' | 'isFeatured' | 'isActive'> & {
  createdAt: Date
  updatedAt: Date
}

export type CatalogProductImageRecord = ProductImage
export type CatalogProductVideoRecord = ProductVideo
export type CatalogUploadRecord = Upload

export interface CreateProductRecord {
  shopId: string
  categoryId?: string | null
  brandId?: string | null
  title: string
  titleTh?: string | null
  titleEn?: string | null
  slug: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  warrantyInfo?: string | null
  condition?: string | null
  countryOfOrigin?: string | null
  status: ProductStatus
  highlights?: ProductHighlightWriteRecord[]
  attributes?: ProductAttributeWriteRecord[]
}

export interface UpdateProductRecord {
  categoryId?: string | null
  brandId?: string | null
  title?: string
  titleTh?: string | null
  titleEn?: string | null
  slug?: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  warrantyInfo?: string | null
  condition?: string | null
  countryOfOrigin?: string | null
  status?: ProductStatus
  highlights?: ProductHighlightWriteRecord[]
  attributes?: ProductAttributeWriteRecord[]
}

export interface ProductHighlightWriteRecord {
  text: string
  sortOrder: number
}

export interface ProductAttributeWriteRecord {
  attributeKey: string
  displayName: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  value: string
  valueTh?: string | null
  valueEn?: string | null
  sortOrder: number
  isFilterable: boolean
}

export interface CreateVariantRecord {
  productId: string
  sku: string
  title: string
  titleTh?: string | null
  titleEn?: string | null
  price: number
  currency: string
  weightGrams?: number | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
}

export interface UpdateVariantRecord {
  sku?: string
  title?: string
  titleTh?: string | null
  titleEn?: string | null
  price?: number
  currency?: string
  weightGrams?: number | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
}

export interface CreateProductImageRecord {
  productId: string
  uploadId?: string | null
  url: string
  altText?: string | null
  sortOrder?: number
  isPrimary?: boolean
  width?: number | null
  height?: number | null
}

export interface UpdateProductImageRecord {
  uploadId?: string | null
  url?: string
  altText?: string | null
  sortOrder?: number
  isPrimary?: boolean
  width?: number | null
  height?: number | null
}

export interface UpsertProductVideoRecord {
  productId: string
  uploadId?: string | null
  url: string
  contentType: string
  fileName: string
  fileSize: number
  sortOrder?: number
}

export interface UpdateInventoryRecord {
  quantityOnHand?: number
  reorderLevel?: number
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
  brand: CatalogBrandListItem | null
  images: CatalogProductImageRecord[]
  video: CatalogProductVideoRecord | null
  highlights: ProductHighlight[]
  attributes: ProductAttribute[]
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
  findActiveBrands(): Promise<CatalogBrandListItem[]>
  findBrandById(id: string): Promise<CatalogBrandListItem | null>
  findShopById(id: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findFirstShopByOwnerId(ownerId: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findProductById(id: string): Promise<CatalogProductDetail | null>
  findProducts(filters: ProductListFilters): Promise<PaginatedResult<CatalogProductListItem>>
  findUploadById(id: string): Promise<CatalogUploadRecord | null>
  createProduct(data: CreateProductRecord): Promise<CatalogProductDetail>
  updateProduct(id: string, data: UpdateProductRecord): Promise<CatalogProductDetail>
  createProductImage(data: CreateProductImageRecord): Promise<CatalogProductImageRecord>
  updateProductImage(productId: string, imageId: string, data: UpdateProductImageRecord): Promise<CatalogProductImageRecord | null>
  deleteProductImage(productId: string, imageId: string): Promise<CatalogProductImageRecord | null>
  upsertProductVideo(data: UpsertProductVideoRecord): Promise<CatalogProductVideoRecord>
  deleteProductVideo(productId: string): Promise<CatalogProductVideoRecord | null>
  createVariant(data: CreateVariantRecord): Promise<CatalogVariantRecord>
  updateVariant(id: string, data: UpdateVariantRecord): Promise<CatalogVariantRecord>
  deleteVariant(id: string): Promise<CatalogVariantRecord>
  findVariantById(id: string): Promise<(CatalogVariantRecord & { product: CatalogProductRecord }) | null>
  updateVariantInventory(variantId: string, data: UpdateInventoryRecord): Promise<NonNullable<CatalogProductListItem['variants'][number]['inventory']>>
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
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      nameTh: true,
      nameEn: true,
      description: true,
      descriptionTh: true,
      descriptionEn: true,
      logoUrl: true,
      websiteUrl: true,
      countryCode: true,
      sortOrder: true,
      isFeatured: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  highlights: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
  attributes: {
    orderBy: [{ sortOrder: 'asc' }, { attributeKey: 'asc' }, { id: 'asc' }],
  },
  images: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
  video: true,
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
} satisfies Prisma.ProductInclude

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

  findActiveBrands(): Promise<CatalogBrandListItem[]> {
    this.logger.debug('PrismaCatalogRepository.findActiveBrands')
    return this.prisma.brand.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        nameTh: true,
        nameEn: true,
        description: true,
        descriptionTh: true,
        descriptionEn: true,
        logoUrl: true,
        websiteUrl: true,
        countryCode: true,
        sortOrder: true,
        isFeatured: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
  }

  findBrandById(id: string): Promise<CatalogBrandListItem | null> {
    this.logger.debug('PrismaCatalogRepository.findBrandById', { id })
    return this.prisma.brand.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        nameTh: true,
        nameEn: true,
        description: true,
        descriptionTh: true,
        descriptionEn: true,
        logoUrl: true,
        websiteUrl: true,
        countryCode: true,
        sortOrder: true,
        isFeatured: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
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
      where: { ownerId, status: 'ACTIVE' },
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

  async createProduct(data: CreateProductRecord): Promise<CatalogProductDetail> {
    this.logger.info('PrismaCatalogRepository.createProduct', { shopId: data.shopId, slug: data.slug })
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: this.createProductScalarData(data) })
      if (data.highlights && data.highlights.length > 0) {
        await tx.productHighlight.createMany({ data: data.highlights.map((item) => ({ ...item, productId: created.id })) })
      }
      if (data.attributes && data.attributes.length > 0) {
        await tx.productAttribute.createMany({ data: data.attributes.map((item) => ({ ...item, productId: created.id })) })
      }
      return tx.product.findUniqueOrThrow({
        where: { id: created.id },
        include: productInclude,
      })
    })
  }

  findUploadById(id: string): Promise<CatalogUploadRecord | null> {
    this.logger.debug('PrismaCatalogRepository.findUploadById', { id })
    return this.prisma.upload.findUnique({ where: { id } })
  }

  async updateProduct(id: string, data: UpdateProductRecord): Promise<CatalogProductDetail> {
    this.logger.info('PrismaCatalogRepository.updateProduct', { id })
    return this.prisma.$transaction(async (tx) => {
      if (data.highlights !== undefined) {
        await tx.productHighlight.deleteMany({ where: { productId: id } })
        if (data.highlights.length > 0) await tx.productHighlight.createMany({ data: data.highlights.map((item) => ({ ...item, productId: id })) })
      }
      if (data.attributes !== undefined) {
        await tx.productAttribute.deleteMany({ where: { productId: id } })
        if (data.attributes.length > 0) await tx.productAttribute.createMany({ data: data.attributes.map((item) => ({ ...item, productId: id })) })
      }
      return tx.product.update({
        where: { id },
        data: this.updateProductScalarData(data),
        include: productInclude,
      })
    })
  }

  async createProductImage(data: CreateProductImageRecord): Promise<CatalogProductImageRecord> {
    this.logger.info('PrismaCatalogRepository.createProductImage', { productId: data.productId })
    return this.prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId: data.productId, isPrimary: true },
          data: { isPrimary: false },
        })
      }
      return tx.productImage.create({ data })
    })
  }

  async updateProductImage(productId: string, imageId: string, data: UpdateProductImageRecord): Promise<CatalogProductImageRecord | null> {
    this.logger.info('PrismaCatalogRepository.updateProductImage', { productId, imageId })
    return this.prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } })
      if (!image) return null
      if (data.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId, isPrimary: true, id: { not: imageId } },
          data: { isPrimary: false },
        })
      }
      return tx.productImage.update({
        where: { id: imageId },
        data,
      })
    })
  }

  async deleteProductImage(productId: string, imageId: string): Promise<CatalogProductImageRecord | null> {
    this.logger.info('PrismaCatalogRepository.deleteProductImage', { productId, imageId })
    return this.prisma.$transaction(async (tx) => {
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } })
      if (!image) return null
      return tx.productImage.delete({ where: { id: imageId } })
    })
  }

  upsertProductVideo(data: UpsertProductVideoRecord): Promise<CatalogProductVideoRecord> {
    this.logger.info('PrismaCatalogRepository.upsertProductVideo', { productId: data.productId })
    return this.prisma.productVideo.upsert({
      where: { productId: data.productId },
      create: data,
      update: {
        uploadId: data.uploadId,
        url: data.url,
        contentType: data.contentType,
        fileName: data.fileName,
        fileSize: data.fileSize,
        sortOrder: data.sortOrder ?? 0,
      },
    })
  }

  async deleteProductVideo(productId: string): Promise<CatalogProductVideoRecord | null> {
    this.logger.info('PrismaCatalogRepository.deleteProductVideo', { productId })
    const video = await this.prisma.productVideo.findUnique({ where: { productId } })
    if (!video) return null
    return this.prisma.productVideo.delete({ where: { productId } })
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

  updateVariantInventory(variantId: string, data: UpdateInventoryRecord): Promise<NonNullable<CatalogProductListItem['variants'][number]['inventory']>> {
    this.logger.info('PrismaCatalogRepository.updateVariantInventory', { variantId })
    return this.prisma.inventory.upsert({
      where: { variantId },
      create: {
        variantId,
        quantityOnHand: data.quantityOnHand ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
      },
      update: data,
    })
  }

  private buildProductWhere(filters: ProductListFilters): Prisma.ProductWhereInput {
    return {
      deletedAt: null,
      ...(filters.categoryId ? { category: { slug: filters.categoryId, isActive: true } } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.publicOnly ? { shop: { status: 'ACTIVE' } } : {}),
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
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            variants: {
              some: {
                price: {
                  ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
                  ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
                },
              },
            },
          }
        : {}),
    }
  }

  private createProductScalarData(data: CreateProductRecord): Omit<CreateProductRecord, 'highlights' | 'attributes'> {
    const { highlights: _highlights, attributes: _attributes, ...scalars } = data
    return scalars
  }

  private updateProductScalarData(data: UpdateProductRecord): Omit<UpdateProductRecord, 'highlights' | 'attributes'> {
    const { highlights: _highlights, attributes: _attributes, ...scalars } = data
    return scalars
  }
}
