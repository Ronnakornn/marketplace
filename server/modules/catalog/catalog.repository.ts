import type { Brand, Category, CategoryAttributeDefinition, ModerationAction, ModerationCase, Prisma, PrismaClient, Product, ProductAttribute, ProductHighlight, ProductImage, ProductOption, ProductOptionValue, ProductVariant, ProductVariantOptionValue, ProductVideo, Shop, ShopAddress, Upload } from '#generated/client/client.ts'
import type { ProductStatus } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_FACET_OPTIONS = 20

export interface ProductListFilters {
  keyword?: string
  categoryId?: string
  brandId?: string
  shopId?: string
  status?: ProductStatus
  minPrice?: number
  maxPrice?: number
  sort?: string
  attributeFilters?: ProductAttributeFilter[]
  publicOnly?: boolean
  excludeProductId?: string
  cursor?: string
  page?: number
  limit: number
}

export interface CatalogProductMetric {
  productId: string
  rating: number
  ratingCount: number
  soldCount: number
}

export interface ProductAttributeFilter {
  key: string
  value: string
}

export interface PaginatedResult<T> {
  data: T[]
  items?: T[]
  meta: {
    nextCursor: string | null
    hasNextPage: boolean
    totalCount?: number
    page?: number
    pageSize?: number
    query?: {
      q?: string
      categoryId?: string
      brandId?: string
      minPrice?: number
      maxPrice?: number
      sort?: string
    }
  }
  facets?: ProductListingFacets
}

export interface ProductListingFacets {
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

export type CatalogCategoryListItem = Pick<Category, 'id' | 'name' | 'slug' | 'sortOrder' | 'isActive'> & {
  nameTh?: string | null
  nameEn?: string | null
}

export type CatalogAdminCategoryRecord = Pick<Category, 'id' | 'parentId' | 'name' | 'nameTh' | 'nameEn' | 'slug' | 'sortOrder' | 'isActive' | 'createdAt' | 'updatedAt'>
export type CatalogCategorySpecRecord = CategoryAttributeDefinition
export type CatalogCategoryWithSpecs = Pick<Category, 'id' | 'isActive'> & {
  attributeDefinitions: CatalogCategorySpecRecord[]
}

export interface CreateCategoryRecord {
  parentId?: string | null
  name: string
  nameTh?: string | null
  nameEn?: string | null
  slug: string
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateCategoryRecord {
  parentId?: string | null
  name?: string
  nameTh?: string | null
  nameEn?: string | null
  slug?: string
  sortOrder?: number
  isActive?: boolean
}

export interface ReorderCategoryRecord {
  id: string
  sortOrder: number
}

export interface CreateCategorySpecRecord {
  categoryId: string
  attributeKey: string
  displayName: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  valueType: CategoryAttributeDefinition['valueType']
  isRequired?: boolean
  isFilterable?: boolean
  unit?: string | null
  allowedValues?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateCategorySpecRecord {
  attributeKey?: string
  displayName?: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  valueType?: CategoryAttributeDefinition['valueType']
  isRequired?: boolean
  isFilterable?: boolean
  unit?: string | null
  allowedValues?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
  sortOrder?: number
  isActive?: boolean
}

export interface ReorderCategorySpecRecord {
  id: string
  sortOrder: number
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
  optionValueIds?: string[]
  optionCombinationKey?: string | null
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
  optionValueIds?: string[]
  optionCombinationKey?: string | null
}

export interface ProductOptionValueWriteRecord {
  value: string
  valueTh?: string | null
  valueEn?: string | null
  displayType?: string
  colorHex?: string | null
  sortOrder: number
}

export interface ProductOptionWriteRecord {
  name: string
  nameTh?: string | null
  nameEn?: string | null
  sortOrder: number
  values: ProductOptionValueWriteRecord[]
}

export interface UpdateImageOrderRecord {
  id: string
  sortOrder: number
  isPrimary: boolean
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
    isActive: boolean
  } | null
  brand: CatalogBrandListItem | null
  images: CatalogProductImageRecord[]
  video: CatalogProductVideoRecord | null
  highlights: ProductHighlight[]
  attributes: ProductAttribute[]
  options: CatalogProductOptionRecord[]
  shop: Pick<Shop, 'id' | 'name' | 'slug' | 'ownerId' | 'status'> & {
    addresses?: Array<Pick<ShopAddress, 'city' | 'region' | 'country'>>
  }
  rating?: number
  ratingSummary?: {
    averageRating: number
    totalReviewCount: number
  }
  soldCount?: number
  variants: Array<(Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
    titleTh?: string | null
    titleEn?: string | null
  }) & {
    optionValues: CatalogVariantOptionValueRecord[]
    inventory: {
      id: string
      quantityOnHand: number
      quantityReserved: number
      reorderLevel: number
      updatedAt: Date
    } | null
  }>
}

export type CatalogVariantRecord = Omit<ProductVariant, 'titleTh' | 'titleEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  optionValues?: CatalogVariantOptionValueRecord[]
}

