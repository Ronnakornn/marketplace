import { t } from 'elysia'
import { SupportTicketPlain } from '#generated/prismabox/SupportTicket.ts'
import { TicketMessagePlain } from '#generated/prismabox/TicketMessage.ts'
import { DisputeCasePlain } from '#generated/prismabox/DisputeCase.ts'

export const SupportPageSchema = t.Object({
  page: t.Optional(t.Integer({ minimum: 1, maximum: 100000 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
})
export const SupportListSchema = t.Composite([
  SupportPageSchema,
  t.Partial(t.Pick(SupportTicketPlain, ['status'])),
  t.Object({ shopId: t.Optional(t.String({ format: 'uuid' })) }),
])
export const TicketParamsSchema = t.Object({ ticketId: t.String({ format: 'uuid' }) })
export const OrderParamsSchema = t.Object({ orderId: t.String({ format: 'uuid' }) })
export const CreateTicketSchema = t.Composite([
  t.Pick(SupportTicketPlain, ['subject']),
  t.Object({
    orderId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
    shopId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  }),
  t.Pick(TicketMessagePlain, ['body']),
], { additionalProperties: false })
export const AppealSchema = t.Composite([
  t.Object({ returnRequestId: t.String({ format: 'uuid' }) }),
  t.Pick(SupportTicketPlain, ['subject']),
  t.Pick(TicketMessagePlain, ['body']),
], { additionalProperties: false })
export const ReplySchema = t.Pick(TicketMessagePlain, ['body'], { additionalProperties: false })
export const TicketStatusSchema = t.Pick(SupportTicketPlain, ['status'], { additionalProperties: false })
export const DisputeStatusSchema = t.Composite([
  t.Object({ status: t.Exclude(DisputeCasePlain.properties.status, t.Literal('COMPENSATED')) }),
  t.Pick(DisputeCasePlain, ['decision']),
], { additionalProperties: false })
