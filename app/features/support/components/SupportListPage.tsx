'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { useFormatters, useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { listSupport, type SupportRole, type TicketStatus } from '../api'
import { SupportError, SupportFrame, SupportLoading, SupportPaging, supportBase } from './SupportShared'

export const ticketStatuses = ['OPEN', 'PENDING_CUSTOMER', 'PENDING_SELLER', 'PENDING_ADMIN', 'RESOLVED', 'CLOSED'] satisfies TicketStatus[]

export function SupportListPage({ role }: { role: SupportRole }) {
  const t = useTranslations()
  const formatters = useFormatters()
  const localePath = useLocalePath()
  const searchParams = useSearchParams()
  const shopId = role === 'seller' ? searchParams.get('shopId') ?? undefined : undefined
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<TicketStatus | undefined>()
  const query = useQuery({ queryKey: ['support', role, shopId, status, page], queryFn: () => listSupport(role, page, status, shopId) })
  return <SupportFrame role={role}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{t('support.title')}</h1>
      {role === 'buyer' ? <Button asChild className="bg-orange-600 hover:bg-orange-700"><Link href={localePath('/support/new')}>{t('support.createTicket')}</Link></Button> : null}
    </div>
    <label className="block max-w-sm text-sm font-medium">{t('support.ticketStatus')}
      <select className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2" value={status ?? ''} onChange={(event) => { setStatus(ticketStatuses.find((value) => value === event.target.value)); setPage(1) }}>
        <option value="">{t('support.allStatuses')}</option>
        {ticketStatuses.map((value) => <option key={value} value={value}>{t(`support.status.${value}`)}</option>)}
      </select>
    </label>
    {query.isLoading ? <SupportLoading /> : null}
    {query.isError ? <SupportError retry={() => void query.refetch()} /> : null}
    {query.data ? <>
      {query.data.items.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{t('support.empty')}</p> : <div className="space-y-3">
        {query.data.items.map((ticket) => <Link key={ticket.id} href={localePath(`${supportBase(role)}/${ticket.id}${shopId ? `?shopId=${encodeURIComponent(shopId)}` : ''}`)} className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-orange-400 focus-visible:outline-orange-600">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h2 className="min-w-0 flex-1 break-words font-semibold">{ticket.subject}</h2><Badge variant="outline">{t(`support.status.${ticket.status}`)}</Badge></div>
          <p className="mt-2 break-words text-sm text-slate-600">{ticket.shop?.name ?? t('support.platformSupport')}</p>
          {ticket.disputes.length ? <p className="mt-1 text-sm font-medium text-orange-700">{t('support.returnAppeal')}</p> : null}
          <p className="mt-2 text-xs text-slate-500">{formatters.date(ticket.updatedAt)}</p>
        </Link>)}
      </div>}
      <SupportPaging page={page} total={query.data.total} onPage={setPage} busy={query.isFetching} />
    </> : null}
  </SupportFrame>
}
