import type { ProductStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation, CacheService } from '#server/modules/cache'
import type { EventPublisherService } from '#server/modules/event-bus'
import type { ActiveShopResolver } from '#server/modules/security'
import type { AuditLogService } from '#server/modules/audit-log'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import { CatalogServiceError } from './catalog.errors.ts'
import type {
  CatalogProductDetail,
  CatalogProductRecord,
  CatalogVariantRecord,
  CatalogBrandListItem,
  CatalogProductImageRecord,
  CatalogProductVideoRecord,
  CatalogAdminCategoryRecord,
  CatalogCategorySpecRecord,
  CatalogCategoryListItem,
  CatalogProductListItem,
  ICatalogRepository,
  PaginatedResult,
  ProductListingFacets,
  ProductOptionWriteRecord,
  ProductAttributeWriteRecord,
} from './catalog.repository.ts'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 50
const DEFAULT_RELATED_LIMIT = 8
const MAX_RELATED_LIMIT = 12
const MAX_PRODUCT_IMAGES = 10
const PRODUCT_VIDEO_CONTENT_TYPES = new Set(['video/mp4', 'video/webm'])
const PRODUCT_VIDEO_MAX_FILE_SIZE = 25 * 1024 * 1024
const MARKETPLACE_CURRENCY = 'THB'

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
  optionValueIds?: string[]
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
  optionValueIds?: string[]
}

export interface ProductOptionValueData {
  value: string
  valueTh?: string | null
  valueEn?: string | null
  displayType?: string
  colorHex?: string | null
  sortOrder?: number
}

export interface ProductOptionData {
  name: string
  nameTh?: string | null
  nameEn?: string | null
  sortOrder?: number
  values: ProductOptionValueData[]
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

export interface UpdateImageOrderData {
  images: Array<{
    id: string
    sortOrder?: number
  }>
  primaryImageId?: string | null
}

export interface ModerationListData extends SellerListProductsData {
  status?: ProductStatus
}

export interface ModerationReasonData {
  reason?: string | null
}

export interface PublicListProductsData {
  keyword?: string
  categoryId?: string
  shopId?: string
  minPrice?: number
  maxPrice?: number
  brandId?: string
  sort?: string
  attributes?: Record<string, string> | Array<{ key: string; value: string }>
  cursor?: string
  page?: number
  limit?: number
  locale?: string
}

export interface RelatedProductsData {
  locale?: string
  limit?: number
}

export interface SellerListProductsData extends PublicListProductsData {
  status?: ProductStatus
}

export interface CreateCategoryData {
  parentId?: string | null
  name: string
  nameTh?: string | null
  nameEn?: string | null
  slug?: string
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateCategoryData {
  parentId?: string | null
  name?: string
  nameTh?: string | null
  nameEn?: string | null
  slug?: string
  sortOrder?: number
  isActive?: boolean
}

export interface ReorderCategoriesData {
  parentId?: string | null
  categories: Array<{
    id: string
    sortOrder?: number
  }>
}

type CategorySpecType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT'

export interface CreateCategorySpecData {
  attributeKey: string
  displayName: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  type: CategorySpecType
  isRequired?: boolean
  isFilterable?: boolean
  unit?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface UpdateCategorySpecData {
  attributeKey?: string
  displayName?: string
  displayNameTh?: string | null
  displayNameEn?: string | null
  type?: CategorySpecType
  isRequired?: boolean
  isFilterable?: boolean
  unit?: string | null
  sortOrder?: number
  isActive?: boolean
}

export interface ReorderCategorySpecsData {
  specs: Array<{
    id: string
    sortOrder?: number
  }>
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
    private auditLogService?: AuditLogService,
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

  listAdminCategories(): Promise<CatalogAdminCategoryRecord[]> {
    this.logger.debug('CatalogService.listAdminCategories')
    return this.repo.findAdminCategories()
  }

  async createAdminCategory(data: CreateCategoryData): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('CatalogService.createAdminCategory', { parentId: data.parentId })
    this.validateCategoryName(data.name)
    this.validateOptionalSortOrder(data.sortOrder, 'Category sort order must be a non-negative integer')
    const categories = await this.repo.findAdminCategories()
    const parentId = this.normalizeNullableText(data.parentId)
    this.assertCategoryParentExists(categories, parentId)
    const slug = this.normalizeCategorySlug(data.slug ?? data.name)
    this.assertCategorySlugAvailable(categories, slug)

    const created = await this.handleUniqueConstraint(() =>
      this.repo.createCategory({
        parentId,
        name: data.name.trim(),
        ...(data.nameTh === undefined ? {} : { nameTh: this.normalizeNullableText(data.nameTh) }),
        ...(data.nameEn === undefined ? {} : { nameEn: this.normalizeNullableText(data.nameEn) }),
        slug,
        ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      }),
    )
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return created
  }

  async updateAdminCategory(categoryId: string, data: UpdateCategoryData): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('CatalogService.updateAdminCategory', { categoryId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one category field is required', 400, 'CATEGORY_VALIDATION_FAILED')
    }
    if (data.name !== undefined) this.validateCategoryName(data.name)
    this.validateOptionalSortOrder(data.sortOrder, 'Category sort order must be a non-negative integer')
    const categories = await this.repo.findAdminCategories()
    const existing = this.requireAdminCategory(categories, categoryId)
    const parentId = data.parentId === undefined ? undefined : this.normalizeNullableText(data.parentId)
    if (parentId !== undefined) {
      if (parentId === existing.id) {
        throw new CatalogServiceError('Category cannot be its own parent', 400, 'CATEGORY_PARENT_CYCLE')
      }
      this.assertCategoryParentExists(categories, parentId)
      this.assertCategoryParentDoesNotCreateCycle(categories, existing.id, parentId)
    }
    const slug = data.slug === undefined ? undefined : this.normalizeCategorySlug(data.slug)
    if (slug !== undefined) this.assertCategorySlugAvailable(categories, slug, existing.id)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateCategory(existing.id, {
        ...(parentId === undefined ? {} : { parentId }),
        ...(data.name === undefined ? {} : { name: data.name.trim() }),
        ...(data.nameTh === undefined ? {} : { nameTh: this.normalizeNullableText(data.nameTh) }),
        ...(data.nameEn === undefined ? {} : { nameEn: this.normalizeNullableText(data.nameEn) }),
        ...(slug === undefined ? {} : { slug }),
        ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
        ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
      }),
    )
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return updated
  }

  async deactivateAdminCategory(categoryId: string): Promise<CatalogAdminCategoryRecord> {
    return this.setAdminCategoryActiveState(categoryId, false)
  }

