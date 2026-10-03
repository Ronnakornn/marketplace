import { t } from 'elysia'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { ShopOrderPlain } from '#generated/prismabox/ShopOrder.ts'

const originalAmount = t.String({ pattern: '^(0|[1-9][0-9]*)$', maxLength: 19 })
export const HistoricalShopOrderFactSchema = t.Composite([
  t.Pick(ShopOrderPlain, ['shopId', 'currency', 'status', 'fulfillmentStatus']),
  t.Object({
    subtotal: originalAmount,
    discountTotal: originalAmount,
    shippingTotal: originalAmount,
    taxTotal: originalAmount,
    grandTotal: originalAmount,
  }),
])
export const HistoricalReconciliationSchema = t.Object({
  orderId: t.String({ format: 'uuid' }),
  sourceReference: t.String({ minLength: 1, maxLength: 500 }),
  shops: t.Array(HistoricalShopOrderFactSchema, { minItems: 1, maxItems: 500 }),
}, { additionalProperties: false })
export const historicalReconciliationValidator = TypeCompiler.Compile(HistoricalReconciliationSchema)
export type HistoricalReconciliationInput = typeof HistoricalReconciliationSchema.static
