import type { SupportTicketStatus, DisputeCaseStatus } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'
import type { ISupportRepository, SupportPage, SupportScope, TicketSummary } from './support.repository.ts'
import type { AppealSchema, CreateTicketSchema, DisputeStatusSchema } from './support.schemas.ts'
import { SupportServiceError } from './support.errors.ts'

const activeTickets: SupportTicketStatus[] = ['OPEN', 'PENDING_CUSTOMER', 'PENDING_SELLER', 'PENDING_ADMIN']
const ticketTransitions: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  OPEN: [...activeTickets, 'RESOLVED', 'CLOSED'],
  PENDING_CUSTOMER: [...activeTickets, 'RESOLVED', 'CLOSED'],
  PENDING_SELLER: [...activeTickets, 'RESOLVED', 'CLOSED'],
  PENDING_ADMIN: [...activeTickets, 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
}
const disputeTransitions: Record<DisputeCaseStatus, readonly DisputeCaseStatus[]> = {
  OPEN: ['UNDER_REVIEW', 'WAITING_EVIDENCE', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'],
  UNDER_REVIEW: ['WAITING_EVIDENCE', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'],
  WAITING_EVIDENCE: ['UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'],
  RESOLVED_BUYER: [], RESOLVED_SELLER: [], COMPENSATED: [], CLOSED: [],
}
const activeDisputes: DisputeCaseStatus[] = ['OPEN', 'UNDER_REVIEW', 'WAITING_EVIDENCE']

function text(value: string | null | undefined, maximum: number) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed.length > maximum) throw new SupportServiceError('Text is empty or too long', 400, 'INVALID_SUPPORT_TEXT')
  return trimmed
}

export class SupportService {
  constructor(private readonly context: AppContext, private readonly repo: ISupportRepository) {}

  private page(input: Partial<SupportPage>): SupportPage {
    return { page: input.page ?? 1, limit: input.limit ?? 20 }
  }

  async list(scope: SupportScope, input: Partial<SupportPage> & { status?: SupportTicketStatus } = {}) {
    const pagination = this.page(input)
    return { ...await this.repo.listTickets(scope, pagination, input.status), ...pagination }
  }

  async detail(scope: SupportScope, ticketId: string, input: Partial<SupportPage> = {}) {
    const ticket = await this.requireTicket(this.repo, scope, ticketId)
    const pagination = this.page(input)
    return { ticket, messages: { ...await this.repo.listMessages(ticketId, scope.kind === 'admin', pagination), ...pagination } }
  }

  private async requireTicket(repo: ISupportRepository, scope: SupportScope, ticketId: string): Promise<TicketSummary> {
    const ticket = await repo.findTicket(ticketId, scope)
    if (!ticket) throw new SupportServiceError('Support ticket not found', 404, 'SUPPORT_TICKET_NOT_FOUND')
    return ticket
  }

  private async lockTicket(repo: ISupportRepository, ticketId: string) {
    const reference = await repo.findTicketReference(ticketId)
    if (!reference) throw new SupportServiceError('Support ticket not found', 404, 'SUPPORT_TICKET_NOT_FOUND')
    if (reference.orderId) await repo.lockOrder(reference.orderId)
    await repo.lockTicket(ticketId)
  }

  async create(userId: string, input: typeof CreateTicketSchema.static) {
    const subject = text(input.subject, 200)
    const body = text(input.body, 5000)
    return this.repo.transaction(async (repo) => {
      const orderId = input.orderId ?? null
      const shopId = input.shopId ?? null
      if (orderId) {
        await repo.lockOrder(orderId)
        const order = await repo.findOwnedOrder(orderId, userId)
        if (!order) throw new SupportServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
        if (shopId && !order.shopIds.includes(shopId)) throw new SupportServiceError('Shop does not belong to order', 400, 'INVALID_SUPPORT_CONTEXT')
      } else if (shopId) {
        throw new SupportServiceError('Shop context requires an owned order', 400, 'INVALID_SUPPORT_CONTEXT')
      }
      return repo.createTicket({ userId, orderId, shopId, subject, body })
    })
  }

