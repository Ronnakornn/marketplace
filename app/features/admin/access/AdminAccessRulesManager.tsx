'use client'

import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTranslations } from '#/i18n/client'
import {
  useAdminAccessRules,
  useSaveAccessRule,
  type AccessRule,
  type RuleInput,
} from './useAdminAccess'

const emptyRule: RuleInput = {
  subjectType: 'ACCOUNT',
  subjectValue: '',
  effect: 'DENY',
  actions: ['ALL'],
  priority: 0,
  reason: '',
  isActive: true,
  expiresAt: null,
  expectedVersion: 0,
}
const ruleActions = [
  'ALL',
  'ADMIN',
  'CHECKOUT',
  'CHAT',
  'REVIEW',
  'PROMOTION',
] satisfies RuleInput['actions']
function localDateTime(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

export function AdminAccessRulesManager() {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  const rules = useAdminAccessRules(page)
  const save = useSaveAccessRule()
  const [id, setId] = useState<string | undefined>()
  const [input, setInput] = useState<RuleInput>(emptyRule)
  function edit(rule: AccessRule) {
    if (
      !['ACCOUNT', 'IP_CIDR', 'DEVICE'].includes(rule.subjectType) ||
      !['ALLOW', 'DENY'].includes(rule.effect)
    )
      return
    setId(rule.id)
    setInput({
      subjectType:
        rule.subjectType === 'DEVICE'
          ? 'DEVICE'
          : rule.subjectType === 'IP_CIDR'
            ? 'IP_CIDR'
            : 'ACCOUNT',
      effect: rule.effect === 'ALLOW' ? 'ALLOW' : 'DENY',
      subjectValue: rule.subjectValue,
      actions: ruleActions.filter((action) => rule.actions.includes(action)),
      priority: rule.priority,
      reason: rule.reason,
      isActive: rule.isActive,
      expiresAt: rule.expiresAt ? new Date(rule.expiresAt).toISOString() : null,
      expectedVersion: rule.version,
    })
  }
  return (
    <div className="grid gap-5">
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-xl font-semibold">
          {t('admin.access.rulesTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('admin.access.precedence')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('admin.access.deviceLimit')}
        </p>
        {rules.isPending && (
          <p role="status" className="mt-4">
            {t('admin.access.loading')}
          </p>
        )}
        {rules.error && (
          <p role="alert" className="mt-4 text-destructive">
            {t('admin.access.loadFailed')}
          </p>
        )}
        <div className="mt-4 grid gap-3">
          {rules.data?.items.map((rule) => (
            <article
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium">
                  {t(`admin.access.${rule.effect.toLowerCase()}`)} ·{' '}
                  {t(`admin.access.subject.${rule.subjectType}`)}
                </p>
                <p className="break-all text-sm text-muted-foreground">
                  {rule.subjectValue}
                </p>
                <p className="text-sm">{rule.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {t('admin.access.priority')} {rule.priority} ·{' '}
                  {t(
                    rule.isActive
                      ? 'admin.access.active'
                      : 'admin.access.revoked',
                  )}
                </p>
              </div>
              <Button variant="outline" onClick={() => edit(rule)}>
                {t('admin.access.edit')}
              </Button>
            </article>
          ))}
        </div>
        {!rules.isPending && !rules.data?.items.length && (
          <p className="mt-4">{t('admin.access.empty')}</p>
        )}
        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t('admin.access.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={!rules.data || page * 20 >= rules.data.total}
            onClick={() => setPage(page + 1)}
          >
            {t('admin.access.next')}
          </Button>
          <Button variant="outline" onClick={() => rules.refetch()}>
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
                setInput(emptyRule)
              },
            },
          )
        }}
      >
        <h3 className="font-semibold">
          {t(id ? 'admin.access.editRule' : 'admin.access.addRule')}
        </h3>
        <label className="grid gap-2">
          {t('admin.access.subjectType')}
          <select
            className="rounded-md border bg-background p-2"
            value={input.subjectType}
            onChange={(event) =>
              setInput({
                ...input,
                subjectType:
                  event.target.value === 'DEVICE'
                    ? 'DEVICE'
                    : event.target.value === 'IP_CIDR'
                      ? 'IP_CIDR'
                      : 'ACCOUNT',
              })
            }
          >
            {['ACCOUNT', 'IP_CIDR', 'DEVICE'].map((value) => (
              <option key={value} value={value}>
                {t(`admin.access.subject.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          {t('admin.access.subjectValue')}
          <Input
            required
            value={input.subjectValue}
            onChange={(event) =>
              setInput({ ...input, subjectValue: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2">
          {t('admin.access.effect')}
          <select
            className="rounded-md border bg-background p-2"
            value={input.effect}
            onChange={(event) =>
              setInput({
                ...input,
                effect: event.target.value === 'ALLOW' ? 'ALLOW' : 'DENY',
              })
            }
          >
            <option value="DENY">{t('admin.access.deny')}</option>
            <option value="ALLOW">{t('admin.access.allow')}</option>
          </select>
        </label>
        <label className="grid gap-2">
          {t('admin.access.priority')}
          <Input
            type="number"
            min={0}
            max={1000}
            required
            value={input.priority}
            onChange={(event) =>
              setInput({ ...input, priority: Number(event.target.value) })
            }
          />
        </label>
        <label className="grid gap-2">
          {t('admin.access.reason')}
          <Input
            required
            minLength={3}
            maxLength={500}
            value={input.reason}
            onChange={(event) =>
              setInput({ ...input, reason: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2">
          {t('admin.access.expiry')}
          <Input
            type="datetime-local"
            value={localDateTime(input.expiresAt)}
            onChange={(event) =>
              setInput({
                ...input,
                expiresAt: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : null,
              })
            }
          />
        </label>
        <fieldset className="flex flex-wrap gap-3">
          <legend className="mb-2">{t('admin.access.actions')}</legend>
          {ruleActions.map((action) => (
            <label key={action} className="flex gap-2">
              <input
                type="checkbox"
                checked={input.actions.includes(action)}
                onChange={(event) =>
                  setInput({
                    ...input,
                    actions: event.target.checked
                      ? [...input.actions, action]
                      : input.actions.filter((item) => item !== action),
                  })
                }
              />
              {t(`admin.access.action.${action}`)}
            </label>
          ))}
        </fieldset>
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
          <Button
            type="submit"
            disabled={save.isPending || !input.actions.length}
          >
            {t('admin.access.save')}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setId(undefined)
              setInput(emptyRule)
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
