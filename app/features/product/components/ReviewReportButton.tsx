'use client'
import { useId, useState } from 'react'
import Link from 'next/link'
import { treaty } from '@elysiajs/eden'
import { useMutation } from '@tanstack/react-query'
import type { createReviewRoutes } from '#server/modules/review/review.routes'
import { useSession } from '#/lib/auth-client'
import { useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { Button } from '#/components/ui/button'

const api = treaty<ReturnType<typeof createReviewRoutes>>(typeof window === 'undefined' ? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' : window.location.origin, { fetch: { credentials: 'include' } })
type Input = Parameters<typeof api.api['review-reports']['post']>[0]
type Reason = Input['reason']
const reasons = ['SPAM', 'ABUSIVE_LANGUAGE', 'ADULT_CONTENT', 'FAKE_REVIEW', 'IRRELEVANT', 'PERSONAL_INFO', 'OTHER'] satisfies Reason[]
export function ReviewReportButton({ reviewId, shopRatingId }: { reviewId: string; shopRatingId?: never } | { reviewId?: never; shopRatingId: string }) {
  const t = useTranslations(), path = useLocalePath(), id = useId(), session = useSession()
  const [open, setOpen] = useState(false), [reason, setReason] = useState<Reason>('SPAM'), [detail, setDetail] = useState('')
  const report = useMutation({ mutationFn: async () => {
    if (!reviewId && !shopRatingId) throw new Error('Review target required')
    const target = reviewId ? { reviewId } : { shopRatingId: shopRatingId ?? '' }
    const result = await api.api['review-reports'].post({ ...target, reason, detail })
    if (result.error) throw result.error
    return result.data
  } })
  return <div className="mt-3"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}>{t('reviewReport.report')}</Button>{open && <div id={id} className="mt-2 rounded-lg border p-3">{!session.data ? <Link className="underline" href={path('/login')}>{t('reviewReport.login')}</Link> : report.isSuccess ? <p role="status">{t('reviewReport.success')}</p> : <form className="grid gap-2" onSubmit={event => { event.preventDefault(); report.mutate() }}><label htmlFor={`${id}-reason`}>{t('reviewReport.reason')}</label><select id={`${id}-reason`} className="rounded border p-2" value={reason} onChange={event => { const next = reasons.find(value => value === event.target.value); if (next) setReason(next) }}>{reasons.map(value => <option value={value} key={value}>{t(`reviewReport.reasons.${value}`)}</option>)}</select><label htmlFor={`${id}-detail`}>{t('reviewReport.detail')}</label><textarea id={`${id}-detail`} className="min-h-20 rounded border p-2" maxLength={2000} required={reason === 'OTHER'} value={detail} onChange={event => setDetail(event.target.value)} /><Button disabled={report.isPending || (reason === 'OTHER' && !detail.trim())}>{t('reviewReport.submit')}</Button>{report.error && <p role="alert">{t('reviewReport.failed')}</p>}</form>}</div>}</div>
}
