import type { Cart, CartItem, Coupon, CouponClaim, CouponRedemptionStatus, PrismaClient, ProductVariant, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type PromotionCoupon = Omit<Coupon, 'titleTh' | 'titleEn' | 'descriptionTh' | 'descriptionEn'> & {
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  discountValueCents?: number | null
  minOrderCents?: number | null
  maxDiscountCents?: number | null
  _count: {
    redemptions: number
  }
}

export type BuyerPromotionCoupon = PromotionCoupon & {
  claims: Array<Pick<CouponClaim, 'id' | 'claimedAt'>>
}

export type PromotionCart = Cart & {
  items: Array<CartItem & {
    variant: Pick<ProductVariant, 'id' | 'price' | 'currency'>
  }>
}

export interface CreateCouponInput {
  shopId?: string | null
  code: string
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  discountType: 'PERCENT' | 'FIXED_AMOUNT'
  discountValue?: number | null
  discountPercentBps?: number | null
  minOrder?: number | null
  maxDiscount?: number | null
  startsAt?: Date | null
  endsAt?: Date | null
  usageLimit?: number | null
  perUserLimit?: number | null
  isActive?: boolean
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {}

export interface IPromotionValidationRepository {
  findCouponByCode(code: string): Promise<PromotionCoupon | null>
  countCouponRedemptionsForUser(couponId: string, userId: string): Promise<number>
}

export interface IPromotionRepository extends IPromotionValidationRepository {
  findCartForCouponValidation(cartId: string, userId: string): Promise<PromotionCart | null>
  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'ownerId'>>>
  listPublicCoupons(): Promise<PromotionCoupon[]>
  listBuyerCoupons(userId: string): Promise<BuyerPromotionCoupon[]>
  findCouponForClaim(couponId: string): Promise<PromotionCoupon | null>
  createCouponClaim(couponId: string, userId: string): Promise<CouponClaim>
  listAdminCoupons(): Promise<Coupon[]>
  listSellerCoupons(shopIds: string[]): Promise<Coupon[]>
  findCouponById(couponId: string): Promise<Coupon | null>
  createCoupon(input: CreateCouponInput): Promise<Coupon>
  updateCoupon(couponId: string, input: UpdateCouponInput): Promise<Coupon>
  deleteCoupon(couponId: string): Promise<Coupon>
}

const activeCouponRedemptionStatuses: CouponRedemptionStatus[] = ['RESERVED', 'REDEEMED']

const couponCountInclude = {
  _count: {
    select: { redemptions: { where: { status: { in: activeCouponRedemptionStatuses } } } },
  },
} as const

export class PrismaPromotionRepository implements IPromotionRepository {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private prisma: PrismaClient,
  ) {
    this.logger = appContext.logger
  }

  findCouponByCode(code: string): Promise<PromotionCoupon | null> {
    this.logger.debug('PrismaPromotionRepository.findCouponByCode', { code })
    return this.prisma.coupon.findUnique({
      where: { code },
      include: couponCountInclude,
    })
  }

  countCouponRedemptionsForUser(couponId: string, userId: string): Promise<number> {
    this.logger.debug('PrismaPromotionRepository.countCouponRedemptionsForUser', { couponId, userId })
    return this.prisma.couponRedemption.count({
      where: { couponId, userId, status: { in: ['RESERVED', 'REDEEMED'] } },
    })
  }

  findCartForCouponValidation(cartId: string, userId: string): Promise<PromotionCart | null> {
    this.logger.debug('PrismaPromotionRepository.findCartForCouponValidation', { cartId, userId })
    return this.prisma.cart.findFirst({
      where: {
        id: cartId,
        userId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            variant: {
              select: {
                id: true,
                price: true,
                currency: true,
              },
            },
          },
        },
      },
    })
  }

  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'ownerId'>>> {
    this.logger.debug('PrismaPromotionRepository.findSellerShops', { ownerId })
    return this.prisma.shop.findMany({
      where: { ownerId, status: 'ACTIVE' },
      select: { id: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  listPublicCoupons(): Promise<PromotionCoupon[]> {
    this.logger.debug('PrismaPromotionRepository.listPublicCoupons')
    const now = new Date()
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: couponCountInclude,
      orderBy: { createdAt: 'desc' },
    })
  }

  listBuyerCoupons(userId: string): Promise<BuyerPromotionCoupon[]> {
    this.logger.debug('PrismaPromotionRepository.listBuyerCoupons', { userId })
    const now = new Date()
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: {
        ...couponCountInclude,
        claims: {
          where: { userId },
          select: { id: true, claimedAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  findCouponForClaim(couponId: string): Promise<PromotionCoupon | null> {
    this.logger.debug('PrismaPromotionRepository.findCouponForClaim', { couponId })
    return this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: couponCountInclude,
    })
  }

  createCouponClaim(couponId: string, userId: string): Promise<CouponClaim> {
    this.logger.info('PrismaPromotionRepository.createCouponClaim', { couponId, userId })
    return this.prisma.couponClaim.upsert({
      where: { couponId_userId: { couponId, userId } },
      create: { couponId, userId },
      update: {},
    })
  }

  listAdminCoupons(): Promise<Coupon[]> {
    this.logger.debug('PrismaPromotionRepository.listAdminCoupons')
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  listSellerCoupons(shopIds: string[]): Promise<Coupon[]> {
    this.logger.debug('PrismaPromotionRepository.listSellerCoupons', { shopIds })
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.coupon.findMany({
      where: { shopId: { in: shopIds } },
      orderBy: { createdAt: 'desc' },
    })
  }

  findCouponById(couponId: string): Promise<Coupon | null> {
    this.logger.debug('PrismaPromotionRepository.findCouponById', { couponId })
    return this.prisma.coupon.findUnique({
      where: { id: couponId },
    })
  }

  createCoupon(input: CreateCouponInput): Promise<Coupon> {
    this.logger.info('PrismaPromotionRepository.createCoupon', { code: input.code })
    return this.prisma.coupon.create({ data: input })
  }

  updateCoupon(couponId: string, input: UpdateCouponInput): Promise<Coupon> {
    this.logger.info('PrismaPromotionRepository.updateCoupon', { couponId })
    return this.prisma.coupon.update({
      where: { id: couponId },
      data: input,
    })
  }

  deleteCoupon(couponId: string): Promise<Coupon> {
    this.logger.info('PrismaPromotionRepository.deleteCoupon', { couponId })
    return this.prisma.coupon.delete({
      where: { id: couponId },
    })
  }
}
