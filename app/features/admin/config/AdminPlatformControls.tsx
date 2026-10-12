'use client'

import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTranslations } from '#/i18n/client'
import {
  useAdminToggles,
  useSaveToggle,
  useAdminTypedSettings,
  useSaveSetting,
  type ToggleInput,
  type ToggleKey,
} from './useAdminConfig'

export function AdminPlatformControls() {
  const t = useTranslations()
  const toggles = useAdminToggles()
  const settings = useAdminTypedSettings()
  const saveToggle = useSaveToggle()
  const saveSetting = useSaveSetting()
  const [key, setKey] = useState<ToggleKey>('checkout')
  const [scope, setScope] = useState<ToggleInput['scope']>('GLOBAL')
  const [scopeId, setScopeId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const current = toggles.data?.items.find(
    (item) =>
      item.key === key &&
      item.scope === scope &&
      item.scopeId === (scope === 'GLOBAL' ? null : scopeId),
  )
  return (
    <div className="grid gap-5">
      <section className="admin-panel grid gap-4 rounded-xl p-5">
        <h2 className="text-xl font-semibold">
          {t('admin.config.controlsTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('admin.config.controlsDescription')}
        </p>
        {toggles.isPending && <p role="status">{t('admin.access.loading')}</p>}
        {toggles.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.loadFailed')}
          </p>
        )}
        <div className="grid gap-3">
          {toggles.data?.items.map((toggle) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              key={toggle.id}
            >
              <span>
                {t(`admin.config.feature.${toggle.key}`)} ·{' '}
                {t(`admin.config.scope.${toggle.scope}`)} {toggle.scopeId}
              </span>
              <Button
                variant="outline"
                disabled={saveToggle.isPending}
                onClick={() => {
                  const knownKey = toggles.data.keys.find(
                    (item) => item === toggle.key,
                  )
                  if (knownKey)
                    saveToggle.mutate({
                      key: knownKey,
                      input: {
                        scope: toggle.scope,
                        scopeId: toggle.scopeId,
                        isEnabled: !toggle.isEnabled,
                        expectedVersion: new Date(
                          toggle.updatedAt,
                        ).toISOString(),
                      },
                    })
                }}
              >
                {t(
                  toggle.isEnabled
                    ? 'admin.config.enabled'
                    : 'admin.config.disabled',
                )}
              </Button>
            </div>
          ))}
        </div>
        <form
          className="grid gap-3 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveToggle.mutate({
              key,
              input: {
                scope,
                scopeId: scope === 'GLOBAL' ? null : scopeId,
                isEnabled: enabled,
                expectedVersion: current
                  ? new Date(current.updatedAt).toISOString()
                  : null,
              },
            })
          }}
        >
          <label className="grid gap-2">
            {t('admin.config.featureLabel')}
            <select
              className="rounded-md border bg-background p-2"
              value={key}
              onChange={(event) => {
                const selected = toggles.data?.keys.find(
                  (item) => item === event.target.value,
                )
                if (selected) setKey(selected)
              }}
            >
              {toggles.data?.keys.map((item) => (
                <option value={item} key={item}>
                  {t(`admin.config.feature.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            {t('admin.config.scopeLabel')}
            <select
              className="rounded-md border bg-background p-2"
              value={scope}
              onChange={(event) =>
                setScope(
                  event.target.value === 'USER'
                    ? 'USER'
                    : event.target.value === 'SHOP'
                      ? 'SHOP'
                      : 'GLOBAL',
                )
              }
            >
              {['GLOBAL', 'SHOP', 'USER'].map((item) => (
                <option key={item} value={item}>
                  {t(`admin.config.scope.${item}`)}
                </option>
              ))}
            </select>
          </label>
          {scope !== 'GLOBAL' && (
            <label className="grid gap-2">
              {t('admin.config.scopeId')}
              <Input
                required
                value={scopeId}
                onChange={(event) => setScopeId(event.target.value)}
              />
            </label>
          )}
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            {t('admin.config.enabled')}
          </label>
          {saveToggle.error && (
            <p role="alert" className="text-destructive">
              {t('admin.access.saveFailed')}
            </p>
          )}
          <Button
            type="submit"
            disabled={saveToggle.isPending || !toggles.data}
          >
            {t('admin.access.save')}
          </Button>
        </form>
      </section>
      <section className="admin-panel grid gap-4 rounded-xl p-5">
        <h2 className="text-xl font-semibold">
          {t('admin.config.settingsTitle')}
        </h2>
        {settings.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.loadFailed')}
          </p>
        )}
        {settings.data?.map((setting) => (
          <div key={setting.key} className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">
              {t(`admin.config.setting.${setting.key.replaceAll('.', '_')}`)}
            </h3>
            {setting.key === 'catalog.approvalRequired' ? (
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={setting.value}
                  disabled={saveSetting.isPending}
                  onChange={(event) =>
                    saveSetting.mutate({
                      ...setting,
                      value: event.target.checked,
                    })
                  }
                />
                {t('admin.config.approvalRequired')}
              </label>
            ) : setting.key === 'payment.channels' ? (
              <div className="flex flex-wrap gap-4">
                {(['card', 'promptpay'] as const).map((channel) => (
                  <label key={channel} className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={setting.value[channel]}
                      disabled={saveSetting.isPending}
                      onChange={(event) =>
                        saveSetting.mutate({
                          ...setting,
                          value: {
                            ...setting.value,
                            [channel]: event.target.checked,
                          },
                        })
                      }
                    />
                    {t(`admin.config.channel.${channel}`)}
                  </label>
                ))}
                <p className="text-sm text-muted-foreground">
                  {t('admin.config.bankTransferDisabled')}
                </p>
              </div>
            ) : setting.key === 'notifications.delivery' ? (
              <div className="flex flex-wrap gap-4">
                {(['inApp', 'email', 'push'] as const).map((channel) => (
                  <label key={channel} className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={setting.value[channel]}
                      disabled={saveSetting.isPending}
                      onChange={(event) =>
                        saveSetting.mutate({
                          ...setting,
                          value: {
                            ...setting.value,
                            [channel]: event.target.checked,
                          },
                        })
                      }
                    />
                    {t(`admin.config.delivery.${channel}`)}
                  </label>
                ))}
              </div>
            ) : (
              <label className="grid gap-2">
                {t('admin.config.defaultLocale')}
                <select
                  className="rounded-md border bg-background p-2"
                  value={setting.value.locale}
                  onChange={(event) =>
                    saveSetting.mutate({
                      ...setting,
                      value: {
                        locale: event.target.value === 'en' ? 'en' : 'th',
                        currency: 'THB',
                      },
                    })
                  }
                >
                  <option value="th">{t('admin.config.thai')}</option>
                  <option value="en">{t('admin.config.english')}</option>
                </select>
              </label>
            )}
          </div>
        ))}
        {saveSetting.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.saveFailed')}
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            settings.refetch()
            toggles.refetch()
          }}
        >
          {t('admin.access.reload')}
        </Button>
      </section>
    </div>
  )
}
