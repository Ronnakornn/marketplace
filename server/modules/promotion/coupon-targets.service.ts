import { Value } from '@sinclair/typebox/value'
import { toMoneyDto } from '#server/lib/money.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'
import { AdminAccessError } from '#server/modules/admin-access/admin-access.errors.ts'
import { CouponTargetsRepository } from './coupon-targets.repository.ts'
import {
  CouponTargetsWriteSchema,
  type CouponTargetsWrite,
} from './coupon-targets.schemas.ts'

export class CouponTargetsService {
  constructor(
    private readonly repository: CouponTargetsRepository,
    private readonly access: AdminAuthorizer,
  ) {}
  async choices(actor: AdminActor, page = 1, limit = 20) {
    await this.access.require(actor, 'marketing.read')
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 10000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new AdminAccessError(
        'Invalid pagination',
        400,
        'INVALID_PAGINATION',
      )
    return toMoneyDto(await this.repository.choices(page, limit))
  }
  async read(actor: AdminActor, couponId: string) {
    await this.access.require(actor, 'marketing.read')
    return this.repository.read(couponId)
  }
  async save(actor: AdminActor, couponId: string, input: CouponTargetsWrite) {
    await this.access.require(actor, 'marketing.write')
    if (!Value.Check(CouponTargetsWriteSchema, input))
      throw new AdminAccessError(
        'Invalid coupon targets',
        400,
        'INVALID_COUPON_SCOPE',
      )
    const normalized = {
      ...input,
      productIds: input.productIds.map((id) => id.toLowerCase()),
      categoryIds: input.categoryIds.map((id) => id.toLowerCase()),
    }
    if (
      new Set(normalized.productIds).size !== normalized.productIds.length ||
      new Set(normalized.categoryIds).size !== normalized.categoryIds.length
    )
      throw new AdminAccessError(
        'Duplicate coupon targets',
        400,
        'INVALID_COUPON_SCOPE',
      )
    return this.repository.save(actor, couponId, normalized)
  }
}
