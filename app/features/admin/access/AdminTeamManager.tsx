'use client'

import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useTranslations } from '#/i18n/client'
import {
  useAdminAccess,
  useAdminTeam,
  useSaveTeamMember,
  type TeamMember,
  type TeamInput,
} from './useAdminAccess'

export function AdminTeamManager() {
  const t = useTranslations()
  const [page, setPage] = useState(1)
  const team = useAdminTeam(page)
  const access = useAdminAccess()
  const save = useSaveTeamMember()
  const [userId, setUserId] = useState('')
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [input, setInput] = useState<TeamInput>({
    label: '',
    permissions: [],
    isOwner: false,
    isActive: true,
    expectedVersion: 0,
  })
  function edit(member: TeamMember) {
    setEditing(member)
    setUserId(member.userId)
    setInput({
      label: member.label,
      permissions:
        access.data?.registry.filter((permission) =>
          member.permissions.includes(permission),
        ) ?? [],
      isOwner: member.isOwner,
      isActive: member.isActive,
      expectedVersion: member.version,
    })
  }
  return (
    <div className="grid gap-5">
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-xl font-semibold">{t('admin.access.teamTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('admin.access.teamDescription')}
        </p>
        {team.isPending ? (
          <p role="status" className="mt-4">
            {t('admin.access.loading')}
          </p>
        ) : team.error ? (
          <p role="alert" className="mt-4 text-destructive">
            {t('admin.access.loadFailed')}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">{t('admin.access.member')}</th>
                  <th className="p-3">{t('admin.access.label')}</th>
                  <th className="p-3">{t('admin.access.status')}</th>
                  <th className="p-3">{t('admin.access.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {team.data?.items.map((member) => (
                  <tr key={member.id} className="border-b">
                    <td className="p-3">
                      {member.user.name}
                      <p className="text-muted-foreground">
                        {member.user.email}
                      </p>
                    </td>
                    <td className="p-3">
                      {member.label}
                      {member.isOwner ? ` (${t('admin.access.owner')})` : ''}
                    </td>
                    <td className="p-3">
                      {t(
                        member.isActive
                          ? 'admin.access.active'
                          : 'admin.access.revoked',
                      )}
                    </td>
                    <td className="p-3">
                      <Button variant="outline" onClick={() => edit(member)}>
                        {t('admin.access.edit')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!team.data?.items.length && (
              <p className="p-3">{t('admin.access.empty')}</p>
            )}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {t('admin.access.previous')}
          </Button>
          <span>{page}</span>
          <Button
            variant="outline"
            disabled={!team.data || page * 20 >= team.data.total}
            onClick={() => setPage(page + 1)}
          >
            {t('admin.access.next')}
          </Button>
          <Button variant="outline" onClick={() => team.refetch()}>
            {t('admin.access.reload')}
          </Button>
        </div>
      </section>
      <form
        className="admin-panel grid gap-4 rounded-xl p-5"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate(
            { userId, input },
            {
              onSuccess: () => {
                setEditing(null)
                setUserId('')
                setInput({
                  label: '',
                  permissions: [],
                  isOwner: false,
                  isActive: true,
                  expectedVersion: 0,
                })
              },
            },
          )
        }}
      >
        <h3 className="font-semibold">
          {t(editing ? 'admin.access.editMember' : 'admin.access.addMember')}
        </h3>
        <label className="grid gap-2">
          {t('admin.access.userId')}
          <Input
            required
            value={userId}
            disabled={Boolean(editing)}
            onChange={(event) => setUserId(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          {t('admin.access.label')}
          <Input
            required
            maxLength={100}
            value={input.label}
            onChange={(event) =>
              setInput({ ...input, label: event.target.value })
            }
          />
        </label>
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
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={input.isOwner}
            disabled={!access.data?.isOwner}
            onChange={(event) =>
              setInput({ ...input, isOwner: event.target.checked })
            }
          />
          {t('admin.access.owner')}
        </label>
        <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-3">{t('admin.access.permissions')}</legend>
          {access.data?.registry.map((permission) => (
            <label key={permission} className="flex gap-2">
              <input
                type="checkbox"
                disabled={input.isOwner}
                checked={
                  input.isOwner || input.permissions.includes(permission)
                }
                onChange={(event) =>
                  setInput({
                    ...input,
                    permissions: event.target.checked
                      ? [...input.permissions, permission]
                      : input.permissions.filter((item) => item !== permission),
                  })
                }
              />
              {t(`admin.access.permission.${permission.replace('.', '_')}`)}
            </label>
          ))}
        </fieldset>
        {save.error && (
          <p role="alert" className="text-destructive">
            {t('admin.access.saveFailed')}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending || !access.data}>
            {t('admin.access.save')}
          </Button>
          {editing && (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setEditing(null)
                setUserId('')
                setInput({
                  label: '',
                  permissions: [],
                  isOwner: false,
                  isActive: true,
                  expectedVersion: 0,
                })
                save.reset()
              }}
            >
              {t('admin.access.cancel')}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
