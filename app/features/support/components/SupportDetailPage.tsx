'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useFormatters, useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { decideSupport, getSupport, replySupport, updateSupportStatus, type DisputeStatus, type SupportRole, type TicketStatus } from '../api'
import { ticketStatuses } from './SupportListPage'
import { SupportError, SupportFrame, SupportLoading, SupportPaging, supportBase } from './SupportShared'

type Ticket = Awaited<ReturnType<typeof getSupport>>['ticket']

export function SupportDetailPage({ role, ticketId }: { role: SupportRole; ticketId: string }) {
  const t = useTranslations()
  const formatters = useFormatters()
  const localePath = useLocalePath()
  const searchParams = useSearchParams()
  const shopId = role === 'seller' ? searchParams.get('shopId') : null
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['support', role, ticketId, page], queryFn: () => getSupport(role, ticketId, page) })
  const ticket = query.data?.ticket
  const isOpen = ticket && !['CLOSED', 'RESOLVED'].includes(ticket.status)
  return <SupportFrame role={role}>
    <Link href={localePath(`${supportBase(role)}${shopId ? `?shopId=${encodeURIComponent(shopId)}` : ''}`)} className="text-sm font-medium text-orange-700">{t('support.back')}</Link>
    {query.isLoading ? <SupportLoading /> : null}
    {query.isError ? <SupportError retry={() => void query.refetch()} /> : null}
    {ticket && query.data ? <>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3"><h1 className="min-w-0 flex-1 break-words text-xl font-bold">{ticket.subject}</h1><Badge variant="outline">{t(`support.status.${ticket.status}`)}</Badge></div>
        <p className="break-words text-sm text-slate-600">{ticket.shop?.name ?? t('support.platformSupport')}</p>
        {role === 'buyer' && ticket.orderId ? <Link href={localePath(`/orders/${ticket.orderId}`)} className="inline-block text-sm font-medium text-orange-700">{t('support.backToOrder')}</Link> : null}
        {ticket.disputes.map((dispute) => <div key={dispute.id} className="space-y-2 rounded-lg bg-orange-50 p-4">
          <h2 className="min-w-0 break-words font-semibold">{t('support.returnAppeal')} · {t(`support.disputeStatus.${dispute.status}`)}</h2>
          <p className="whitespace-pre-wrap break-words text-sm">{dispute.reason}</p>
          {dispute.decision ? <p className="whitespace-pre-wrap break-words text-sm"><span className="font-semibold">{t('support.decision')}</span> · {dispute.decision}</p> : null}
          {dispute.resolvedAt ? <p className="text-xs text-slate-600">{formatters.date(dispute.resolvedAt)}</p> : null}
          <p className="text-xs text-slate-600">{t('support.decisionScope')}</p>
        </div>)}
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{t('support.conversation')}</h2>
        {query.data.messages.items.map((message) => <article key={message.id} className={`rounded-lg border p-4 ${message.isInternal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><p className="font-semibold">{t(`support.sender.${message.senderType}`)}{message.isInternal ? ` · ${t('support.privateNote')}` : ''}</p><time>{formatters.date(message.createdAt)}</time></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.senderType === 'SYSTEM' ? systemMessage(message.body, t) : message.body}</p>
        </article>)}
        <SupportPaging page={page} total={query.data.messages.total} onPage={setPage} busy={query.isFetching} />
      </section>
      {isOpen ? <ReplyForm role={role} ticketId={ticketId} internal={false} /> : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{t('support.terminal')}</p>}
      {role === 'admin' ? <>
        <ReplyForm role="admin" ticketId={ticketId} internal />
        <AdminReview key={`${ticket.status}-${ticket.disputes[0]?.status}`} ticket={ticket} />
      </> : null}
    </> : null}
  </SupportFrame>
}

function systemMessage(body: string, t: ReturnType<typeof useTranslations>) {
  const match = /^\[([A-Z_]+)\]\s*(.*)$/s.exec(body)
  if (!match) return body
  const label = ticketStatuses.some((status) => status === match[1]) ? t(`support.status.${match[1]}`) : t(`support.disputeStatus.${match[1]}`)
  return `${label}${match[2] ? ` · ${match[2]}` : ''}`
}

function ReplyForm({ role, ticketId, internal }: { role: SupportRole; ticketId: string; internal: boolean }) {
  const t = useTranslations()
  const client = useQueryClient()
  const [body, setBody] = useState('')
  const pending = useRef(false)
  const mutation = useMutation({ mutationFn: () => replySupport(role, ticketId, body, internal), onSuccess: async () => { setBody(''); await client.invalidateQueries({ queryKey: ['support'] }) } })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    mutation.mutate(undefined, { onSettled: () => { pending.current = false } })
  }
  const id = internal ? 'support-private-note' : 'support-message'
  return <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
    <label htmlFor={id} className="block font-semibold">{internal ? t('support.privateNote') : t('support.message')}</label>
    {internal ? <p className="text-sm text-slate-600">{t('support.privateNoteDescription')}</p> : null}
    <textarea id={id} className="min-h-28 w-full rounded-lg border border-slate-300 p-3" value={body} onChange={(event) => setBody(event.target.value)} required maxLength={5000} />
    {mutation.isError ? <SupportError /> : null}
    {mutation.isSuccess ? <p role="status" className="text-sm text-emerald-700">{t('support.saved')}</p> : null}
    <Button type="submit" disabled={mutation.isPending || !body.trim()}>{mutation.isPending ? t('support.saving') : internal ? t('support.addPrivateNote') : t('support.sendMessage')}</Button>
  </form>
}

const disputeStatuses = ['UNDER_REVIEW', 'WAITING_EVIDENCE', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'] satisfies DisputeStatus[]

function AdminReview({ ticket }: { ticket: Ticket }) {
  const t = useTranslations()
  const client = useQueryClient()
  const dispute = ticket.disputes[0]
  const activeDispute = dispute && ['OPEN', 'UNDER_REVIEW', 'WAITING_EVIDENCE'].includes(dispute.status)
  const allowedTicketStatuses = ticket.status === 'CLOSED' ? [] : ticket.status === 'RESOLVED' ? ticketStatuses.filter((status) => status === 'CLOSED')
    : ticketStatuses.filter((status) => status !== ticket.status && (!activeDispute || !['RESOLVED', 'CLOSED'].includes(status)))
  const allowedDisputeStatuses = disputeStatuses.filter((status) => status !== dispute?.status)
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(allowedTicketStatuses[0] ?? ticket.status)
  const [disputeStatus, setDisputeStatus] = useState<DisputeStatus>(allowedDisputeStatuses[0] ?? 'UNDER_REVIEW')
  const [decision, setDecision] = useState('')
  const pending = useRef(false)
  const statusMutation = useMutation({ mutationFn: () => updateSupportStatus(ticket.id, ticketStatus), onSuccess: () => client.invalidateQueries({ queryKey: ['support'] }) })
  const decisionMutation = useMutation({ mutationFn: () => decideSupport(ticket.id, disputeStatus, decision), onSuccess: () => client.invalidateQueries({ queryKey: ['support'] }) })
  function submit(event: FormEvent, kind: 'status' | 'decision') {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    const mutation = kind === 'status' ? statusMutation : decisionMutation
    mutation.mutate(undefined, { onSettled: () => { pending.current = false } })
  }
  return <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">{t('support.adminReview')}</h2>
    {allowedTicketStatuses.length ? <form onSubmit={(event) => submit(event, 'status')} className="space-y-3">
      <label htmlFor="support-ticket-status" className="block text-sm font-medium">{t('support.ticketStatus')}</label>
      <select id="support-ticket-status" className="w-full rounded-lg border border-slate-300 p-2" value={ticketStatus} onChange={(event) => { const status = ticketStatuses.find((value) => value === event.target.value); if (status) setTicketStatus(status) }}>
        {allowedTicketStatuses.map((status) => <option key={status} value={status}>{t(`support.status.${status}`)}</option>)}
      </select>
      <Button type="submit" variant="outline" disabled={statusMutation.isPending || decisionMutation.isPending}>{t('support.saveStatus')}</Button>
      {statusMutation.isError ? <SupportError /> : null}
    </form> : null}
    {activeDispute ? <form onSubmit={(event) => submit(event, 'decision')} className="space-y-3 border-t border-slate-200 pt-5">
      <p className="text-sm text-slate-600">{t('support.decisionScope')}</p>
      <label htmlFor="support-dispute-status" className="block text-sm font-medium">{t('support.disputeStatusLabel')}</label>
      <select id="support-dispute-status" className="w-full rounded-lg border border-slate-300 p-2" value={disputeStatus} onChange={(event) => { const status = disputeStatuses.find((value) => value === event.target.value); if (status) setDisputeStatus(status) }}>
        {allowedDisputeStatuses.map((status) => <option key={status} value={status}>{t(`support.disputeStatus.${status}`)}</option>)}
      </select>
      <label htmlFor="support-decision" className="block text-sm font-medium">{t('support.decision')}</label>
      <textarea id="support-decision" className="min-h-28 w-full rounded-lg border border-slate-300 p-3" value={decision} onChange={(event) => setDecision(event.target.value)} required maxLength={5000} />
      <Button type="submit" disabled={decisionMutation.isPending || statusMutation.isPending || !decision.trim()}>{decisionMutation.isPending ? t('support.saving') : t('support.saveDecision')}</Button>
      {decisionMutation.isError ? <SupportError /> : null}
    </form> : null}
  </section>
}
