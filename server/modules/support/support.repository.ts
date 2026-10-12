import type { Prisma, PrismaClient, ReturnRequest, SupportTicket, TicketMessage, DisputeCase, Upload, Refund } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'

export type SupportScope = { kind: 'buyer'; userId: string } | { kind: 'seller'; userId: string; shopId?: string } | { kind: 'admin'; userId: string }
export type SupportPage = { page: number; limit: number }
export type TicketSummary = SupportTicket & {
  shop: { id: string; name: string } | null
  disputes: Array<Pick<DisputeCase, 'id' | 'returnRequestId' | 'status' | 'reason' | 'decision' | 'resolvedAt' | 'createdAt' | 'refundId' | 'compensation'>>
}
export type SupportMessage = Pick<TicketMessage, 'id' | 'senderId' | 'senderType' | 'body' | 'isInternal' | 'createdAt' | 'attachments'>
export type SupportReturn = Pick<ReturnRequest, 'id' | 'orderId' | 'shopId' | 'userId' | 'status' | 'reason' | 'description'>
export type CreateTicket = Pick<SupportTicket, 'userId' | 'orderId' | 'shopId' | 'subject'> & { body: string }

export interface ISupportRepository {
  transaction<T>(callback: (repo: ISupportRepository) => Promise<T>): Promise<T>
  lockOrder(orderId: string): Promise<void>
  lockTicket(ticketId: string): Promise<void>
  findTicketReference(ticketId: string): Promise<Pick<SupportTicket, 'orderId'> | null>
  findOwnedOrder(orderId: string, userId: string): Promise<{ id: string; shopIds: string[] } | null>
  findReturn(returnId: string): Promise<SupportReturn | null>
  findAppeal(returnId: string): Promise<Pick<DisputeCase, 'ticketId' | 'openedById'> | null>
  listAppealableReturns(orderId: string, userId: string, page: SupportPage): Promise<{ items: Array<SupportReturn & { ticketId: string | null; shopName: string }>; total: number }>
  listTickets(scope: SupportScope, page: SupportPage, status?: SupportTicket['status']): Promise<{ items: TicketSummary[]; total: number }>
  findTicket(ticketId: string, scope: SupportScope): Promise<TicketSummary | null>
  listMessages(ticketId: string, includeInternal: boolean, page: SupportPage): Promise<{ items: SupportMessage[]; total: number }>
  createTicket(input: CreateTicket): Promise<TicketSummary>
  createDispute(input: Pick<DisputeCase, 'ticketId' | 'orderId' | 'openedById' | 'returnRequestId' | 'reason'>): Promise<void>
  createMessage(input: Pick<TicketMessage, 'ticketId' | 'senderId' | 'senderType' | 'body' | 'isInternal'> & { attachmentIds?: string[] }): Promise<SupportMessage>
  findAttachments(uploadIds: string[], userId: string): Promise<Array<Pick<Upload, 'id' | 'userId' | 'usage' | 'status'>>>
  listCompensationRefunds(orderId: string): Promise<Array<Pick<Refund, 'id' | 'amount' | 'status'> & { currency: string }>>
  findCompensationRefund(refundId: string, returnRequestId: string): Promise<(Pick<Refund, 'id' | 'orderId' | 'amount' | 'status'> & { matchesReturn: boolean }) | null>
  linkCompensation(disputeId: string, refundId: string, amount: bigint, succeeded: boolean, actorId: string): Promise<void>
  updateTicket(ticketId: string, input: Pick<SupportTicket, 'status' | 'closedAt'>): Promise<void>
  updateDispute(disputeId: string, input: Pick<DisputeCase, 'status' | 'decision' | 'resolvedAt'>): Promise<void>
}

