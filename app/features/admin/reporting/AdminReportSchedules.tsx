'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFormatters, useTranslations } from '#/i18n/client'
import { reportingApi, requireData } from './api'

const field =
  'rounded border border-input bg-background px-3 py-2 text-sm text-foreground'
type ScheduleInput = Parameters<
  (typeof reportingApi.api.admin)['report-schedules']['post']
>[0]
export function AdminReportSchedules() {
  const t = useTranslations(),
    format = useFormatters(),
    client = useQueryClient()
  const [draft, setDraft] = useState<ScheduleInput>({
    name: '',
    type: 'SALES',
    format: 'XLSX',
    cadence: 'DAILY',
    hour: 8,
    filters: { group: 'day', timeZone: 'Asia/Bangkok' },
    isActive: true,
  })
  const schedules = useQuery({
    queryKey: ['admin', 'report-schedules'],
    queryFn: () =>
      requireData(reportingApi.api.admin['report-schedules'].get()),
  })
  const save = useMutation({
    mutationFn: () =>
      requireData(reportingApi.api.admin['report-schedules'].post(draft)),
    onSuccess: () => {
      setDraft({ ...draft, name: '' })
      return client.invalidateQueries({
        queryKey: ['admin', 'report-schedules'],
      })
    },
  })
  const toggle = useMutation({
    mutationFn: (schedule: NonNullable<typeof schedules.data>[number]) =>
      requireData(
        reportingApi.api.admin['report-schedules']({ id: schedule.id }).put({
          name: schedule.name,
          type: 'SALES',
          format: schedule.format === 'CSV' ? 'CSV' : 'XLSX',
          cadence:
            schedule.cadence === 'MONTHLY'
              ? 'MONTHLY'
              : schedule.cadence === 'WEEKLY'
                ? 'WEEKLY'
                : 'DAILY',
          hour: schedule.hour,
          filters: schedule.filters,
          isActive: !schedule.isActive,
          expectedVersion: schedule.version,
        }),
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'report-schedules'] }),
  })
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <h1 className="text-2xl font-semibold text-white">
        {t('admin.reporting.schedules')}
      </h1>
      <p className="text-sm text-slate-300">
        {t('admin.reporting.scheduleNote')}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.name')}
          <input
            className={field}
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.cadence')}
          <select
            className={field}
            value={draft.cadence}
            onChange={(event) =>
              setDraft({
                ...draft,
                cadence:
                  event.target.value === 'MONTHLY'
                    ? 'MONTHLY'
                    : event.target.value === 'WEEKLY'
                      ? 'WEEKLY'
                      : 'DAILY',
              })
            }
          >
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((cadence) => (
              <option key={cadence} value={cadence}>
                {t(`admin.reporting.${cadence}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.bangkokHour')}
          <input
            className={field}
            type="number"
            min={0}
            max={23}
            required
            value={draft.hour}
            onChange={(event) =>
              setDraft({ ...draft, hour: Number(event.target.value) })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.format')}
          <select
            className={field}
            value={draft.format}
            onChange={(event) =>
              setDraft({
                ...draft,
                format: event.target.value === 'CSV' ? 'CSV' : 'XLSX',
              })
            }
          >
            <option>CSV</option>
            <option>XLSX</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.shopId')}
          <input
            className={field}
            value={draft.filters.shopId ?? ''}
            onChange={(event) =>
              setDraft({
                ...draft,
                filters: {
                  ...draft.filters,
                  shopId: event.target.value || undefined,
                },
              })
            }
          />
        </label>
        <button className={field} disabled={save.isPending}>
          {t('admin.reporting.save')}
        </button>
      </form>
      {save.error || toggle.error || schedules.error ? (
        <p role="alert" className="text-red-300">
          {(save.error ?? toggle.error ?? schedules.error)?.message}
        </p>
      ) : null}
      {schedules.isPending ? (
        <p role="status" className="text-slate-300">
          {t('admin.reporting.loading')}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-300">
            <tr>
              {['name', 'cadence', 'nextRun', 'statusLabel', 'actions'].map(
                (key) => (
                  <th key={key} className="p-3">
                    {t(`admin.reporting.${key}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {schedules.data?.map((schedule) => (
              <tr
                key={schedule.id}
                className="border-t border-white/10 text-white"
              >
                <td className="p-3">
                  {schedule.name}
                  <span className="block text-xs text-slate-400">
                    {schedule.format}
                  </span>
                </td>
                <td className="p-3">
                  {t(`admin.reporting.${schedule.cadence}`)} · {schedule.hour}
                  :00
                </td>
                <td className="p-3">{format.date(schedule.nextRunAt)}</td>
                <td className="p-3">
                  {t(
                    schedule.isActive
                      ? 'admin.reporting.active'
                      : 'admin.reporting.paused',
                  )}
                </td>
                <td className="p-3">
                  <button
                    className={field}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(schedule)}
                  >
                    {t(
                      schedule.isActive
                        ? 'admin.reporting.pause'
                        : 'admin.reporting.resume',
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.data?.length === 0 ? (
          <p className="py-5 text-slate-300">{t('admin.reporting.empty')}</p>
        ) : null}
      </div>
    </section>
  )
}
