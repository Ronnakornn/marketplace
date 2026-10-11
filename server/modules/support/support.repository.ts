import type { Prisma, PrismaClient, ReturnRequest, SupportTicket, TicketMessage, DisputeCase } from '#generated/client/client.ts'
import type { AppContext } from '#server/context/app-context.ts'

export type SupportScope = { kind: 'buyer'; userId: string } | { kind: 'seller'; userId: string; shopId?: string } | { kind: 'admin'; userId: string }
export type SupportPage = { page: number; limit: number }
export type TicketSummary = SupportTicket & {
  shop: { id: string; name: string } | null
  disputes: Array<Pick<DisputeCase, 'id' | 'returnRequestId' | 'status' | 'reason' | 'decision' | 'resolvedAt' | 'createdAt'>>
}
export type SupportMessage = Pick<TicketMessage, 'id' | 'senderId' | 'senderType' | 'body' | 'isInternal' | 'createdAt'>
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
  createMessage(input: Pick<TicketMessage, 'ticketId' | 'senderId' | 'senderType' | 'body' | 'isInternal'>): Promise<SupportMessage>
  updateTicket(ticketId: string, input: Pick<SupportTicket, 'status' | 'closedAt'>): Promise<void>
  updateDispute(disputeId: string, input: Pick<DisputeCase, 'status' | 'decision' | 'resolvedAt'>): Promise<void>
}

const ticketSelect = {
  id: true, userId: true, orderId: true, shopId: true, subject: true, status: true, priority: true, category: true,
  createdAt: true, updatedAt: true, closedAt: true,
  shop: { select: { id: true, name: true } },
  disputes: { select: { id: true, returnRequestId: true, status: true, reason: true, decision: true, resolvedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SupportTicketSelect
const messageSelect = { id: true, senderId: true, senderType: true, body: true, isInternal: true, createdAt: true } satisfies Prisma.TicketMessageSelect
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

  createMessage(input: Pick<TicketMessage, 'ticketId' | 'senderId' | 'senderType' | 'body' | 'isInternal'>) {
    return this.db.ticketMessage.create({ data: input, select: messageSelect })
  }

  async updateTicket(ticketId: string, input: Pick<SupportTicket, 'status' | 'closedAt'>) {
    await this.db.supportTicket.update({ where: { id: ticketId }, data: input })
  }

  async updateDispute(disputeId: string, input: Pick<DisputeCase, 'status' | 'decision' | 'resolvedAt'>) {
    await this.db.disputeCase.update({ where: { id: disputeId }, data: input })
  }
}
