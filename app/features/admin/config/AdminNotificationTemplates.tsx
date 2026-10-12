'use client'

import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTranslations } from '#/i18n/client'
import {
  useAdminTemplates,
  useSaveTemplate,
  type TemplateInput,
  type Template,
} from './useAdminConfig'

const empty: TemplateInput = {
  key: '',
  channel: 'IN_APP',
  locale: 'th',
  subject: null,
  body: '',
  isActive: true,
  expectedVersion: null,
}

export function AdminNotificationTemplates() {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  const templates = useAdminTemplates(page)
  const save = useSaveTemplate()
  const [id, setId] = useState<string | undefined>()
  const [input, setInput] = useState<TemplateInput>(empty)
  function edit(template: Template) {
    setId(template.id)
    setInput({
      key: template.key,
      channel: template.channel,
      locale: template.locale === 'en' ? 'en' : 'th',
      subject: template.subject,
      body: template.body,
      isActive: template.isActive,
      expectedVersion: new Date(template.updatedAt).toISOString(),
    })
  }
  return (
    <div className="grid gap-5">
      <section className="admin-panel grid gap-4 rounded-xl p-5">
        <h2 className="text-xl font-semibold">
          {t('admin.config.templatesTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.config.templateDescription')}
        </p>
        {templates.isPending && (
          <p role="status">{t('admin.access.loading')}</p>
        )}
        {templates.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.loadFailed')}
          </p>
        )}
        {templates.data?.items.map((template) => (
          <article
            key={template.id}
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
          >
            <div>
              <h3 className="font-semibold">{template.key}</h3>
              <p className="text-sm text-muted-foreground">
                {t(`admin.config.templateChannel.${template.channel}`)} ·{' '}
                {t(
                  template.locale === 'en'
                    ? 'admin.config.english'
                    : 'admin.config.thai',
                )}{' '}
                ·{' '}
                {t(
                  template.isActive
                    ? 'admin.access.active'
                    : 'admin.access.revoked',
                )}
              </p>
              <p className="mt-2 line-clamp-2 text-sm">{template.body}</p>
            </div>
            <Button variant="outline" onClick={() => edit(template)}>
              {t('admin.access.edit')}
            </Button>
          </article>
        ))}
        <div className="flex gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t('admin.access.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={!templates.data || page * 20 >= templates.data.total}
            onClick={() => setPage(page + 1)}
          >
            {t('admin.access.next')}
          </Button>
          <Button variant="outline" onClick={() => templates.refetch()}>
            {t('admin.access.reload')}
          </Button>
        </div>
      </section>
      <form
        className="admin-panel grid gap-4 rounded-xl p-5"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(
            { id, input },
            {
              onSuccess: () => {
                setId(undefined)
                setInput(empty)
              },
            },
          )
        }}
      >
        <h3 className="font-semibold">{t('admin.config.editTemplate')}</h3>
        <label className="grid gap-2">
          {t('admin.config.templateKey')}
          <Input
            required
            value={input.key}
            onChange={(event) =>
              setInput({ ...input, key: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2">
          {t('admin.config.templateChannelLabel')}
          <select
            className="rounded-md border bg-background p-2"
            value={input.channel}
            onChange={(event) => {
              const selected = (
                [
                  'IN_APP',
                  'EMAIL',
                  'PUSH',
                  'SMS',
                  'LINE',
                ] satisfies TemplateInput['channel'][]
              ).find((value) => value === event.target.value)
              if (selected) setInput({ ...input, channel: selected })
            }}
          >
            {['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'LINE'].map((value) => (
              <option key={value} value={value}>
                {t(`admin.config.templateChannel.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          {t('admin.config.defaultLocale')}
          <select
            className="rounded-md border bg-background p-2"
            value={input.locale}
            onChange={(event) =>
              setInput({
                ...input,
                locale: event.target.value === 'en' ? 'en' : 'th',
              })
            }
          >
            <option value="th">{t('admin.config.thai')}</option>
            <option value="en">{t('admin.config.english')}</option>
          </select>
        </label>
        <label className="grid gap-2">
          {t('admin.config.subject')}
          <Input
            maxLength={200}
            value={input.subject ?? ''}
            onChange={(event) =>
              setInput({ ...input, subject: event.target.value || null })
            }
          />
        </label>
        <label className="grid gap-2">
          {t('admin.config.body')}
          <textarea
            required
            maxLength={10000}
            rows={6}
            className="rounded-md border bg-background p-3"
            value={input.body}
            onChange={(event) =>
              setInput({ ...input, body: event.target.value })
            }
          />
        </label>
        <p className="text-sm text-muted-foreground">
          {t('admin.config.templateVariables')}
        </p>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={input.isActive}
            onChange={(event) =>
              setInput({ ...input, isActive: event.target.checked })
            }
          />
          {t('admin.access.active')}
        </label>
        {save.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.saveFailed')}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending}>
            {t('admin.access.save')}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setId(undefined)
              setInput(empty)
              save.reset()
            }}
          >
            {t('admin.access.cancel')}
          </Button>
        </div>
      </form>
    </div>
  )
}
