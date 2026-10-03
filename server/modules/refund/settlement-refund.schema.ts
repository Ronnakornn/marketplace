import { t } from 'elysia'
import { RefundShippingCause } from '#generated/prismabox/RefundShippingCause.ts'

export const SettlementRefundPlanSchema = t.Object({
  items: t.Array(t.Object({
    orderItemId: t.String({ format: 'uuid' }),
    quantity: t.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  }), { maxItems: 500 }),
  shipping: t.Array(t.Object({
    shopOrderId: t.String({ format: 'uuid' }),
    cause: RefundShippingCause,
  }), { maxItems: 500 }),
})
