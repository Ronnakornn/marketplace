import { Elysia, status as httpStatus } from 'elysia'
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
    .get('/api/support/tickets', (context) => service.list({ kind: 'buyer', userId: userId(context) }, context.query), { withAuth: true, query: SupportListSchema })
    .post('/api/support/tickets', (context) => service.create(userId(context), context.body), { withAuth: true, body: CreateTicketSchema })
    .get('/api/support/tickets/:ticketId', (context) => service.detail({ kind: 'buyer', userId: userId(context) }, context.params.ticketId, context.query), { withAuth: true, params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/support/tickets/:ticketId/messages', (context) => service.reply({ kind: 'buyer', userId: userId(context) }, context.params.ticketId, context.body), { withAuth: true, params: TicketParamsSchema, body: ReplySchema })
    .post('/api/support/appeals', (context) => service.appeal(userId(context), context.body), { withAuth: true, body: AppealSchema })
    .get('/api/support/orders/:orderId/returns', (context) => service.appealableReturns(userId(context), context.params.orderId, context.query), { withAuth: true, params: OrderParamsSchema, query: SupportPageSchema })
    .get('/api/seller/support/tickets', (context) => service.list({ kind: 'seller', userId: userId(context), shopId: context.query.shopId }, context.query), { withAuth: true, withSellerOperational: true, query: SupportListSchema })
    .get('/api/seller/support/tickets/:ticketId', (context) => service.detail({ kind: 'seller', userId: userId(context) }, context.params.ticketId, context.query), { withAuth: true, withSellerOperational: true, params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/seller/support/tickets/:ticketId/messages', (context) => service.reply({ kind: 'seller', userId: userId(context) }, context.params.ticketId, context.body), { withAuth: true, withSellerOperational: true, params: TicketParamsSchema, body: ReplySchema })
    .get('/api/admin/support/tickets', (context) => service.list({ kind: 'admin', userId: userId(context) }, context.query), { withRole: 'ADMIN', query: SupportListSchema })
    .get('/api/admin/support/tickets/:ticketId', (context) => service.detail({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.query), { withRole: 'ADMIN', params: TicketParamsSchema, query: SupportPageSchema })
    .post('/api/admin/support/tickets/:ticketId/messages', (context) => service.reply({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.body), { withRole: 'ADMIN', params: TicketParamsSchema, body: ReplySchema })
    .post('/api/admin/support/tickets/:ticketId/notes', (context) => service.reply({ kind: 'admin', userId: userId(context) }, context.params.ticketId, context.body, true), { withRole: 'ADMIN', params: TicketParamsSchema, body: ReplySchema })
    .patch('/api/admin/support/tickets/:ticketId/status', (context) => service.setStatus(userId(context), context.params.ticketId, context.body.status), { withRole: 'ADMIN', params: TicketParamsSchema, body: TicketStatusSchema })
    .patch('/api/admin/support/tickets/:ticketId/dispute', (context) => service.decide(userId(context), context.params.ticketId, context.body), { withRole: 'ADMIN', params: TicketParamsSchema, body: DisputeStatusSchema })
}
