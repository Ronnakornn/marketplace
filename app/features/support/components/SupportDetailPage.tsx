'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { useFormatters, useTranslations } from '#/i18n/client'
import { useAdminAccess } from '#/features/admin/access/useAdminAccess'
import { useLocalePath } from '#/i18n/navigation'
import { decideSupport, getSupport, listCompensationRefunds, linkSupportCompensation, replySupport, updateSupportStatus, type DisputeStatus, type SupportRole, type TicketStatus } from '../api'
import { ticketStatuses } from './SupportListPage'
import { SupportError, SupportFrame, SupportLoading, SupportPaging, supportBase } from './SupportShared'
import { uploadSupportAttachment } from '../upload'

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
          {dispute.refundId ? <p className="text-sm"><span className="font-medium">{t(dispute.status === 'COMPENSATED' ? 'support.integration.compensated' : 'support.integration.compensationPending')}</span>{dispute.compensation !== null ? ` · ${formatters.number(dispute.compensation)} ${t('support.integration.minorUnits')}` : ''}</p> : null}
          {role === 'admin' && dispute.refundId ? <Link href={localePath('/admin/refunds')} className="inline-block break-all text-sm font-medium text-orange-700 underline">{t('support.integration.refundPlan')} · {dispute.refundId}</Link> : null}
          {dispute.resolvedAt ? <p className="text-xs text-slate-600">{formatters.date(dispute.resolvedAt)}</p> : null}
          <p className="text-xs text-slate-600">{t('support.decisionScope')}</p>
        </div>)}
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">{t('support.conversation')}</h2>
        {query.data.messages.items.map((message) => <article key={message.id} className={`rounded-lg border p-4 ${message.isInternal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><p className="font-semibold">{t(`support.sender.${message.senderType}`)}{message.isInternal ? ` · ${t('support.privateNote')}` : ''}</p><time>{formatters.date(message.createdAt)}</time></div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.senderType === 'SYSTEM' ? systemMessage(message.body, t) : message.body}</p>
          {Array.isArray(message.attachments) ? <ul className="mt-3 space-y-1">{message.attachments.filter((id): id is string => typeof id === 'string').map((id, index) => <li key={id}><a href={`/api/support/tickets/${ticketId}/attachments/${id}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-orange-700 underline">{t('support.attachment')} {index + 1}</a></li>)}</ul> : null}
        </article>)}
        <SupportPaging page={page} total={query.data.messages.total} onPage={setPage} busy={query.isFetching} />
      </section>
      {isOpen ? <ReplyForm role={role} ticketId={ticketId} internal={false} /> : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">{t('support.terminal')}</p>}
      {role === 'admin' ? <>
        <ReplyForm role="admin" ticketId={ticketId} internal />
        <SupportCompensation ticket={ticket} />
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
  const [files, setFiles] = useState<File[]>([])
  const pending = useRef(false)
  const mutation = useMutation({ mutationFn: async () => {
    const attachmentIds = await Promise.all(files.map(uploadSupportAttachment))
    return attachmentIds.length ? replySupport(role, ticketId, body, internal, attachmentIds) : replySupport(role, ticketId, body, internal)
  }, onSuccess: async () => { setBody(''); setFiles([]); await client.invalidateQueries({ queryKey: ['support'] }) } })
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
    <label htmlFor={`${id}-files`} className="block text-sm font-medium">{t('support.attachEvidence')}</label>
    <input id={`${id}-files`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple disabled={mutation.isPending} onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []).slice(0, 5))} className="block w-full text-sm" />
    {files.length ? <p className="text-xs text-slate-600">{files.map((file) => file.name).join(', ')}</p> : null}
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

export function SupportCompensation({ ticket }: { ticket: Ticket }) {
  const t = useTranslations()
  const formatters = useFormatters()
  const localePath = useLocalePath()
  const client = useQueryClient()
  const access = useAdminAccess()
  const eligible = ticket.disputes.find(dispute => dispute.returnRequestId && ['RESOLVED_BUYER', 'COMPENSATED'].includes(dispute.status))
  const [refundId, setRefundId] = useState('')
  const pending = useRef(false)
  const refunds = useQuery({ queryKey: ['support-compensation', ticket.id], queryFn: () => listCompensationRefunds(ticket.id), enabled: Boolean(eligible && access.data?.permissions.includes('support.read')) })
  const candidate = refunds.data?.find(refund => refund.id === refundId)
  const selected = candidate && ['PROCESSING', 'SUCCESS'].includes(candidate.status) ? candidate : null
  const linked = refunds.data?.find(refund => refund.id === eligible?.refundId)
  const link = useMutation({ mutationFn: () => { if (!selected) throw new Error('SUPPORT_REFUND_SELECTION_REQUIRED'); return linkSupportCompensation(ticket.id, selected.id) }, onSuccess: async () => { setRefundId(''); await client.invalidateQueries({ queryKey: ['support'] }); await client.invalidateQueries({ queryKey: ['support-compensation', ticket.id] }) } })
  if (!eligible) return null
  function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current || !selected) return
    pending.current = true
    link.mutate(undefined, { onSettled: () => { pending.current = false } })
  }
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-semibold">{t('support.integration.compensationTitle')}</h2>
    <p className="text-sm text-slate-600">{t('support.integration.compensationScope')}</p>
    <Link href={localePath('/admin/refunds')} className="inline-block text-sm font-medium text-orange-700 underline">{t('support.integration.managePlans')}</Link>
    {eligible.refundId ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold">{t(eligible.status === 'COMPENSATED' ? 'support.integration.compensated' : 'support.integration.compensationPending')}</p><p className="mt-2 break-all text-sm">{eligible.refundId}</p>{linked ? <p className="mt-2 text-sm">{formatters.currency(linked.amount, linked.currency)} {linked.currency} · {t(`admin.statuses.${linked.status}`)}</p> : null}</div> : <>
      {refunds.isPending ? <p role="status" className="text-sm text-slate-600">{t('support.integration.loadingPlans')}</p> : null}
      {refunds.isError ? <SupportError retry={() => void refunds.refetch()} /> : null}
      {refunds.data?.length === 0 ? <p className="text-sm text-slate-600">{t('support.integration.noFrozenPlans')}</p> : null}
      {access.data?.permissions.includes('support.write') ? <form className="space-y-3" onSubmit={submit}>
        <label htmlFor="support-compensation-refund" className="block text-sm font-medium">{t('support.integration.selectPlan')}</label>
        <select id="support-compensation-refund" value={refundId} onChange={event => setRefundId(event.target.value)} className="w-full rounded-lg border border-slate-300 p-2" disabled={refunds.isPending || link.isPending}><option value="">{t('support.integration.choosePlan')}</option>{refunds.data?.filter(refund => ['PROCESSING', 'SUCCESS'].includes(refund.status)).map(refund => <option key={refund.id} value={refund.id}>{refund.id} · {formatters.currency(refund.amount, refund.currency)} {refund.currency} · {t(`admin.statuses.${refund.status}`)}</option>)}</select>
        {selected ? <p className="text-sm text-slate-600">{formatters.currency(selected.amount, selected.currency)} {selected.currency} · {t(selected.status === 'SUCCESS' ? 'support.integration.completedPlan' : 'support.integration.processingPlan')}</p> : null}
        <Button type="submit" disabled={!selected || link.isPending}>{link.isPending ? t('support.saving') : t('support.integration.linkPlan')}</Button>
        {link.isError ? <SupportError /> : null}
      </form> : null}
    </>}
  </section>
}
