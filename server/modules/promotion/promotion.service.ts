import { moneyNumber, decimalMoneyNumber, moneyInteger } from '#server/lib/money.ts'
import type { Coupon } from '#generated/client/client.ts'
import type { Role } from '#generated/client/enums.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { ActiveShopResolver } from '#server/modules/security'
import { localizedText, resolveContentLocale } from '#server/lib/localization.ts'
import { PromotionServiceError } from './promotion.errors.ts'
import type {
  CreateCouponInput,
  IPromotionRepository,
  IPromotionValidationRepository,
  PromotionCart,
  PromotionCoupon,
  BuyerPromotionCoupon,
  UpdateCouponInput,
  FlashSalePayload,
  CouponListInput,
  FlashSaleListInput,
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
  shopSubtotals: Array<{ shopId: string; subtotal: number }>
}

export interface CouponValidationResult {
  couponId: string
  couponCode: string
  discount: number
  discountCents: number
  subtotal: number
  freeShipping: boolean
  couponShopId: string | null
  freeShippingShopIds: string[]
}

export interface PublicCoupon {
  id: string
  code: string
  title: string
  description: string | null
  discountType: Coupon['discountType']
  discountValueCents: bigint | null
  discountPercentBps: number | null
  minOrderCents: bigint | null
  maxDiscountCents: bigint | null
  startsAt: string | null
  endsAt: string | null
  claimed?: boolean
  claimedAt?: string | null
}

export interface CouponPayload {
  code: string
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  discountType: 'fixed' | 'percent' | 'free_shipping'
  discountValue?: number | null
  discountValueCents?: number | null
  discountPercentBps?: number | null
  minOrder?: number | null
  minOrderCents?: number | null
  maxDiscount?: number | null
  maxDiscountCents?: number | null
  startsAt?: string | Date | null
  endsAt?: string | Date | null
  usageLimit?: number | null
  perUserLimit?: number | null
  isActive?: boolean
}

export interface FlashSaleCampaignPayload {
  title: string
  description?: string | null
  status: FlashSalePayload['status']
  startsAt: string | Date
  endsAt: string | Date
}

export interface FlashSaleCampaignItemPayload {
  productId: string
  variantId: string
  salePriceBaht: number | string
  stockLimit: number
  perUserLimit?: number | null
}

export type FlashSaleCampaignItemUpdatePayload = Partial<Pick<FlashSaleCampaignItemPayload, 'salePriceBaht' | 'stockLimit' | 'perUserLimit'>>