export type CatalogProductOptionRecord = ProductOption & {
  values: ProductOptionValue[]
}

export type CatalogVariantOptionValueRecord = ProductVariantOptionValue & {
  optionValue: ProductOptionValue & {
    option: Pick<ProductOption, 'id' | 'productId' | 'name' | 'nameTh' | 'nameEn' | 'sortOrder'>
  }
}

export type CatalogModerationCaseRecord = ModerationCase & {
  actions: ModerationAction[]
}

export type CatalogProductDetail = CatalogProductListItem & {
  moderationCase?: CatalogModerationCaseRecord | null
}

export type CatalogProductRecord = Omit<Product, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
}

export interface ICatalogRepository {
  findActiveCategories(): Promise<CatalogCategoryListItem[]>
  findCategoryWithSpecs(id: string): Promise<CatalogCategoryWithSpecs | null>
  findCategorySpecsByAttributeKeys(attributeKeys: string[]): Promise<CatalogCategorySpecRecord[]>
  findAdminCategories(): Promise<CatalogAdminCategoryRecord[]>
  createCategory(data: CreateCategoryRecord): Promise<CatalogAdminCategoryRecord>
  updateCategory(id: string, data: UpdateCategoryRecord): Promise<CatalogAdminCategoryRecord>
  updateCategoryActiveState(id: string, isActive: boolean): Promise<CatalogAdminCategoryRecord>
  reorderSiblingCategories(parentId: string | null, categories: ReorderCategoryRecord[]): Promise<CatalogAdminCategoryRecord[]>
  findAdminCategorySpecs(categoryId: string): Promise<CatalogCategorySpecRecord[]>
  createCategorySpec(data: CreateCategorySpecRecord): Promise<CatalogCategorySpecRecord>
  updateCategorySpec(id: string, data: UpdateCategorySpecRecord): Promise<CatalogCategorySpecRecord>
  updateCategorySpecActiveState(id: string, isActive: boolean): Promise<CatalogCategorySpecRecord>
  reorderCategorySpecs(categoryId: string, specs: ReorderCategorySpecRecord[]): Promise<CatalogCategorySpecRecord[]>
  findActiveBrands(): Promise<CatalogBrandListItem[]>
  findBrandById(id: string): Promise<CatalogBrandListItem | null>
  findShopById(id: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findFirstShopByOwnerId(ownerId: string): Promise<Pick<Shop, 'id' | 'ownerId' | 'status'> | null>
  findProductById(id: string): Promise<CatalogProductDetail | null>
  findProductMetrics(productIds: string[]): Promise<CatalogProductMetric[]>
  findRelatedProducts(product: Pick<Product, 'id' | 'categoryId' | 'shopId' | 'brandId'>, limit: number): Promise<CatalogProductListItem[]>
  findProducts(filters: ProductListFilters): Promise<PaginatedResult<CatalogProductListItem>>
  findProductFacets(filters: ProductListFilters): Promise<ProductListingFacets>
  findUploadById(id: string): Promise<CatalogUploadRecord | null>
  createProduct(data: CreateProductRecord): Promise<CatalogProductDetail>
  updateProduct(id: string, data: UpdateProductRecord): Promise<CatalogProductDetail>
  createProductImage(data: CreateProductImageRecord): Promise<CatalogProductImageRecord>
  updateProductImage(productId: string, imageId: string, data: UpdateProductImageRecord): Promise<CatalogProductImageRecord | null>
  deleteProductImage(productId: string, imageId: string): Promise<CatalogProductImageRecord | null>
  upsertProductVideo(data: UpsertProductVideoRecord): Promise<CatalogProductVideoRecord>
  deleteProductVideo(productId: string): Promise<CatalogProductVideoRecord | null>
  replaceProductOptions(productId: string, options: ProductOptionWriteRecord[]): Promise<CatalogProductDetail>
  updateProductImagesOrder(productId: string, images: UpdateImageOrderRecord[]): Promise<CatalogProductImageRecord[]>
  createVariant(data: CreateVariantRecord): Promise<CatalogVariantRecord>
  updateVariant(id: string, data: UpdateVariantRecord): Promise<CatalogVariantRecord>
  deleteVariant(id: string): Promise<CatalogVariantRecord>
  findVariantById(id: string): Promise<(CatalogVariantRecord & { product: CatalogProductRecord }) | null>
  updateVariantInventory(variantId: string, data: UpdateInventoryRecord): Promise<NonNullable<CatalogProductListItem['variants'][number]['inventory']>>
  findLatestModerationCase(productId: string): Promise<CatalogModerationCaseRecord | null>
  createModerationAction(productId: string, actorId: string, action: string, note?: string | null): Promise<CatalogModerationCaseRecord>
}

const adminCategorySelect = {
  id: true,
  parentId: true,
  name: true,
  nameTh: true,
  nameEn: true,
  slug: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      nameTh: true,
      nameEn: true,
      slug: true,
      isActive: true,
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
  options: {
    include: {
      values: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
  images: {
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  },
  video: true,
  shop: {
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      status: true,
      logoUrl: true,
      coverUrl: true,
      ratingAverage: true,
      ratingCount: true,
      followerCount: true,
      productCount: true,
      addresses: {
        where: { type: 'PICKUP' },
        select: { city: true, region: true, country: true },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        take: 1,
      },
    },
  },
  variants: {
    include: {
      inventory: true,
      optionValues: {
        include: {
          optionValue: {
            include: {
              option: {
                select: {
                  id: true,
                  productId: true,
                  name: true,
                  nameTh: true,
                  nameEn: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
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
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  findCategoryWithSpecs(id: string): Promise<CatalogCategoryWithSpecs | null> {
    this.logger.debug('PrismaCatalogRepository.findCategoryWithSpecs', { id })
    return this.prisma.category.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        isActive: true,
        attributeDefinitions: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { attributeKey: 'asc' }, { id: 'asc' }],
        },
      },
    })
  }

  findCategorySpecsByAttributeKeys(attributeKeys: string[]): Promise<CatalogCategorySpecRecord[]> {
    this.logger.debug('PrismaCatalogRepository.findCategorySpecsByAttributeKeys', { attributeKeyCount: attributeKeys.length })
    if (attributeKeys.length === 0) return Promise.resolve([])
    return this.prisma.categoryAttributeDefinition.findMany({
      where: { attributeKey: { in: attributeKeys } },
      orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }, { attributeKey: 'asc' }, { id: 'asc' }],
    })
  }

  findAdminCategories(): Promise<CatalogAdminCategoryRecord[]> {
    this.logger.debug('PrismaCatalogRepository.findAdminCategories')
    return this.prisma.category.findMany({
      select: adminCategorySelect,
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    })
  }

  createCategory(data: CreateCategoryRecord): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('PrismaCatalogRepository.createCategory', { slug: data.slug, parentId: data.parentId })
    return this.prisma.category.create({
      data,
      select: adminCategorySelect,
    })
  }

  updateCategory(id: string, data: UpdateCategoryRecord): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('PrismaCatalogRepository.updateCategory', { id })
    return this.prisma.category.update({
      where: { id },
      data,
      select: adminCategorySelect,
    })
  }

  updateCategoryActiveState(id: string, isActive: boolean): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('PrismaCatalogRepository.updateCategoryActiveState', { id, isActive })
    return this.prisma.category.update({
      where: { id },
      data: { isActive },
      select: adminCategorySelect,
    })
  }

