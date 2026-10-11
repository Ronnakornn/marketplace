import { describe, expect, it, vi } from 'vitest'
import type { AppContext } from '#server/context/app-context.ts'
import type { ISupportRepository, SupportMessage, SupportReturn, TicketSummary } from './support.repository.ts'
import { SupportService } from './support.service.ts'

const context: AppContext = { config: { environment: 'test' }, logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }
const buyer = { kind: 'buyer', userId: 'buyer' } as const
const seller = { kind: 'seller', userId: 'seller' } as const
const admin = { kind: 'admin', userId: 'admin' } as const

function harness() {
  let tickets: TicketSummary[] = []
  let messages: Array<SupportMessage & { ticketId: string }> = []
  const request: SupportReturn = { id: 'return', userId: 'buyer', orderId: 'order', shopId: 'shop', status: 'REJECTED', reason: 'Damaged item', description: null }
  const locks: string[] = []
  let failMessage = false
  let queue = Promise.resolve()
  const repo: ISupportRepository = {
    transaction: async (callback) => {
      const previous = queue
      let release = () => {}
      queue = new Promise<void>((resolve) => { release = resolve })
      await previous
      const snapshot = structuredClone({ tickets, messages })
      try { return await callback(repo) } catch (error) { tickets = snapshot.tickets; messages = snapshot.messages; throw error } finally { release() }
    },
    lockOrder: async (id) => { locks.push(`order:${id}`) },
    lockTicket: async (id) => { locks.push(`ticket:${id}`) },
    findTicketReference: async (id) => tickets.find((ticket) => ticket.id === id) ?? null,
    findOwnedOrder: async (id, userId) => id === 'order' && userId === 'buyer' ? { id, shopIds: ['shop'] } : null,
    findReturn: async (id) => id === request.id ? structuredClone(request) : null,
    findAppeal: async (id) => {
      const ticket = tickets.find((row) => row.disputes.some((dispute) => dispute.returnRequestId === id))
      return ticket ? { ticketId: ticket.id, openedById: ticket.userId } : null
    },
    listAppealableReturns: async () => ({ items: [{ ...request, ticketId: tickets[0]?.id ?? null, shopName: 'Shop' }], total: 1 }),
    listTickets: async (scope, page) => {
      const rows = tickets.filter((ticket) => scope.kind === 'admin' || scope.kind === 'buyer' && ticket.userId === scope.userId || scope.kind === 'seller' && scope.userId === 'seller' && ticket.shopId === 'shop')
      return { items: rows.slice((page.page - 1) * page.limit, page.page * page.limit), total: rows.length }
    },
    findTicket: async (id, scope) => {
      const row = tickets.find((ticket) => ticket.id === id)
      if (!row) return null
      if (scope.kind === 'buyer' && row.userId !== scope.userId || scope.kind === 'seller' && (scope.userId !== 'seller' || row.shopId !== 'shop')) return null
      return structuredClone(row)
    },
    listMessages: async (id, includeInternal, page) => {
      const rows = messages.filter((message) => message.ticketId === id && (includeInternal || !message.isInternal))
      return { items: rows.slice((page.page - 1) * page.limit, page.page * page.limit), total: rows.length }
    },
    createTicket: async ({ body, ...input }) => {
      const row: TicketSummary = { ...input, id: `ticket-${tickets.length + 1}`, status: 'OPEN', priority: 'NORMAL', category: null, createdAt: new Date(), updatedAt: new Date(), closedAt: null, disputes: [], shop: input.shopId ? { id: input.shopId, name: 'Shop' } : null }
      tickets.push(row)
      await repo.createMessage({ ticketId: row.id, senderId: input.userId, senderType: 'BUYER', body, isInternal: false })
      return structuredClone(row)
    },
    createDispute: async (input) => {
      const row = tickets.find((ticket) => ticket.id === input.ticketId)
      if (!row) throw new Error('Ticket missing')
      row.disputes.push({ id: 'dispute', returnRequestId: input.returnRequestId, status: 'OPEN', reason: input.reason, decision: null, resolvedAt: null, createdAt: new Date() })
    },
    createMessage: async (input) => {
      if (failMessage) throw new Error('Database unavailable')
      const row = { ...input, id: `message-${messages.length}`, createdAt: new Date() }
      messages.push(row)
      return structuredClone(row)
    },
    updateTicket: async (id, input) => { const row = tickets.find((ticket) => ticket.id === id); if (row) Object.assign(row, input) },
    updateDispute: async (id, input) => { const row = tickets.flatMap((ticket) => ticket.disputes).find((dispute) => dispute.id === id); if (row) Object.assign(row, input) },
  }
  return { service: new SupportService(context, repo), request, locks, failNextMessage: () => { failMessage = true } }
}

