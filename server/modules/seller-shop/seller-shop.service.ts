import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { SellerShopServiceError } from './seller-shop.errors.ts'
import type {
  ISellerShopRepository,
  SellerOwnedShopRecord,
  SellerShopProfileUpdateInput,
  SellerShopSettingUpdateInput,
  SellerShopSettingRecord,
} from './seller-shop.repository.ts'

const SLUG_MIN_LENGTH = 2

export function resolveLocalizedSellerText(
  locale: 'th' | 'en',
  values: { base: string | null; th: string | null; en: string | null },
): string | null {
  const candidates = locale === 'th'
    ? [values.th, values.base, values.en]
    : [values.en, values.base, values.th]
  return candidates.find((value) => value !== null && value.trim().length > 0)?.trim() ?? null
}

export interface SellerShopActor {
  id: string
  role: Role
}

export interface SellerShopListItemResponse {
  id: string
  name: string
  slug: string
  status: string
  contactEmail: string
  contactPhone: string
  updatedAt: Date
}

export interface SellerShopListResponse {
  shops: SellerShopListItemResponse[]
  activeShopId: string | null
  maxShopCount: number | null
}

export interface SellerShopProfileResponse {
  id: string
  name: string
  slug: string
  status: string
  contactEmail: string
  contactPhone: string
  description: string | null
  descriptionTh: string | null
  descriptionEn: string | null
  logoUrl: string | null
  coverUrl: string | null
  metaTitle: string | null
  metaDescription: string | null
  updatedAt: Date
}

export interface SellerShopSettingsResponse {
  id: string
  shopId: string
  autoAcceptOrder: boolean
  allowCod: boolean
  chatEnabled: boolean
  vacationMode: boolean
  defaultShippingProvider: string | null
  returnPolicy: string | null
  shippingPolicy: string | null
  returnPolicyTh: string | null
  returnPolicyEn: string | null
  shippingPolicyTh: string | null
  shippingPolicyEn: string | null
  version: number
  updatedAt: Date
}

export interface PublicStorefrontProfile {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  coverUrl: string | null
  ratingAverage: number
  ratingCount: number
  followerCount: number
  productCount: number
  chatEnabled: boolean
  shippingPolicy: string | null
  returnPolicy: string | null
  updatedAt: Date
  viewer: { isOwner: boolean }
}

export type PublicStorefrontReadModel = PublicStorefrontProfile & {
  metaTitle: string | null
  metaDescription: string | null
}

