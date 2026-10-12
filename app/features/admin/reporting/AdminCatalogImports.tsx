'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Treaty } from '@elysiajs/eden'
import { useTranslations } from '#/i18n/client'
import { importApi, requireData } from './api'

type PreviewInput = Parameters<
  typeof importApi.api.admin.catalog.imports.preview.post
>[0]
type Preview = Treaty.Data<
  ReturnType<typeof importApi.api.admin.catalog.imports.preview.post>
>
const field =
  'rounded border border-input bg-background px-3 py-2 text-sm text-foreground'
function fileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.split(',')[1] ?? '')
        : reject(new Error('Unable to read file'))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}
export function AdminCatalogImports() {
  const t = useTranslations(),
    client = useQueryClient()
  const [shopId, setShopId] = useState(''),
    [mode, setMode] = useState<PreviewInput['mode']>('PRICE'),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [accepted, setAccepted] = useState(false)
  const imports = useQuery({
    queryKey: ['admin', 'catalog-imports'],
    queryFn: () => requireData(importApi.api.admin.catalog.imports.get()),
  })
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || file.size > 2_000_000)
        throw new Error(t('admin.reporting.fileLimit'))
      return requireData(
        importApi.api.admin.catalog.imports.preview.post({
          shopId,
          mode,
          format: file.name.toLowerCase().endsWith('.xlsx') ? 'XLSX' : 'CSV',
          contentBase64: await fileContent(file),
          requestKey: crypto.randomUUID(),
        }),
      )
    },
    onSuccess: (data) => {
      setPreview(data)
      setAccepted(false)
      return client.invalidateQueries({
        queryKey: ['admin', 'catalog-imports'],
      })
    },
  })
  const commit = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error(t('admin.reporting.previewRequired'))
      return requireData(
        importApi.api.admin.catalog
          .imports({ id: preview.id })
          .commit.post({ previewFingerprint: preview.previewFingerprint }),
      )
    },
    onSuccess: (data) => {
      setPreview(data)
      return client.invalidateQueries({
        queryKey: ['admin', 'catalog-imports'],
      })
    },
  })
  const review = useMutation({
    mutationFn: (id: string) =>
      requireData(importApi.api.admin.catalog.imports({ id }).get()),
    onSuccess: (data) => {
      setPreview(data)
      setAccepted(false)
    },
  })
  const invalid = preview?.rows.some((row) => row.errors.length > 0)
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <h1 className="text-2xl font-semibold text-white">
        {t('admin.reporting.imports')}
      </h1>
      <p className="text-sm leading-relaxed text-slate-300">
        {t('admin.reporting.importNote')}
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          upload.mutate()
        }}
      >
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.shopId')}
          <input
            className={field}
            required
            value={shopId}
            onChange={(event) => {
              setShopId(event.target.value)
              setPreview(null)
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.mode')}
          <select
            className={field}
            value={mode}
            onChange={(event) => {
              const selected = (
                ['PRICE', 'STOCK', 'CONTENT', 'CREATE', 'ARCHIVE'] as const
              ).find((mode) => mode === event.target.value)
              if (selected) setMode(selected)
              setPreview(null)
            }}
          >
            {['PRICE', 'STOCK', 'CONTENT', 'CREATE', 'ARCHIVE'].map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t('admin.reporting.file')}
          <input
            className={field}
            required
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setPreview(null)
            }}
          />
        </label>
        <button className={field} disabled={upload.isPending}>
          {t('admin.reporting.preview')}
        </button>
      </form>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['CSV', 'XLSX'] as const).map((format) => (
          <a
            key={format}
            className="text-cyan-200"
            href={`/api/admin/catalog/import-template?mode=${mode}&format=${format}`}
          >
            {t('admin.reporting.template')} {format}
          </a>
        ))}
        {shopId
          ? (['CSV', 'XLSX'] as const).map((format) => (
              <a
                key={`export-${format}`}
                className="text-cyan-200"
                href={`/api/admin/catalog/export?shopId=${encodeURIComponent(shopId)}&format=${format}`}
              >
                {t('admin.reporting.exportCatalog')} {format}
              </a>
            ))
          : null}
      </div>
      {upload.error || commit.error || review.error || imports.error ? (
        <p role="alert" className="text-red-300">
          {
            (upload.error ?? commit.error ?? review.error ?? imports.error)
              ?.message
          }
        </p>
      ) : null}
      {preview ? (
        <div>
          <p className="mb-3 text-sm text-slate-300">
            {preview.mode} · {t(`admin.reporting.status.${preview.status}`)} ·{' '}
            {preview.shopId}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-300">
                <tr>
                  <th className="p-3">{t('admin.reporting.row')}</th>
                  <th className="p-3">{t('admin.reporting.changes')}</th>
                  <th className="p-3">{t('admin.reporting.errors')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className="border-t border-white/10 text-white"
                  >
                    <td className="p-3">{row.rowNumber}</td>
                    <td className="p-3">
                      {Object.entries(row.input).map(([key, value]) => (
                        <p key={key}>
                          {key}:{' '}
                          {row.before?.[key] !== undefined
                            ? `${row.before[key]} → `
                            : ''}
                          {value}
                        </p>
                      ))}
                    </td>
                    <td className="p-3 text-red-300">
                      {row.errors.join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.status === 'PREVIEW' ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                {t('admin.reporting.acceptPreview')}
              </label>
              <button
                className={field}
                disabled={!accepted || invalid || commit.isPending}
                onClick={() => commit.mutate()}
              >
                {t('admin.reporting.commit')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div>
        <h2 className="mb-3 font-medium text-white">
          {t('admin.reporting.recentImports')}
        </h2>
        {imports.data?.map((job) => (
          <div
            className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm text-slate-300"
            key={job.id}
          >
            <span>
              {job.mode} · {t(`admin.reporting.status.${job.status}`)}
            </span>
            <button
              className="text-cyan-200"
              disabled={review.isPending}
              onClick={() => review.mutate(job.id)}
            >
              {t('admin.reporting.review')}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
