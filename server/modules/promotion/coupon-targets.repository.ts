import type { PrismaClient } from '#generated/client/client.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import { auditAccess } from '#server/modules/admin-access/admin-access.repository.ts'
import {
  storedCouponTargetsSchema,
  type CouponTargets,
  type CouponTargetsWrite,
} from './coupon-targets.schemas.ts'

function parseStored(value: unknown) {
  if (value === undefined)
    return { productIds: [], categoryIds: [], version: 0 }
  const parsed = storedCouponTargetsSchema.safeParse(value)
  if (!parsed.success)
    throw new AdminAccessError(
      'Coupon target configuration is invalid',
      409,
      'INVALID_COUPON_TARGETS',
    )
  return parsed.data
}

export class CouponTargetsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly access?: AdminAuthorizer,
  ) {}
  async choices(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({
        include: {
          _count: {
            select: {
              redemptions: {
                where: { status: { in: ['RESERVED', 'REDEEMED'] } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coupon.count(),
    ])
    return { items, total, page, limit }
  }
  async read(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, code: true, shopId: true },
    })
    if (!coupon)
      throw new AdminAccessError('Coupon not found', 404, 'COUPON_NOT_FOUND')
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: `coupon.targets.${couponId}` },
      select: { value: true },
    })
    return { coupon, ...parseStored(setting?.value) }
  }
  async readCouponTargets(couponId: string): Promise<CouponTargets> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: `coupon.targets.${couponId}` },
      select: { value: true },
    })
    const { productIds, categoryIds } = parseStored(setting?.value)
    return { productIds, categoryIds }
  }
  save(actor: AdminActor, couponId: string, input: CouponTargetsWrite) {
    return this.prisma.$transaction(async (tx) => {
      if (this.access) {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
        await this.access.require(actor, 'marketing.write')
      }
      await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${couponId}::uuid FOR UPDATE`
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
        select: { id: true, shopId: true },
      })
      if (!coupon)
        throw new AdminAccessError('Coupon not found', 404, 'COUPON_NOT_FOUND')
      const key = `coupon.targets.${couponId}`
      const setting = await tx.systemSetting.findUnique({ where: { key } })
      const before = parseStored(setting?.value)
      if (before.version !== input.expectedVersion)
        throw new AdminAccessError(
          'Coupon targets changed. Reload before saving',
          409,
          'STALE_VERSION',
        )
      const [products, categories] = await Promise.all([
        tx.product.findMany({
          where: {
            id: { in: input.productIds },
            deletedAt: null,
            ...(coupon.shopId ? { shopId: coupon.shopId } : {}),
          },
          select: { id: true },
        }),
        tx.category.findMany({
          where: {
            id: { in: input.categoryIds },
            ...(coupon.shopId
              ? {
                  products: {
                    some: { shopId: coupon.shopId, deletedAt: null },
                  },
                }
              : {}),
          },
          select: { id: true },
        }),
      ])
      if (
        products.length !== input.productIds.length ||
        categories.length !== input.categoryIds.length
      )
        throw new AdminAccessError(
          'Target IDs must exist and belong to the coupon shop',
          400,
          'INVALID_COUPON_SCOPE',
        )
      const after = {
        productIds: [...input.productIds].sort(),
        categoryIds: [...input.categoryIds].sort(),
        version: before.version + 1,
      }
      await tx.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: after,
          valueType: 'JSON',
          isPublic: false,
          updatedById: actor.id,
        },
        update: { value: after, isPublic: false, updatedById: actor.id },
      })
      await auditAccess(tx, actor, 'CouponTargets', couponId, before, after)
      return after
    })
  }
}
