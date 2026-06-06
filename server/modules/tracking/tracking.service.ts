import type { Prisma } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { TrackingServiceError } from './tracking.errors.ts'
import type { ITrackingRepository, TrackingProductRecord } from './tracking.repository.ts'

const MAX_RECENTLY_VIEWED_LIMIT = 24
const DEFAULT_RECENTLY_VIEWED_LIMIT = 12
const MAX_QUERY_LENGTH = 100
const MAX_SOURCE_LENGTH = 64
const MAX_SESSION_ID_LENGTH = 128
const PRODUCT_LOG_EVENTS = new Set<TrackingEventType>([
  'product_viewed',
  'product_impression',
  'product_click',
  'recommendation_clicked',
  'recently_viewed_update',
])

export type TrackingEventType =
  | 'product_viewed'
  | 'product_impression'
  | 'product_click'
  | 'search_submitted'
  | 'filter_applied'
  | 'category_viewed'
  | 'banner_clicked'
  | 'recommendation_clicked'
  | 'recently_viewed_update'

export interface TrackingEventInput {
  eventType: TrackingEventType
  productId?: string
  shopId?: string
  categoryId?: string
  bannerId?: string
  recommendationId?: string
  query?: string
  filters?: Record<string, unknown>
  source?: string
  position?: number
  resultCount?: number
  sessionId?: string
  referrer?: string
  timestamp?: string
}

export interface TrackingActor {
  userId?: string
}

export interface ProductAddToCartTrackingInput {
  productId: string
  variantId: string
  shopId: string
  userId?: string
  sessionId?: string
  quantity: number
  source?: string
}

export interface RecentlyViewedProductsInput {
  userId?: string
  sessionId?: string
  limit?: number
}

export interface RecentlyViewedProduct {
  productId: string
  title: string
  slug: string
  coverImage: string | null
  minPrice: number | null
  currency: string | null
  shop: {
    id: string
    name: string
    slug: string
  }
}