  async reactivateAdminCategory(categoryId: string): Promise<CatalogAdminCategoryRecord> {
    return this.setAdminCategoryActiveState(categoryId, true)
  }

  async reorderAdminCategories(data: ReorderCategoriesData): Promise<CatalogAdminCategoryRecord[]> {
    this.logger.info('CatalogService.reorderAdminCategories', { parentId: data.parentId, categoryCount: data.categories?.length })
    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      throw new CatalogServiceError('Category reorder list is required', 400, 'CATEGORY_REORDER_INVALID')
    }
    const parentId = this.normalizeNullableText(data.parentId)
    const categories = await this.repo.findAdminCategories()
    this.assertCategoryParentExists(categories, parentId)
    const seen = new Set<string>()
    const reordered = data.categories.map((category, index) => {
      if (seen.has(category.id)) throw new CatalogServiceError('Category reorder list contains duplicates', 400, 'CATEGORY_REORDER_INVALID')
      seen.add(category.id)
      const existing = this.requireAdminCategory(categories, category.id)
      if (existing.parentId !== parentId) {
        throw new CatalogServiceError('Only sibling categories can be reordered together', 400, 'CATEGORY_REORDER_SIBLING_MISMATCH')
      }
      const sortOrder = category.sortOrder ?? index
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new CatalogServiceError('Category sort order must be a non-negative integer', 400, 'CATEGORY_REORDER_INVALID')
      }
      return { id: category.id, sortOrder }
    })
    const result = await this.repo.reorderSiblingCategories(parentId, reordered)
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return result
  }

  async listCategorySpecs(categoryId: string): Promise<CatalogCategorySpecRecord[]> {
    this.logger.debug('CatalogService.listCategorySpecs', { categoryId })
    const category = await this.repo.findCategoryWithSpecs(categoryId)
    if (!category?.isActive) {
      throw new CatalogServiceError('Category not found', 404, 'CATEGORY_NOT_FOUND')
    }
    return category.attributeDefinitions
  }

  async validateProductAttributesForCategory(
    categoryId: string | null | undefined,
    attributes: ProductAttributeData[] = [],
  ): Promise<ProductAttributeWriteRecord[]> {
    const normalizedCategoryId = this.normalizeNullableText(categoryId)
    if (!normalizedCategoryId) return this.normalizeProductAttributes(attributes)

    const category = await this.repo.findCategoryWithSpecs(normalizedCategoryId)
    if (!category?.isActive) {
      throw new CatalogServiceError('Category not found', 404, 'CATEGORY_NOT_FOUND')
    }

    const normalizedAttributes = this.normalizeProductAttributes(
      attributes,
      'PRODUCT_VALIDATION_FAILED',
      'PRODUCT_SPEC_ATTRIBUTE_DUPLICATE',
      false,
    )
    const submittedKeys = normalizedAttributes.map((attribute) => attribute.attributeKey)
    const activeSpecs = category.attributeDefinitions.filter((spec) => spec.isActive)
    const activeSpecByKey = new Map(activeSpecs.map((spec) => [spec.attributeKey.toLowerCase(), spec]))
    const categorySpecsByKey = await this.loadSubmittedCategorySpecs(submittedKeys)
    const submittedKeySet = new Set(submittedKeys)
    const missingRequiredSpecs = activeSpecs.filter((spec) => spec.isRequired && !submittedKeySet.has(spec.attributeKey.toLowerCase()))

    if (missingRequiredSpecs.length > 0) {
      throw new CatalogServiceError('Product is missing required category specs', 400, 'PRODUCT_SPEC_REQUIRED_MISSING', {
        missingSpecs: missingRequiredSpecs.map((spec) => spec.attributeKey),
      })
    }

    return normalizedAttributes.map((attribute) => {
      const activeSpec = activeSpecByKey.get(attribute.attributeKey)
      if (activeSpec) return this.normalizeCategorySpecAttribute(attribute, activeSpec)

      const categorySpecs = categorySpecsByKey.get(attribute.attributeKey) ?? []
      if (categorySpecs.length > 0) {
        throw new CatalogServiceError('Product attribute does not match an active spec for this category', 400, 'PRODUCT_SPEC_ATTRIBUTE_INVALID', {
          attributeKey: attribute.attributeKey,
        })
      }
      if (!attribute.value.trim()) {
        throw new CatalogServiceError('Product attribute name and value are required', 400, 'PRODUCT_VALIDATION_FAILED')
      }

      return attribute
    })
  }

  async listAdminCategorySpecs(categoryId: string): Promise<CatalogCategorySpecRecord[]> {
    this.logger.debug('CatalogService.listAdminCategorySpecs', { categoryId })
    const categories = await this.repo.findAdminCategories()
    this.requireAdminCategory(categories, categoryId)
    return this.repo.findAdminCategorySpecs(categoryId)
  }

  async createAdminCategorySpec(categoryId: string, data: CreateCategorySpecData): Promise<CatalogCategorySpecRecord> {
    this.logger.info('CatalogService.createAdminCategorySpec', { categoryId })
    const categories = await this.repo.findAdminCategories()
    this.requireAdminCategory(categories, categoryId)
    const specs = await this.repo.findAdminCategorySpecs(categoryId)
    const normalized = this.normalizeCreateCategorySpec(data, specs)
    const created = await this.handleUniqueConstraint(() =>
      this.repo.createCategorySpec({
        categoryId,
        ...normalized,
      }),
    )
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return created
  }

  async updateAdminCategorySpec(categoryId: string, specId: string, data: UpdateCategorySpecData): Promise<CatalogCategorySpecRecord> {
    this.logger.info('CatalogService.updateAdminCategorySpec', { categoryId, specId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one category spec field is required', 400, 'CATEGORY_SPEC_VALIDATION_FAILED')
    }
    const specs = await this.repo.findAdminCategorySpecs(categoryId)
    const existing = this.requireAdminCategorySpec(specs, specId)
    const normalized = this.normalizeUpdateCategorySpec(data, specs, existing.id)
    const updated = await this.handleUniqueConstraint(() => this.repo.updateCategorySpec(existing.id, normalized))
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return updated
  }

  async deactivateAdminCategorySpec(categoryId: string, specId: string): Promise<CatalogCategorySpecRecord> {
    return this.setAdminCategorySpecActiveState(categoryId, specId, false)
  }

  async reactivateAdminCategorySpec(categoryId: string, specId: string): Promise<CatalogCategorySpecRecord> {
    return this.setAdminCategorySpecActiveState(categoryId, specId, true)
  }

  async reorderAdminCategorySpecs(categoryId: string, data: ReorderCategorySpecsData): Promise<CatalogCategorySpecRecord[]> {
    this.logger.info('CatalogService.reorderAdminCategorySpecs', { categoryId, specCount: data.specs?.length })
    if (!Array.isArray(data.specs) || data.specs.length === 0) {
      throw new CatalogServiceError('Category spec reorder list is required', 400, 'CATEGORY_SPEC_REORDER_INVALID')
    }
    const specs = await this.repo.findAdminCategorySpecs(categoryId)
    const seen = new Set<string>()
    const reordered = data.specs.map((spec, index) => {
      if (seen.has(spec.id)) throw new CatalogServiceError('Category spec reorder list contains duplicates', 400, 'CATEGORY_SPEC_REORDER_INVALID')
      seen.add(spec.id)
      this.requireAdminCategorySpec(specs, spec.id)
      const sortOrder = spec.sortOrder ?? index
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new CatalogServiceError('Category spec sort order must be a non-negative integer', 400, 'CATEGORY_SPEC_REORDER_INVALID')
      }
      return { id: spec.id, sortOrder }
    })
    const result = await this.repo.reorderCategorySpecs(categoryId, reordered)
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return result
  }

  listActiveBrands(): Promise<CatalogBrandListItem[]> {
    this.logger.debug('CatalogService.listActiveBrands')
    return this.repo.findActiveBrands()
  }

  async listPublicProducts(filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicProducts', { filters })
    const locale = resolveContentLocale(filters.locale)
    const listFilters = this.normalizeListFilters(filters)
    await this.validatePublicAttributeFilters(listFilters.categoryId, listFilters.attributeFilters)
    const normalizedFilters = {
      ...listFilters,
      status: 'ACTIVE',
      publicOnly: true,
    } as const
    const cacheFilters = { ...normalizedFilters, locale }

    const result = !this.cache ? await this.repo.findProducts(normalizedFilters) : await this.cache.remember(
      this.cache.keys.productList(cacheFilters),
      () => this.repo.findProducts(normalizedFilters),
      { ttlSeconds: this.cache.ttl().product },
    )
    const facets = await this.loadProductFacets(normalizedFilters)
    const data = (await this.attachPublicProductMetrics(result.data)).map((product) => this.localizeProduct(product, locale))
    return {
      ...result,
      data,
      items: data,
      facets,
    }
  }

  async listPublicShopProducts(shopId: string, filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicShopProducts', { shopId, filters })
    const sort = ['newest', 'price_asc', 'price_desc'].includes(filters.sort ?? '') ? filters.sort : 'newest'
    const normalized = { ...filters, shopId, sort, limit: filters.limit ?? 12, page: filters.page ?? 1, cursor: undefined }
    const result = await this.listPublicProducts(normalized)
    const facets = await this.loadProductFacets({
      ...this.normalizeListFilters({ ...normalized, categoryId: undefined }),
      status: 'ACTIVE',
      publicOnly: true,
    })
    return { ...result, facets }
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
    const [enriched] = await this.attachPublicProductMetrics([product])
    return this.preparePublicProduct(enriched!, locale)
  }

  async listRelatedProducts(id: string, data: RelatedProductsData = {}): Promise<CatalogProductListItem[]> {
    this.logger.debug('CatalogService.listRelatedProducts', { id, limit: data.limit })
    const locale = resolveContentLocale(data.locale)
    const limit = this.normalizeRelatedLimit(data.limit)
    const product = await this.repo.findProductById(id)
    if (!product || product.status !== 'ACTIVE' || product.deletedAt || product.shop.status !== 'ACTIVE') {
      throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    }
    const related = await this.repo.findRelatedProducts(product, limit)
    return (await this.attachPublicProductMetrics(related)).map((item) => this.preparePublicProduct(item, locale))
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

  listModerationProducts(filters: ModerationListData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listModerationProducts', { filters })
    return this.repo.findProducts({
      ...this.normalizeListFilters(filters),
      status: filters.status ?? 'PENDING_REVIEW',
    })
  }

  async approveProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.assertAdmin(actor)
    return this.transitionProductStatus(actor, productId, 'ACTIVE', 'APPROVE')
  }

  async rejectProduct(actor: CatalogActor, productId: string, data: ModerationReasonData): Promise<CatalogProductDetail> {
    this.assertAdmin(actor)
    const reason = this.requireModerationReason(data.reason, 'Reject reason is required')
    return this.transitionProductStatus(actor, productId, 'REJECTED', 'REJECT', reason)
  }

  async suspendProduct(actor: CatalogActor, productId: string, data: ModerationReasonData): Promise<CatalogProductDetail> {
    this.assertAdmin(actor)
    const reason = this.requireModerationReason(data.reason, 'Suspend reason is required')
    return this.transitionProductStatus(actor, productId, 'SUSPENDED', 'SUSPEND', reason)
  }

  async restoreProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.assertAdmin(actor)
    return this.transitionProductStatus(actor, productId, 'ACTIVE', 'RESTORE')
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
        currency: this.normalizeMarketplaceCurrency(data.currency),
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
        ...(data.currency === undefined ? {} : { currency: this.normalizeMarketplaceCurrency(data.currency) }),
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

  async getSellerProductDetail(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.logger.debug('CatalogService.getSellerProductDetail', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    const moderationCase = await this.repo.findLatestModerationCase(product.id)
    return {
      ...product,
      moderationCase,
    }
  }

  async createProduct(actor: CatalogActor, data: CreateProductData): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.createProduct', { actorId: actor.id, shopId: data.shopId })
    this.validateProductInput(data)
    await this.validateBrand(data.brandId)

    const shop = await this.resolveSellerShop(actor, data.shopId)
    this.assertCanManageShop(actor, shop.ownerId)

    const enrichment = await this.normalizeProductEnrichmentForCategory(data, false, this.normalizeNullableText(data.categoryId))

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
        ...enrichment,
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
    const categoryId = data.categoryId === undefined ? product.categoryId : this.normalizeNullableText(data.categoryId)
    const enrichment = await this.normalizeProductUpdateEnrichmentForCategory(product, data, categoryId)
    const readinessAttributes = await this.validateProductAttributesForUpdateReadiness(product, data, categoryId)
    const productForReadiness = {
      ...product,
      categoryId,
      attributes: readinessAttributes,
    } as CatalogProductDetail
    await this.assertPublishReady(productForReadiness, data)

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
        ...enrichment,
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

  async submitProductReview(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.submitProductReview', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    if (product.status !== 'DRAFT' && product.status !== 'REJECTED') {
      throw new CatalogServiceError('Only draft or rejected products can be submitted for review', 400, 'PRODUCT_REVIEW_STATUS_INVALID')
    }
    await this.validateProductAttributesForCategory(product.categoryId, this.toProductAttributeData(product.attributes))
    await this.assertPublishReady(product, { status: 'ACTIVE' })
    const updated = await this.repo.updateProduct(product.id, { status: 'PENDING_REVIEW' })
    await this.repo.createModerationAction(product.id, actor.id, 'ESCALATE', 'Submitted for review')
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    await this.publishBestEffort('product.updated', updated.id, actor.id, {
      productId: updated.id,
      shopId: updated.shopId,
      changedFields: ['status'],
    })
    return updated
  }

  async updateProductOptions(actor: CatalogActor, productId: string, data: { options: ProductOptionData[] }): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.updateProductOptions', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    const options = this.normalizeProductOptions(data.options)
    if (product.variants.some((variant) => (variant.optionValues ?? []).length > 0)) {
      throw new CatalogServiceError('Product options cannot be replaced while variants reference existing option values', 400, 'PRODUCT_OPTION_REFERENCES_EXIST')
    }
    const updated = await this.handleUniqueConstraint(() => this.repo.replaceProductOptions(product.id, options))
    await this.cacheInvalidation?.invalidateProduct(product.id)
    return updated
  }

  async updateProductImagesOrder(actor: CatalogActor, productId: string, data: UpdateImageOrderData): Promise<CatalogProductImageRecord[]> {
    this.logger.info('CatalogService.updateProductImagesOrder', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    if (!Array.isArray(data.images) || data.images.length === 0) {
      throw new CatalogServiceError('Image order is required', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    const productImageIds = new Set(product.images.map((image) => image.id))
    const seen = new Set<string>()
    const primaryImageId = data.primaryImageId?.trim() || product.images.find((image) => image.isPrimary)?.id || data.images[0]?.id
    const images = data.images.map((image, index) => {
      if (!productImageIds.has(image.id) || seen.has(image.id)) {
        throw new CatalogServiceError('Image order must include each product image exactly once', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
      }
      seen.add(image.id)
      return {
        id: image.id,
        sortOrder: image.sortOrder ?? index,
        isPrimary: image.id === primaryImageId,
      }
    })
    if (seen.size !== product.images.length || !primaryImageId || !seen.has(primaryImageId)) {
      throw new CatalogServiceError('Image order must include each product image exactly once and select one primary image', 400, 'PRODUCT_IMAGE_VALIDATION_FAILED')
    }
    const ordered = await this.repo.updateProductImagesOrder(product.id, images)
    await this.cacheInvalidation?.invalidateProduct(product.id)
    return ordered
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
    const optionSelection = this.validateVariantOptionSelection(product, data.optionValueIds)
    this.assertSkuAvailable(product, data.sku)
    this.assertOptionCombinationAvailable(product, optionSelection.combinationKey)

    const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        price: data.price, // Update the property name to 'price'
        currency: this.normalizeMarketplaceCurrency(data.currency),
        ...this.normalizeVariantShippingFields(data),
        optionValueIds: optionSelection.optionValueIds,
        optionCombinationKey: optionSelection.combinationKey,
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
    const product = await this.getManageableProduct(actor, productId)
    if (data.sku !== undefined) this.assertSkuAvailable(product, data.sku, variantId)
    const optionSelection = data.optionValueIds === undefined
      ? undefined
      : this.validateVariantOptionSelection(product, data.optionValueIds)
    if (optionSelection) this.assertOptionCombinationAvailable(product, optionSelection.combinationKey, variantId)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateVariant(variantId, {
        ...(data.sku === undefined ? {} : { sku: data.sku.trim() }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.price === undefined ? {} : { price: data.price }),
        ...(data.currency === undefined ? {} : { currency: this.normalizeMarketplaceCurrency(data.currency) }),
        ...this.normalizeVariantShippingFields(data),
        ...(optionSelection === undefined ? {} : {
          optionValueIds: optionSelection.optionValueIds,
          optionCombinationKey: optionSelection.combinationKey,
        }),
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
    if (filters.page !== undefined && (!Number.isInteger(filters.page) || filters.page < 1)) {
      throw new CatalogServiceError('Page must be a positive integer', 400, 'CATALOG_QUERY_INVALID')
    }
    this.validatePriceRange(filters.minPrice, filters.maxPrice)

    return {
      ...(filters.keyword?.trim() ? { keyword: filters.keyword.trim() } : {}),
      ...(filters.categoryId?.trim() ? { categoryId: filters.categoryId.trim() } : {}),
      ...(filters.shopId ? { shopId: filters.shopId } : {}),
      ...(filters.brandId?.trim() ? { brandId: filters.brandId.trim() } : {}),
      ...(filters.sort?.trim() ? { sort: filters.sort.trim() } : {}),
      ...this.normalizeAttributeFilters(filters.attributes),
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.cursor ? { cursor: filters.cursor } : {}),
      ...(filters.page !== undefined ? { page: filters.page } : {}),
      limit,
    }
  }

  private normalizeRelatedLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_RELATED_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_RELATED_LIMIT) {
      throw new CatalogServiceError(`Limit must be between 1 and ${MAX_RELATED_LIMIT}`, 400, 'CATALOG_QUERY_INVALID')
    }
    return value
  }

  private validateProductInput(data: CreateProductData): void {
    if (!data.title.trim()) throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
    if (data.status === 'ACTIVE') {
      throw new CatalogServiceError('Create product as draft before publishing', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
  }

  private validateCategoryName(name: string): void {
    if (!name.trim()) throw new CatalogServiceError('Category name is required', 400, 'CATEGORY_VALIDATION_FAILED')
  }

  private validateOptionalSortOrder(sortOrder: number | undefined, message: string): void {
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
      throw new CatalogServiceError(message, 400, 'CATEGORY_VALIDATION_FAILED')
    }
  }

  private requireAdminCategory(categories: CatalogAdminCategoryRecord[], categoryId: string): CatalogAdminCategoryRecord {
    const category = categories.find((item) => item.id === categoryId)
    if (!category) throw new CatalogServiceError('Category not found', 404, 'CATEGORY_NOT_FOUND')
    return category
  }

  private assertCategoryParentExists(categories: CatalogAdminCategoryRecord[], parentId: string | null): void {
    if (!parentId) return
    if (!categories.some((category) => category.id === parentId)) {
      throw new CatalogServiceError('Parent category not found', 400, 'CATEGORY_PARENT_NOT_FOUND')
    }
  }

  private assertCategorySlugAvailable(categories: CatalogAdminCategoryRecord[], slug: string, ignoredCategoryId?: string): void {
    if (categories.some((category) => category.id !== ignoredCategoryId && category.slug.toLowerCase() === slug)) {
      throw new CatalogServiceError('Category slug already exists', 409, 'CATEGORY_SLUG_DUPLICATE')
    }
  }

  private assertCategoryParentDoesNotCreateCycle(categories: CatalogAdminCategoryRecord[], categoryId: string, parentId: string | null): void {
    let currentParentId = parentId
    const visited = new Set<string>()
    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new CatalogServiceError('Category parent cannot create a cycle', 400, 'CATEGORY_PARENT_CYCLE')
      }
      if (visited.has(currentParentId)) {
        throw new CatalogServiceError('Category tree already contains a cycle', 400, 'CATEGORY_PARENT_CYCLE')
      }
      visited.add(currentParentId)
      currentParentId = categories.find((category) => category.id === currentParentId)?.parentId ?? null
    }
  }

  private requireAdminCategorySpec(specs: CatalogCategorySpecRecord[], specId: string): CatalogCategorySpecRecord {
    const spec = specs.find((item) => item.id === specId)
    if (!spec) throw new CatalogServiceError('Category spec not found', 404, 'CATEGORY_SPEC_NOT_FOUND')
    return spec
  }

  private normalizeCreateCategorySpec(data: CreateCategorySpecData, specs: CatalogCategorySpecRecord[]) {
    const attributeKey = this.normalizeSpecAttributeKey(data.attributeKey)
    const displayName = this.normalizeSpecDisplayName(data.displayName)
    this.assertCategorySpecAttributeKeyAvailable(specs, attributeKey)
    this.validateCategorySpecType(data.type)
    this.validateOptionalSortOrder(data.sortOrder, 'Category spec sort order must be a non-negative integer')
    return {
      attributeKey,
      displayName,
      displayNameTh: this.normalizeNullableText(data.displayNameTh),
      displayNameEn: this.normalizeNullableText(data.displayNameEn),
      valueType: data.type,
      ...(data.isRequired === undefined ? {} : { isRequired: data.isRequired }),
      ...(data.isFilterable === undefined ? {} : { isFilterable: data.isFilterable }),
      unit: this.normalizeNullableText(data.unit),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    }
  }

  private normalizeUpdateCategorySpec(data: UpdateCategorySpecData, specs: CatalogCategorySpecRecord[], ignoredSpecId: string) {
    const attributeKey = data.attributeKey === undefined ? undefined : this.normalizeSpecAttributeKey(data.attributeKey)
    if (attributeKey !== undefined) this.assertCategorySpecAttributeKeyAvailable(specs, attributeKey, ignoredSpecId)
    if (data.type !== undefined) this.validateCategorySpecType(data.type)
    this.validateOptionalSortOrder(data.sortOrder, 'Category spec sort order must be a non-negative integer')
    return {
      ...(attributeKey === undefined ? {} : { attributeKey }),
      ...(data.displayName === undefined ? {} : { displayName: this.normalizeSpecDisplayName(data.displayName) }),
      ...(data.displayNameTh === undefined ? {} : { displayNameTh: this.normalizeNullableText(data.displayNameTh) }),
      ...(data.displayNameEn === undefined ? {} : { displayNameEn: this.normalizeNullableText(data.displayNameEn) }),
      ...(data.type === undefined ? {} : { valueType: data.type }),
      ...(data.isRequired === undefined ? {} : { isRequired: data.isRequired }),
      ...(data.isFilterable === undefined ? {} : { isFilterable: data.isFilterable }),
      ...(data.unit === undefined ? {} : { unit: this.normalizeNullableText(data.unit) }),
      ...(data.sortOrder === undefined ? {} : { sortOrder: data.sortOrder }),
      ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    }
  }

  private normalizeSpecAttributeKey(value: string): string {
    try {
      return this.normalizeAttributeKey(value)
    } catch {
      throw new CatalogServiceError('Category spec attribute key is required', 400, 'CATEGORY_SPEC_VALIDATION_FAILED')
    }
  }

  private normalizeSpecDisplayName(value: string): string {
    const displayName = value.trim()
    if (!displayName) throw new CatalogServiceError('Category spec display name is required', 400, 'CATEGORY_SPEC_VALIDATION_FAILED')
    return displayName
  }

  private validateCategorySpecType(type: string): void {
    if (!['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTI_SELECT'].includes(type)) {
      throw new CatalogServiceError('Category spec type is invalid', 400, 'CATEGORY_SPEC_VALIDATION_FAILED')
    }
  }

  private assertCategorySpecAttributeKeyAvailable(specs: CatalogCategorySpecRecord[], attributeKey: string, ignoredSpecId?: string): void {
    if (specs.some((spec) => spec.id !== ignoredSpecId && spec.attributeKey.toLowerCase() === attributeKey)) {
      throw new CatalogServiceError('Category spec attribute key already exists', 409, 'CATEGORY_SPEC_ATTRIBUTE_DUPLICATE')
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
        optionValues: variant.optionValues.map((link) => ({
          ...link,
          optionValue: {
            ...link.optionValue,
            value: localizedText(locale, {
              th: link.optionValue.valueTh,
              en: link.optionValue.valueEn,
              fallback: link.optionValue.value,
            }) ?? link.optionValue.value,
            option: {
              ...link.optionValue.option,
              name: localizedText(locale, {
                th: link.optionValue.option.nameTh,
                en: link.optionValue.option.nameEn,
                fallback: link.optionValue.option.name,
              }) ?? link.optionValue.option.name,
            },
          },
        })),
      })),
      options: product.options.map((option) => ({
        ...option,
        name: localizedText(locale, { th: option.nameTh, en: option.nameEn, fallback: option.name }) ?? option.name,
        values: option.values.map((value) => ({
          ...value,
          value: localizedText(locale, { th: value.valueTh, en: value.valueEn, fallback: value.value }) ?? value.value,
        })),
      })),
    }
  }

  private async loadProductFacets(filters: Parameters<ICatalogRepository['findProductFacets']>[0]): Promise<ProductListingFacets> {
    try {
      return await this.repo.findProductFacets(filters)
    } catch (error) {
      this.logger.warn('CatalogService.loadProductFacets failed', { error })
      return this.emptyProductFacets()
    }
  }

  private emptyProductFacets(): ProductListingFacets {
    return {
      categories: [],
      brands: [],
      price: {
        min: null,
        max: null,
        currency: 'THB',
      },
    }
  }

  private preparePublicProduct<T extends CatalogProductListItem>(product: T, locale: ContentLocale): T {
    const localized = this.localizeProduct(product, locale)
    return {
      ...localized,
      images: localized.images.filter((image) => this.isPublicSafeAssetUrl(image.url)),
      video: localized.video && this.isPublicSafeAssetUrl(localized.video.url) ? localized.video : null,
    }
  }

  private isPublicSafeAssetUrl(url: string): boolean {
    const value = url.trim()
    if (!value) return false
    if (value.startsWith('/')) return true
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
      const secretIndicators = ['x-amz-signature', 'x-amz-credential', 'x-goog-signature', 'signature', 'token', 'expires']
      for (const key of parsed.searchParams.keys()) {
        if (secretIndicators.includes(key.toLowerCase())) return false
      }
      return true
    } catch {
      return false
    }
  }

  private validateVariantInput(data: CreateVariantData): void {
    if (!data.sku.trim()) throw new CatalogServiceError('Variant SKU is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!data.title.trim()) throw new CatalogServiceError('Variant title is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!Number.isInteger(data.price) || data.price <= 0) {
      throw new CatalogServiceError('Variant price must be a positive integer in cents', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.normalizeMarketplaceCurrency(data.currency)
    this.validateVariantShippingFields(data)
  }

  private async attachPublicProductMetrics<T extends CatalogProductListItem>(products: T[]): Promise<T[]> {
    const metrics = await this.repo.findProductMetrics(products.map((product) => product.id))
    const metricsByProductId = new Map(metrics.map((metric) => [metric.productId, metric]))
    return products.map((product) => {
      const metric = metricsByProductId.get(product.id)
      const rating = metric?.rating ?? 0
      const ratingCount = metric?.ratingCount ?? 0
      return {
        ...product,
        rating,
        ratingSummary: {
          averageRating: rating,
          totalReviewCount: ratingCount,
        },
        soldCount: metric?.soldCount ?? 0,
      }
    })
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
    if (data.currency !== undefined) this.normalizeMarketplaceCurrency(data.currency)
    this.validateVariantShippingFields(data)
  }

  private normalizeMarketplaceCurrency(currency?: string): string {
    const normalized = currency?.trim().toUpperCase() || MARKETPLACE_CURRENCY
    if (normalized !== MARKETPLACE_CURRENCY) {
      throw new CatalogServiceError(
        `Marketplace variants must use ${MARKETPLACE_CURRENCY}`,
        400,
        'VARIANT_VALIDATION_FAILED',
      )
    }
    return normalized
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
    const category = await this.repo.findCategoryWithSpecs(categoryId)
    if (!category?.isActive) {
      throw new CatalogServiceError('Active products require an active category', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
    const requiredSpecs = category.attributeDefinitions.filter((attribute) => attribute.isRequired)
    const attributeKeys = new Set(existing.attributes.map((attribute) => attribute.attributeKey))
    const missingSpecs = requiredSpecs.filter((spec) => !attributeKeys.has(spec.attributeKey))
    if (missingSpecs.length > 0) {
      throw new CatalogServiceError('Active products require all required category specs', 400, 'PRODUCT_PUBLISH_NOT_READY', {
        missingSpecs: missingSpecs.map((spec) => spec.attributeKey),
      })
    }
    const hasPrimaryImage = existing.images.some((image) => image.isPrimary)
    if (!hasPrimaryImage) {
      throw new CatalogServiceError('Active products require a primary image', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
    const hasActivePaidVariant = existing.variants.some((variant) => variant.status === 'ACTIVE' && Number(variant.price) > 0)
    if (!hasActivePaidVariant) {
      throw new CatalogServiceError('Active products require at least one active priced variant', 400, 'PRODUCT_PUBLISH_NOT_READY')
    }
    this.assertValidOptionMatrix(existing)
  }

  private async setAdminCategoryActiveState(categoryId: string, isActive: boolean): Promise<CatalogAdminCategoryRecord> {
    this.logger.info('CatalogService.setAdminCategoryActiveState', { categoryId, isActive })
    const categories = await this.repo.findAdminCategories()
    const existing = this.requireAdminCategory(categories, categoryId)
    const updated = await this.repo.updateCategoryActiveState(existing.id, isActive)
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return updated
  }

  private async setAdminCategorySpecActiveState(categoryId: string, specId: string, isActive: boolean): Promise<CatalogCategorySpecRecord> {
    this.logger.info('CatalogService.setAdminCategorySpecActiveState', { categoryId, specId, isActive })
    const specs = await this.repo.findAdminCategorySpecs(categoryId)
    const existing = this.requireAdminCategorySpec(specs, specId)
    const updated = await this.repo.updateCategorySpecActiveState(existing.id, isActive)
    await this.cacheInvalidation?.invalidateCatalogDiscoveryAndSearch()
    return updated
  }

  private assertValidOptionMatrix(product: CatalogProductDetail): void {
    if (product.options.length === 0) return
    for (const option of product.options) {
      if (option.values.length === 0) {
        throw new CatalogServiceError('Product options require at least one value', 400, 'PRODUCT_PUBLISH_NOT_READY')
      }
    }
    const seen = new Set<string>()
    for (const variant of product.variants) {
      if (variant.status !== 'ACTIVE') continue
      const selected = variant.optionValues ?? []
      if (selected.length !== product.options.length) {
        throw new CatalogServiceError('Active variants must select one value for every product option', 400, 'PRODUCT_PUBLISH_NOT_READY')
      }
      const selectedOptionIds = new Set(selected.map((link) => link.optionValue.optionId))
      if (selectedOptionIds.size !== product.options.length) {
        throw new CatalogServiceError('Active variants must not select duplicate values for the same option', 400, 'PRODUCT_PUBLISH_NOT_READY')
      }
      const key = this.optionCombinationKey(selected.map((link) => link.optionValueId))
      if (seen.has(key)) throw new CatalogServiceError('Duplicate variant option combination', 409, 'VARIANT_OPTION_COMBINATION_DUPLICATE')
      seen.add(key)
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

  private async normalizeProductEnrichmentForCategory(
    data: CreateProductData | UpdateProductData,
    partial: boolean,
    categoryId: string | null | undefined,
  ) {
    const enrichment = this.normalizeProductEnrichment(data, partial)
    if (data.attributes === undefined && !categoryId) return enrichment
    return {
      ...enrichment,
      attributes: await this.validateProductAttributesForCategory(categoryId, data.attributes ?? []),
    }
  }

  private async normalizeProductUpdateEnrichmentForCategory(
    product: CatalogProductDetail,
    data: UpdateProductData,
    categoryId: string | null | undefined,
  ) {
    if (data.attributes === undefined && data.categoryId === undefined) return this.normalizeProductEnrichment(data, true)
    const attributes = data.attributes ?? this.toProductAttributeData(product.attributes)
    return {
      ...this.normalizeProductEnrichment(data, true),
      attributes: await this.validateProductAttributesForCategory(categoryId, attributes),
    }
  }

  private async validateProductAttributesForUpdateReadiness(
    product: CatalogProductDetail,
    data: UpdateProductData,
    categoryId: string | null | undefined,
  ): Promise<ProductAttributeWriteRecord[]> {
    const shouldValidateAttributes =
      data.attributes !== undefined ||
      data.categoryId !== undefined ||
      data.status === 'ACTIVE' ||
      data.status === 'PENDING_REVIEW'
    if (!shouldValidateAttributes) return product.attributes
    return this.validateProductAttributesForCategory(categoryId, data.attributes ?? this.toProductAttributeData(product.attributes))
  }

  private toProductAttributeData(attributes: ProductAttributeWriteRecord[]): ProductAttributeData[] {
    return attributes.map((attribute) => ({
      attributeKey: attribute.attributeKey,
      displayName: attribute.displayName,
      displayNameTh: attribute.displayNameTh,
      displayNameEn: attribute.displayNameEn,
      value: attribute.value,
      valueTh: attribute.valueTh,
      valueEn: attribute.valueEn,
      sortOrder: attribute.sortOrder,
      isFilterable: attribute.isFilterable,
    }))
  }

  private normalizeProductOptions(options: ProductOptionData[]): ProductOptionWriteRecord[] {
    const seenOptions = new Set<string>()
    return options.map((option, optionIndex) => {
      const name = option.name.trim()
      if (!name) throw new CatalogServiceError('Product option name is required', 400, 'PRODUCT_OPTION_VALIDATION_FAILED')
      const optionKey = name.toLowerCase()
      if (seenOptions.has(optionKey)) throw new CatalogServiceError('Duplicate product option name', 400, 'PRODUCT_OPTION_VALIDATION_FAILED')
      seenOptions.add(optionKey)
      if (!Array.isArray(option.values) || option.values.length === 0) {
        throw new CatalogServiceError('Product option requires at least one value', 400, 'PRODUCT_OPTION_VALIDATION_FAILED')
      }
      const seenValues = new Set<string>()
      return {
        name,
        nameTh: this.normalizeNullableText(option.nameTh),
        nameEn: this.normalizeNullableText(option.nameEn),
        sortOrder: option.sortOrder ?? optionIndex,
        values: option.values.map((value, valueIndex) => {
          const normalizedValue = value.value.trim()
          if (!normalizedValue) throw new CatalogServiceError('Product option value is required', 400, 'PRODUCT_OPTION_VALIDATION_FAILED')
          const valueKey = normalizedValue.toLowerCase()
          if (seenValues.has(valueKey)) throw new CatalogServiceError('Duplicate product option value', 400, 'PRODUCT_OPTION_VALIDATION_FAILED')
          seenValues.add(valueKey)
          return {
            value: normalizedValue,
            valueTh: this.normalizeNullableText(value.valueTh),
            valueEn: this.normalizeNullableText(value.valueEn),
            displayType: value.displayType?.trim() || 'TEXT',
            colorHex: this.normalizeNullableText(value.colorHex),
            sortOrder: value.sortOrder ?? valueIndex,
          }
        }),
      }
    })
  }

  private validateVariantOptionSelection(product: CatalogProductDetail, optionValueIds?: string[]) {
    if (product.options.length === 0) {
      if (optionValueIds && optionValueIds.length > 0) {
        throw new CatalogServiceError('Variant option values require product options', 400, 'VARIANT_OPTION_VALUES_INVALID')
      }
      return { optionValueIds: [], combinationKey: null }
    }
    if (!optionValueIds || optionValueIds.length !== product.options.length) {
      throw new CatalogServiceError('Variant must select one value for every product option', 400, 'VARIANT_OPTION_VALUES_INVALID')
    }
    const valueToOption = new Map<string, string>()
    for (const option of product.options) {
      for (const value of option.values) valueToOption.set(value.id, option.id)
    }
    const seenValueIds = new Set<string>()
    const seenOptionIds = new Set<string>()
    for (const valueId of optionValueIds) {
      const optionId = valueToOption.get(valueId)
      if (!optionId || seenValueIds.has(valueId) || seenOptionIds.has(optionId)) {
        throw new CatalogServiceError('Variant option values must belong to this product and be unique per option', 400, 'VARIANT_OPTION_VALUES_INVALID')
      }
      seenValueIds.add(valueId)
      seenOptionIds.add(optionId)
    }
    return {
      optionValueIds: [...seenValueIds],
      combinationKey: this.optionCombinationKey([...seenValueIds]),
    }
  }

  private assertSkuAvailable(product: CatalogProductDetail, sku: string, ignoredVariantId?: string): void {
    const normalized = sku.trim().toLowerCase()
    if (product.variants.some((variant) => variant.id !== ignoredVariantId && variant.sku.toLowerCase() === normalized)) {
      throw new CatalogServiceError('Duplicate variant SKU', 409, 'VARIANT_SKU_DUPLICATE')
    }
  }

  private assertOptionCombinationAvailable(product: CatalogProductDetail, combinationKey: string | null, ignoredVariantId?: string): void {
    if (!combinationKey) return
    if (product.variants.some((variant) => variant.id !== ignoredVariantId && variant.optionCombinationKey === combinationKey)) {
      throw new CatalogServiceError('Duplicate variant option combination', 409, 'VARIANT_OPTION_COMBINATION_DUPLICATE')
    }
  }

  private optionCombinationKey(optionValueIds: string[]): string {
    return [...optionValueIds].sort().join('|')
  }

  private async transitionProductStatus(
    actor: CatalogActor,
    productId: string,
    status: ProductStatus,
    moderationAction: string,
    reason?: string,
  ): Promise<CatalogProductDetail> {
    const existing = await this.repo.findProductById(productId)
    if (!existing) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    if (moderationAction === 'APPROVE' && existing.status !== 'PENDING_REVIEW') {
      throw new CatalogServiceError('Only pending review products can be approved', 400, 'PRODUCT_MODERATION_STATUS_INVALID')
    }
    if (moderationAction === 'RESTORE' && existing.status !== 'SUSPENDED') {
      throw new CatalogServiceError('Only suspended products can be restored', 400, 'PRODUCT_MODERATION_STATUS_INVALID')
    }
    const updated = await this.repo.updateProduct(productId, { status })
    await this.repo.createModerationAction(productId, actor.id, moderationAction, reason)
    await this.auditLogService?.createAuditLogBestEffort({
      actorUserId: actor.id,
      actorRole: actor.role,
      action: 'PRODUCT_STATUS_CHANGED',
      entityType: 'Product',
      entityId: productId,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: { reason, moderationAction },
      nonCritical: true,
    })
    await this.cacheInvalidation?.invalidateProduct(productId)
    return updated
  }

  private requireModerationReason(reason: string | null | undefined, message: string): string {
    const normalized = this.normalizeNullableText(reason)
    if (!normalized) throw new CatalogServiceError(message, 400, 'PRODUCT_MODERATION_REASON_REQUIRED')
    return normalized
  }

  private normalizeHighlights(highlights: ProductHighlightData[]) {
    return highlights
      .map((highlight, index) => ({
        text: highlight.text.trim(),
        sortOrder: highlight.sortOrder ?? index,
      }))
      .filter((highlight) => highlight.text.length > 0)
  }

  private async loadSubmittedCategorySpecs(attributeKeys: string[]): Promise<Map<string, CatalogCategorySpecRecord[]>> {
    if (attributeKeys.length === 0) return new Map()
    const specs = await this.repo.findCategorySpecsByAttributeKeys([...new Set(attributeKeys)])
    const specsByKey = new Map<string, CatalogCategorySpecRecord[]>()
    for (const spec of specs) {
      const key = spec.attributeKey.toLowerCase()
      specsByKey.set(key, [...(specsByKey.get(key) ?? []), spec])
    }
    return specsByKey
  }

  private normalizeCategorySpecAttribute(
    attribute: ProductAttributeWriteRecord,
    spec: CatalogCategorySpecRecord,
  ): ProductAttributeWriteRecord {
    return {
      ...attribute,
      displayName: spec.displayName,
      displayNameTh: spec.displayNameTh,
      displayNameEn: spec.displayNameEn,
      value: this.normalizeCategorySpecValue(attribute.value, spec),
      isFilterable: spec.isFilterable,
    }
  }

  private normalizeCategorySpecValue(value: string, spec: CatalogCategorySpecRecord): string {
    const trimmed = value.trim()
    switch (spec.valueType) {
      case 'TEXT':
      case 'SELECT':
        if (!trimmed) {
          throw new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', {
            attributeKey: spec.attributeKey,
            valueType: spec.valueType,
          })
        }
        return trimmed
      case 'NUMBER': {
        const parsed = Number(trimmed)
        if (!trimmed || !Number.isFinite(parsed)) {
          throw new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', {
            attributeKey: spec.attributeKey,
            valueType: spec.valueType,
          })
        }
        return String(parsed)
      }
      case 'BOOLEAN':
        return this.normalizeCategorySpecBooleanValue(trimmed, spec)
      case 'MULTI_SELECT': {
        const values = trimmed.split(',').map((item) => item.trim()).filter((item) => item.length > 0)
        if (values.length === 0) {
          throw new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', {
            attributeKey: spec.attributeKey,
            valueType: spec.valueType,
          })
        }
        return values.join(', ')
      }
      default:
        throw new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', {
          attributeKey: spec.attributeKey,
          valueType: spec.valueType,
        })
    }
  }

  private normalizeCategorySpecBooleanValue(value: string, spec: CatalogCategorySpecRecord): string {
    const normalized = value.toLowerCase()
    if (['true', 'yes', '1'].includes(normalized)) return 'true'
    if (['false', 'no', '0'].includes(normalized)) return 'false'
    throw new CatalogServiceError('Product spec value is invalid', 400, 'PRODUCT_SPEC_TYPE_INVALID', {
      attributeKey: spec.attributeKey,
      valueType: spec.valueType,
    })
  }

  private normalizeProductAttributes(
    attributes: ProductAttributeData[],
    validationErrorCode = 'PRODUCT_VALIDATION_FAILED',
    duplicateErrorCode = validationErrorCode,
    requireValue = true,
  ) {
    const seen = new Set<string>()
    return attributes.map((attribute, index) => {
      const displayName = attribute.displayName.trim()
      const value = attribute.value.trim()
      const attributeKey = this.normalizeAttributeKey(attribute.attributeKey ?? displayName)
      if (!displayName || (requireValue && !value)) {
        throw new CatalogServiceError('Product attribute name and value are required', 400, validationErrorCode)
      }
      if (seen.has(attributeKey)) {
        throw new CatalogServiceError('Duplicate product attribute key', 400, duplicateErrorCode, { attributeKey })
      }
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

  private async validatePublicAttributeFilters(
    categoryId: string | undefined,
    attributeFilters: ReturnType<CatalogService['normalizeAttributeFilters']>['attributeFilters'],
  ): Promise<void> {
    if (!attributeFilters || attributeFilters.length === 0) return
    if (!categoryId) {
      throw new CatalogServiceError('Attribute filters require a category scope', 400, 'PRODUCT_SPEC_FILTER_INVALID')
    }

    const category = await this.repo.findCategoryWithSpecs(categoryId)
    if (!category?.isActive) {
      throw new CatalogServiceError('Attribute filter category scope is invalid', 400, 'PRODUCT_SPEC_FILTER_INVALID')
    }

    const filterableSpecKeys = new Set(
      category.attributeDefinitions
        .filter((spec) => spec.isActive && spec.isFilterable)
        .map((spec) => spec.attributeKey.toLowerCase()),
    )

    for (const filter of attributeFilters) {
      if (!filterableSpecKeys.has(filter.key)) {
        throw new CatalogServiceError('Attribute filter is not allowed for this category', 400, 'PRODUCT_SPEC_FILTER_INVALID', {
          attributeKey: filter.key,
        })
      }
    }
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

  private assertAdmin(actor: CatalogActor): void {
    if (actor.role === 'ADMIN') return
    throw new CatalogServiceError('Admin catalog access requires admin role', 403, 'ADMIN_CATALOG_FORBIDDEN')
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

  private normalizeCategorySlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!slug) throw new CatalogServiceError('Category slug is required', 400, 'CATEGORY_VALIDATION_FAILED')
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
