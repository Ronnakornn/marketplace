import { Prisma } from '#generated/client/client.ts'
import { listPage, listPageResult, type ListPageInput } from '#server/lib/list-page.ts'
import { escapeLikeLiteral } from '#server/lib/sql-like.ts'
import type { BuyerCoinLedger, BuyerCoinWallet, Cart, CartItem, Coupon, CouponClaim, CouponRedemptionStatus, FlashSale, FlashSaleItem, PrismaClient, ProductVariant, Shop } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { PromotionServiceError } from './promotion.errors.ts'

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
    variant: Pick<ProductVariant, 'id' | 'price' | 'currency'> & {
      product: { shopId: string }
    }
  }>
}

export interface CreateCouponInput {
  shopId?: string | null
  code: string
  titleTh?: string | null
  titleEn?: string | null
  descriptionTh?: string | null
  descriptionEn?: string | null
  discountType: 'PERCENT' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
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

export interface FlashSalePayload {
  title: string
  description?: string | null
  status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED'
  startsAt: Date
  endsAt: Date
}

export interface FlashSaleItemPayload {
  productId: string
  variantId: string
  salePrice: number
  stockLimit: number
  perUserLimit?: number | null
}

export type FlashSaleItemForManagement = FlashSaleItem & {
  variant: Pick<ProductVariant, 'price'>
  flashSale: Pick<FlashSale, 'id' | 'shopId' | 'status' | 'startsAt' | 'endsAt'>
}

export interface CouponListInput extends ListPageInput { q?: string; isActive?: boolean; shopId?: string }
export interface FlashSaleListInput extends ListPageInput { q?: string; status?: FlashSale['status'] }
export type CouponPage<T> = ReturnType<typeof listPageResult<T>>

export interface IPromotionValidationRepository {
  findCouponByCode(code: string): Promise<PromotionCoupon | null>
  countCouponRedemptionsForUser(couponId: string, userId: string): Promise<number>
}

export interface IPromotionRepository extends IPromotionValidationRepository {
  findBuyerCoinWallet(userId: string): Promise<Pick<BuyerCoinWallet, 'balance' | 'pendingBalance' | 'debtBalance' | 'lifetimeEarned' | 'lifetimeSpent'> | null>
  listBuyerCoinLedger(userId: string, limit: number, cursor?: string): Promise<Array<Pick<BuyerCoinLedger, 'id' | 'type' | 'status' | 'amount' | 'reason' | 'orderId' | 'createdAt'>>>
  findCartForCouponValidation(cartId: string, userId: string): Promise<PromotionCart | null>
  findSellerShops(ownerId: string): Promise<Array<Pick<Shop, 'id' | 'ownerId'>>>
  listPublicCoupons(input?: CouponListInput): Promise<CouponPage<PromotionCoupon>>
  listBuyerCoupons(userId: string, input?: CouponListInput): Promise<CouponPage<BuyerPromotionCoupon>>
  findCouponForClaim(couponId: string): Promise<PromotionCoupon | null>
  createCouponClaim(couponId: string, userId: string): Promise<CouponClaim>
  listAdminCoupons(input?: CouponListInput): Promise<CouponPage<Coupon>>
  listSellerCoupons(shopIds: string[], input?: CouponListInput): Promise<CouponPage<Coupon>>
  findCouponById(couponId: string): Promise<Coupon | null>
  createCoupon(input: CreateCouponInput): Promise<Coupon>
  updateCoupon(couponId: string, input: UpdateCouponInput): Promise<Coupon>
  deleteCoupon(couponId: string): Promise<Coupon>
  listAdminFlashSales(input?: FlashSaleListInput): Promise<CouponPage<FlashSale & { items: FlashSaleItem[] }>>
  listSellerFlashSales(shopIds: string[]): Promise<Array<FlashSale & { items: FlashSaleItem[] }>>
  findFlashSaleById(flashSaleId: string): Promise<(FlashSale & { items: FlashSaleItem[] }) | null>
  createFlashSale(input: FlashSalePayload): Promise<FlashSale>
  updateFlashSale(flashSaleId: string, input: Partial<FlashSalePayload>): Promise<FlashSale>
  updateFlashSaleSafely(flashSaleId: string, input: FlashSalePayload): Promise<FlashSale | null>
  findActiveProductVariant(variantId: string): Promise<(Pick<ProductVariant, 'id' | 'price'> & { product: { id: string; shopId: string } }) | null>
  createFlashSaleItem(flashSaleId: string, input: FlashSaleItemPayload & { shopId: string; originalPrice: number }): Promise<FlashSaleItem | null>
  findFlashSaleItemById(itemId: string): Promise<FlashSaleItemForManagement | null>
  findOverlappingFlashSaleItem(variantId: string, startsAt: Date, endsAt: Date, excludeFlashSaleId: string): Promise<Pick<FlashSaleItem, 'id'> | null>
  sumActiveFlashSaleReservations(itemId: string): Promise<number>
  updateFlashSaleItem(itemId: string, input: Partial<FlashSaleItemPayload>): Promise<FlashSaleItem>
  deleteFlashSaleItem(itemId: string): Promise<FlashSaleItem>
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

