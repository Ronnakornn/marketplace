import type { ProductStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation, CacheService } from '#server/modules/cache'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { ActiveShopResolver } from '#server/modules/security'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import { CatalogServiceError } from './catalog.errors.ts'
import type {
  CatalogProductDetail,
  CatalogProductRecord,
  CatalogVariantRecord,
  CatalogBrandListItem,
  CatalogProductImageRecord,
  CatalogProductVideoRecord,
  CatalogCategoryListItem,
  CatalogProductListItem,
  ICatalogRepository,
  PaginatedResult,
} from './catalog.repository.ts'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 50
const MAX_PRODUCT_IMAGES = 10
const PRODUCT_VIDEO_CONTENT_TYPES = new Set(['video/mp4', 'video/webm'])
const PRODUCT_VIDEO_MAX_FILE_SIZE = 25 * 1024 * 1024

export interface CatalogActor {
  id: string
  role: Role
}

export interface CreateProductData {
  shopId?: string
  categoryId?: string | null
  brandId?: string | null
  title: string
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
  highlights?: ProductHighlightData[]
  attributes?: ProductAttributeData[]
  status?: ProductStatus
}

export interface UpdateProductData {
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
  highlights?: ProductHighlightData[]
  attributes?: ProductAttributeData[]
  status?: ProductStatus
}

export interface ProductHighlightData {
  text: string
  sortOrder?: number
}

export interface ProductAttributeData {
  attributeKey?: string
  displayName: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  value: string
  valueTh?: string | null
  valueEn?: string | null
  sortOrder?: number
  isFilterable?: boolean
}

export interface CreateVariantData {
  sku: string
  title: string
  titleTh?: string | null
  titleEn?: string | null
  price: number
  currency?: string
  weightGrams?: number | null
  lengthMm?: number | null
  widthMm?: number | null
  heightMm?: number | null
}

export interface UpdateVariantData {
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

export interface CreateProductImageData {
  uploadId?: string | null
  url?: string
  altText?: string | null
  sortOrder?: number
  isPrimary?: boolean
  width?: number | null
  height?: number | null
}

export interface UpdateProductImageData {
  uploadId?: string | null
  url?: string
  altText?: string | null
  sortOrder?: number
  isPrimary?: boolean
  width?: number | null
  height?: number | null
}

export interface UpsertProductVideoData {
  uploadId: string
  sortOrder?: number
}

export interface UpdateInventoryData {
  quantityOnHand?: number
  reorderLevel?: number
}

export interface PublicListProductsData {
  keyword?: string
  categoryId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  brandId?: string
  attributes?: Record<string, string> | Array<{ key: string; value: string }>
  cursor?: string
  limit?: number
  locale?: string
}

export interface SellerListProductsData extends PublicListProductsData {
  status?: ProductStatus
}

export class CatalogService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ICatalogRepository,
    private cache?: CacheService,
    private cacheInvalidation?: CacheInvalidation,
    private eventPublisher?: EventPublisherService,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async listCategories(localeInput?: string): Promise<CatalogCategoryListItem[]> {
    this.logger.debug('CatalogService.listCategories')
    const locale = resolveContentLocale(localeInput)
    const categories = !this.cache ? await this.repo.findActiveCategories() : await this.cache.remember(
      this.cache.keys.categoryList(locale),
      () => this.repo.findActiveCategories(),
      { ttlSeconds: this.cache.ttl().product },
    )
    return categories.map((category) => this.localizeCategory(category, locale))
  }

  listActiveBrands(): Promise<CatalogBrandListItem[]> {
    this.logger.debug('CatalogService.listActiveBrands')
    return this.repo.findActiveBrands()
  }

  async listPublicProducts(filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicProducts', { filters })
    const locale = resolveContentLocale(filters.locale)
    const normalizedFilters = {
      ...this.normalizeListFilters(filters),
      status: 'ACTIVE',
      publicOnly: true,
    } as const
    const cacheFilters = { ...normalizedFilters, locale }

    const result = !this.cache ? await this.repo.findProducts(normalizedFilters) : await this.cache.remember(
      this.cache.keys.productList(cacheFilters),
      () => this.repo.findProducts(normalizedFilters),
      { ttlSeconds: this.cache.ttl().product },
    )
    return {
      ...result,
      data: result.data.map((product) => this.localizeProduct(product, locale)),
    }
  }