export class SellerShopService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: ISellerShopRepository,
  ) {
    this.logger = appContext.logger
  }

  async listOwnedShops(actor: SellerShopActor): Promise<SellerShopListResponse> {
    this.logger.debug('SellerShopService.listOwnedShops', { actorId: actor.id })
    const [sellerProfile, shops] = await Promise.all([
      this.repo.findSellerProfileByUserId(actor.id),
      this.repo.listOwnedShops(actor.id),
    ])

    const sorted = [...shops].sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    return {
      shops: sorted.map((shop) => this.toListItem(shop)),
      activeShopId: sorted.find((shop) => shop.status === 'ACTIVE')?.id ?? null,
      maxShopCount: sellerProfile?.maxShopCount ?? null,
    }
  }

  async getPublicStorefront(identifier: string, locale: 'th' | 'en', viewerId?: string): Promise<PublicStorefrontReadModel> {
    const shop = await this.repo.findPublicStorefront(identifier)
    if (!shop) throw new SellerShopServiceError('Shop not found', 404, 'SHOP_NOT_FOUND')
    const settings = shop.settings
    return {
      id: shop.id, name: shop.name, slug: shop.slug,
      description: resolveLocalizedSellerText(locale, { base: shop.description, th: shop.descriptionTh, en: shop.descriptionEn }),
      logoUrl: shop.logoUrl, coverUrl: shop.coverUrl,
      ratingAverage: Number(shop.ratingAverage), ratingCount: shop.ratingCount,
      followerCount: shop.followerCount, productCount: shop.productCount,
      chatEnabled: settings?.chatEnabled ?? true,
      shippingPolicy: resolveLocalizedSellerText(locale, { base: settings?.shippingPolicy ?? null, th: settings?.shippingPolicyTh ?? null, en: settings?.shippingPolicyEn ?? null }),
      returnPolicy: resolveLocalizedSellerText(locale, { base: settings?.returnPolicy ?? null, th: settings?.returnPolicyTh ?? null, en: settings?.returnPolicyEn ?? null }),
      metaTitle: shop.metaTitle, metaDescription: shop.metaDescription, updatedAt: shop.updatedAt,
      viewer: { isOwner: viewerId === shop.ownerId },
    }
  }

  async getShopProfile(actor: SellerShopActor, shopId: string): Promise<SellerShopProfileResponse> {
    const shop = await this.requireOwnedShop(actor.id, shopId)
    return this.toProfile(shop)
  }

  async updateShopProfile(
    actor: SellerShopActor,
    shopId: string,
    input: SellerShopProfileUpdateInput,
  ): Promise<SellerShopProfileResponse> {
    const shop = await this.requireOwnedActiveShop(actor.id, shopId)
    const normalized = await this.normalizeProfileInput(actor.id, shop.id, input)
    if (Object.keys(normalized).length === 0) {
      throw new SellerShopServiceError('At least one profile field is required', 400, 'SHOP_PROFILE_INVALID')
    }
    const updated = await this.repo.updateShopProfile(shop.id, normalized)
    return this.toProfile(updated)
  }

  async getShopSettings(actor: SellerShopActor, shopId: string): Promise<SellerShopSettingsResponse> {
    const shop = await this.requireOwnedActiveShop(actor.id, shopId)
    const settings = await this.repo.upsertShopSettings(shop.id, {})
    return this.toSettings(settings)
  }

  async updateShopSettings(
    actor: SellerShopActor,
    shopId: string,
    input: SellerShopSettingUpdateInput,
  ): Promise<SellerShopSettingsResponse> {
    const shop = await this.requireOwnedActiveShop(actor.id, shopId)
    const normalized = this.normalizeSettingsInput(input)
    if (Object.keys(normalized).length === 0) {
      throw new SellerShopServiceError('At least one setting field is required', 400, 'SHOP_SETTINGS_INVALID')
    }
    const settings = await this.repo.upsertShopSettings(shop.id, normalized)
    return this.toSettings(settings)
  }

  private async requireOwnedShop(userId: string, shopId: string): Promise<SellerOwnedShopRecord> {
    const shop = await this.repo.findOwnedShopById(userId, shopId)
    if (!shop) throw new SellerShopServiceError('Shop access is forbidden', 403, 'SHOP_FORBIDDEN')
    return shop
  }

  private async requireOwnedActiveShop(userId: string, shopId: string): Promise<SellerOwnedShopRecord> {
    const activeShop = await this.repo.findOwnedActiveShopById(userId, shopId)
    if (activeShop) return activeShop

    const ownedShop = await this.repo.findOwnedShopById(userId, shopId)
    if (!ownedShop) throw new SellerShopServiceError('Shop access is forbidden', 403, 'SHOP_FORBIDDEN')
    throw new SellerShopServiceError('Active seller shop access required', 403, 'SELLER_SHOP_NOT_ACTIVE')
  }

  private async normalizeProfileInput(
    userId: string,
    shopId: string,
    input: SellerShopProfileUpdateInput,
  ): Promise<SellerShopProfileUpdateInput> {
    const next: SellerShopProfileUpdateInput = {}

    if (input.name !== undefined) next.name = this.normalizeRequiredText(input.name, 'Shop name')
    if (input.contactEmail !== undefined) next.contactEmail = this.normalizeEmail(input.contactEmail, 'Shop contact email')
    if (input.contactPhone !== undefined) next.contactPhone = this.normalizeRequiredText(input.contactPhone, 'Shop contact phone')

    if (input.slug !== undefined) {
      const slug = this.normalizeSlug(input.slug)
      const existing = await this.repo.findShopBySlug(slug)
      if (existing && existing.id !== shopId && existing.ownerId !== userId) {
        throw new SellerShopServiceError('Shop slug already exists', 409, 'SHOP_SLUG_EXISTS')
      }
      next.slug = slug
    }

    if (input.description !== undefined) next.description = this.normalizeNullableText(input.description)
    if (input.descriptionTh !== undefined) next.descriptionTh = this.normalizeNullableText(input.descriptionTh)
    if (input.descriptionEn !== undefined) next.descriptionEn = this.normalizeNullableText(input.descriptionEn)
    if (input.metaTitle !== undefined) next.metaTitle = this.normalizeNullableText(input.metaTitle)
    if (input.metaDescription !== undefined) next.metaDescription = this.normalizeNullableText(input.metaDescription)
    if (input.logoUrl !== undefined) next.logoUrl = this.normalizeNullableUrl(input.logoUrl, 'Logo URL')
    if (input.coverUrl !== undefined) next.coverUrl = this.normalizeNullableUrl(input.coverUrl, 'Cover URL')

    return next
  }

  private normalizeSettingsInput(input: SellerShopSettingUpdateInput): SellerShopSettingUpdateInput {
    const next: SellerShopSettingUpdateInput = {}

    if (input.autoAcceptOrder !== undefined) next.autoAcceptOrder = input.autoAcceptOrder
    if (input.allowCod !== undefined) next.allowCod = input.allowCod
    if (input.chatEnabled !== undefined) next.chatEnabled = input.chatEnabled
    if (input.vacationMode !== undefined) next.vacationMode = input.vacationMode
    if (input.defaultShippingProvider !== undefined) next.defaultShippingProvider = this.normalizeNullableText(input.defaultShippingProvider)
    if (input.returnPolicy !== undefined) next.returnPolicy = this.normalizeNullableText(input.returnPolicy)
    if (input.shippingPolicy !== undefined) next.shippingPolicy = this.normalizeNullableText(input.shippingPolicy)
    if (input.returnPolicyTh !== undefined) next.returnPolicyTh = this.normalizeNullableText(input.returnPolicyTh)
    if (input.returnPolicyEn !== undefined) next.returnPolicyEn = this.normalizeNullableText(input.returnPolicyEn)
    if (input.shippingPolicyTh !== undefined) next.shippingPolicyTh = this.normalizeNullableText(input.shippingPolicyTh)
    if (input.shippingPolicyEn !== undefined) next.shippingPolicyEn = this.normalizeNullableText(input.shippingPolicyEn)

    return next
  }

  private normalizeRequiredText(value: string, label: string): string {
    const normalized = value.trim()
    if (!normalized) {
      throw new SellerShopServiceError(`${label} is required`, 400, 'SHOP_PROFILE_INVALID')
    }
    return normalized
  }

  private normalizeNullableText(value: string | null): string | null {
    if (value === null) return null
    const normalized = value.trim()
    return normalized || null
  }

  private normalizeEmail(value: string, label: string): string {
    const normalized = value.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalized)) {
      throw new SellerShopServiceError(`${label} is invalid`, 400, 'SHOP_PROFILE_INVALID')
    }
    return normalized
  }

  private normalizeSlug(value: string): string {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (slug.length < SLUG_MIN_LENGTH) {
      throw new SellerShopServiceError('Shop slug is too short', 400, 'SHOP_PROFILE_INVALID')
    }

    return slug
  }

  private normalizeNullableUrl(value: string | null, label: string): string | null {
    if (value === null) return null
    const normalized = value.trim()
    if (!normalized) return null

    if (normalized.startsWith('/')) {
      return normalized
    }

    try {
      const url = new URL(normalized)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new SellerShopServiceError(`${label} must be an http or https URL`, 400, 'SHOP_PROFILE_INVALID')
      }
      return normalized
    } catch {
      throw new SellerShopServiceError(`${label} is invalid`, 400, 'SHOP_PROFILE_INVALID')
    }
  }

  private toListItem(shop: SellerOwnedShopRecord): SellerShopListItemResponse {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      contactEmail: shop.contactEmail,
      contactPhone: shop.contactPhone,
      updatedAt: shop.updatedAt,
    }
  }

  private toProfile(shop: SellerOwnedShopRecord): SellerShopProfileResponse {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      contactEmail: shop.contactEmail,
      contactPhone: shop.contactPhone,
      description: shop.description,
      descriptionTh: shop.descriptionTh,
      descriptionEn: shop.descriptionEn,
      logoUrl: shop.logoUrl,
      coverUrl: shop.coverUrl,
      metaTitle: shop.metaTitle,
      metaDescription: shop.metaDescription,
      updatedAt: shop.updatedAt,
    }
  }

  private toSettings(settings: SellerShopSettingRecord): SellerShopSettingsResponse {
    return {
      id: settings.id,
      shopId: settings.shopId,
      autoAcceptOrder: settings.autoAcceptOrder,
      allowCod: settings.allowCod,
      chatEnabled: settings.chatEnabled,
      vacationMode: settings.vacationMode,
      defaultShippingProvider: settings.defaultShippingProvider,
      returnPolicy: settings.returnPolicy,
      shippingPolicy: settings.shippingPolicy,
      returnPolicyTh: settings.returnPolicyTh,
      returnPolicyEn: settings.returnPolicyEn,
      shippingPolicyTh: settings.shippingPolicyTh,
      shippingPolicyEn: settings.shippingPolicyEn,
      version: settings.version,
      updatedAt: settings.updatedAt,
    }
  }
}