export class TrackingService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ITrackingRepository,
  ) {
    this.logger = appContext.logger
  }

  async trackEvent(actor: TrackingActor, input: TrackingEventInput): Promise<{ ok: true }> {
    const event = this.normalizeEvent(input)
    this.logger.debug('TrackingService.trackEvent', {
      eventType: event.eventType,
      userId: actor.userId,
      sessionId: event.sessionId,
    })

    if (PRODUCT_LOG_EVENTS.has(event.eventType)) {
      await this.recordProductView(actor, event)
      return { ok: true }
    }

    if (event.eventType === 'search_submitted' || event.eventType === 'filter_applied' || event.eventType === 'category_viewed') {
      await this.recordSearchLikeEvent(actor, event)
      return { ok: true }
    }

    return { ok: true }
  }

  async getRecentlyViewedProducts(input: RecentlyViewedProductsInput): Promise<RecentlyViewedProduct[]> {
    const limit = this.normalizeLimit(input.limit)
    const sessionId = this.normalizeOptionalString(input.sessionId, 'sessionId', MAX_SESSION_ID_LENGTH)
    if (!input.userId && !sessionId) return []

    const products = await this.repo.findRecentlyViewedProducts({
      userId: input.userId,
      sessionId,
      limit,
    })
    return products.map((product) => this.toRecentlyViewedProduct(product))
  }

  async recordProductAddToCart(input: ProductAddToCartTrackingInput): Promise<{ ok: true }> {
    const productId = this.requireUuid(input.productId, 'productId')
    const variantId = this.requireUuid(input.variantId, 'variantId')
    const shopId = this.requireUuid(input.shopId, 'shopId')
    const userId = this.normalizeOptionalUuid(input.userId, 'userId')
    const sessionId = this.normalizeOptionalString(input.sessionId, 'sessionId', MAX_SESSION_ID_LENGTH)
    const source = this.normalizeOptionalString(input.source, 'source', MAX_SOURCE_LENGTH)
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new TrackingServiceError('Quantity must be a positive integer', 400, 'TRACKING_PAYLOAD_INVALID')
    }

    await this.repo.createProductAddToCartLog({
      productId,
      variantId,
      shopId,
      userId,
      sessionId,
      quantity: input.quantity,
      source,
      metadata: {
        eventType: 'product_added_to_cart',
      },
    })
    return { ok: true }
  }

  private async recordProductView(actor: TrackingActor, event: Required<Pick<TrackingEventInput, 'eventType'>> & TrackingEventInput): Promise<void> {
    const productId = this.requireUuid(event.productId, 'productId')
    const product = await this.repo.findActiveProduct(productId)
    if (!product) {
      throw new TrackingServiceError('Product is not available for tracking', 404, 'TRACKING_PRODUCT_NOT_FOUND')
    }
    if (event.shopId && event.shopId !== product.shopId) {
      throw new TrackingServiceError('Product and shop do not match', 400, 'TRACKING_PAYLOAD_INVALID')
    }

    await this.repo.createProductViewLog({
      productId: product.id,
      shopId: product.shopId,
      userId: actor.userId,
      sessionId: event.sessionId,
      source: event.source,
      referrer: event.referrer,
      metadata: this.eventMetadata(event),
    })
  }

  private async recordSearchLikeEvent(actor: TrackingActor, event: Required<Pick<TrackingEventInput, 'eventType'>> & TrackingEventInput): Promise<void> {
    const query = event.eventType === 'search_submitted'
      ? this.requireQuery(event.query)
      : this.normalizeQuery(event.query) ?? event.categoryId ?? event.source ?? event.eventType
    const normalizedQuery = this.normalizeSearchKey(query)
    await this.repo.createSearchQueryLog({
      userId: actor.userId,
      sessionId: event.sessionId,
      query,
      normalizedQuery,
      resultCount: event.resultCount,
      clickedEntityType: event.categoryId ? 'CATEGORY' : 'SEARCH',
      clickedEntityId: event.categoryId && this.isUuid(event.categoryId) ? event.categoryId : undefined,
      metadata: this.eventMetadata(event),
    })
  }

  private normalizeEvent(input: TrackingEventInput): Required<Pick<TrackingEventInput, 'eventType'>> & TrackingEventInput {
    if (!input || typeof input !== 'object') {
      throw new TrackingServiceError('Tracking payload is required', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    if (!input.eventType) {
      throw new TrackingServiceError('Tracking event type is required', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    if (input.position !== undefined && (!Number.isInteger(input.position) || input.position < 0)) {
      throw new TrackingServiceError('Tracking position must be a non-negative integer', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    if (input.resultCount !== undefined && (!Number.isInteger(input.resultCount) || input.resultCount < 0)) {
      throw new TrackingServiceError('Tracking result count must be a non-negative integer', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    if (input.timestamp && Number.isNaN(Date.parse(input.timestamp))) {
      throw new TrackingServiceError('Tracking timestamp must be an ISO date string', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    if (input.filters !== undefined && (!input.filters || typeof input.filters !== 'object' || Array.isArray(input.filters))) {
      throw new TrackingServiceError('Tracking filters must be an object', 400, 'TRACKING_PAYLOAD_INVALID')
    }

    return {
      ...input,
      sessionId: this.normalizeOptionalString(input.sessionId, 'sessionId', MAX_SESSION_ID_LENGTH),
      source: this.normalizeOptionalString(input.source, 'source', MAX_SOURCE_LENGTH),
      referrer: this.normalizeOptionalString(input.referrer, 'referrer', 256),
      query: this.normalizeQuery(input.query),
      categoryId: this.normalizeOptionalString(input.categoryId, 'categoryId', 64),
      bannerId: this.normalizeOptionalString(input.bannerId, 'bannerId', 64),
      recommendationId: this.normalizeOptionalString(input.recommendationId, 'recommendationId', 64),
      productId: this.normalizeOptionalUuid(input.productId, 'productId'),
      shopId: this.normalizeOptionalUuid(input.shopId, 'shopId'),
    }
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit ?? DEFAULT_RECENTLY_VIEWED_LIMIT
    if (!Number.isInteger(value) || value < 1 || value > MAX_RECENTLY_VIEWED_LIMIT) {
      throw new TrackingServiceError(`Limit must be between 1 and ${MAX_RECENTLY_VIEWED_LIMIT}`, 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return value
  }

  private requireQuery(query: string | undefined): string {
    const normalized = this.normalizeQuery(query)
    if (!normalized) {
      throw new TrackingServiceError('Search tracking requires a query', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return normalized
  }

  private normalizeQuery(query: string | undefined): string | undefined {
    const normalized = query?.trim()
    if (normalized && normalized.length > MAX_QUERY_LENGTH) {
      throw new TrackingServiceError('Search query is too long', 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return normalized || undefined
  }

  private normalizeSearchKey(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ')
  }

  private requireUuid(value: string | undefined, field: string): string {
    const normalized = this.normalizeOptionalUuid(value, field)
    if (!normalized) {
      throw new TrackingServiceError(`${field} is required`, 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return normalized
  }

  private normalizeOptionalUuid(value: string | undefined, field: string): string | undefined {
    const normalized = this.normalizeOptionalString(value, field, 64)
    if (!normalized) return undefined
    if (!this.isUuid(normalized)) {
      throw new TrackingServiceError(`${field} must be a UUID`, 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return normalized
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  private normalizeOptionalString(value: string | undefined, field: string, maxLength: number): string | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'string') {
      throw new TrackingServiceError(`${field} must be a string`, 400, 'TRACKING_PAYLOAD_INVALID')
    }
    const normalized = value.trim()
    if (!normalized) return undefined
    if (normalized.length > maxLength) {
      throw new TrackingServiceError(`${field} is too long`, 400, 'TRACKING_PAYLOAD_INVALID')
    }
    return normalized
  }

  private eventMetadata(event: TrackingEventInput): Prisma.InputJsonValue {
    return {
      eventType: event.eventType,
      ...(event.categoryId ? { categoryId: event.categoryId } : {}),
      ...(event.bannerId ? { bannerId: event.bannerId } : {}),
      ...(event.recommendationId ? { recommendationId: event.recommendationId } : {}),
      ...(event.position !== undefined ? { position: event.position } : {}),
      ...(event.filters ? { filters: event.filters as Prisma.InputJsonObject } : {}),
      ...(event.timestamp ? { timestamp: event.timestamp } : {}),
    }
  }

  private toRecentlyViewedProduct(product: TrackingProductRecord): RecentlyViewedProduct {
    const firstVariant = product.variants[0]
    return {
      productId: product.id,
      title: product.title,
      slug: product.slug,
      coverImage: product.images[0]?.url ?? null,
      minPrice: firstVariant ? Number(firstVariant.price) : null,
      currency: firstVariant?.currency ?? null,
      shop: {
        id: product.shop.id,
        name: product.shop.name,
        slug: product.shop.slug,
      },
    }
  }
}