  listPublicShopProducts(shopId: string, filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicShopProducts', { shopId, filters })
    return this.listPublicProducts({ ...filters, shopId })
  }

  async getPublicProductDetail(id: string, localeInput?: string): Promise<CatalogProductDetail> {
    this.logger.debug('CatalogService.getPublicProductDetail', { id })
    const locale = resolveContentLocale(localeInput)
    const product = this.cache
      ? await this.cache.remember(
          this.cache.keys.productDetail(id, locale),
          () => this.repo.findProductById(id),
          { ttlSeconds: this.cache.ttl().product },
        )
      : await this.repo.findProductById(id)
    if (!product || product.status !== 'ACTIVE' || product.deletedAt || product.shop.status !== 'ACTIVE') {
      throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    }
    return this.localizeProduct(product, locale)
  }

  listAdminProducts(filters: SellerListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listAdminProducts', { filters })
    return this.repo.findProducts({
      ...this.normalizeListFilters(filters),
      status: filters.status,
    })
  }

  async getAdminProductDetail(id: string): Promise<CatalogProductDetail> {
    this.logger.debug('CatalogService.getAdminProductDetail', { id })
    const product = await this.repo.findProductById(id)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    return product
  }

  async updateAdminProduct(productId: string, data: UpdateProductData): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.updateAdminProduct', { productId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one product field is required', 400, 'PRODUCT_VALIDATION_FAILED')
    }
    const product = await this.repo.findProductById(productId)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    if (data.title !== undefined && !data.title.trim()) {
      throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
    }
    await this.validateBrand(data.brandId)
    await this.assertPublishReady(product, data)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateProduct(product.id, {
        ...(data.categoryId === undefined ? {} : { categoryId: this.normalizeNullableText(data.categoryId) }),
        ...(data.brandId === undefined ? {} : { brandId: this.normalizeNullableText(data.brandId) }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
        ...this.normalizeProductEnrichment(data, true),
        ...(data.status === undefined ? {} : { status: data.status }),
      }),
    )
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    await this.publishBestEffort('product.updated', updated.id, undefined, {
      productId: updated.id,
      shopId: updated.shopId,
      changedFields: Object.keys(data),
    })
    return updated
  }

  async createAdminVariant(productId: string, data: CreateVariantData): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.createAdminVariant', { productId, sku: data.sku })
    this.validateVariantInput(data)
    const product = await this.repo.findProductById(productId)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    await this.validateBrand(undefined)

   const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        price: data.price,
        currency: data.currency?.trim().toUpperCase() || 'USD',
        ...this.normalizeVariantShippingFields(data),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return variant
  }

  async updateAdminVariant(productId: string, variantId: string, data: UpdateVariantData): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.updateAdminVariant', { productId, variantId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one variant field is required', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.validateVariantUpdateInput(data)
    const variant = await this.repo.findVariantById(variantId)
    if (!variant || variant.productId !== productId) {
      throw new CatalogServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    }

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateVariant(variantId, {
        ...(data.sku === undefined ? {} : { sku: data.sku.trim() }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        ...(data.price === undefined ? {} : { price: data.price }),
        ...(data.currency === undefined ? {} : { currency: data.currency.trim().toUpperCase() }),
        ...this.normalizeVariantShippingFields(data),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return updated
  }

  async deleteAdminVariant(productId: string, variantId: string): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.deleteAdminVariant', { productId, variantId })
    const variant = await this.repo.findVariantById(variantId)
    if (!variant || variant.productId !== productId) {
      throw new CatalogServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    }
    const deleted = await this.repo.deleteVariant(variantId)
    await this.cacheInvalidation?.invalidateVariant(productId)
    return deleted
  }

  async listSellerProducts(actor: CatalogActor, filters: SellerListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listSellerProducts', { actorId: actor.id, filters })
    const shop = await this.resolveSellerShop(actor, filters.shopId)

    return this.repo.findProducts({
      ...this.normalizeListFilters(filters),
      shopId: shop.id,
      status: filters.status,
    })
  }

  async createProduct(actor: CatalogActor, data: CreateProductData): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.createProduct', { actorId: actor.id, shopId: data.shopId })
    this.validateProductInput(data)
    await this.validateBrand(data.brandId)

    const shop = await this.resolveSellerShop(actor, data.shopId)
    this.assertCanManageShop(actor, shop.ownerId)

    const created = await this.handleUniqueConstraint(() =>
      this.repo.createProduct({
        shopId: shop.id,
        categoryId: this.normalizeNullableText(data.categoryId),
        brandId: this.normalizeNullableText(data.brandId),
        title: data.title.trim(),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        slug: this.normalizeSlug(data.slug ?? data.title),
        description: this.normalizeNullableText(data.description),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
        ...this.normalizeProductEnrichment(data, false),
        status: data.status ?? 'DRAFT',
      }),
    )
    await this.cacheInvalidation?.invalidateProductListsAndSearch()
    await this.invalidateSellerDashboardForShop(created.shopId)
    await this.publishBestEffort('product.created', created.id, actor.id, {
      productId: created.id,
      shopId: created.shopId,
      status: created.status,
    })
    return created
  }

  async updateProduct(actor: CatalogActor, productId: string, data: UpdateProductData): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.updateProduct', { actorId: actor.id, productId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one product field is required', 400, 'PRODUCT_VALIDATION_FAILED')
    }

    const product = await this.getManageableProduct(actor, productId)

    if (data.title !== undefined && !data.title.trim()) {
      throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
    }
    await this.validateBrand(data.brandId)
    await this.assertPublishReady(product, data)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateProduct(product.id, {
        ...(data.categoryId === undefined ? {} : { categoryId: this.normalizeNullableText(data.categoryId) }),
        ...(data.brandId === undefined ? {} : { brandId: this.normalizeNullableText(data.brandId) }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
        ...this.normalizeProductEnrichment(data, true),
        ...(data.status === undefined ? {} : { status: data.status }),
      }),
    )
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    await this.invalidateSellerDashboardForShop(updated.shopId)
    await this.publishBestEffort('product.updated', updated.id, actor.id, {
      productId: updated.id,
      shopId: updated.shopId,
      changedFields: Object.keys(data),
    })
    return updated
  }

  async archiveProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.archiveProduct', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    const updated = await this.repo.updateProduct(product.id, { status: 'ARCHIVED' })
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    await this.invalidateSellerDashboardForShop(updated.shopId)
    await this.publishBestEffort('product.updated', updated.id, actor.id, {
      productId: updated.id,
      shopId: updated.shopId,
      changedFields: ['status'],
    })
    return updated
  }

  async createProductImage(actor: CatalogActor, productId: string, data: CreateProductImageData): Promise<CatalogProductImageRecord> {
    this.logger.info('CatalogService.createProductImage', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    if (product.images.length >= MAX_PRODUCT_IMAGES) {
      throw new CatalogServiceError('Products can have at most 10 images', 400, 'PRODUCT_IMAGE_LIMIT_EXCEEDED')
    }
    const normalized = this.normalizeCreateProductImageInput(data)
    const upload = normalized.uploadId ? await this.getCompletedUploadForActor(actor, normalized.uploadId) : null
    if (upload) {
      if (upload.usage !== 'PRODUCT_IMAGE' || !upload.contentType.startsWith('image/')) {
        throw new CatalogServiceError('Product image upload must be an image', 400, 'PRODUCT_IMAGE_UPLOAD_INVALID')
      }
      if (!upload.publicUrl) {
        throw new CatalogServiceError('Product image upload does not have a public URL', 400, 'PRODUCT_IMAGE_UPLOAD_INVALID')
      }
      normalized.url = upload.publicUrl ?? normalized.url
    }
    const image = await this.repo.createProductImage({
      productId,
      ...normalized,
    })
    await this.cacheInvalidation?.invalidateProduct(productId)
    return image
  }

  async updateProductImage(actor: CatalogActor, productId: string, imageId: string, data: UpdateProductImageData): Promise<CatalogProductImageRecord> {
    this.logger.info('CatalogService.updateProductImage', { actorId: actor.id, productId, imageId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one image field is required', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    await this.getManageableProduct(actor, productId)
    const image = await this.repo.updateProductImage(productId, imageId, this.normalizeProductImageInput(data, true))
    if (!image) throw new CatalogServiceError('Product image not found', 404, 'PRODUCT_IMAGE_NOT_FOUND')
    await this.cacheInvalidation?.invalidateProduct(productId)
    return image
  }

  async upsertProductVideo(actor: CatalogActor, productId: string, data: UpsertProductVideoData): Promise<CatalogProductVideoRecord> {
    this.logger.info('CatalogService.upsertProductVideo', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    if (product.video) {
      throw new CatalogServiceError('Products can have at most one video', 400, 'PRODUCT_VIDEO_LIMIT_EXCEEDED')
    }
    if (!data.uploadId?.trim()) {
      throw new CatalogServiceError('Product video upload is required', 400, 'PRODUCT_VIDEO_VALIDATION_FAILED')
    }
    if (data.sortOrder !== undefined && (!Number.isInteger(data.sortOrder) || data.sortOrder < 0)) {
      throw new CatalogServiceError('Product video sort order must be a non-negative integer', 400, 'PRODUCT_VIDEO_VALIDATION_FAILED')
    }
    const upload = await this.getCompletedUploadForActor(actor, data.uploadId.trim())
    if (upload.usage !== 'PRODUCT_VIDEO' || !PRODUCT_VIDEO_CONTENT_TYPES.has(upload.contentType)) {
      throw new CatalogServiceError('Product video upload must be mp4 or webm', 400, 'PRODUCT_VIDEO_UPLOAD_INVALID')
    }
    if (upload.fileSize > PRODUCT_VIDEO_MAX_FILE_SIZE) {
      throw new CatalogServiceError('Product video file is too large', 400, 'PRODUCT_VIDEO_UPLOAD_INVALID')
    }
    if (!upload.publicUrl) {
      throw new CatalogServiceError('Product video upload does not have a public URL', 400, 'PRODUCT_VIDEO_UPLOAD_INVALID')
    }

    const video = await this.repo.upsertProductVideo({
      productId,
      uploadId: upload.id,
      url: upload.publicUrl,
      contentType: upload.contentType,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      sortOrder: data.sortOrder ?? 0,
    })
    await this.cacheInvalidation?.invalidateProduct(productId)
    return video
  }

  async deleteProductVideo(actor: CatalogActor, productId: string): Promise<CatalogProductVideoRecord> {
    this.logger.info('CatalogService.deleteProductVideo', { actorId: actor.id, productId })
    await this.getManageableProduct(actor, productId)
    const video = await this.repo.deleteProductVideo(productId)
    if (!video) throw new CatalogServiceError('Product video not found', 404, 'PRODUCT_VIDEO_NOT_FOUND')
    await this.cacheInvalidation?.invalidateProduct(productId)
    return video
  }

  async deleteProductImage(actor: CatalogActor, productId: string, imageId: string): Promise<CatalogProductImageRecord> {
    this.logger.info('CatalogService.deleteProductImage', { actorId: actor.id, productId, imageId })
    await this.getManageableProduct(actor, productId)
    const image = await this.repo.deleteProductImage(productId, imageId)
    if (!image) throw new CatalogServiceError('Product image not found', 404, 'PRODUCT_IMAGE_NOT_FOUND')
    await this.cacheInvalidation?.invalidateProduct(productId)
    return image
  }

  private async publishBestEffort(
    eventName: 'product.created' | 'product.updated',
    productId: string,
    actorUserId: string | undefined,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.eventPublisher?.publish({
        eventName,
        aggregateType: 'product',
        aggregateId: productId,
        ...(actorUserId ? { actorUserId } : {}),
        data,
      })
    } catch (error) {
      this.logger.warn('CatalogService event publish failed', {
        eventName,
        productId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async createVariant(actor: CatalogActor, productId: string, data: CreateVariantData): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.createVariant', { actorId: actor.id, productId, sku: data.sku })
    this.validateVariantInput(data)
    const product = await this.getManageableProduct(actor, productId)

    const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        price: data.price, // Update the property name to 'price'
        currency: data.currency?.trim().toUpperCase() || 'USD',
        ...this.normalizeVariantShippingFields(data),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    await this.invalidateSellerDashboardForShop(product.shopId)
    return variant
  }

  async updateVariant(actor: CatalogActor, productId: string, variantId: string, data: UpdateVariantData): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.updateVariant', { actorId: actor.id, productId, variantId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one variant field is required', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.validateVariantUpdateInput(data)
    const variant = await this.getManageableVariant(actor, productId, variantId)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateVariant(variantId, {
        ...(data.sku === undefined ? {} : { sku: data.sku.trim() }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.price === undefined ? {} : { price: data.price }),
        ...(data.currency === undefined ? {} : { currency: data.currency.trim().toUpperCase() }),
        ...this.normalizeVariantShippingFields(data),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    await this.invalidateSellerDashboardForShop(variant.product.shopId)
    return updated
  }

  async deleteVariant(actor: CatalogActor, productId: string, variantId: string): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.deleteVariant', { actorId: actor.id, productId, variantId })
    const variant = await this.getManageableVariant(actor, productId, variantId)
    const deleted = await this.repo.deleteVariant(variantId)
    await this.cacheInvalidation?.invalidateVariant(productId)
    await this.invalidateSellerDashboardForShop(variant.product.shopId)
    return deleted
  }

  async updateSellerInventory(actor: CatalogActor, variantId: string, data: UpdateInventoryData) {
    this.logger.info('CatalogService.updateSellerInventory', { actorId: actor.id, variantId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one inventory field is required', 400, 'INVENTORY_VALIDATION_FAILED')
    }
    const update: UpdateInventoryData = {}
    if (data.quantityOnHand !== undefined) {
      if (!Number.isInteger(data.quantityOnHand) || data.quantityOnHand < 0) {
        throw new CatalogServiceError('Quantity on hand must be a non-negative integer', 400, 'INVENTORY_VALIDATION_FAILED')
      }
      update.quantityOnHand = data.quantityOnHand
    }
    if (data.reorderLevel !== undefined) {
      if (!Number.isInteger(data.reorderLevel) || data.reorderLevel < 0) {
        throw new CatalogServiceError('Reorder level must be a non-negative integer', 400, 'INVENTORY_VALIDATION_FAILED')
      }
      update.reorderLevel = data.reorderLevel
    }
    const variant = await this.repo.findVariantById(variantId)
    if (!variant) throw new CatalogServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    const product = await this.getManageableProduct(actor, variant.productId)
    const inventory = await this.repo.updateVariantInventory(variantId, update)
    await this.cacheInvalidation?.invalidateVariant(variant.productId)
    await this.invalidateSellerDashboardForShop(product.shopId)
    return inventory
  }

  private async invalidateSellerDashboardForShop(shopId: string): Promise<void> {
    await this.cacheInvalidation?.invalidateSellerDashboard(shopId)
  }

  private async resolveSellerShop(actor: CatalogActor, requestedShopId?: string) {
    if (this.activeShopResolver) {
      const resolvedShopId = requestedShopId ?? (await this.activeShopResolver.resolveActiveShops(actor.id))[0]?.id
      const activeShop = requestedShopId
        ? await this.activeShopResolver.hasActiveShop(actor.id, requestedShopId)
          ? await this.repo.findShopById(requestedShopId)
          : null
        : resolvedShopId
          ? await this.repo.findShopById(resolvedShopId)
          : null

      if (!activeShop) throw new CatalogServiceError('Seller shop not found', 404, 'SELLER_SHOP_REQUIRED')
      return activeShop
    }

    const shop = requestedShopId
      ? await this.repo.findShopById(requestedShopId)
      : await this.repo.findFirstShopByOwnerId(actor.id)

    if (!shop) throw new CatalogServiceError('Seller shop not found', 404, 'SELLER_SHOP_REQUIRED')
    this.assertCanManageShop(actor, shop.ownerId)
    this.assertShopActive(shop.status)
    return shop
  }

  private async getManageableProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    const product = await this.repo.findProductById(productId)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    if (this.activeShopResolver) {
      if (!await this.activeShopResolver.hasActiveShop(actor.id, product.shopId)) {
        throw new CatalogServiceError('You do not have access to this shop catalog', 403, 'PRODUCT_FORBIDDEN')
      }
      return product
    }
    this.assertCanManageShop(actor, product.shop.ownerId)
    this.assertShopActive(product.shop.status)
    return product
  }

  private async getManageableVariant(actor: CatalogActor, productId: string, variantId: string): Promise<CatalogVariantRecord & { product: CatalogProductRecord }> {
    const variant = await this.repo.findVariantById(variantId)
    if (!variant || variant.productId !== productId) {
      throw new CatalogServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    }

    const product = await this.getManageableProduct(actor, variant.productId)
    if (product.id !== productId) {
      throw new CatalogServiceError('Variant not found', 404, 'VARIANT_NOT_FOUND')
    }

    return variant
  }

  private normalizeListFilters(filters: PublicListProductsData) {
    const limit = filters.limit ?? DEFAULT_PAGE_LIMIT
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
      throw new CatalogServiceError(`Limit must be between 1 and ${MAX_PAGE_LIMIT}`, 400, 'CATALOG_QUERY_INVALID')
    }
    this.validatePriceRange(filters.minPrice, filters.maxPrice)

    return {
      ...(filters.keyword?.trim() ? { keyword: filters.keyword.trim() } : {}),
      ...(filters.categoryId?.trim() ? { categoryId: filters.categoryId.trim() } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.brandId?.trim() ? { brandId: filters.brandId.trim() } : {}),
      ...this.normalizeAttributeFilters(filters.attributes),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.cursor ? { cursor: filters.cursor } : {}),
      limit,
    }
  }

  private validateProductInput(data: CreateProductData): void {
    if (!data.title.trim()) throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
    if (data.status === 'ACTIVE') {
      throw new CatalogServiceError('Create product as draft before publishing', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
  }

  private localizeCategory(category: CatalogCategoryListItem, locale: ContentLocale): CatalogCategoryListItem {
    return {
      ...category,
      name: localizedText(locale, { th: category.nameTh, en: category.nameEn, fallback: category.name }) ?? category.name,
    }
  }

  private localizeProduct<T extends CatalogProductListItem>(product: T, locale: ContentLocale): T {
    return {
      ...product,
      title: localizedText(locale, { th: product.titleTh, en: product.titleEn, fallback: product.title }) ?? product.title,
      description: localizedText(locale, {
        th: product.descriptionTh,
        en: product.descriptionEn,
        fallback: product.description,
      }),
      category: product.category
        ? {
            ...product.category,
            name: localizedText(locale, {
              th: product.category.nameTh,
              en: product.category.nameEn,
              fallback: product.category.name,
            }) ?? product.category.name,
          }
        : null,
      brand: product.brand
        ? {
            ...product.brand,
            name: localizedText(locale, { th: product.brand.nameTh, en: product.brand.nameEn, fallback: product.brand.name }) ?? product.brand.name,
            description: localizedText(locale, {
              th: product.brand.descriptionTh,
              en: product.brand.descriptionEn,
              fallback: product.brand.description,
            }),
          }
        : null,
      attributes: (product.attributes ?? []).map((attribute) => ({
        ...attribute,
        displayName: localizedText(locale, {
          th: attribute.displayNameTh,
          en: attribute.displayNameEn,
          fallback: attribute.displayName,
        }) ?? attribute.displayName,
        value: localizedText(locale, {
          th: attribute.valueTh,
          en: attribute.valueEn,
          fallback: attribute.value,
        }) ?? attribute.value,
      })),
      variants: product.variants.map((variant) => ({
        ...variant,
        title: localizedText(locale, { th: variant.titleTh, en: variant.titleEn, fallback: variant.title }) ?? variant.title,
      })),
    }
  }

  private validateVariantInput(data: CreateVariantData): void {
    if (!data.sku.trim()) throw new CatalogServiceError('Variant SKU is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!data.title.trim()) throw new CatalogServiceError('Variant title is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!Number.isInteger(data.price) || data.price <= 0) {
      throw new CatalogServiceError('Variant price must be a positive integer in cents', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.validateVariantShippingFields(data)
  }

  private validateVariantUpdateInput(data: UpdateVariantData): void {
    if (data.sku !== undefined && !data.sku.trim()) {
      throw new CatalogServiceError('Variant SKU is required', 400, 'VARIANT_VALIDATION_FAILED')
    }
    if (data.title !== undefined && !data.title.trim()) {
      throw new CatalogServiceError('Variant title is required', 400, 'VARIANT_VALIDATION_FAILED')
    }
    if (data.price !== undefined && (!Number.isInteger(data.price) || data.price <= 0)) {
      throw new CatalogServiceError('Variant price must be a positive integer in cents', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.validateVariantShippingFields(data)
  }

  private async validateBrand(brandId: string | null | undefined): Promise<void> {
    if (brandId === undefined || brandId === null || !brandId.trim()) return
    const brand = await this.repo.findBrandById(brandId.trim())
    if (!brand || !brand.isActive) {
      throw new CatalogServiceError('Brand is not available', 400, 'BRAND_NOT_AVAILABLE')
    }
  }

  private async assertPublishReady(existing: CatalogProductDetail, data: UpdateProductData): Promise<void> {
    if (data.status !== 'ACTIVE') return
    const categoryId = data.categoryId === undefined ? existing.categoryId : this.normalizeNullableText(data.categoryId)
    if (!categoryId) {
      throw new CatalogServiceError('Active products require a category', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
    const hasImage = existing.images.length > 0
    if (!hasImage) {
      throw new CatalogServiceError('Active products require at least one image', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
    const hasActivePaidVariant = existing.variants.some((variant) => variant.status === 'ACTIVE' && Number(variant.price) > 0)
    if (!hasActivePaidVariant) {
      throw new CatalogServiceError('Active products require at least one active priced variant', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
  }

  private normalizeProductImageInput<T extends CreateProductImageData | UpdateProductImageData>(data: T, partial: boolean) {
    if (!partial && !data.uploadId?.trim() && (!('url' in data) || !data.url?.trim())) {
      throw new CatalogServiceError('Product image URL is required', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    if (data.url !== undefined && !this.isValidImageReference(data.url)) {
      throw new CatalogServiceError('Product image URL must be a valid URL or absolute path', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    if (data.sortOrder !== undefined && (!Number.isInteger(data.sortOrder) || data.sortOrder < 0)) {
      throw new CatalogServiceError('Product image sort order must be a non-negative integer', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    if (data.width !== undefined && data.width !== null && (!Number.isInteger(data.width) || data.width <= 0)) {
      throw new CatalogServiceError('Product image width must be a positive integer', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    if (data.height !== undefined && data.height !== null && (!Number.isInteger(data.height) || data.height <= 0)) {
      throw new CatalogServiceError('Product image height must be a positive integer', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    return {
      ...(data.uploadId === undefined ? {} : { uploadId: this.normalizeNullableText(data.uploadId) }),
      ...(data.url === undefined ? {} : { url: data.url.trim() }),
      ...(data.altText === undefined ? {} : { altText: this.normalizeNullableText(data.altText) }),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
      ...(data.isPrimary === undefined ? {} : { isPrimary: data.isPrimary }),
      ...(data.width === undefined ? {} : { width: data.width }),
      ...(data.height === undefined ? {} : { height: data.height }),
    }
  }

  private normalizeCreateProductImageInput(data: CreateProductImageData) {
    const normalized = this.normalizeProductImageInput(data, false)
    if (!normalized.url) {
      if (!normalized.uploadId) throw new CatalogServiceError('Product image URL is required', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
      normalized.url = ''
    }
    return {
      ...normalized,
      url: normalized.url,
    }
  }

  private async getCompletedUploadForActor(actor: CatalogActor, uploadId: string) {
    const upload = await this.repo.findUploadById(uploadId)
    if (!upload) throw new CatalogServiceError('Upload not found', 404, 'UPLOAD_NOT_FOUND')
    if (actor.role !== 'ADMIN' && upload.userId !== actor.id) {
      throw new CatalogServiceError('Upload does not belong to this seller', 403, 'UPLOAD_FORBIDDEN')
    }
    if (upload.status !== 'COMPLETED') {
      throw new CatalogServiceError('Upload must be completed before attachment', 400, 'UPLOAD_NOT_COMPLETED')
    }
    return upload
  }

  private isValidImageReference(value: string): boolean {
    const trimmed = value.trim()
    if (trimmed.startsWith('/')) return trimmed.length > 1
    try {
      const url = new URL(trimmed)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  private validateVariantShippingFields(data: Partial<CreateVariantData & UpdateVariantData>): void {
    for (const [field, value] of Object.entries({
      weightGrams: data.weightGrams,
      lengthMm: data.lengthMm,
      widthMm: data.widthMm,
      heightMm: data.heightMm,
    })) {
      if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
        throw new CatalogServiceError(`${field} must be a non-negative integer`, 400, 'VARIANT_VALIDATION_FAILED')
      }
    }
  }

  private normalizeVariantShippingFields(data: Partial<CreateVariantData & UpdateVariantData>) {
    return {
      ...(data.weightGrams === undefined ? {} : { weightGrams: data.weightGrams }),
      ...(data.lengthMm === undefined ? {} : { lengthMm: data.lengthMm }),
      ...(data.widthMm === undefined ? {} : { widthMm: data.widthMm }),
      ...(data.heightMm === undefined ? {} : { heightMm: data.heightMm }),
    }
  }

  private normalizeProductEnrichment(data: CreateProductData | UpdateProductData, partial: boolean) {
    return {
      ...(partial && data.metaTitle === undefined ? {} : { metaTitle: this.normalizeNullableText(data.metaTitle) }),
      ...(partial && data.metaDescription === undefined ? {} : { metaDescription: this.normalizeNullableText(data.metaDescription) }),
      ...(partial && data.warrantyInfo === undefined ? {} : { warrantyInfo: this.normalizeNullableText(data.warrantyInfo) }),
      ...(partial && data.condition === undefined ? {} : { condition: this.normalizeNullableText(data.condition) }),
      ...(partial && data.countryOfOrigin === undefined ? {} : { countryOfOrigin: this.normalizeNullableText(data.countryOfOrigin) }),
      ...(data.highlights === undefined ? {} : { highlights: this.normalizeHighlights(data.highlights) }),
      ...(data.attributes === undefined ? {} : { attributes: this.normalizeProductAttributes(data.attributes) }),
    }
  }

  private normalizeHighlights(highlights: ProductHighlightData[]) {
    return highlights
      .map((highlight, index) => ({
        text: highlight.text.trim(),
        sortOrder: highlight.sortOrder ?? index,
      }))
      .filter((highlight) => highlight.text.length > 0)
  }

  private normalizeProductAttributes(attributes: ProductAttributeData[]) {
    const seen = new Set<string>()
    return attributes.map((attribute, index) => {
      const displayName = attribute.displayName.trim()
      const value = attribute.value.trim()
      const attributeKey = this.normalizeAttributeKey(attribute.attributeKey ?? displayName)
      if (!displayName || !value) throw new CatalogServiceError('Product attribute name and value are required', 400, 'PRODUCT_VALIDATION_FAILED')
      if (seen.has(attributeKey)) throw new CatalogServiceError('Duplicate product attribute key', 400, 'PRODUCT_VALIDATION_FAILED')
      seen.add(attributeKey)
      return {
        attributeKey,
        displayName,
        displayNameTh: this.normalizeNullableText(attribute.displayNameTh),
        displayNameEn: this.normalizeNullableText(attribute.displayNameEn),
        value,
        valueTh: this.normalizeNullableText(attribute.valueTh),
        valueEn: this.normalizeNullableText(attribute.valueEn),
        sortOrder: attribute.sortOrder ?? index,
        isFilterable: attribute.isFilterable ?? false,
      }
    })
  }

  private normalizeAttributeFilters(attributes: PublicListProductsData['attributes']) {
    if (!attributes) return {}
    const pairs = Array.isArray(attributes)
      ? attributes
      : Object.entries(attributes).map(([key, value]) => ({ key, value }))
    const attributeFilters = pairs
      .map((pair) => ({ key: this.normalizeAttributeKey(pair.key), value: pair.value.trim() }))
      .filter((pair) => pair.key && pair.value)
    return attributeFilters.length > 0 ? { attributeFilters } : {}
  }

  private normalizeAttributeKey(value: string): string {
    const key = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    if (!key) throw new CatalogServiceError('Product attribute key is required', 400, 'PRODUCT_VALIDATION_FAILED')
    return key
  }

  private validatePriceRange(minPrice?: number, maxPrice?: number): void {
    if (minPrice !== undefined && (!Number.isInteger(minPrice) || minPrice < 0)) {
      throw new CatalogServiceError('Minimum price must be a non-negative integer in cents', 400, 'CATALOG_QUERY_INVALID')
    }
    if (maxPrice !== undefined && (!Number.isInteger(maxPrice) || maxPrice < 0)) {
      throw new CatalogServiceError('Maximum price must be a non-negative integer in cents', 400, 'CATALOG_QUERY_INVALID')
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      throw new CatalogServiceError('Minimum price cannot exceed maximum price', 400, 'CATALOG_QUERY_INVALID')
    }
  }

  private assertCanManageShop(actor: CatalogActor, ownerId: string): void {
    if (actor.id === ownerId) return
    throw new CatalogServiceError('You do not have access to this shop catalog', 403, 'PRODUCT_FORBIDDEN')
  }

  private assertShopActive(status: string): void {
    if (status === 'ACTIVE') return
    throw new CatalogServiceError('Seller shop is not active', 403, 'SELLER_SHOP_NOT_ACTIVE')
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!slug) throw new CatalogServiceError('Product slug is required', 400, 'PRODUCT_VALIDATION_FAILED')
    return slug
  }

  private normalizeNullableText(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private async handleUniqueConstraint<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (this.isPrismaUniqueError(error)) {
        throw new CatalogServiceError('Catalog record already exists', 409, 'CATALOG_CONFLICT')
      }
      throw error
    }
  }

  private isPrismaUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
  }
}
