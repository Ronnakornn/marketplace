import { t, type Static } from 'elysia'
import { z } from 'zod'
import type { Product } from '#generated/client/client.ts'

const ids = t.Array(t.String({ format: 'uuid' }), {
  maxItems: 100,
  uniqueItems: true,
})
export const CouponTargetsSchema = t.Object(
  { productIds: ids, categoryIds: ids },
  { additionalProperties: false },
)
export const CouponTargetsWriteSchema = t.Object(
  {
    ...CouponTargetsSchema.properties,
    expectedVersion: t.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)
export type CouponTargets = Static<typeof CouponTargetsSchema>
export type CouponTargetsWrite = Static<typeof CouponTargetsWriteSchema>
export const storedCouponTargetsSchema = z
  .object({
    productIds: z.array(z.uuid()).max(100),
    categoryIds: z.array(z.uuid()).max(100),
    version: z.number().int().nonnegative().default(0),
  })
  .strict()
export function couponTargetEligible(
  targets: CouponTargets,
  product: Pick<Product, 'id' | 'categoryId'>,
) {
  return (
    (!targets.productIds.length && !targets.categoryIds.length) ||
    targets.productIds.includes(product.id) ||
    (product.categoryId !== null &&
      targets.categoryIds.includes(product.categoryId))
  )
}
