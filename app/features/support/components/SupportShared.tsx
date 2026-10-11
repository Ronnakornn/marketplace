'use client'

import type { ReactNode } from 'react'
import { BuyerTopBar } from '#/components/BuyerShell'
import { Button } from '#/components/ui/button'
import { useTranslations } from '#/i18n/client'
import type { SupportRole } from '../api'

export function SupportFrame({ role, children }: { role: SupportRole; children: ReactNode }) {
  const t = useTranslations()
  return <>
    {role === 'buyer' ? <BuyerTopBar title={t('support.title')} /> : null}
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">{children}</div>
  </>
}

export function SupportPaging({ page, total, limit = 20, onPage, busy }: { page: number; total: number; limit?: number; onPage: (page: number) => void; busy?: boolean }) {
  const t = useTranslations()
  if (total <= limit) return null
  return <nav aria-label={t('support.pagination')} className="flex items-center justify-between gap-3">
    <Button variant="outline" disabled={page === 1 || busy} onClick={() => onPage(page - 1)}>{t('ui.previous')}</Button>
    <p className="text-sm text-slate-600">{t('support.pageNumber').replace('{page}', String(page))}</p>
    <Button variant="outline" disabled={page * limit >= total || busy} onClick={() => onPage(page + 1)}>{t('ui.next')}</Button>
  </nav>
}

export function SupportError({ retry }: { retry?: () => void }) {
  const t = useTranslations()
  return <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
    <p>{t('support.error')}</p>
    {retry ? <Button variant="outline" onClick={retry}>{t('state.retry')}</Button> : null}
  </div>
}

export function SupportLoading() {
  const t = useTranslations()
  return <p role="status" className="rounded-xl bg-slate-100 p-5 text-slate-600">{t('support.loading')}</p>
}

export function supportBase(role: SupportRole) {
  return role === 'buyer' ? '/support' : `/${role}/support`
}
