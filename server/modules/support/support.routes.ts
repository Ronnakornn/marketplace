import { Elysia, status as httpStatus, t } from 'elysia'
import { moneyResponse } from '#server/lib/money.ts'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import type { AuthContext } from '#server/modules/auth/auth.context.ts'
import { SupportServiceError } from './support.errors.ts'
import { AppealSchema, CreateTicketSchema, DisputeStatusSchema, OrderParamsSchema, ReplySchema, SupportListSchema, SupportPageSchema, TicketParamsSchema, TicketStatusSchema } from './support.schemas.ts'

function userId(context: { request: Request; authContext?: AuthContext }) {
  if (!context.authContext) throw new Error('Support route requires the authentication macro')
  return context.authContext.user.id
}

export function createSupportRoutes(container: Pick<ServiceContainer, 'supportService'>) {
  const service = container.supportService
  return new Elysia({ name: 'support' })
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof SupportServiceError) return httpStatus(error.status, { error: { code: error.code, message: error.message } })
    })
    .get('/api/support/tickets', (context) => moneyResponse(service.list({ kind: 'buyer', userId: userId(context) }, context.query)), { withAuth: true, query: SupportListSchema })
    .post('/api/support/tickets', (context) => moneyResponse(service.create(userId(context), context.body)), { withAuth: true, body: CreateTicketSchema })
    .get('/api/support/tickets/:ticketId', (context) => moneyResponse(service.detail({ kind: 'buyer', userId: userId(context) }, context.params.ticketId, context.query)), { withAuth: true, params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/support/tickets/:ticketId/messages', (context) => moneyResponse(service.reply({ kind: 'buyer', userId: userId(context) }, context.params.ticketId, context.body)), { withAuth: true, params: TicketParamsSchema, body: ReplySchema })
    .post('/api/support/appeals', (context) => moneyResponse(service.appeal(userId(context), context.body)), { withAuth: true, body: AppealSchema })
    .get('/api/support/orders/:orderId/returns', (context) => moneyResponse(service.appealableReturns(userId(context), context.params.orderId, context.query)), { withAuth: true, params: OrderParamsSchema, query: SupportPageSchema })
    .get('/api/seller/support/tickets', (context) => moneyResponse(service.list({ kind: 'seller', userId: userId(context), shopId: context.query.shopId }, context.query)), { withAuth: true, withSellerOperational: true, query: SupportListSchema })
    .get('/api/seller/support/tickets/:ticketId', (context) => moneyResponse(service.detail({ kind: 'seller', userId: userId(context) }, context.params.ticketId, context.query)), { withAuth: true, withSellerOperational: true, params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/seller/support/tickets/:ticketId/messages', (context) => moneyResponse(service.reply({ kind: 'seller', userId: userId(context) }, context.params.ticketId, context.body)), { withAuth: true, withSellerOperational: true, params: TicketParamsSchema, body: ReplySchema })
    .get('/api/admin/support/tickets', (context) => moneyResponse(service.list({ kind: 'admin', userId: userId(context) }, context.query)), { withRole: 'ADMIN', query: SupportListSchema })
    .get('/api/admin/support/tickets/:ticketId', (context) => moneyResponse(service.detail({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.query)), { withRole: 'ADMIN', params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/admin/support/tickets/:ticketId/messages', (context) => moneyResponse(service.reply({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.body)), { withRole: 'ADMIN', params: TicketParamsSchema, body: ReplySchema })
    .post('/api/admin/support/tickets/:ticketId/notes', (context) => moneyResponse(service.reply({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.body, true)), { withRole: 'ADMIN', params: TicketParamsSchema, body: ReplySchema })
    .patch('/api/admin/support/tickets/:ticketId/status', (context) => moneyResponse(service.setStatus(userId(context), context.params.ticketId, context.body.status)), { withRole: 'ADMIN', params: TicketParamsSchema, body: TicketStatusSchema })
    .patch('/api/admin/support/tickets/:ticketId/dispute', (context) => moneyResponse(service.decide(userId(context), context.params.ticketId, context.body)), { withRole: 'ADMIN', params: TicketParamsSchema, body: DisputeStatusSchema })
    .get('/api/admin/support/tickets/:ticketId/compensation-refunds', (context) => moneyResponse(service.compensationRefunds(userId(context), context.params.ticketId)), { withRole: 'ADMIN', params: TicketParamsSchema })
    .post('/api/admin/support/tickets/:ticketId/compensation', (context) => moneyResponse(service.linkCompensation(userId(context), context.params.ticketId, context.body.refundId)), { withRole: 'ADMIN', params: TicketParamsSchema, body: t.Object({ refundId: t.String({ format: 'uuid' }) }) })
}
