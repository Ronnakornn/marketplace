'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { useTranslations } from '#/i18n/client'
import { useLocalePath } from '#/i18n/navigation'
import { createAppeal, createSupport } from '../api'
import { SupportError, SupportFrame } from './SupportShared'

export type SupportCreateContext = { kind: 'ticket'; orderId?: string; shopId?: string } | { kind: 'appeal'; returnRequestId: string; orderId: string }

export function SupportCreateForm({ context }: { context: SupportCreateContext }) {
  const t = useTranslations()
  const localePath = useLocalePath()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [subject, setSubject] = useState(context.kind === 'appeal' ? t('support.returnAppeal') : '')
  const [body, setBody] = useState('')
  const pending = useRef(false)
  const mutation = useMutation({
    mutationFn: () => context.kind === 'appeal' ? createAppeal({ returnRequestId: context.returnRequestId, subject, body }) : createSupport({ subject, body, orderId: context.orderId, shopId: context.shopId }),
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ['support'] })
      router.push(localePath(`/support/${ticket.id}`))
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    mutation.mutate(undefined, { onSettled: () => { pending.current = false } })
  }
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <p className="text-sm text-slate-600">{t('support.textEvidenceOnly')}</p>
    <div><label htmlFor="support-subject" className="mb-2 block text-sm font-medium">{t('support.subject')}</label><input id="support-subject" className="w-full rounded-lg border border-slate-300 p-3" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} /></div>
    <div><label htmlFor="support-evidence" className="mb-2 block text-sm font-medium">{t('support.textEvidence')}</label><textarea id="support-evidence" className="min-h-40 w-full rounded-lg border border-slate-300 p-3" value={body} onChange={(event) => setBody(event.target.value)} required maxLength={5000} /></div>
    {mutation.isError ? <SupportError /> : null}
    <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={mutation.isPending || !subject.trim() || !body.trim()}>{mutation.isPending ? t('support.saving') : context.kind === 'appeal' ? t('support.submitAppeal') : t('support.createTicket')}</Button>
  </form>
}

export function SupportCreatePage({ orderId, shopId }: { orderId?: string; shopId?: string }) {
  const t = useTranslations()
  const localePath = useLocalePath()
  return <SupportFrame role="buyer">
    <Link href={localePath(orderId ? `/orders/${orderId}/support` : '/support')} className="text-sm font-medium text-orange-700">{t('support.back')}</Link>
    <h1 className="text-2xl font-bold">{t('support.createTicket')}</h1>
    <SupportCreateForm context={{ kind: 'ticket', orderId, shopId }} />
  </SupportFrame>
}