  async reorderSiblingCategories(parentId: string | null, categories: ReorderCategoryRecord[]): Promise<CatalogAdminCategoryRecord[]> {
    this.logger.info('PrismaCatalogRepository.reorderSiblingCategories', { parentId, categoryCount: categories.length })
    return this.prisma.$transaction(async (tx) => {
      const ids = categories.map((category) => category.id)
      const existing = await tx.category.findMany({
        where: {
          id: { in: ids },
          parentId,
        },
        select: { id: true },
      })
      if (existing.length !== ids.length) {
        throw new Error('CATEGORY_REORDER_SIBLING_MISMATCH')
      }
      for (const category of categories) {
        await tx.category.update({
          where: { id: category.id },
          data: { sortOrder: category.sortOrder },
        })
      }
      return tx.category.findMany({
        where: { parentId },
        select: adminCategorySelect,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      })
    })
  }

  findAdminCategorySpecs(categoryId: string): Promise<CatalogCategorySpecRecord[]> {
    this.logger.debug('PrismaCatalogRepository.findAdminCategorySpecs', { categoryId })
    return this.prisma.categoryAttributeDefinition.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: 'asc' }, { attributeKey: 'asc' }, { id: 'asc' }],
    })
  }

  createCategorySpec(data: CreateCategorySpecRecord): Promise<CatalogCategorySpecRecord> {
    this.logger.info('PrismaCatalogRepository.createCategorySpec', { categoryId: data.categoryId, attributeKey: data.attributeKey })
    return this.prisma.categoryAttributeDefinition.create({ data })
  }

  updateCategorySpec(id: string, data: UpdateCategorySpecRecord): Promise<CatalogCategorySpecRecord> {
    this.logger.info('PrismaCatalogRepository.updateCategorySpec', { id })
    return this.prisma.categoryAttributeDefinition.update({
      where: { id },
      data,
    })
  }

  updateCategorySpecActiveState(id: string, isActive: boolean): Promise<CatalogCategorySpecRecord> {
    this.logger.info('PrismaCatalogRepository.updateCategorySpecActiveState', { id, isActive })
    return this.prisma.categoryAttributeDefinition.update({
      where: { id },
      data: { isActive },
    })
  }

  async reorderCategorySpecs(categoryId: string, specs: ReorderCategorySpecRecord[]): Promise<CatalogCategorySpecRecord[]> {
    this.logger.info('PrismaCatalogRepository.reorderCategorySpecs', { categoryId, specCount: specs.length })
    return this.prisma.$transaction(async (tx) => {
      const ids = specs.map((spec) => spec.id)
      const existing = await tx.categoryAttributeDefinition.findMany({
        where: {
          id: { in: ids },
          categoryId,
        },
        select: { id: true },
      })
      if (existing.length !== ids.length) {
        throw new Error('CATEGORY_SPEC_REORDER_CATEGORY_MISMATCH')
      }
      for (const spec of specs) {
        await tx.categoryAttributeDefinition.update({
          where: { id: spec.id },
          data: { sortOrder: spec.sortOrder },
        })
      }
      return tx.categoryAttributeDefinition.findMany({
        where: { categoryId },
        orderBy: [{ sortOrder: 'asc' }, { attributeKey: 'asc' }, { id: 'asc' }],
      })
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

  async findProductMetrics(productIds: string[]): Promise<CatalogProductMetric[]> {
    const uniqueProductIds = [...new Set(productIds)]
    if (uniqueProductIds.length === 0) return []
    this.logger.debug('PrismaCatalogRepository.findProductMetrics', { productCount: uniqueProductIds.length })

    const [ratingRows, variants] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: uniqueProductIds }, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.prisma.productVariant.findMany({
        where: { productId: { in: uniqueProductIds } },
        select: { id: true, productId: true },
      }),
    ])
    const variantProductIds = new Map(variants.map((variant) => [variant.id, variant.productId]))
    const salesRows = variants.length === 0
      ? []
      : await this.prisma.orderItem.groupBy({
          by: ['variantId'],
          where: {
            variantId: { in: variants.map((variant) => variant.id) },
            order: { paymentStatus: 'SUCCEEDED' },
          },
          _sum: { quantity: true },
        })
    const ratingByProductId = new Map(ratingRows.map((row) => [row.productId, row]))
    const soldByProductId = new Map<string, number>()
    for (const row of salesRows) {
      const productId = variantProductIds.get(row.variantId)
      if (!productId) continue
      soldByProductId.set(productId, (soldByProductId.get(productId) ?? 0) + (row._sum.quantity ?? 0))
    }

    return uniqueProductIds.map((productId) => {
      const rating = ratingByProductId.get(productId)
      return {
        productId,
        rating: rating?._avg.rating === null || rating?._avg.rating === undefined
          ? 0
          : Number(Number(rating._avg.rating).toFixed(2)),
        ratingCount: rating?._count.rating ?? 0,
        soldCount: soldByProductId.get(productId) ?? 0,
      }
    })
  }

  async findProducts(filters: ProductListFilters): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('PrismaCatalogRepository.findProducts', { filters })
    const where = this.buildProductWhere(filters)
    const page = filters.page ?? 1
    const skip = filters.cursor ? 1 : (page - 1) * filters.limit
    const cursor = filters.cursor ? { id: filters.cursor } : undefined
    const take = filters.cursor ? filters.limit + 1 : filters.limit
    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      // ponytail: price sorting materializes matching products; replace with a composite SQL cursor if storefront scale proves this costly.
      const rows = await this.prisma.product.findMany({ where, include: productInclude })
      const direction = filters.sort === 'price_asc' ? 1 : -1
      const sorted = rows
        .filter((product) => product.variants.some((variant) => variant.status === 'ACTIVE'))
        .sort((left, right) => {
          const leftPrice = Math.min(...left.variants.filter((variant) => variant.status === 'ACTIVE').map((variant) => Number(variant.price)))
          const rightPrice = Math.min(...right.variants.filter((variant) => variant.status === 'ACTIVE').map((variant) => Number(variant.price)))
          return (leftPrice - rightPrice) * direction || left.id.localeCompare(right.id)
        })
      const data = sorted.slice(skip, skip + filters.limit)
      return {
        data, items: data,
        meta: {
          nextCursor: null, totalCount: sorted.length, page, pageSize: filters.limit,
          hasNextPage: skip + filters.limit < sorted.length,
          query: this.buildResultQuery(filters),
        },
      }
    }
    const [rows, totalCount] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        cursor,
        skip,
        take: take + (filters.cursor ? 0 : 1),
      }),
      this.prisma.product.count({ where }),
    ])
    const hasNextPage = rows.length > filters.limit
    const data = hasNextPage ? rows.slice(0, filters.limit) : rows

    return {
      data,
      items: data,
      meta: {
        nextCursor: hasNextPage ? data.at(-1)?.id ?? null : null,
        totalCount,
        page,
        pageSize: filters.limit,
        hasNextPage,
        query: this.buildResultQuery(filters),
      },
    }
  }

  async findProductFacets(filters: ProductListFilters): Promise<ProductListingFacets> {
    this.logger.debug('PrismaCatalogRepository.findProductFacets', { filters })
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

  async findRelatedProducts(product: Pick<Product, 'id' | 'categoryId' | 'shopId' | 'brandId'>, limit: number): Promise<CatalogProductListItem[]> {
    this.logger.debug('PrismaCatalogRepository.findRelatedProducts', { productId: product.id, limit })
    const seen = new Set<string>([product.id])
    const rows: CatalogProductListItem[] = []

    const addRows = async (where: Prisma.ProductWhereInput) => {
      if (rows.length >= limit) return
      const batch = await this.prisma.product.findMany({
        where: {
          ...this.publicRelatedProductWhere(product.id),
          id: { notIn: [...seen] },
          ...where,
        },
        include: productInclude,
        orderBy: [
          { variants: { _count: 'desc' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        take: limit - rows.length,
      })
      for (const row of batch) {
        seen.add(row.id)
        rows.push(row)
      }
    }

    if (product.categoryId) await addRows({ categoryId: product.categoryId })
    if (product.shopId || product.brandId) {
      await addRows({
        OR: [
          ...(product.shopId ? [{ shopId: product.shopId }] : []),
          ...(product.brandId ? [{ brandId: product.brandId }] : []),
        ],
      })
    }
    await addRows({})

    return rows
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

  async replaceProductOptions(productId: string, options: ProductOptionWriteRecord[]): Promise<CatalogProductDetail> {
    this.logger.info('PrismaCatalogRepository.replaceProductOptions', { productId, optionCount: options.length })
    return this.prisma.$transaction(async (tx) => {
      await tx.productOption.deleteMany({ where: { productId } })
      for (const option of options) {
        await tx.productOption.create({
          data: {
            productId,
            name: option.name,
            nameTh: option.nameTh,
            nameEn: option.nameEn,
            sortOrder: option.sortOrder,
            values: {
              create: option.values.map((value) => ({
                value: value.value,
                valueTh: value.valueTh,
                valueEn: value.valueEn,
                displayType: value.displayType ?? 'TEXT',
                colorHex: value.colorHex,
                sortOrder: value.sortOrder,
              })),
            },
          },
        })
      }
      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude })
    })
  }

  async updateProductImagesOrder(productId: string, images: UpdateImageOrderRecord[]): Promise<CatalogProductImageRecord[]> {
    this.logger.info('PrismaCatalogRepository.updateProductImagesOrder', { productId, imageCount: images.length })
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.productImage.findMany({ where: { productId }, select: { id: true } })
      const existingIds = new Set(existing.map((image) => image.id))
      if (existing.length !== images.length || images.some((image) => !existingIds.has(image.id))) {
        throw new Error('PRODUCT_IMAGE_ORDER_MISMATCH')
      }
      for (const image of images) {
        await tx.productImage.update({
          where: { id: image.id },
          data: { sortOrder: image.sortOrder, isPrimary: image.isPrimary },
        })
      }
      return tx.productImage.findMany({
        where: { productId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      })
    })
  }

  async createVariant(data: CreateVariantRecord): Promise<CatalogVariantRecord> {
    this.logger.info('PrismaCatalogRepository.createVariant', { productId: data.productId, sku: data.sku })
    const { optionValueIds, ...variantData } = data
    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          ...variantData,
          optionValues: optionValueIds && optionValueIds.length > 0
            ? { create: optionValueIds.map((optionValueId) => ({ optionValueId })) }
            : undefined,
        },
        include: productVariantInclude,
      })
      return variant
    })
  }

  async updateVariant(id: string, data: UpdateVariantRecord): Promise<CatalogVariantRecord> {
    this.logger.info('PrismaCatalogRepository.updateVariant', { id })
    const { optionValueIds, ...variantData } = data
    return this.prisma.$transaction(async (tx) => {
      if (optionValueIds !== undefined) {
        await tx.productVariantOptionValue.deleteMany({ where: { variantId: id } })
      }
      return tx.productVariant.update({
        where: { id },
        data: {
          ...variantData,
          optionValues: optionValueIds && optionValueIds.length > 0
            ? { create: optionValueIds.map((optionValueId) => ({ optionValueId })) }
            : undefined,
        },
        include: productVariantInclude,
      })
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
      include: { ...productVariantInclude, product: true },
    })
  }

  async findLatestModerationCase(productId: string): Promise<CatalogModerationCaseRecord | null> {
    this.logger.debug('PrismaCatalogRepository.findLatestModerationCase', { productId })
    return this.prisma.moderationCase.findFirst({
      where: {
        entityType: 'PRODUCT',
        entityId: productId,
      },
      include: { actions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createModerationAction(productId: string, actorId: string, action: string, note?: string | null): Promise<CatalogModerationCaseRecord> {
    this.logger.info('PrismaCatalogRepository.createModerationAction', { productId, actorId, action })
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.moderationCase.findFirst({
        where: {
          entityType: 'PRODUCT',
          entityId: productId,
          status: { in: ['OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED'] },
        },
        orderBy: { createdAt: 'desc' },
      })
      const moderationCase = existing ?? await tx.moderationCase.create({
        data: {
          entityType: 'PRODUCT',
          entityId: productId,
          reason: action === 'REJECT' || action === 'SUSPEND' ? 'POLICY_VIOLATION' : 'OTHER',
          status: 'UNDER_REVIEW',
          title: `Product ${action.toLowerCase()} review`,
          createdById: actorId,
        },
      })
      await tx.moderationAction.create({
        data: {
          caseId: moderationCase.id,
          actorId,
          action: action as never,
          note,
        },
      })
      const resolvedStatus = action === 'ESCALATE' || action === 'NOTE' ? moderationCase.status : 'RESOLVED'
      return tx.moderationCase.update({
        where: { id: moderationCase.id },
        data: {
          status: resolvedStatus,
          resolvedAt: resolvedStatus === 'RESOLVED' ? new Date() : moderationCase.resolvedAt,
        },
        include: { actions: { orderBy: { createdAt: 'desc' } } },
      })
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
      ...(filters.excludeProductId ? { id: { not: filters.excludeProductId } } : {}),
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

  private buildResultQuery(filters: ProductListFilters): NonNullable<PaginatedResult<CatalogProductListItem>['meta']['query']> {
    return {
      ...(filters.keyword ? { q: filters.keyword } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.brandId ? { brandId: filters.brandId } : {}),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.sort ? { sort: filters.sort } : {}),
    }
  }

  private publicRelatedProductWhere(productId: string): Prisma.ProductWhereInput {
    return {
      id: { not: productId },
      status: 'ACTIVE',
      deletedAt: null,
      shop: { status: 'ACTIVE' },
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

const productVariantInclude = {
  optionValues: {
    include: {
      optionValue: {
        include: {
          option: {
            select: {
              id: true,
              productId: true,
              name: true,
              nameTh: true,
              nameEn: true,
              sortOrder: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ProductVariantInclude