  async appeal(userId: string, input: typeof AppealSchema.static) {
    const subject = text(input.subject, 200)
    const body = text(input.body, 5000)
    return this.repo.transaction(async (repo) => {
      const reference = await repo.findReturn(input.returnRequestId)
      if (!reference || reference.userId !== userId) throw new SupportServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
      await repo.lockOrder(reference.orderId)
      const request = await repo.findReturn(input.returnRequestId)
      if (!request || request.userId !== userId || !await repo.findOwnedOrder(request.orderId, userId)) {
        throw new SupportServiceError('Return not found', 404, 'RETURN_NOT_FOUND')
      }
      const existing = await repo.findAppeal(request.id)
      if (existing?.ticketId && existing.openedById === userId) return this.requireTicket(repo, { kind: 'buyer', userId }, existing.ticketId)
      if (existing) throw new SupportServiceError('Return already has an appeal', 409, 'RETURN_ALREADY_APPEALED')
      if (request.status !== 'REJECTED') throw new SupportServiceError('Only rejected returns can be appealed', 409, 'RETURN_NOT_REJECTED')
      const ticket = await repo.createTicket({ userId, orderId: request.orderId, shopId: request.shopId, subject, body })
      await repo.createDispute({ ticketId: ticket.id, orderId: request.orderId, openedById: userId, returnRequestId: request.id, reason: body })
      this.context.logger.info('Return appealed', { returnRequestId: request.id, ticketId: ticket.id, userId })
      return this.requireTicket(repo, { kind: 'buyer', userId }, ticket.id)
    })
  }

  async appealableReturns(userId: string, orderId: string, input: Partial<SupportPage> = {}) {
    if (!await this.repo.findOwnedOrder(orderId, userId)) throw new SupportServiceError('Order not found', 404, 'ORDER_NOT_FOUND')
    const pagination = this.page(input)
    return { ...await this.repo.listAppealableReturns(orderId, userId, pagination), ...pagination }
  }

  async reply(scope: SupportScope, ticketId: string, input: { body: string; attachmentIds?: string[] }, internal = false) {
    const body = text(input.body, 5000)
    if (internal && scope.kind !== 'admin') throw new SupportServiceError('Administrator required', 403, 'FORBIDDEN')
    return this.repo.transaction(async (repo) => {
      await this.lockTicket(repo, ticketId)
      const ticket = await this.requireTicket(repo, scope, ticketId)
      if (!internal && !activeTickets.includes(ticket.status)) throw new SupportServiceError('Ticket is closed for replies', 409, 'SUPPORT_TICKET_TERMINAL')
      const senderType = scope.kind === 'admin' ? 'ADMIN' : scope.kind === 'seller' ? 'SELLER' : 'BUYER'
      const attachmentIds = [...new Set(input.attachmentIds ?? [])]
      if (attachmentIds.length > 5) throw new SupportServiceError('Too many attachments', 400, 'INVALID_SUPPORT_ATTACHMENT')
      if (attachmentIds.length) {
        const uploads = await repo.findAttachments(attachmentIds, scope.userId)
        if (uploads.length !== attachmentIds.length || uploads.some((upload) => upload.usage !== 'SUPPORT_ATTACHMENT' || upload.status !== 'COMPLETED')) {
          throw new SupportServiceError('Attachments must be your completed support uploads', 400, 'INVALID_SUPPORT_ATTACHMENT')
        }
      }
      const message = await repo.createMessage({ ticketId, senderId: scope.userId, senderType, body, isInternal: internal, ...(attachmentIds.length ? { attachmentIds } : {}) })
      if (!internal) {
        const hasDispute = ticket.disputes.some((dispute) => activeDisputes.includes(dispute.status))
        const status = scope.kind === 'buyer' ? (hasDispute || !ticket.shopId ? 'PENDING_ADMIN' : 'PENDING_SELLER')
          : scope.kind === 'seller' ? (hasDispute ? 'PENDING_ADMIN' : 'PENDING_CUSTOMER') : 'PENDING_CUSTOMER'
        await repo.updateTicket(ticketId, { status, closedAt: null })
      }
      return message
    })
  }

