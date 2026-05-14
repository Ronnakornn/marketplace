import type { ProductVariant } from '#generated/client/client.ts'
import type { ProductStatus, Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { CacheInvalidation, CacheService } from '#server/modules/cache'
import { CatalogServiceError } from './catalog.errors.ts'
import type {
  CatalogProductDetail,
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
  slug?: string
  description?: string | null
  status?: ProductStatus
}

export interface UpdateProductData {
  categoryId?: string | null
  title?: string
  slug?: string
  description?: string | null
  status?: ProductStatus
}

export interface CreateVariantData {
  sku: string
  title: string
  priceCents: number
  currency?: string
}

export interface UpdateVariantData {
  sku?: string
  title?: string
  priceCents?: number
  currency?: string
}

export interface PublicListProductsData {
  keyword?: string
  categoryId?: string
  shopId?: string
  minPriceCents?: number
  maxPriceCents?: number
  cursor?: string
  limit?: number
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
  ) {
    this.logger = appContext.logger
  }

  listCategories(): Promise<CatalogCategoryListItem[]> {
    this.logger.debug('CatalogService.listCategories')
    if (!this.cache) return this.repo.findActiveCategories()
    return this.cache.remember(
      this.cache.keys.categoryList(),
      () => this.repo.findActiveCategories(),
      { ttlSeconds: this.cache.ttl().product },
    )
  }

  listPublicProducts(filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicProducts', { filters })
    const normalizedFilters = {
      ...this.normalizeListFilters(filters),
      status: 'ACTIVE',
    } as const

    if (!this.cache) return this.repo.findProducts(normalizedFilters)
    return this.cache.remember(
      this.cache.keys.productList(normalizedFilters),
      () => this.repo.findProducts(normalizedFilters),
      { ttlSeconds: this.cache.ttl().product },
    )
  }

  listPublicShopProducts(shopId: string, filters: PublicListProductsData): Promise<PaginatedResult<CatalogProductListItem>> {
    this.logger.debug('CatalogService.listPublicShopProducts', { shopId, filters })
    return this.listPublicProducts({ ...filters, shopId })
  }

  async getPublicProductDetail(id: string): Promise<CatalogProductDetail> {
    this.logger.debug('CatalogService.getPublicProductDetail', { id })
    const product = this.cache
      ? await this.cache.remember(
          this.cache.keys.productDetail(id),
          () => this.repo.findProductById(id),
          { ttlSeconds: this.cache.ttl().product },
        )
      : await this.repo.findProductById(id)
    if (!product || product.status !== 'ACTIVE') {
      throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    }
    return product
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
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.status === undefined ? {} : { status: data.status }),
      }),
    )
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    return updated
  }

  async createAdminVariant(productId: string, data: CreateVariantData): Promise<ProductVariant> {
    this.logger.info('CatalogService.createAdminVariant', { productId, sku: data.sku })
    this.validateVariantInput(data)
    const product = await this.repo.findProductById(productId)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')

    const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        priceCents: data.priceCents,
        currency: data.currency?.trim().toUpperCase() || 'USD',
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return variant
  }

  async updateAdminVariant(productId: string, variantId: string, data: UpdateVariantData): Promise<ProductVariant> {
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
        ...(data.priceCents === undefined ? {} : { priceCents: data.priceCents }),
        ...(data.currency === undefined ? {} : { currency: data.currency.trim().toUpperCase() }),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return updated
  }

  async deleteAdminVariant(productId: string, variantId: string): Promise<ProductVariant> {
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
        slug: this.normalizeSlug(data.slug ?? data.title),
        description: this.normalizeNullableText(data.description),
        status: data.status ?? 'DRAFT',
      }),
    )
    await this.cacheInvalidation?.invalidateProductListsAndSearch()
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
        ...(data.slug === undefined ? {} : { slug: this.normalizeSlug(data.slug) }),
        ...(data.description === undefined ? {} : { description: this.normalizeNullableText(data.description) }),
        ...(data.status === undefined ? {} : { status: data.status }),
      }),
    )
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    return updated
  }

  async archiveProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    this.logger.info('CatalogService.archiveProduct', { actorId: actor.id, productId })
    const product = await this.getManageableProduct(actor, productId)
    const updated = await this.repo.updateProduct(product.id, { status: 'ARCHIVED' })
    await this.cacheInvalidation?.invalidateProduct(updated.id)
    return updated
  }

  async createVariant(actor: CatalogActor, productId: string, data: CreateVariantData): Promise<ProductVariant> {
    this.logger.info('CatalogService.createVariant', { actorId: actor.id, productId, sku: data.sku })
    this.validateVariantInput(data)
    await this.getManageableProduct(actor, productId)

    const variant = await this.handleUniqueConstraint(() =>
      this.repo.createVariant({
        productId,
        sku: data.sku.trim(),
        title: data.title.trim(),
        priceCents: data.priceCents,
        currency: data.currency?.trim().toUpperCase() || 'USD',
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return variant
  }

  async updateVariant(actor: CatalogActor, productId: string, variantId: string, data: UpdateVariantData): Promise<ProductVariant> {
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
        ...(data.priceCents === undefined ? {} : { priceCents: data.priceCents }),
        ...(data.currency === undefined ? {} : { currency: data.currency.trim().toUpperCase() }),
      }),
    )
    await this.cacheInvalidation?.invalidateVariant(productId)
    return updated
  }

  async deleteVariant(actor: CatalogActor, productId: string, variantId: string): Promise<ProductVariant> {
    this.logger.info('CatalogService.deleteVariant', { actorId: actor.id, productId, variantId })
    await this.getManageableVariant(actor, productId, variantId)
    const deleted = await this.repo.deleteVariant(variantId)
    await this.cacheInvalidation?.invalidateVariant(productId)
    return deleted
  }

  private async resolveSellerShop(actor: CatalogActor, requestedShopId?: string) {
    const shop = requestedShopId
      ? await this.repo.findShopById(requestedShopId)
      : await this.repo.findFirstShopByOwnerId(actor.id)

    if (!shop) throw new CatalogServiceError('Seller shop not found', 404, 'SELLER_SHOP_REQUIRED')
    this.assertCanManageShop(actor, shop.ownerId)
    return shop
  }

  private async getManageableProduct(actor: CatalogActor, productId: string): Promise<CatalogProductDetail> {
    const product = await this.repo.findProductById(productId)
    if (!product) throw new CatalogServiceError('Product not found', 404, 'PRODUCT_NOT_FOUND')
    this.assertCanManageShop(actor, product.shop.ownerId)
    return product
  }

  private async getManageableVariant(actor: CatalogActor, productId: string, variantId: string): Promise<ProductVariant> {
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
    this.validatePriceRange(filters.minPriceCents, filters.maxPriceCents)

    return {
      keyword: filters.keyword?.trim() || undefined,
      categoryId: filters.categoryId?.trim() || undefined,
      shopId: filters.shopId,
      minPriceCents: filters.minPriceCents,
      maxPriceCents: filters.maxPriceCents,
      cursor: filters.cursor,
      limit,
    }
  }

  private validateProductInput(data: CreateProductData): void {
    if (!data.title.trim()) throw new CatalogServiceError('Product title is required', 400, 'PRODUCT_VALIDATION_FAILED')
  }

  private validateVariantInput(data: CreateVariantData): void {
    if (!data.sku.trim()) throw new CatalogServiceError('Variant SKU is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!data.title.trim()) throw new CatalogServiceError('Variant title is required', 400, 'VARIANT_VALIDATION_FAILED')
    if (!Number.isInteger(data.priceCents) || data.priceCents <= 0) {
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
    if (data.priceCents !== undefined && (!Number.isInteger(data.priceCents) || data.priceCents <= 0)) {
      throw new CatalogServiceError('Variant price must be a positive integer in cents', 400, 'VARIANT_VALIDATION_FAILED')
    }
  }

  private validatePriceRange(minPriceCents?: number, maxPriceCents?: number): void {
    if (minPriceCents !== undefined && (!Number.isInteger(minPriceCents) || minPriceCents < 0)) {
      throw new CatalogServiceError('Minimum price must be a non-negative integer in cents', 400, 'CATALOG_QUERY_INVALID')
    }
    if (maxPriceCents !== undefined && (!Number.isInteger(maxPriceCents) || maxPriceCents < 0)) {
      throw new CatalogServiceError('Maximum price must be a non-negative integer in cents', 400, 'CATALOG_QUERY_INVALID')
    }
    if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
      throw new CatalogServiceError('Minimum price cannot exceed maximum price', 400, 'CATALOG_QUERY_INVALID')
    }
  }

  private assertCanManageShop(actor: CatalogActor, ownerId: string): void {
    if (actor.role === 'SELLER' && actor.id === ownerId) return
    throw new CatalogServiceError('You do not have access to this shop catalog', 403, 'PRODUCT_FORBIDDEN')
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