export class PromotionService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private repo: IPromotionRepository,
    private activeShopResolver?: ActiveShopResolver,
  ) {
    this.logger = appContext.logger
  }

  async listPublicCoupons(localeInput?: string, input: CouponListInput = {}) {
    const locale = resolveContentLocale(localeInput)
    const page = await this.repo.listPublicCoupons(input)
    return { ...page, data: page.data.map(coupon => this.toPublicCoupon(coupon, locale)) }
  }

  async listBuyerCoupons(actor: PromotionActor, localeInput?: string, input: CouponListInput = {}) {
    this.assertBuyer(actor)
    const locale = resolveContentLocale(localeInput)
    const page = await this.repo.listBuyerCoupons(actor.id, input)
    return { ...page, data: page.data.map(coupon => this.toPublicCoupon(coupon, locale, coupon.claims[0])) }
  }

  async getBuyerCoins(actor: PromotionActor, limitInput = 20, cursor?: string) {
    this.assertBuyer(actor)
    const limit = Number.isInteger(limitInput) ? Math.min(Math.max(limitInput, 1), 100) : 20
    const [wallet, entries] = await Promise.all([
      this.repo.findBuyerCoinWallet(actor.id),
      this.repo.listBuyerCoinLedger(actor.id, limit + 1, cursor),
    ])
    const hasMore = entries.length > limit
    const pageEntries = entries.slice(0, limit)
    return {
      balance: moneyInteger(wallet?.balance ?? 0n),
      pendingBalance: moneyInteger(wallet?.pendingBalance ?? 0n),
      debtBalance: moneyInteger(wallet?.debtBalance ?? 0n),
      lifetimeEarned: moneyInteger(wallet?.lifetimeEarned ?? 0n),
      lifetimeSpent: moneyInteger(wallet?.lifetimeSpent ?? 0n),
      entries: pageEntries.map((entry) => ({ ...entry, amount: moneyInteger(entry.amount) })),
      nextCursor: hasMore ? pageEntries.at(-1)?.id ?? null : null,
    }
  }

  async claimCoupon(actor: PromotionActor, couponId: string, localeInput?: string): Promise<PublicCoupon> {
    this.assertBuyer(actor)
    const coupon = await this.repo.findCouponForClaim(couponId)
    if (!coupon) throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    this.assertCouponClaimable(coupon)
    const claim = await this.repo.createCouponClaim(coupon.id, actor.id)
    return this.toPublicCoupon(coupon, resolveContentLocale(localeInput), claim)
  }

  listAdminCoupons(actor: PromotionActor, input: CouponListInput = {}) {
    this.assertAdmin(actor)
    return this.repo.listAdminCoupons(input)
  }

  async listSellerCoupons(actor: PromotionActor, input: CouponListInput = {}) {
    const shopIds = await this.getSellerShopIds(actor)
    return this.repo.listSellerCoupons(shopIds, input)
  }

  async validateCoupon(actor: PromotionActor, input: ValidateCouponInput): Promise<CouponValidationResult> {
    this.assertBuyer(actor)
    const code = this.normalizeCode(input.couponCode)
    const cart = await this.repo.findCartForCouponValidation(input.cartId, actor.id)
    if (!cart) throw new PromotionServiceError('Cart not found', 404, 'INVALID_COUPON')
    const shopSubtotals = this.calculateCartShopSubtotals(cart)
    const subtotal = shopSubtotals.reduce((total, shop) => total + shop.subtotal, 0)
    return this.validateCouponForsubtotal(this.repo, { userId: actor.id, couponCode: code, subtotal, shopSubtotals })
  }

  async validateCouponForsubtotal(
    repo: IPromotionValidationRepository,
    context: CouponValidationContext,
  ): Promise<CouponValidationResult> {
    const code = this.normalizeCode(context.couponCode)
    const coupon = await repo.findCouponByCode(code)
    if (!coupon) throw new PromotionServiceError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    return this.validateLoadedCouponForSubtotal(repo, coupon, context)
  }

  async validateLoadedCouponForSubtotal(
    repo: IPromotionValidationRepository,
    coupon: PromotionCoupon,
    context: CouponValidationContext,
  ): Promise<CouponValidationResult> {
    const code = this.normalizeCode(context.couponCode)
    this.logger.debug('PromotionService.validateCouponForsubtotal', {
      userId: context.userId,
      couponCode: code,
      subtotal: context.subtotal,
    })
    const eligibleSubtotal = this.resolveCouponEligibleSubtotal(coupon, context)
    await this.assertCouponUsable(repo, coupon, context.userId, eligibleSubtotal)
    const discount = this.calculateDiscount(coupon, eligibleSubtotal)
    const freeShippingShopIds = coupon.discountType === 'FREE_SHIPPING'
      ? coupon.shopId
        ? [coupon.shopId]
        : context.shopSubtotals.map((shop) => shop.shopId)
      : []
    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      discount,
      discountCents: discount,
      subtotal: context.subtotal,
      freeShipping: coupon.discountType === 'FREE_SHIPPING',
      couponShopId: coupon.shopId,
      freeShippingShopIds,
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

  async listAdminFlashSales(actor: PromotionActor, input: FlashSaleListInput = {}) {
    this.assertAdmin(actor)
    return this.repo.listAdminFlashSales(input)
  }

  async listSellerFlashSales(actor: PromotionActor) {
    const shopIds = await this.getSellerShopIds(actor)
    return this.repo.listSellerFlashSales(shopIds)
  }

  async createFlashSale(actor: PromotionActor, payload: FlashSaleCampaignPayload) {
    this.assertAdmin(actor)
    return this.repo.createFlashSale(this.normalizeFlashSalePayload(payload))
  }

  async updateFlashSale(actor: PromotionActor, flashSaleId: string, payload: Partial<FlashSaleCampaignPayload>) {
    this.assertAdmin(actor)
    const sale = await this.repo.findFlashSaleById(flashSaleId)
    if (!sale) throw new PromotionServiceError('Flash sale not found', 404, 'COUPON_NOT_FOUND')
    const normalized = this.normalizeFlashSalePayload({
      title: payload.title ?? sale.title,
      description: payload.description ?? sale.description,
      status: payload.status ?? sale.status,
      startsAt: payload.startsAt ?? sale.startsAt,
      endsAt: payload.endsAt ?? sale.endsAt,
    })
    const updated = await this.repo.updateFlashSaleSafely(flashSaleId, normalized)
    if (!updated) throw new PromotionServiceError('Campaign schedule overlaps another flash sale', 409, 'FLASH_SALE_OVERLAP')
    return updated
  }

  async addFlashSaleItem(actor: PromotionActor, flashSaleId: string, payload: FlashSaleCampaignItemPayload) {
    this.assertAdmin(actor)
    const sale = await this.repo.findFlashSaleById(flashSaleId)
    if (!sale) throw new PromotionServiceError('Flash sale not found', 404, 'COUPON_NOT_FOUND')
    this.assertFlashSaleItemsMutable(sale)
    const variant = await this.repo.findActiveProductVariant(payload.variantId)
    if (!variant || variant.product.id !== payload.productId) throw new PromotionServiceError('Product variant is unavailable', 400, 'INVALID_COUPON')
    const normalized = this.normalizeFlashSaleItemPayload(payload)
    this.assertFlashSaleItemCreatePayload(normalized, moneyNumber(variant.price))
    if (['SCHEDULED', 'ACTIVE'].includes(sale.status)) await this.assertNoOverlappingFlashSale(payload.variantId, sale.startsAt, sale.endsAt, sale.id)
    const created = await this.repo.createFlashSaleItem(flashSaleId, { ...normalized, shopId: variant.product.shopId, originalPrice: moneyNumber(variant.price) })
    if (!created) throw new PromotionServiceError('Variant is already enrolled in an overlapping flash sale', 409, 'FLASH_SALE_OVERLAP')
    return created
  }

  async addSellerFlashSaleItem(actor: PromotionActor, flashSaleId: string, payload: FlashSaleCampaignItemPayload) {
    const shopIds = await this.getSellerShopIds(actor)
    const sale = await this.repo.findFlashSaleById(flashSaleId)
    if (!sale || sale.status !== 'SCHEDULED' || sale.startsAt <= new Date() || (sale.shopId !== null && !shopIds.includes(sale.shopId))) {
      throw new PromotionServiceError('Flash sale is not open for seller participation', 404, 'FLASH_SALE_NOT_AVAILABLE')
    }
    const variant = await this.repo.findActiveProductVariant(payload.variantId)
    if (!variant || variant.product.id !== payload.productId || !shopIds.includes(variant.product.shopId)) {
      throw new PromotionServiceError('Product variant is unavailable', 404, 'FLASH_SALE_ITEM_NOT_FOUND')
    }
    const normalized = this.normalizeFlashSaleItemPayload(payload)
    this.assertFlashSaleItemCreatePayload(normalized, moneyNumber(variant.price))
    await this.assertNoOverlappingFlashSale(payload.variantId, sale.startsAt, sale.endsAt, sale.id)
    const created = await this.repo.createFlashSaleItem(flashSaleId, {
      ...normalized,
      shopId: variant.product.shopId,
      originalPrice: moneyNumber(variant.price),
    })
    if (!created) throw new PromotionServiceError('Variant is already enrolled in an overlapping flash sale', 409, 'FLASH_SALE_OVERLAP')
    return created
  }

  async updateFlashSaleItem(actor: PromotionActor, itemId: string, payload: FlashSaleCampaignItemUpdatePayload) {
    this.assertAdmin(actor)
    const item = await this.repo.findFlashSaleItemById(itemId)
    if (!item) throw new PromotionServiceError('Flash sale item not found', 404, 'FLASH_SALE_ITEM_NOT_FOUND')
    this.assertFlashSaleItemsMutable(item.flashSale)
    const normalized = this.normalizeFlashSaleItemUpdatePayload(payload)
    await this.assertFlashSaleItemUpdatePayload(item, itemId, normalized)
    return this.repo.updateFlashSaleItem(itemId, normalized)
  }

  async deleteFlashSaleItem(actor: PromotionActor, itemId: string): Promise<{ ok: true }> {
    this.assertAdmin(actor)
    const item = await this.repo.findFlashSaleItemById(itemId)
    if (!item) throw new PromotionServiceError('Flash sale item not found', 404, 'FLASH_SALE_ITEM_NOT_FOUND')
    this.assertFlashSaleItemsMutable(item.flashSale)
    await this.assertFlashSaleItemDeletable(item)
    await this.repo.deleteFlashSaleItem(itemId)
    return { ok: true }
  }

  async updateSellerFlashSaleItem(actor: PromotionActor, itemId: string, payload: FlashSaleCampaignItemUpdatePayload) {
    const item = await this.getSellerFlashSaleItem(actor, itemId)
    this.assertFlashSaleItemsMutable(item.flashSale)
    const normalized = this.normalizeFlashSaleItemUpdatePayload(payload)
    await this.assertFlashSaleItemUpdatePayload(item, itemId, normalized)
    return this.repo.updateFlashSaleItem(itemId, normalized)
  }

  async deleteSellerFlashSaleItem(actor: PromotionActor, itemId: string): Promise<{ ok: true }> {
    const item = await this.getSellerFlashSaleItem(actor, itemId)
    this.assertFlashSaleItemsMutable(item.flashSale)
    await this.assertFlashSaleItemDeletable(item)
    await this.repo.deleteFlashSaleItem(itemId)
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

  private async getSellerFlashSaleItem(actor: PromotionActor, itemId: string) {
    const shopIds = await this.getSellerShopIds(actor)
    const item = await this.repo.findFlashSaleItemById(itemId)
    if (!item || !shopIds.includes(item.shopId)) {
      throw new PromotionServiceError('Flash sale item not found', 404, 'FLASH_SALE_ITEM_NOT_FOUND')
    }
    return item
  }

  private assertFlashSaleItemCreatePayload(payload: import('./promotion.repository.ts').FlashSaleItemPayload, regularPrice: number): void {
    if (!Number.isInteger(payload.salePrice) || payload.salePrice <= 0 || payload.salePrice >= regularPrice) {
      throw new PromotionServiceError('Flash sale price must be below the active product price', 400, 'FLASH_SALE_PRICE_INVALID')
    }
    if (!Number.isInteger(payload.stockLimit) || payload.stockLimit < 1 || payload.stockLimit > 2_147_483_647 || (
      payload.perUserLimit !== undefined
      && payload.perUserLimit !== null
      && (!Number.isInteger(payload.perUserLimit) || payload.perUserLimit < 1 || payload.perUserLimit > 2_147_483_647)
    )) {
      throw new PromotionServiceError('Flash sale quota is invalid', 400, 'FLASH_SALE_QUOTA_INVALID')
    }
  }

  private assertFlashSaleItemsMutable(sale: { status: string; startsAt: Date }): void {
    if (!['DRAFT', 'SCHEDULED'].includes(sale.status) || sale.startsAt <= new Date()) {
      throw new PromotionServiceError('Live or completed flash sale items cannot be changed', 409, 'FLASH_SALE_ITEM_LOCKED')
    }
  }

  private async assertFlashSaleItemDeletable(item: Awaited<ReturnType<IPromotionRepository['findFlashSaleItemById']>> & {}): Promise<void> {
    const activeReservations = await this.repo.sumActiveFlashSaleReservations(item.id)
    if (item.soldCount > 0 || activeReservations > 0) {
      throw new PromotionServiceError('Flash sale item has sold or reserved quantity', 409, 'FLASH_SALE_ITEM_LOCKED')
    }
  }

  private async assertNoOverlappingFlashSale(variantId: string, startsAt: Date, endsAt: Date, flashSaleId: string): Promise<void> {
    const overlap = await this.repo.findOverlappingFlashSaleItem(variantId, startsAt, endsAt, flashSaleId)
    if (overlap) {
      throw new PromotionServiceError('Product variant is already enrolled in an overlapping flash sale', 409, 'FLASH_SALE_OVERLAP')
    }
  }

  private normalizeFlashSaleItemPayload(payload: FlashSaleCampaignItemPayload): import('./promotion.repository.ts').FlashSaleItemPayload {
    return {
      productId: payload.productId,
      variantId: payload.variantId,
      salePrice: this.bahtToMinorUnits(payload.salePriceBaht),
      stockLimit: payload.stockLimit,
      perUserLimit: payload.perUserLimit,
    }
  }

  private normalizeFlashSaleItemUpdatePayload(payload: FlashSaleCampaignItemUpdatePayload): Partial<import('./promotion.repository.ts').FlashSaleItemPayload> {
    return {
      ...(payload.salePriceBaht !== undefined ? { salePrice: this.bahtToMinorUnits(payload.salePriceBaht) } : {}),
      ...(payload.stockLimit !== undefined ? { stockLimit: payload.stockLimit } : {}),
      ...(payload.perUserLimit !== undefined ? { perUserLimit: payload.perUserLimit } : {}),
    }
  }

  private bahtToMinorUnits(value: number | string): number {
    let minorUnits: number
    try { minorUnits = decimalMoneyNumber(value) } catch { throw new PromotionServiceError('Flash sale price must be a positive amount with at most two decimal places', 400, 'FLASH_SALE_PRICE_INVALID') }
    if (minorUnits <= 0) throw new PromotionServiceError('Flash sale price must be positive', 400, 'FLASH_SALE_PRICE_INVALID')
    return minorUnits
  }

  private async assertFlashSaleItemUpdatePayload(
    item: Awaited<ReturnType<IPromotionRepository['findFlashSaleItemById']>> & {},
    itemId: string,
    payload: Partial<import('./promotion.repository.ts').FlashSaleItemPayload>,
  ): Promise<void> {
    if (payload.salePrice !== undefined && (
      !Number.isInteger(payload.salePrice)
      || payload.salePrice <= 0
      || payload.salePrice >= moneyNumber(item.variant.price)
    )) {
      throw new PromotionServiceError('Flash sale price must be below the active product price', 400, 'FLASH_SALE_PRICE_INVALID')
    }
    if (payload.perUserLimit !== undefined && payload.perUserLimit !== null && (
      !Number.isInteger(payload.perUserLimit) || payload.perUserLimit < 1 || payload.perUserLimit > 2_147_483_647
    )) {
      throw new PromotionServiceError('Flash sale per-user quota is invalid', 400, 'FLASH_SALE_QUOTA_INVALID')
    }
    if (payload.stockLimit !== undefined) {
      const activeReservations = await this.repo.sumActiveFlashSaleReservations(itemId)
      if (!Number.isInteger(payload.stockLimit) || payload.stockLimit > 2_147_483_647 || payload.stockLimit < 0 || payload.stockLimit < item.soldCount + activeReservations) {
        throw new PromotionServiceError('Flash sale quota cannot be lower than sold and reserved quantity', 400, 'FLASH_SALE_QUOTA_INVALID')
      }
    }
  }

  private async assertCouponUsable(
    repo: IPromotionValidationRepository,
    coupon: PromotionCoupon,
    userId: string,
    subtotal: number,
  ): Promise<void> {
    const now = new Date()
    const startsAt = this.toDate(coupon.startsAt)
    const endsAt = this.toDate(coupon.endsAt)
    if (!coupon.isActive) throw new PromotionServiceError('Coupon is inactive', 400, 'COUPON_INACTIVE')
    if (startsAt && startsAt > now) throw new PromotionServiceError('Coupon has not started', 400, 'COUPON_NOT_STARTED')
    if (endsAt && endsAt < now) throw new PromotionServiceError('Coupon has expired', 400, 'COUPON_EXPIRED')
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

  private assertCouponClaimable(coupon: PromotionCoupon): void {
    const now = new Date()
    const startsAt = this.toDate(coupon.startsAt)
    const endsAt = this.toDate(coupon.endsAt)
    if (!coupon.isActive) throw new PromotionServiceError('Coupon is inactive', 400, 'COUPON_INACTIVE')
    if (startsAt && startsAt > now) throw new PromotionServiceError('Coupon has not started', 400, 'COUPON_NOT_STARTED')
    if (endsAt && endsAt <= now) throw new PromotionServiceError('Coupon has expired', 400, 'COUPON_EXPIRED')
    if (coupon.usageLimit !== null && coupon._count.redemptions >= coupon.usageLimit) {
      throw new PromotionServiceError('Coupon usage limit reached', 400, 'COUPON_USAGE_LIMIT_REACHED')
    }
  }

  private calculateDiscount(coupon: PromotionCoupon, subtotal: number): number {
    let discount = 0
    if (coupon.discountType === 'FIXED_AMOUNT') {
      discount = this.toMoneyNumber(coupon.discountValue ?? coupon.discountValueCents ?? 0)
    } else if (coupon.discountType === 'PERCENT') {
      discount = moneyNumber(BigInt(subtotal) * BigInt(coupon.discountPercentBps ?? 0) / 10_000n)
      const maxDiscount = coupon.maxDiscount ?? coupon.maxDiscountCents ?? null
      if (maxDiscount !== null) {
        discount = Math.min(discount, this.toMoneyNumber(maxDiscount))
      }
    }
    return Math.min(Math.max(0, discount), subtotal)
  }

  private calculateCartShopSubtotals(cart: PromotionCart): Array<{ shopId: string; subtotal: number }> {
    const subtotals = new Map<string, number>()
    for (const item of cart.items) {
      const shopId = item.variant.product.shopId
      subtotals.set(shopId, moneyNumber(BigInt(subtotals.get(shopId) ?? 0) + BigInt(this.toMoneyNumber(item.variant.price)) * BigInt(item.quantity)))
    }
    return [...subtotals].map(([shopId, subtotal]) => ({ shopId, subtotal }))
  }

  private resolveCouponEligibleSubtotal(coupon: PromotionCoupon, context: CouponValidationContext): number {
    if (!coupon.shopId) return context.subtotal
    const shopSubtotal = context.shopSubtotals.find((shop) => shop.shopId === coupon.shopId)?.subtotal
    if (shopSubtotal === undefined) {
      throw new PromotionServiceError('Coupon is not valid for the selected shops', 400, 'COUPON_SHOP_MISMATCH')
    }
    return shopSubtotal
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
    if (payload.minOrder !== undefined || payload.minOrderCents !== undefined) {
      data.minOrder = payload.minOrder ?? payload.minOrderCents ?? null
    }
    if (payload.maxDiscount !== undefined || payload.maxDiscountCents !== undefined) {
      data.maxDiscount = payload.maxDiscount ?? payload.maxDiscountCents ?? null
    }
    if (payload.startsAt !== undefined) data.startsAt = this.normalizeDate(payload.startsAt)
    if (payload.endsAt !== undefined) data.endsAt = this.normalizeDate(payload.endsAt)
    if (payload.usageLimit !== undefined) data.usageLimit = payload.usageLimit
    if (payload.perUserLimit !== undefined) data.perUserLimit = payload.perUserLimit
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    for (const [field, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue
      const minimum = field === 'usageLimit' || field === 'perUserLimit' ? 1 : 0
      const maximum = field === 'discountPercentBps' ? 10_000
        : field === 'usageLimit' || field === 'perUserLimit' ? 2_147_483_647
          : Number.MAX_SAFE_INTEGER
      if (['discountValue', 'minOrder', 'maxDiscount', 'discountPercentBps', 'usageLimit', 'perUserLimit'].includes(field)
        && (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum)) {
        throw new PromotionServiceError(`${field} must be an integer between ${minimum} and ${maximum}`, 400, 'INVALID_COUPON')
      }
    }
    return data as CreateCouponInput | UpdateCouponInput
  }

  private normalizeDiscountType(type: CouponPayload['discountType'] | undefined): CreateCouponInput['discountType'] {
    if (type === 'fixed') return 'FIXED_AMOUNT'
    if (type === 'percent') return 'PERCENT'
    if (type === 'free_shipping') return 'FREE_SHIPPING'
    throw new PromotionServiceError('Discount type must be fixed or percent', 400, 'INVALID_COUPON')
  }

  private normalizeFlashSalePayload(payload: FlashSaleCampaignPayload): FlashSalePayload {
    const startsAt = this.normalizeDate(payload.startsAt)
    const endsAt = this.normalizeDate(payload.endsAt)
    if (!payload.title.trim() || !startsAt || !endsAt || endsAt <= startsAt) {
      throw new PromotionServiceError('Flash sale schedule is invalid', 400, 'INVALID_COUPON')
    }
    return { title: payload.title.trim(), description: this.normalizeNullableText(payload.description), status: payload.status, startsAt, endsAt }
  }

  private normalizeDate(value: string | Date | null | undefined): Date | null {
    if (value === null || value === undefined) return null
    return value instanceof Date ? value : new Date(value)
  }

  private toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private toIsoDate(value: Date | string | null | undefined): string | null {
    return this.toDate(value)?.toISOString() ?? null
  }

  private toPublicCoupon(
    coupon: PromotionCoupon,
    locale: ReturnType<typeof resolveContentLocale>,
    claim?: BuyerPromotionCoupon['claims'][number],
  ): PublicCoupon {
    return {
      id: coupon.id,
      code: coupon.code,
      title: localizedText(locale, { th: coupon.titleTh, en: coupon.titleEn, fallback: coupon.code }) ?? coupon.code,
      description: localizedText(locale, { th: coupon.descriptionTh, en: coupon.descriptionEn }),
      discountType: coupon.discountType,
      discountValueCents: coupon.discountValue === null ? null : moneyInteger(coupon.discountValue),
      discountPercentBps: coupon.discountPercentBps,
      minOrderCents: coupon.minOrder === null ? null : moneyInteger(coupon.minOrder),
      maxDiscountCents: coupon.maxDiscount === null ? null : moneyInteger(coupon.maxDiscount),
      startsAt: this.toIsoDate(coupon.startsAt),
      endsAt: this.toIsoDate(coupon.endsAt),
      claimed: Boolean(claim),
      claimedAt: this.toIsoDate(claim?.claimedAt),
    }
  }

  private normalizeNullableText(value?: string | null): string | null {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }

  private toMoneyNumber(value: bigint | number): number {
    return moneyNumber(value)
  }
}
