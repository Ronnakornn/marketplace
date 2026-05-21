import type { Coupon } from '#generated/client/client.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { localizedText, resolveContentLocale, type ContentLocale } from '#server/lib/localization.ts'
import { PromotionServiceError } from './promotion.errors.ts'
import type {
  CreateCouponInput,
  IPromotionRepository,
  IPromotionValidationRepository,
  PromotionCart,
  PromotionCoupon,
  UpdateCouponInput,
} from './promotion.repository.ts'

export interface PromotionActor {
  id: string
  role: Role
}

export interface ValidateCouponInput {
  couponCode: string
  cartId: string
}

export interface CouponValidationContext {
  userId: string
  couponCode: string
  subtotal: number
}

export interface CouponValidationResult {
  couponId: string
  couponCode: string
  discount: number
  discountCents: number
  subtotal: number
}

export interface CouponPayload {
  code: string
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  discountType: 'fixed' | 'percent'
  discountValue?: number | null
  discountValueCents?: number | null
  discountPercentBps?: number | null
  minOrder?: number | null
  maxDiscount?: number | null
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  usageLimit?: number | null
  perUserLimit?: number | null
  isActive?: boolean
}

export class PromotionService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IPromotionRepository,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async listPublicCoupons(localeInput?: string): Promise<Array<Coupon & { title: string; description: string | null }>> {
    const locale = resolveContentLocale(localeInput)
    const coupons = await this.repo.listPublicCoupons()
    return coupons.map((coupon) => this.localizeCoupon(coupon, locale))
  }

  listAdminCoupons(actor: PromotionActor): Promise<Coupon[]> {
    this.assertAdmin(actor)
    return this.repo.listAdminCoupons()
  }

  async listSellerCoupons(actor: PromotionActor): Promise<Coupon[]> {
    const shopIds = await this.getSellerShopIds(actor)
    return this.repo.listSellerCoupons(shopIds)
  }

  async validateCoupon(actor: PromotionActor, input: ValidateCouponInput): Promise<CouponValidationResult> {
    this.assertBuyer(actor)
    const code = this.normalizeCode(input.couponCode)
    const cart = await this.repo.findCartForCouponValidation(input.cartId, actor.id)
    if (!cart) throw new PromotionServiceError('Cart not found', 404, 'INVALID_COUPON')
    const subtotal = this.calculateCartsubtotal(cart)
    return this.validateCouponForsubtotal(this.repo, { userId: actor.id, couponCode: code, subtotal })
  }

  async validateCouponForsubtotal(
    repo: IPromotionValidationRepository,
    context: CouponValidationContext,
  ): Promise<CouponValidationResult> {
    const code = this.normalizeCode(context.couponCode)
    this.logger.debug('PromotionService.validateCouponForsubtotal', {
      userId: context.userId,
      couponCode: code,
      subtotal: context.subtotal,
    })
    const coupon = await repo.findCouponByCode(code)
    if (!coupon) throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    await this.assertCouponUsable(repo, coupon, context.userId, context.subtotal)
    const discount = this.calculateDiscount(coupon, context.subtotal)
    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      discount,
      discountCents: discount,
      subtotal: context.subtotal,
    }
  }

  async createCoupon(actor: PromotionActor, payload: CouponPayload): Promise<Coupon> {
    this.assertAdmin(actor)
    return this.repo.createCoupon(this.normalizeCouponPayload(payload) as CreateCouponInput)
  }

  async createSellerCoupon(actor: PromotionActor, payload: CouponPayload): Promise<Coupon> {
    const shopId = (await this.getSellerShopIds(actor))[0]
    if (!shopId) throw new PromotionServiceError('Seller shop not found', 404, 'COUPON_FORBIDDEN')
    return this.repo.createCoupon({ ...this.normalizeCouponPayload(payload) as CreateCouponInput, shopId })
  }

  async updateCoupon(actor: PromotionActor, couponId: string, payload: Partial<CouponPayload>): Promise<Coupon> {
    this.assertAdmin(actor)
    const coupon = await this.repo.findCouponById(couponId)
    if (!coupon) throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    return this.repo.updateCoupon(couponId, this.normalizeCouponPayload(payload, true))
  }

  async updateSellerCoupon(actor: PromotionActor, couponId: string, payload: Partial<CouponPayload>): Promise<Coupon> {
    const coupon = await this.getSellerCoupon(actor, couponId)
    return this.repo.updateCoupon(coupon.id, this.normalizeCouponPayload(payload, true))
  }

  async deleteCoupon(actor: PromotionActor, couponId: string): Promise<{ ok: true }> {
    this.assertAdmin(actor)
    const coupon = await this.repo.findCouponById(couponId)
    if (!coupon) throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    await this.repo.deleteCoupon(couponId)
    return { ok: true }
  }

  async deleteSellerCoupon(actor: PromotionActor, couponId: string): Promise<{ ok: true }> {
    const coupon = await this.getSellerCoupon(actor, couponId)
    await this.repo.deleteCoupon(coupon.id)
    return { ok: true }
  }

  private assertBuyer(actor: PromotionActor): void {
    if (actor.role === 'ADMIN') {
      throw new PromotionServiceError('Coupon validation is only available to buyers', 403, 'INVALID_COUPON')
    }
  }

  private assertAdmin(actor: PromotionActor): void {
    if (actor.role !== 'ADMIN') {
      throw new PromotionServiceError('Admin coupon access required', 403, 'INVALID_COUPON')
    }
  }

  private async getSellerShopIds(actor: PromotionActor): Promise<string[]> {
    const shops = this.activeShopResolver
      ? await this.activeShopResolver.resolveActiveShops(actor.id)
      : await this.repo.findSellerShops(actor.id)
    if (shops.length === 0) throw new PromotionServiceError('Active seller shop not found', 403, 'COUPON_FORBIDDEN')
    return shops.map((shop) => shop.id)
  }

  private async getSellerCoupon(actor: PromotionActor, couponId: string): Promise<Coupon> {
    const shopIds = await this.getSellerShopIds(actor)
    const coupon = await this.repo.findCouponById(couponId)
    if (!coupon || !coupon.shopId || !shopIds.includes(coupon.shopId)) {
      throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    }
    return coupon
  }

  private async assertCouponUsable(
    repo: IPromotionValidationRepository,
    coupon: PromotionCoupon,
    userId: string,
    subtotal: number,
  ): Promise<void> {
    const now = new Date()
    if (!coupon.isActive) throw new PromotionServiceError('Coupon is inactive', 400, 'COUPON_INACTIVE')
    if (coupon.startsAt && coupon.startsAt > now) throw new PromotionServiceError('Coupon has not started', 400, 'COUPON_NOT_STARTED')
    if (coupon.endsAt && coupon.endsAt < now) throw new PromotionServiceError('Coupon has expired', 400, 'COUPON_EXPIRED')
    const minOrder = coupon.minOrder ?? coupon.minOrderCents ?? null
    if (minOrder !== null && subtotal < minOrder) {
      throw new PromotionServiceError('Minimum order amount not met', 400, 'COUPON_MIN_ORDER_NOT_MET')
    }
    if (coupon.usageLimit !== null && coupon._count.redemptions >= coupon.usageLimit) {
      throw new PromotionServiceError('Coupon usage limit reached', 400, 'COUPON_USAGE_LIMIT_REACHED')
    }
    if (coupon.perUserLimit !== null) {
      const userRedemptions = await repo.countCouponRedemptionsForUser(coupon.id, userId)
      if (userRedemptions >= coupon.perUserLimit) {
        throw new PromotionServiceError('Coupon user limit reached', 400, 'COUPON_USER_LIMIT_REACHED')
      }
    }
  }

  private calculateDiscount(coupon: PromotionCoupon, subtotal: number): number {
    let discount = 0
    if (coupon.discountType === 'FIXED_AMOUNT') {
      discount = this.toMoneyNumber(coupon.discountValue ?? coupon.discountValueCents ?? 0)
    } else if (coupon.discountType === 'PERCENT') {
      discount = Math.floor(subtotal * (coupon.discountPercentBps ?? 0) / 10_000)
      const maxDiscount = coupon.maxDiscount ?? coupon.maxDiscountCents ?? null
      if (maxDiscount !== null) {
        discount = Math.min(discount, this.toMoneyNumber(maxDiscount))
      }
    }
    return Math.min(Math.max(0, discount), subtotal)
  }

  private calculateCartsubtotal(cart: PromotionCart): number {
    return cart.items.reduce((total, item) => total + this.toMoneyNumber(item.variant.price) * item.quantity, 0)
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().toUpperCase()
    if (!normalized) throw new PromotionServiceError('Coupon code is required', 400, 'INVALID_COUPON')
    return normalized
  }

  private normalizeCouponPayload(payload: Partial<CouponPayload>, partial = false): CreateCouponInput | UpdateCouponInput {
    const data: UpdateCouponInput = {}
    if (!partial || payload.code !== undefined) data.code = this.normalizeCode(payload.code ?? '')
    if (payload.titleTh !== undefined) data.titleTh = this.normalizeNullableText(payload.titleTh)
    if (payload.titleEn !== undefined) data.titleEn = this.normalizeNullableText(payload.titleEn)
    if (payload.descriptionTh !== undefined) data.descriptionTh = this.normalizeNullableText(payload.descriptionTh)
    if (payload.descriptionEn !== undefined) data.descriptionEn = this.normalizeNullableText(payload.descriptionEn)
    if (!partial || payload.discountType !== undefined) {
      data.discountType = this.normalizeDiscountType(payload.discountType)
    }
    if (payload.discountValue !== undefined || payload.discountValueCents !== undefined) {
      data.discountValue = payload.discountValue ?? payload.discountValueCents ?? null
    }
    if (payload.discountPercentBps !== undefined) data.discountPercentBps = payload.discountPercentBps
    if (payload.minOrder !== undefined) data.minOrder = payload.minOrder
    if (payload.maxDiscount !== undefined) data.maxDiscount = payload.maxDiscount
    if (payload.startsAt !== undefined) data.startsAt = this.normalizeDate(payload.startsAt)
    if (payload.endsAt !== undefined) data.endsAt = this.normalizeDate(payload.endsAt)
    if (payload.usageLimit !== undefined) data.usageLimit = payload.usageLimit
    if (payload.perUserLimit !== undefined) data.perUserLimit = payload.perUserLimit
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    return data as CreateCouponInput | UpdateCouponInput
  }

  private normalizeDiscountType(type: CouponPayload['discountType'] | undefined): CreateCouponInput['discountType'] {
    if (type === 'fixed') return 'FIXED_AMOUNT'
    if (type === 'percent') return 'PERCENT'
    throw new PromotionServiceError('Discount type must be fixed or percent', 400, 'INVALID_COUPON')
  }

  private normalizeDate(value: string | Date | null | undefined): Date | null {
    if (value === null || value === undefined) return null
    return value instanceof Date ? value : new Date(value)
  }

  private localizeCoupon<T extends Coupon>(coupon: T, locale: ContentLocale): T & { title: string; description: string | null } {
    return {
      ...coupon,
      title: localizedText(locale, { th: coupon.titleTh, en: coupon.titleEn, fallback: coupon.code }) ?? coupon.code,
      description: localizedText(locale, { th: coupon.descriptionTh, en: coupon.descriptionEn }),
    }
  }

  private normalizeNullableText(value?: string | null): string | null {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  private toMoneyNumber(value: bigint | number): number {
    return typeof value === 'bigint' ? Number(value) : value
  }
}