describe('SupportService participant workflows', () => {
  it('accepts owned order/shop context and hides it from other buyers and sellers', async () => {
    const { service } = harness()
    const ticket = await service.create('buyer', { subject: 'Help', body: 'Please help', orderId: 'order', shopId: 'shop' })
    await expect(service.detail({ kind: 'buyer', userId: 'other' }, ticket.id)).rejects.toMatchObject({ code: 'SUPPORT_TICKET_NOT_FOUND' })
    await expect(service.detail({ kind: 'seller', userId: 'other-seller' }, ticket.id)).rejects.toMatchObject({ code: 'SUPPORT_TICKET_NOT_FOUND' })
    expect((await service.detail(seller, ticket.id)).ticket.shop?.name).toBe('Shop')
    expect((await service.list({ kind: 'buyer', userId: 'other' })).total).toBe(0)
  })

  it('rejects another buyer order, unrelated shops and a shop without order context', async () => {
    const { service } = harness()
    await expect(service.create('other', { subject: 'Help', body: 'Evidence', orderId: 'order' })).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
    await expect(service.create('buyer', { subject: 'Help', body: 'Evidence', orderId: 'order', shopId: 'other-shop' })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_CONTEXT' })
    await expect(service.create('buyer', { subject: 'Help', body: 'Evidence', shopId: 'shop' })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_CONTEXT' })
    expect((await service.list(admin)).total).toBe(0)
  })

  it('keeps shopless tickets between buyer and administrators', async () => {
    const { service } = harness()
    const ticket = await service.create('buyer', { subject: 'Account help', body: 'Please help' })
    await expect(service.reply(seller, ticket.id, { body: 'Unauthorized reply' })).rejects.toMatchObject({ code: 'SUPPORT_TICKET_NOT_FOUND' })
    expect((await service.list(seller)).total).toBe(0)
    expect((await service.detail(admin, ticket.id)).messages.total).toBe(1)
  })

  it('requires an owned rejected return and converges concurrent retries to one appeal', async () => {
    const { service, request } = harness()
    const input = { returnRequestId: 'return', subject: 'Appeal', body: 'Text evidence' }
    await expect(service.appeal('other', input)).rejects.toMatchObject({ code: 'RETURN_NOT_FOUND' })
    request.status = 'REQUESTED'
    await expect(service.appeal('buyer', input)).rejects.toMatchObject({ code: 'RETURN_NOT_REJECTED' })
    request.status = 'REJECTED'
    const [first, retry] = await Promise.all([service.appeal('buyer', input), service.appeal('buyer', input)])
    expect(first.id).toBe(retry.id)
    expect((await service.list(admin)).total).toBe(1)
    expect((await service.detail(buyer, first.id)).messages.total).toBe(1)
    expect(first.disputes[0]?.returnRequestId).toBe('return')
  })

  it('filters private notes before pagination/counts and keeps public workflow unchanged', async () => {
    const { service } = harness()
    const ticket = await service.create('buyer', { subject: 'Help', body: 'First', orderId: 'order', shopId: 'shop' })
    await service.reply(admin, ticket.id, { body: 'Private investigation' }, true)
    await service.reply(admin, ticket.id, { body: 'Public response' })
    const detail = await service.detail(buyer, ticket.id, { page: 2, limit: 1 })
    expect(detail.messages.items.map((message) => message.body)).toEqual(['Public response'])
    expect(detail.messages.total).toBe(2)
    expect((await service.detail(seller, ticket.id)).messages.items.some((message) => message.isInternal)).toBe(false)
    expect((await service.detail(admin, ticket.id)).messages.total).toBe(3)
    await expect(service.reply(buyer, ticket.id, { body: 'Private' }, true)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('makes decisions terminal with an administrator SYSTEM message and leaves the return rejected', async () => {
    const { service, request, locks } = harness()
    const ticket = await service.appeal('buyer', { returnRequestId: 'return', subject: 'Appeal', body: 'Evidence' })
    locks.length = 0
    await service.decide('admin', ticket.id, { status: 'UNDER_REVIEW', decision: 'Checking evidence' })
    const decided = await service.decide('admin', ticket.id, { status: 'RESOLVED_BUYER', decision: 'The evidence supports the buyer' })
    expect(decided.status).toBe('RESOLVED')
    expect(decided.disputes[0]).toMatchObject({ status: 'RESOLVED_BUYER', decision: 'The evidence supports the buyer', resolvedAt: expect.any(Date) })
    const last = (await service.detail(admin, ticket.id)).messages.items.at(-1)
    expect(last).toMatchObject({ senderId: 'admin', senderType: 'SYSTEM', body: '[RESOLVED_BUYER] The evidence supports the buyer', isInternal: false })
    expect(request.status).toBe('REJECTED')
    expect(locks).toEqual([`order:order`, `ticket:${ticket.id}`, `order:order`, `ticket:${ticket.id}`])
    await expect(service.decide('admin', ticket.id, { status: 'UNDER_REVIEW', decision: 'Reopen' })).rejects.toMatchObject({ code: 'INVALID_DISPUTE_TRANSITION' })
    await expect(service.reply(buyer, ticket.id, { body: 'Late reply' })).rejects.toMatchObject({ code: 'SUPPORT_TICKET_TERMINAL' })
  })

  it('requires a dispute decision before resolving and rolls decision writes back with message failure', async () => {
    const { service, failNextMessage } = harness()
    const ticket = await service.appeal('buyer', { returnRequestId: 'return', subject: 'Appeal', body: 'Evidence' })
    await expect(service.setStatus('admin', ticket.id, 'RESOLVED')).rejects.toMatchObject({ code: 'DISPUTE_DECISION_REQUIRED' })
    await expect(service.decide('admin', ticket.id, { status: 'RESOLVED_SELLER', decision: '  ' })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_TEXT' })
    failNextMessage()
    await expect(service.decide('admin', ticket.id, { status: 'RESOLVED_SELLER', decision: 'Seller evidence' })).rejects.toThrow('Database unavailable')
    const detail = await service.detail(admin, ticket.id)
    expect(detail.ticket.status).toBe('OPEN')
    expect(detail.ticket.disputes[0]).toMatchObject({ status: 'OPEN', decision: null, resolvedAt: null })
    expect(detail.messages.total).toBe(1)
  })

  it('rejects blank and oversized text before writes', async () => {
    const { service } = harness()
    await expect(service.create('buyer', { subject: '  ', body: 'Evidence' })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_TEXT' })
    await expect(service.create('buyer', { subject: 'Help', body: 'x'.repeat(5001) })).rejects.toMatchObject({ code: 'INVALID_SUPPORT_TEXT' })
    expect((await service.list(admin)).total).toBe(0)
  })
})