  findBuyerCoinWallet(userId: string): Promise<Pick<BuyerCoinWallet, 'balance' | 'pendingBalance' | 'debtBalance' | 'lifetimeEarned' | 'lifetimeSpent'> | null> {
    return this.prisma.buyerCoinWallet.findUnique({
      where: { userId },
      select: { balance: true, pendingBalance: true, debtBalance: true, lifetimeEarned: true, lifetimeSpent: true },
    })
  }

  listBuyerCoinLedger(userId: string, limit: number, cursor?: string): Promise<Array<Pick<BuyerCoinLedger, 'id' | 'type' | 'status' | 'amount' | 'reason' | 'orderId' | 'createdAt'>>> {
    return this.prisma.buyerCoinLedger.findMany({
      where: { userId },
      select: { id: true, type: true, status: true, amount: true, reason: true, orderId: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
                product: { select: { shopId: true } },
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

  async listPublicCoupons(input: CouponListInput = {}): Promise<CouponPage<PromotionCoupon>> {
    return this.listEligibleCoupons(input)
  }

  async listBuyerCoupons(userId: string, input: CouponListInput = {}): Promise<CouponPage<BuyerPromotionCoupon>> {
    return this.listEligibleCoupons(input, userId)
  }

  private async listEligibleCoupons(input: CouponListInput, userId?: string): Promise<CouponPage<BuyerPromotionCoupon>> {
    const { skip, take } = listPage(input)
    const now = new Date()
    const search = input.q?.trim()
    const pattern = '%' + (search?.replace(/[\\%_]/g, '\\$&') ?? '') + '%'
    const where = Prisma.sql`c."isActive" = true
      AND (c."startsAt" IS NULL OR c."startsAt" <= ${now})
      AND (c."endsAt" IS NULL OR c."endsAt" > ${now})
      AND (c."usageLimit" IS NULL OR c."usageLimit" > (
        SELECT COUNT(*) FROM "CouponRedemption" r WHERE r."couponId" = c.id AND r.status IN ('RESERVED', 'REDEEMED')
      ))
      ${search ? Prisma.sql`AND (c.code ILIKE ${pattern} OR c."titleEn" ILIKE ${pattern} OR c."titleTh" ILIKE ${pattern})` : Prisma.empty}`
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "Coupon" c WHERE ${where}`
      const ids = await tx.$queryRaw<Array<{ id: string }>>`SELECT c.id FROM "Coupon" c WHERE ${where}
        ORDER BY ${userId ? Prisma.sql`EXISTS (SELECT 1 FROM "CouponClaim" cc WHERE cc."couponId" = c.id AND cc."userId" = ${userId}::uuid) DESC,` : Prisma.empty}
        c."createdAt" DESC, c.id DESC OFFSET ${skip} LIMIT ${take}`
      const coupons = await tx.coupon.findMany({
        where: { id: { in: ids.map(row => row.id) } },
        include: { ...couponCountInclude, claims: { where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' }, select: { id: true, claimedAt: true }, take: 1 } },
      })
      const byId = new Map(coupons.map(coupon => [coupon.id, coupon]))
      return listPageResult(ids.flatMap(row => { const coupon = byId.get(row.id); return coupon ? [coupon] : [] }), Number(total[0]?.count ?? 0n), input)
    }, { isolationLevel: 'RepeatableRead' })
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

  listAdminCoupons(input: CouponListInput = {}): Promise<CouponPage<Coupon>> {
    return this.listManagedCoupons(input)
  }

  listSellerCoupons(shopIds: string[], input: CouponListInput = {}): Promise<CouponPage<Coupon>> {
    return this.listManagedCoupons(input, shopIds)
  }

  private async listManagedCoupons(input: CouponListInput, shopIds?: string[]): Promise<CouponPage<Coupon>> {
    const q = input.q?.trim() ? escapeLikeLiteral(input.q.trim()) : undefined
    const where: Prisma.CouponWhereInput = {
      ...(shopIds ? { shopId: { in: input.shopId ? shopIds.filter(id => id === input.shopId) : shopIds } } : input.shopId ? { shopId: input.shopId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { titleEn: { contains: q, mode: 'insensitive' } }, { titleTh: { contains: q, mode: 'insensitive' } }] } : {}),
    }
    const { skip, take } = listPage(input)
    const [data, count] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.coupon.count({ where }),
    ])
    return listPageResult(data, count, input)
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

  async listAdminFlashSales(input: FlashSaleListInput = {}): Promise<CouponPage<FlashSale & { items: FlashSaleItem[] }>> {
    const q = input.q?.trim() ? escapeLikeLiteral(input.q.trim()) : undefined
    const where: Prisma.FlashSaleWhereInput = { ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}), ...(input.status ? { status: input.status } : {}) }
    const { skip, take } = listPage(input)
    const [data, count] = await this.prisma.$transaction([
      this.prisma.flashSale.findMany({ where, include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } }, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], skip, take }),
      this.prisma.flashSale.count({ where }),
    ])
    return listPageResult(data, count, input)
  }

  listSellerFlashSales(shopIds: string[]): Promise<Array<FlashSale & { items: FlashSaleItem[] }>> {
    if (shopIds.length === 0) return Promise.resolve([])
    return this.prisma.flashSale.findMany({
      where: {
        status: { in: ['SCHEDULED', 'ACTIVE'] },
        OR: [{ shopId: null }, { shopId: { in: shopIds } }],
      },
      include: {
        items: {
          where: { shopId: { in: shopIds } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    })
  }

  findFlashSaleById(flashSaleId: string): Promise<(FlashSale & { items: FlashSaleItem[] }) | null> {
    return this.prisma.flashSale.findUnique({ where: { id: flashSaleId }, include: { items: { orderBy: { createdAt: 'asc' } } } })
  }

  createFlashSale(input: FlashSalePayload): Promise<FlashSale> {
    return this.prisma.flashSale.create({ data: input })
  }

  updateFlashSale(flashSaleId: string, input: Partial<FlashSalePayload>): Promise<FlashSale> {
    return this.prisma.flashSale.update({ where: { id: flashSaleId }, data: input })
  }

  updateFlashSaleSafely(flashSaleId: string, input: FlashSalePayload): Promise<FlashSale | null> {
    return this.prisma.$transaction(async (tx) => {
      const lockedSale = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "FlashSale" WHERE "id" = ${flashSaleId}::uuid FOR UPDATE`
      if (!lockedSale.length) return null
      const items = await tx.flashSaleItem.findMany({ where: { flashSaleId, isActive: true }, select: { variantId: true } })
      for (const variantId of [...new Set(items.map((item) => item.variantId))].sort()) {
        await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id" = ${variantId}::uuid FOR UPDATE`
      }
      if (input.status === 'SCHEDULED' || input.status === 'ACTIVE') {
        for (const { variantId } of items) {
          const overlap = await tx.flashSaleItem.findFirst({
            where: {
              variantId,
              isActive: true,
              flashSaleId: { not: flashSaleId },
              flashSale: { status: { in: ['SCHEDULED', 'ACTIVE'] }, startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt } },
            },
            select: { id: true },
          })
          if (overlap) return null
        }
      }
      return tx.flashSale.update({ where: { id: flashSaleId }, data: input })
    })
  }

  findActiveProductVariant(variantId: string): Promise<(Pick<ProductVariant, 'id' | 'price'> & { product: { id: string; shopId: string } }) | null> {
    return this.prisma.productVariant.findFirst({ where: { id: variantId, status: 'ACTIVE', product: { status: 'ACTIVE', shop: { status: 'ACTIVE' } } }, select: { id: true, price: true, product: { select: { id: true, shopId: true } } } })
  }

  createFlashSaleItem(flashSaleId: string, input: FlashSaleItemPayload & { shopId: string; originalPrice: number }): Promise<FlashSaleItem | null> {
    return this.prisma.$transaction(async (tx) => {
      const lockedSale = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "FlashSale" WHERE "id" = ${flashSaleId}::uuid FOR UPDATE`
      if (!lockedSale.length) return null
      await tx.$queryRaw`SELECT "id" FROM "ProductVariant" WHERE "id" = ${input.variantId}::uuid FOR UPDATE`
      const sale = await tx.flashSale.findUnique({ where: { id: flashSaleId }, select: { status: true, startsAt: true, endsAt: true } })
      if (!sale) return null
      if (sale.status === 'SCHEDULED' || sale.status === 'ACTIVE') {
        const overlap = await tx.flashSaleItem.findFirst({
          where: {
            variantId: input.variantId,
            isActive: true,
            OR: [
              { flashSaleId },
              {
                flashSaleId: { not: flashSaleId },
                flashSale: { status: { in: ['SCHEDULED', 'ACTIVE'] }, startsAt: { lt: sale.endsAt }, endsAt: { gt: sale.startsAt } },
              },
            ],
          },
          select: { id: true },
        })
        if (overlap) return null
      }
      return tx.flashSaleItem.create({ data: { flashSaleId, productId: input.productId, variantId: input.variantId, shopId: input.shopId, salePrice: input.salePrice, originalPrice: input.originalPrice, stockLimit: input.stockLimit, perUserLimit: input.perUserLimit ?? null } })
    })
  }

  findFlashSaleItemById(itemId: string): Promise<FlashSaleItemForManagement | null> {
    return this.prisma.flashSaleItem.findUnique({
      where: { id: itemId },
      include: { variant: { select: { price: true } }, flashSale: { select: { id: true, shopId: true, status: true, startsAt: true, endsAt: true } } },
    })
  }

  findOverlappingFlashSaleItem(variantId: string, startsAt: Date, endsAt: Date, excludeFlashSaleId: string): Promise<Pick<FlashSaleItem, 'id'> | null> {
    return this.prisma.flashSaleItem.findFirst({
      where: {
        variantId,
        isActive: true,
        flashSaleId: { not: excludeFlashSaleId },
        flashSale: { status: { in: ['SCHEDULED', 'ACTIVE'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      },
      select: { id: true },
    })
  }

  async sumActiveFlashSaleReservations(itemId: string): Promise<number> {
    const reservations = await this.prisma.flashSaleReservation.aggregate({
      where: { flashSaleItemId: itemId, status: 'ACTIVE' },
      _sum: { quantity: true },
    })
    return Number(reservations._sum.quantity ?? 0)
  }

  updateFlashSaleItem(itemId: string, input: Partial<FlashSaleItemPayload>): Promise<FlashSaleItem> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FlashSaleItem" WHERE "id" = ${itemId}::uuid FOR UPDATE`
      if (input.stockLimit !== undefined) {
        const item = await tx.flashSaleItem.findUniqueOrThrow({ where: { id: itemId }, select: { soldCount: true } })
        const reservations = await tx.flashSaleReservation.aggregate({ where: { flashSaleItemId: itemId, status: 'ACTIVE' }, _sum: { quantity: true } })
        if (input.stockLimit < item.soldCount + (reservations._sum.quantity ?? 0)) {
          throw new PromotionServiceError('Flash sale quota cannot be lower than sold and reserved quantity', 400, 'FLASH_SALE_QUOTA_INVALID')
        }
      }
      return tx.flashSaleItem.update({ where: { id: itemId }, data: { ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}), ...(input.stockLimit !== undefined ? { stockLimit: input.stockLimit } : {}), ...(input.perUserLimit !== undefined ? { perUserLimit: input.perUserLimit } : {}) } })
    })
  }

  deleteFlashSaleItem(itemId: string): Promise<FlashSaleItem> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "FlashSaleItem" WHERE "id" = ${itemId}::uuid FOR UPDATE`
      const item = await tx.flashSaleItem.findUniqueOrThrow({ where: { id: itemId }, select: { soldCount: true } })
      const reservations = await tx.flashSaleReservation.aggregate({ where: { flashSaleItemId: itemId, status: 'ACTIVE' }, _sum: { quantity: true } })
      if (item.soldCount > 0 || (reservations._sum.quantity ?? 0) > 0) {
        throw new PromotionServiceError('Flash sale item has sold or reserved quantity', 409, 'FLASH_SALE_ITEM_LOCKED')
      }
      return tx.flashSaleItem.delete({ where: { id: itemId } })
    })
  }
}