  async setStatus(userId: string, ticketId: string, status: SupportTicketStatus) {
    return this.repo.transaction(async (repo) => {
      await this.lockTicket(repo, ticketId)
      const ticket = await this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
      if (!ticketTransitions[ticket.status].includes(status) || ticket.status === status) throw new SupportServiceError('Invalid ticket transition', 409, 'INVALID_SUPPORT_TRANSITION')
      if (['RESOLVED', 'CLOSED'].includes(status) && ticket.disputes.some((dispute) => activeDisputes.includes(dispute.status))) {
        throw new SupportServiceError('Decide the dispute before closing the ticket', 409, 'DISPUTE_DECISION_REQUIRED')
      }
      await repo.updateTicket(ticketId, { status, closedAt: status === 'CLOSED' ? new Date() : null })
      await repo.createMessage({ ticketId, senderId: userId, senderType: 'SYSTEM', body: `[${status}]`, isInternal: false })
      return this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
    })
  }

  async decide(userId: string, ticketId: string, input: typeof DisputeStatusSchema.static) {
    const decision = text(input.decision, 5000)
    return this.repo.transaction(async (repo) => {
      await this.lockTicket(repo, ticketId)
      const ticket = await this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
      const dispute = ticket.disputes[0]
      if (!dispute) throw new SupportServiceError('Dispute not found', 404, 'DISPUTE_NOT_FOUND')
      if (!activeTickets.includes(ticket.status) || !disputeTransitions[dispute.status].includes(input.status)) {
        throw new SupportServiceError('Invalid dispute transition', 409, 'INVALID_DISPUTE_TRANSITION')
      }
      const now = new Date()
      const terminal = !activeDisputes.includes(input.status)
      await repo.updateDispute(dispute.id, { status: input.status, decision: terminal ? decision : null, resolvedAt: terminal ? now : null })
      await repo.updateTicket(ticketId, { status: terminal ? 'RESOLVED' : 'PENDING_ADMIN', closedAt: null })
      await repo.createMessage({ ticketId, senderId: userId, senderType: 'SYSTEM', body: `[${input.status}] ${decision}`, isInternal: false })
      this.context.logger.info('Support dispute updated', { ticketId, disputeId: dispute.id, status: input.status, actorId: userId, at: now.toISOString() })
      return this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
    })
  }

  async compensationRefunds(userId: string, ticketId: string) {
    const ticket = await this.requireTicket(this.repo, { kind: 'admin', userId }, ticketId)
    if (!ticket.orderId) return []
    return this.repo.listCompensationRefunds(ticket.orderId)
  }

  async linkCompensation(userId: string, ticketId: string, refundId: string) {
    return this.repo.transaction(async (repo) => {
      await this.lockTicket(repo, ticketId)
      const ticket = await this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
      const dispute = ticket.disputes.find((row) => row.status === 'RESOLVED_BUYER' || row.status === 'COMPENSATED')
      if (!dispute?.returnRequestId || !ticket.orderId) throw new SupportServiceError('Resolve the appeal for the buyer first', 409, 'COMPENSATION_DECISION_REQUIRED')
      if (dispute.refundId) {
        if (dispute.refundId === refundId) return ticket
        const previous = await repo.findCompensationRefund(dispute.refundId, dispute.returnRequestId)
        if (dispute.status !== 'RESOLVED_BUYER' || previous?.status !== 'FAILED') throw new SupportServiceError('A refund is already linked', 409, 'COMPENSATION_ALREADY_LINKED')
      }
      const refund = await repo.findCompensationRefund(refundId, dispute.returnRequestId)
      if (!refund || refund.orderId !== ticket.orderId || !refund.matchesReturn || !['PROCESSING', 'SUCCESS'].includes(refund.status)) {
        throw new SupportServiceError('Refund must have a frozen plan matching the appealed items', 409, 'INVALID_COMPENSATION_REFUND')
      }
      await repo.linkCompensation(dispute.id, refund.id, refund.amount, refund.status === 'SUCCESS', userId)
      await repo.createMessage({ ticketId, senderId: userId, senderType: 'SYSTEM', body: `[${refund.status === 'SUCCESS' ? 'COMPENSATED' : 'RESOLVED_BUYER'}] ${refund.id}`, isInternal: false })
      return this.requireTicket(repo, { kind: 'admin', userId }, ticketId)
    })
  }
}