const ticketSelect = {
  id: true, userId: true, orderId: true, shopId: true, subject: true, status: true, priority: true, category: true,
  createdAt: true, updatedAt: true, closedAt: true,
  shop: { select: { id: true, name: true } },
  disputes: { select: { id: true, returnRequestId: true, status: true, reason: true, decision: true, resolvedAt: true, createdAt: true, refundId: true, compensation: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SupportTicketSelect
const messageSelect = { id: true, senderId: true, senderType: true, body: true, isInternal: true, createdAt: true, attachments: true } satisfies Prisma.TicketMessageSelect
const returnSelect = { id: true, orderId: true, shopId: true, userId: true, status: true, reason: true, description: true } satisfies Prisma.ReturnRequestSelect

export class PrismaSupportRepository implements ISupportRepository {
  constructor(private readonly context: AppContext, private readonly db: PrismaClient | Prisma.TransactionClient) {}

  transaction<T>(callback: (repo: ISupportRepository) => Promise<T>): Promise<T> {
    if (!('$transaction' in this.db)) return callback(this)
    return this.db.$transaction((tx) => callback(new PrismaSupportRepository(this.context, tx)))
  }

  async lockOrder(orderId: string) {
    await this.db.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`
  }

  async lockTicket(ticketId: string) {
    await this.db.$queryRaw`SELECT "id" FROM "SupportTicket" WHERE "id" = ${ticketId}::uuid FOR UPDATE`
  }

  findTicketReference(ticketId: string) {
    return this.db.supportTicket.findUnique({ where: { id: ticketId }, select: { orderId: true } })
  }

  async findOwnedOrder(orderId: string, userId: string) {
    const order = await this.db.order.findFirst({ where: { id: orderId, userId }, select: { id: true, items: { select: { shopId: true } } } })
    return order ? { id: order.id, shopIds: [...new Set(order.items.map((item) => item.shopId))] } : null
  }

  findReturn(returnId: string) {
    return this.db.returnRequest.findUnique({ where: { id: returnId }, select: returnSelect })
  }

  findAppeal(returnId: string) {
    return this.db.disputeCase.findUnique({ where: { returnRequestId: returnId }, select: { ticketId: true, openedById: true } })
  }

  async listAppealableReturns(orderId: string, userId: string, page: SupportPage) {
    const where = { orderId, userId, status: 'REJECTED' as const, order: { userId } }
    const [rows, total] = await Promise.all([this.db.returnRequest.findMany({ where, select: {
      ...returnSelect, shop: { select: { name: true } }, dispute: { select: { ticketId: true } },
    }, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), this.db.returnRequest.count({ where })])
    return { items: rows.map(({ shop, dispute, ...row }) => ({ ...row, shopName: shop.name, ticketId: dispute?.ticketId ?? null })), total }
  }

  private scopeWhere(scope: SupportScope): Prisma.SupportTicketWhereInput {
    switch (scope.kind) {
      case 'buyer': return { userId: scope.userId }
      case 'seller': return { ...(scope.shopId ? { shopId: scope.shopId } : {}), shop: { ownerId: scope.userId, status: 'ACTIVE', deletedAt: null } }
      case 'admin': return {}
    }
  }

  async listTickets(scope: SupportScope, page: SupportPage, status?: SupportTicket['status']) {
    const where = { ...this.scopeWhere(scope), ...(status ? { status } : {}) }
    const [items, total] = await Promise.all([
      this.db.supportTicket.findMany({ where, select: ticketSelect, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
      this.db.supportTicket.count({ where }),
    ])
    return { items, total }
  }

  findTicket(ticketId: string, scope: SupportScope) {
    return this.db.supportTicket.findFirst({ where: { id: ticketId, ...this.scopeWhere(scope) }, select: ticketSelect })
  }

  async listMessages(ticketId: string, includeInternal: boolean, page: SupportPage) {
    const where = { ticketId, ...(includeInternal ? {} : { isInternal: false }) }
    const [items, total] = await Promise.all([
      this.db.ticketMessage.findMany({ where, select: messageSelect, skip: (page.page - 1) * page.limit, take: page.limit, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.db.ticketMessage.count({ where }),
    ])
    return { items, total }
  }

  createTicket({ body, ...input }: CreateTicket) {
    this.context.logger.info('Creating support ticket', { userId: input.userId, orderId: input.orderId })
    return this.db.supportTicket.create({ data: { ...input, messages: { create: { senderId: input.userId, senderType: 'BUYER', body } } }, select: ticketSelect })
  }

  async createDispute(input: Pick<DisputeCase, 'ticketId' | 'orderId' | 'openedById' | 'returnRequestId' | 'reason'>) {
    await this.db.disputeCase.create({ data: input })
  }

  createMessage({ attachmentIds, ...input }: Pick<TicketMessage, 'ticketId' | 'senderId' | 'senderType' | 'body' | 'isInternal'> & { attachmentIds?: string[] }) {
    return this.db.ticketMessage.create({ data: { ...input, ...(attachmentIds?.length ? { attachments: attachmentIds } : {}) }, select: messageSelect })
  }

  findAttachments(uploadIds: string[], userId: string) {
    return this.db.upload.findMany({ where: { id: { in: uploadIds }, userId }, select: { id: true, userId: true, usage: true, status: true } })
  }

  async listCompensationRefunds(orderId: string) {
    const rows = await this.db.refund.findMany({ where: { orderId, status: { in: ['PROCESSING', 'SUCCESS'] } }, select: { id: true, amount: true, status: true, payment: { select: { currency: true } } }, take: 50, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
    return rows.map(({ payment, ...refund }) => ({ ...refund, currency: payment.currency }))
  }

  async findCompensationRefund(refundId: string, returnRequestId: string) {
    const [refund, request] = await Promise.all([
      this.db.refund.findUnique({ where: { id: refundId }, select: { id: true, orderId: true, amount: true, status: true, itemAllocations: { select: { quantity: true, itemSale: { select: { orderItemId: true } } } } } }),
      this.db.returnRequest.findUnique({ where: { id: returnRequestId }, select: { orderId: true, items: { select: { orderItemId: true, quantity: true } } } }),
    ])
    if (!refund || !request) return null
    return { id: refund.id, orderId: refund.orderId, amount: refund.amount, status: refund.status, matchesReturn: refund.orderId === request.orderId && refund.itemAllocations.length === request.items.length && request.items.every((item) => refund.itemAllocations.some((allocation) => allocation.itemSale.orderItemId === item.orderItemId && allocation.quantity === item.quantity)) }
  }

  async linkCompensation(disputeId: string, refundId: string, amount: bigint, succeeded: boolean, actorId: string) {
    const before = await this.db.disputeCase.findUniqueOrThrow({ where: { id: disputeId }, select: { refundId: true, compensation: true, status: true } })
    await this.db.disputeCase.update({ where: { id: disputeId }, data: { refundId, compensation: amount, ...(succeeded ? { status: 'COMPENSATED', resolvedAt: new Date() } : {}) } })
    await this.db.auditLog.create({ data: { actorUserId: actorId, actorRole: 'ADMIN', action: 'ADMIN_CONFIG_CHANGED', entityType: 'DisputeCase', entityId: disputeId, before: { refundId: before.refundId, amount: before.compensation?.toString() ?? null, status: before.status }, after: { refundId, amount: amount.toString(), status: succeeded ? 'COMPENSATED' : 'RESOLVED_BUYER' } } })
  }

  async updateTicket(ticketId: string, input: Pick<SupportTicket, 'status' | 'closedAt'>) {
    await this.db.supportTicket.update({ where: { id: ticketId }, data: input })
  }

  async updateDispute(disputeId: string, input: Pick<DisputeCase, 'status' | 'decision' | 'resolvedAt'>) {
    await this.db.disputeCase.update({ where: { id: disputeId }, data: input })
  }
}
