import type { Cart, CartItem, Coupon, PrismaClient, ProductVariant } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'

export type PromotionCoupon = Coupon & {
  _count: {
    redemptions: number
  }
}

export type PromotionCart = Cart & {
  items: Array<CartItem & {
    variant: Pick<ProductVariant, 'id' | 'priceCents' | 'currency'>
  }>
}

export interface CreateCouponInput {
  code: string
  discountType: 'PERCENT' | 'FIXED_AMOUNT'
  discountValueCents?: number | null
  discountPercentBps?: number | null
  minOrderCents?: number | null
  maxDiscountCents?: number | null
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
  listPublicCoupons(): Promise<Coupon[]>
  listAdminCoupons(): Promise<Coupon[]>
  findCouponById(couponId: string): Promise<Coupon | null>
  createCoupon(input: CreateCouponInput): Promise<Coupon>
  updateCoupon(couponId: string, input: UpdateCouponInput): Promise<Coupon>
  deleteCoupon(couponId: string): Promise<Coupon>
}

const couponCountInclude = {
  _count: {
    select: { redemptions: true },
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
      where: { couponId, userId },
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
                priceCents: true,
                currency: true,
              },
            },
          },
        },
      },
    })
  }

  listPublicCoupons(): Promise<Coupon[]> {
    this.logger.debug('PrismaPromotionRepository.listPublicCoupons')
    return this.prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  listAdminCoupons(): Promise<Coupon[]> {
    this.logger.debug('PrismaPromotionRepository.listAdminCoupons')
    return this.prisma.coupon.findMany({
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
