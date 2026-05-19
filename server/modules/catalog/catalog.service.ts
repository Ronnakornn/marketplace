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
  CatalogCategoryListItem,
  CatalogProductListItem,
  ICatalogRepository,
  PaginatedResult,
} from './catalog.repository.ts'

const DEFAULT_PAGE_LIMIT = 20
const MAX_PAGE_LIMIT = 50

export interface CatalogActor {
  id: string
  role: Role
}

export interface CreateProductData {
  shopId?: string
  categoryId?: string | null
  title: string
  titleTh?: string | null
  titleEn?: string | null
  slug?: string
  description?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  status?: ProductStatus
}

export interface UpdateProductData {
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

export interface CreateVariantData {
  sku: string
  title: string
  titleTh?: string | null
  titleEn?: string | null
  price: number
  currency?: string
}

export interface UpdateVariantData {
  sku?: string
  title?: string
  titleTh?: string | null
  titleEn?: string | null
  price?: number
  currency?: string
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

  async listPublicProducts(filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicProducts', { filters })
    const locale = resolveContentLocale(filters.locale)
    const normalizedFilters = {
      ...this.normalizeListFilters(filters),
      status: 'ACTIVE',
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
    if (!product || product.status !== 'ACTIVE') {
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

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateProduct(product.id, {
        ...(data.categoryId === undefined ? {} : { categoryId: this.normalizeNullableText(data.categoryId) }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
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

   const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        prices: data.price,
        currency: data.currency?.trim().toUpperCase() || 'USD',
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

    const shop = await this.resolveSellerShop(actor, data.shopId)
    this.assertCanManageShop(actor, shop.ownerId)

    const created = await this.handleUniqueConstraint(() =>
      this.repo.createProduct({
        shopId: shop.id,
        categoryId: this.normalizeNullableText(data.categoryId),
        title: data.title.trim(),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        slug: this.normalizeSlug(data.slug ?? data.title),
        description: this.normalizeNullableText(data.description),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
        status: data.status ?? 'DRAFT',
      }),
    )
    await this.cacheInvalidation?.invalidateProductListsAndSearch()
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

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateProduct(product.id, {
        ...(data.categoryId === undefined ? {} : { categoryId: this.normalizeNullableText(data.categoryId) }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.titleTh === undefined ? {} : { titleTh: this.normalizeNullableText(data.titleTh) }),
        ...(data.titleEn === undefined ? {} : { titleEn: this.normalizeNullableText(data.titleEn) }),
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.descriptionTh === undefined ? {} : { descriptionTh: this.normalizeNullableText(data.descriptionTh) }),
        ...(data.descriptionEn === undefined ? {} : { descriptionEn: this.normalizeNullableText(data.descriptionEn) }),
        ...(data.status === undefined ? {} : { status: data.status }),
      }),
    )
    await this.cacheInvalidation?.invalidateProduct(updated.id)
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
    await this.publishBestEffort('product.updated', updated.id, actor.id, {
      productId: updated.id,
      shopId: updated.shopId,
      changedFields: ['status'],
    })
    return updated
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
    await this.getManageableProduct(actor, productId)

    const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        prices: data.price, // Update the property name to 'prices'
        currency: data.currency?.trim().toUpperCase() || 'USD',
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return variant
  }

  async updateVariant(actor: CatalogActor, productId: string, variantId: string, data: UpdateVariantData): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.updateVariant', { actorId: actor.id, productId, variantId })
    if (Object.keys(data).length === 0) {
      throw new CatalogServiceError('At least one variant field is required', 400, 'VARIANT_VALIDATION_FAILED')
    }
    this.validateVariantUpdateInput(data)
    await this.getManageableVariant(actor, productId, variantId)

    const updated = await this.handleUniqueConstraint(() =>
      this.repo.updateVariant(variantId, {
        ...(data.sku === undefined ? {} : { sku: data.sku.trim() }),
        ...(data.title === undefined ? {} : { title: data.title.trim() }),
        ...(data.price === undefined ? {} : { price: data.price }),
        ...(data.currency === undefined ? {} : { currency: data.currency.trim().toUpperCase() }),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return updated
  }

  async deleteVariant(actor: CatalogActor, productId: string, variantId: string): Promise<CatalogVariantRecord> {
    this.logger.info('CatalogService.deleteVariant', { actorId: actor.id, productId, variantId })
    await this.getManageableVariant(actor, productId, variantId)
    const deleted = await this.repo.deleteVariant(variantId)
    await this.cacheInvalidation?.invalidateVariant(productId)
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
    await this.getManageableProduct(actor, variant.productId)
    const inventory = await this.repo.updateVariantInventory(variantId, update)
    await this.cacheInvalidation?.invalidateVariant(variant.productId)
    return inventory
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
      ...(filters.minPrice !== undefined ? { minPrice: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { maxPrice: filters.maxPrice } : {}),
      ...(filters.cursor ? { cursor: filters.cursor } : {}),
      limit,
    }
  }

  private validateProductInput(data: CreateProductData): void {
    if (!data.title.trim()) throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
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
