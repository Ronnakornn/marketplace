import type { Treaty } from '@elysiajs/eden'
import { api } from '#/lib/eden'

export type SupportRole = 'buyer' | 'seller' | 'admin'
export type TicketStatus = NonNullable<Treaty.Data<ReturnType<typeof api.api.support.tickets.get>>>['items'][number]['status']
export type DisputeStatus = Parameters<ReturnType<typeof api.api.admin.support.tickets>['dispute']['patch']>[0]['status']
type CreateTicketInput = Parameters<typeof api.api.support.tickets.post>[0]
type AppealInput = Parameters<typeof api.api.support.appeals.post>[0]

export async function listSupport(role: SupportRole, page: number, status?: TicketStatus, shopId?: string) {
  const query = { page, limit: 20, status, shopId }
  const response = role === 'admin' ? await api.api.admin.support.tickets.get({ query })
    : role === 'seller' ? await api.api.seller.support.tickets.get({ query }) : await api.api.support.tickets.get({ query })
  if (response.error || !response.data) throw new Error('SUPPORT_REQUEST_FAILED')
  return response.data
}

export async function getSupport(role: SupportRole, ticketId: string, page: number) {
  const query = { page, limit: 20 }
  const response = role === 'admin' ? await api.api.admin.support.tickets({ ticketId }).get({ query })
    : role === 'seller' ? await api.api.seller.support.tickets({ ticketId }).get({ query }) : await api.api.support.tickets({ ticketId }).get({ query })
  if (response.error || !response.data) throw new Error('SUPPORT_REQUEST_FAILED')
  return response.data
}

export async function createSupport(input: CreateTicketInput) {
  const { data, error } = await api.api.support.tickets.post(input)
  if (error || !data) throw new Error('SUPPORT_REQUEST_FAILED')
  return data
}

export async function createAppeal(input: AppealInput) {
  const { data, error } = await api.api.support.appeals.post(input)
  if (error || !data) throw new Error('SUPPORT_REQUEST_FAILED')
  return data
}

export async function listAppealableReturns(orderId: string, page: number) {
  const { data, error } = await api.api.support.orders({ orderId }).returns.get({ query: { page, limit: 20 } })
  if (error || !data) throw new Error('SUPPORT_REQUEST_FAILED')
  return data
}

export async function replySupport(role: SupportRole, ticketId: string, body: string, internal: boolean) {
  const response = role === 'admin' ? internal ? await api.api.admin.support.tickets({ ticketId }).notes.post({ body }) : await api.api.admin.support.tickets({ ticketId }).messages.post({ body })
    : role === 'seller' ? await api.api.seller.support.tickets({ ticketId }).messages.post({ body }) : await api.api.support.tickets({ ticketId }).messages.post({ body })
  if (response.error || !response.data) throw new Error('SUPPORT_REQUEST_FAILED')
  return response.data
}

export async function updateSupportStatus(ticketId: string, status: TicketStatus) {
  const { data, error } = await api.api.admin.support.tickets({ ticketId }).status.patch({ status })
  if (error || !data) throw new Error('SUPPORT_REQUEST_FAILED')
  return data
}

export async function decideSupport(ticketId: string, status: DisputeStatus, decision: string) {
  const { data, error } = await api.api.admin.support.tickets({ ticketId }).dispute.patch({ status, decision })
  if (error || !data) throw new Error('SUPPORT_REQUEST_FAILED')
  return data
}
