'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { useAdminAccess } from '#/features/admin/access/useAdminAccess'
import { directoryApi } from './client'

export function AdminShopDetail({ shopId }: { shopId: string }) {
  const t = useTranslations(),
    path = useLocalePath(),
    client = useQueryClient(),
    access = useAdminAccess()
  const [page, setPage] = useState(1),
    [subject, setSubject] = useState(''),
    [body, setBody] = useState('')
  const query = useQuery({
    queryKey: ['admin', 'shop-detail', shopId, page],
    queryFn: async () => {
      const result = await directoryApi.api.admin.directory
        .shops({ shopId })
        .get({ query: { page, limit: 20 } })
      if (result.error) throw result.error
      return result.data
    },
  })
  const notice = useMutation({
    mutationFn: async () => {
      const result = await directoryApi.api.admin.directory
        .shops({ shopId })
        .notices.post({ subject, body })
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => {
      setSubject('')
      setBody('')
      void client.invalidateQueries({
        queryKey: ['admin', 'shop-detail', shopId],
      })
    },
  })
  if (query.isPending)
    return <p role="status">{t('admin.directory.loading')}</p>
  if (query.error || !query.data)
    return <p role="alert">{t('admin.directory.failed')}</p>
  const data = query.data,
    canWrite = access.data?.permissions.includes('shops.write')
  return (
    <div className="grid gap-5">
      <section className="admin-panel rounded-xl p-5">
        <h1 className="text-2xl font-semibold">{data.shop.name}</h1>
        <p className="mt-2">
          {t(`admin.statuses.${data.shop.status}`)} · {data.shop.contactEmail} ·{' '}
          {data.shop.contactPhone}
        </p>
        <Link
          className="underline"
          href={path(`/admin/users/${data.shop.ownerId}`)}
        >
          {data.shop.owner.name}
        </Link>
        <p className="mt-3">
          {t('admin.directory.kyc')}:{' '}
          {t(`admin.statuses.${data.shop.sellerProfile.verificationStatus}`)}
        </p>
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">
          {t('admin.directory.quality')}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          {Object.entries(data.quality)
            .filter(([key]) => key !== 'transitThresholdDays')
            .map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-muted-foreground">
                  {t(`admin.directory.${key}`)}
                </dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {value ?? '—'}
                </dd>
              </div>
            ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('admin.directory.transitExplanation')}
        </p>
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">{t('admin.directory.risk')}</h2>
        <ul className="mt-3 space-y-3">
          {data.violations.map((item) => (
            <li key={item.id}>
              {t(`admin.statuses.${item.type}`)} ·{' '}
              {t(`admin.statuses.${item.severity}`)} ·{' '}
              {t(`admin.statuses.${item.status}`)}
              <p>{item.reason}</p>
            </li>
          ))}
          {data.restrictions.map((item) => (
            <li key={item.id}>
              {t(`admin.statuses.${item.type}`)}
              <p>{item.reason}</p>
            </li>
          ))}
        </ul>
        {!data.violations.length && !data.restrictions.length && (
          <p>{t('admin.directory.empty')}</p>
        )}
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">
          {t('admin.directory.orders')} ({data.orders.total})
        </h2>
        <ul className="mt-3 space-y-3">
          {data.orders.items.map((order) => (
            <li key={order.id}>
              <Link
                className="underline"
                href={path(`/admin/orders?orderId=${order.orderId}`)}
              >
                {order.orderId}
              </Link>{' '}
              · {t(`admin.statuses.${order.status}`)} · {order.grandTotal}{' '}
              {t('admin.directory.minorUnits')} {order.currency}
            </li>
          ))}
        </ul>
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">
          {t('admin.directory.notices')}
        </h2>
        {canWrite && (
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              notice.mutate()
            }}
          >
            <label htmlFor="shop-notice-subject">
              {t('admin.directory.subject')}
            </label>
            <Input
              id="shop-notice-subject"
              maxLength={200}
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <label htmlFor="shop-notice-body">
              {t('admin.directory.message')}
            </label>
            <textarea
              className="min-h-32 rounded border p-3"
              id="shop-notice-body"
              maxLength={10000}
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            <Button
              disabled={notice.isPending || !subject.trim() || !body.trim()}
            >
              {t('admin.directory.send')}
            </Button>
            {notice.error && (
              <p role="alert">{t('admin.directory.noticeFailed')}</p>
            )}
            {notice.isSuccess && (
              <p role="status">{t('admin.directory.noticeSent')}</p>
            )}
          </form>
        )}
        <ul className="mt-4 space-y-2">
          {data.notices.items.map((ticket) => (
            <li key={ticket.id}>
              <Link
                className="underline"
                href={path(`/admin/support?ticketId=${ticket.id}`)}
              >
                {ticket.subject}
              </Link>{' '}
              · {t(`admin.statuses.${ticket.status}`)}
            </li>
          ))}
        </ul>
      </section>
      <div className="flex gap-3">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t('admin.directory.previous')}
        </Button>
        <span>{page}</span>
        <Button
          variant="outline"
          disabled={
            Math.max(data.orders.total, data.notices.total) <=
              page * data.limit &&
            data.violations.length < data.limit &&
            data.restrictions.length < data.limit
          }
          onClick={() => setPage(page + 1)}
        >
          {t('admin.directory.next')}
        </Button>
      </div>
    </div>
  )
}
