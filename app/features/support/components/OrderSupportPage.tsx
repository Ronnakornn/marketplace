'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { fetchOrder } from '#/features/buyer/api'
import { useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { listAppealableReturns } from '../api'
import { SupportCreateForm } from './SupportCreatePage'
import { SupportError, SupportFrame, SupportLoading, SupportPaging } from './SupportShared'

export function OrderSupportPage({ orderId }: { orderId: string }) {
  const t = useTranslations()
  const localePath = useLocalePath()
  const [page, setPage] = useState(1)
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null)
  const orderQuery = useQuery({ queryKey: ['buyer-order', orderId], queryFn: () => fetchOrder(orderId) })
  const returnsQuery = useQuery({ queryKey: ['support', 'rejected-returns', orderId, page], queryFn: () => listAppealableReturns(orderId, page) })
  const shops = [...new Map(orderQuery.data?.items.map((item) => [item.shopId, { id: item.shopId, name: item.shopName }]) ?? []).values()]
  const selected = returnsQuery.data?.items.find((request) => request.id === selectedReturnId)
  return <SupportFrame role="buyer">
    <Link href={localePath(`/orders/${orderId}`)} className="text-sm font-medium text-orange-700">{t('support.backToOrder')}</Link>
    <h1 className="text-2xl font-bold">{t('support.orderHelp')}</h1>
    {orderQuery.isLoading ? <SupportLoading /> : null}
    {orderQuery.isError ? <SupportError retry={() => void orderQuery.refetch()} /> : null}
    {orderQuery.data ? <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">{orderQuery.data.orderNo}</h2>
      <p className="text-sm text-slate-600">{t('support.chooseShop')}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={localePath(`/support/new?orderId=${orderId}`)}>{t('support.platformSupport')}</Link></Button>
        {shops.map((shop) => <Button key={shop.id} asChild variant="outline"><Link href={localePath(`/support/new?orderId=${orderId}&shopId=${shop.id}`)}>{shop.name}</Link></Button>)}
      </div>
    </section> : null}
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{t('support.returnAppeal')}</h2>
      <p className="text-sm text-slate-600">{t('support.appealDescription')}</p>
      {returnsQuery.isLoading ? <SupportLoading /> : null}
      {returnsQuery.isError ? <SupportError retry={() => void returnsQuery.refetch()} /> : null}
      {returnsQuery.data ? <>
        {returnsQuery.data.items.length === 0 ? <p className="text-sm text-slate-600">{t('support.noRejectedReturns')}</p> : returnsQuery.data.items.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
          <div><p className="font-medium">{request.shopName}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{request.reason}</p></div>
          {request.ticketId ? <Button asChild variant="outline"><Link href={localePath(`/support/${request.ticketId}`)}>{t('support.viewAppeal')}</Link></Button> : <Button variant="outline" onClick={() => setSelectedReturnId(request.id)}>{t('support.appealReturn')}</Button>}
        </div>)}
        <SupportPaging page={page} total={returnsQuery.data.total} onPage={(next) => { setSelectedReturnId(null); setPage(next) }} busy={returnsQuery.isFetching} />
      </> : null}
    </section>
    {selected && !selected.ticketId ? <section className="space-y-3"><h2 className="text-lg font-semibold">{t('support.appealReturn')} · {selected.shopName}</h2><SupportCreateForm key={selected.id} context={{ kind: 'appeal', returnRequestId: selected.id, orderId }} /></section> : null}
  </SupportFrame>
}
