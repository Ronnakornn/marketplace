'use client'
import { useLocalePath } from '#/i18n/navigation'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Treaty } from '@elysiajs/eden'
import { useFormatters, useTranslations } from '#/i18n/client'
import { reportingApi, requireData } from './api'
import { useAdminAccess } from '../access/useAdminAccess'

type AnalyticsQuery = NonNullable<
  Parameters<typeof reportingApi.api.admin.analytics.get>[0]
>['query']
type Analytics = Treaty.Data<
  ReturnType<typeof reportingApi.api.admin.analytics.get>
>
type Row = NonNullable<Analytics>['items'][number]
const metricColumns = [
  'gmv',
  'paidMerchandise',
  'shipping',
  'tax',
  'discount',
  'refund',
  'originalCommission',
  'contribution',
] as const
const field =
  'rounded border border-input bg-background px-3 py-2 text-sm text-foreground'
export function AdminAnalytics({ compact = false }: { compact?: boolean }) {
  const localePath = useLocalePath()
  const access = useAdminAccess()
  const canExport = access.data?.permissions.includes('reports.export') ?? false
  const canImport = access.data?.permissions.includes('catalog.read') ?? false
  const canReadDocuments =
    access.data?.permissions.includes('orders.read') ?? false
  const t = useTranslations(),
    format = useFormatters(),
    client = useQueryClient()
  const [filters, setFilters] = useState<AnalyticsQuery>({
    group: 'day',
    timeZone: 'Asia/Bangkok',
    page: 1,
    limit: 25,
  })
  const analytics = useQuery({
    queryKey: ['admin', 'analytics', filters],
    queryFn: () =>
      requireData(reportingApi.api.admin.analytics.get({ query: filters })),
  })
  const charts = useQuery({
    queryKey: ['admin', 'analytics-chart', filters],
    queryFn: () =>
      requireData(
        reportingApi.api.admin.analytics.get({
          query: { ...filters, group: 'day', page: 1, limit: 100 },
        }),
      ),
  })
  const exports = useQuery({
    queryKey: ['admin', 'report-exports', access.data?.userId],
    queryFn: () => requireData(reportingApi.api.admin['report-exports'].get()),
    enabled: !compact && canExport,
  })
  const exportReport = useMutation({
    mutationFn: (format: 'CSV' | 'XLSX') =>
      requireData(
        reportingApi.api.admin['report-exports'].post({
          type: 'SALES',
          format,
          filters: filters ?? {},
        }),
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'report-exports'] }),
  })
  const change = (value: AnalyticsQuery) =>
    setFilters({ ...filters, ...value, page: value?.page ?? 1 })
  const chartRows = charts.data?.items ?? [],
    maximum = chartRows.reduce(
      (max, row) => (BigInt(row.gmv) > max ? BigInt(row.gmv) : max),
      0n,
    )
  const money = (row: Row, key: (typeof metricColumns)[number]) =>
    format.currency(row[key], row.currency)
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">
          {t('admin.reporting.analytics')}
        </h2>
        <div className="flex gap-3 text-sm">
          {canExport ? (
            <Link
              href={localePath('/admin/report-schedules')}
              className="text-cyan-200"
            >
              {t('admin.reporting.schedules')}
            </Link>
          ) : null}
          {canImport ? (
            <Link
              href={localePath('/admin/catalog/imports')}
              className="text-cyan-200"
            >
              {t('admin.reporting.imports')}
            </Link>
          ) : null}
          {canReadDocuments ? (
            <Link
              href={localePath('/admin/order-documents')}
              className="text-cyan-200"
            >
              {t('admin.reporting.documents')}
            </Link>
          ) : null}
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.from')}
          <input
            aria-label={t('admin.reporting.from')}
            type="date"
            className={field}
            value={filters?.from ?? ''}
            onChange={(event) =>
              change({ from: event.target.value || undefined })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.toExclusive')}
          <input
            aria-label={t('admin.reporting.toExclusive')}
            type="date"
            className={field}
            value={filters?.to ?? ''}
            onChange={(event) =>
              change({ to: event.target.value || undefined })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.group')}
          <select
            className={field}
            value={filters?.group}
            onChange={(event) =>
              change({
                group: event.target
                  .value as NonNullable<AnalyticsQuery>['group'],
              })
            }
          >
            {['day', 'month', 'shop', 'category', 'product', 'region'].map(
              (group) => (
                <option key={group} value={group}>
                  {t(`admin.reporting.${group}`)}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.timeZone')}
          <select
            className={field}
            value={filters?.timeZone}
            onChange={(event) =>
              change({
                timeZone: event.target.value === 'UTC' ? 'UTC' : 'Asia/Bangkok',
              })
            }
          >
            <option>Asia/Bangkok</option>
            <option>UTC</option>
          </select>
        </label>
        {!compact ? (
          <>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              {t('admin.reporting.shopId')}
              <input
                className={field}
                value={filters?.shopId ?? ''}
                onChange={(event) =>
                  change({ shopId: event.target.value || undefined })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              {t('admin.reporting.categoryId')}
              <input
                className={field}
                value={filters?.categoryId ?? ''}
                onChange={(event) =>
                  change({ categoryId: event.target.value || undefined })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              {t('admin.reporting.region')}
              <input
                className={field}
                value={filters?.region ?? ''}
                onChange={(event) =>
                  change({ region: event.target.value || undefined })
                }
              />
            </label>
          </>
        ) : null}
      </form>
      {analytics.isPending ? (
        <p role="status" className="text-slate-300">
          {t('admin.reporting.loading')}
        </p>
      ) : null}
      {analytics.error ? (
        <p role="alert" className="text-red-300">
          {analytics.error.message}
        </p>
      ) : null}
      {analytics.data?.totals.map((total) => (
        <div
          key={total.currency}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {(['gmv', 'paidMerchandise', 'refund', 'contribution'] as const).map(
            (key) => (
              <div
                key={key}
                className="rounded border border-white/10 bg-slate-950/40 p-4"
              >
                <p className="text-sm text-slate-300">
                  {t(`admin.reporting.${key}`)} · {total.currency}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {format.currency(total[key], total.currency)}
                </p>
              </div>
            ),
          )}
        </div>
      ))}
      {analytics.data?.totals.map((total) =>
        total.operatingContribution !== null ? (
          <p
            key={`expenses-${total.currency}`}
            className="text-sm text-slate-300"
          >
            {t('admin.reporting.recordedExpenses')}:{' '}
            {format.currency(total.recordedExpenses ?? '0', total.currency)} ·{' '}
            {t('admin.reporting.operatingContribution')}:{' '}
            {format.currency(total.operatingContribution, total.currency)}
          </p>
        ) : null,
      )}
      {analytics.data?.totals.some(
        (total) => BigInt(total.snapshotMissing) > 0n,
      ) ? (
        <p className="text-sm text-amber-200">
          {t('admin.reporting.legacyNote')}
        </p>
      ) : null}
      <div>
        <h3 className="mb-2 text-sm text-slate-300">
          {t('admin.reporting.dailyGmv')}
        </h3>
        <div
          className="flex h-32 items-end gap-1 overflow-x-auto"
          role="img"
          aria-label={t('admin.reporting.dailyGmv')}
        >
          {chartRows.map((row) => (
            <div
              key={`${row.key}-${row.currency}`}
              className="min-w-3 flex-1 rounded-t bg-cyan-300"
              style={{
                height: `${maximum === 0n ? 0 : Number((BigInt(row.gmv) * 10000n) / maximum) / 100}%`,
              }}
              title={`${row.key} ${format.currency(row.gmv, row.currency)}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t('admin.reporting.chartLimit')}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        {t('admin.reporting.metricNote')}
      </p>
      {!compact ? (
        <>
          <div className="flex gap-2">
            {canExport &&
              (['CSV', 'XLSX'] as const).map((format) => (
                <button
                  key={format}
                  className={field}
                  disabled={exportReport.isPending}
                  onClick={() => exportReport.mutate(format)}
                >
                  {t('admin.reporting.export')} {format}
                </button>
              ))}
          </div>
          {exportReport.error ? (
            <p role="alert" className="text-red-300">
              {exportReport.error.message}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-300">
                <tr>
                  <th className="p-3">{t('admin.reporting.group')}</th>
                  <th className="p-3">{t('admin.reporting.orders')}</th>
                  <th className="p-3">{t('admin.reporting.units')}</th>
                  {metricColumns.map((key) => (
                    <th className="whitespace-nowrap p-3" key={key}>
                      {t(`admin.reporting.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-white">
                {analytics.data?.items.map((row) => (
                  <tr
                    key={`${row.key}-${row.currency}`}
                    className="border-t border-white/10"
                  >
                    <td className="p-3">
                      {row.label}
                      <span className="block text-xs text-slate-400">
                        {row.currency}
                      </span>
                    </td>
                    <td className="p-3">{row.orders}</td>
                    <td className="p-3">{row.units}</td>
                    {metricColumns.map((key) => (
                      <td className="whitespace-nowrap p-3" key={key}>
                        {money(row, key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics.data?.items.length === 0 ? (
              <p className="py-5 text-slate-300">
                {t('admin.reporting.empty')}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              className={field}
              disabled={(filters?.page ?? 1) <= 1}
              onClick={() => change({ page: (filters?.page ?? 1) - 1 })}
            >
              {t('admin.reporting.previous')}
            </button>
            <span className="text-sm text-slate-300">
              {filters?.page ?? 1} · {analytics.data?.total ?? '0'}
            </span>
            <button
              className={field}
              disabled={
                BigInt((filters?.page ?? 1) * 25) >=
                BigInt(analytics.data?.total ?? '0')
              }
              onClick={() => change({ page: (filters?.page ?? 1) + 1 })}
            >
              {t('admin.reporting.next')}
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-medium text-white">
                {t('admin.reporting.searchQueries')}
              </h3>
              {analytics.data?.searchQueries.map((item) => (
                <p
                  key={item.query}
                  className="flex justify-between border-b border-white/10 py-2 text-sm text-slate-300"
                >
                  <span>{item.query}</span>
                  <span>
                    {item.count} · {t('admin.reporting.zeroResults')}{' '}
                    {item.zeroResults}
                  </span>
                </p>
              ))}
            </div>
            {canExport ? (
              <div>
                <h3 className="mb-2 font-medium text-white">
                  {t('admin.reporting.exports')}
                </h3>
                {exports.data?.map((job) => (
                  <div
                    key={job.id}
                    className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm text-slate-300"
                  >
                    <div>
                      {job.format} · {t(`admin.reporting.status.${job.status}`)}
                      {job.error ? (
                        <p className="text-red-300">{job.error}</p>
                      ) : null}
                    </div>
                    {job.status === 'COMPLETED' ? (
                      <a
                        href={`/api/admin/report-exports/${job.id}/download`}
                        className="text-cyan-200"
                      >
                        {t('admin.reporting.download')}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
