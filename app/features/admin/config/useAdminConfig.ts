'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Treaty } from '@elysiajs/eden'
import { api } from '#/lib/eden'

export type ToggleKey = Treaty.Data<
  ReturnType<typeof api.api.admin.config.toggles.get>
>['keys'][number]
export type ToggleInput = Parameters<
  ReturnType<typeof api.api.admin.config.toggles>['put']
>[0]
export type SettingInput = Parameters<
  typeof api.api.admin.config.settings.put
>[0]
export type TemplateInput = Parameters<
  typeof api.api.admin.config.templates.post
>[0]
export type Template = Treaty.Data<
  ReturnType<typeof api.api.admin.config.templates.get>
>['items'][number]

export function useAdminToggles() {
  return useQuery({
    queryKey: ['admin', 'toggles'],
    queryFn: async () => {
      const result = await api.api.admin.config.toggles.get()
      if (result.error) throw result.error
      return result.data
    },
  })
}
export function useAdminTypedSettings() {
  return useQuery({
    queryKey: ['admin', 'typed-settings'],
    queryFn: async () => {
      const result = await api.api.admin.config.settings.get()
      if (result.error) throw result.error
      return result.data
    },
  })
}
export function useSaveToggle() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      key,
      input,
    }: {
      key: ToggleKey
      input: ToggleInput
    }) => {
      const result = await api.api.admin.config.toggles({ key }).put(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'toggles'] }),
  })
}
export function useSaveSetting() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: SettingInput) => {
      const result = await api.api.admin.config.settings.put(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'typed-settings'] }),
  })
}
export function useAdminTemplates(page: number) {
  return useQuery({
    queryKey: ['admin', 'templates', page],
    queryFn: async () => {
      const result = await api.api.admin.config.templates.get({
        query: { page, limit: 20 },
      })
      if (result.error) throw result.error
      return result.data
    },
  })
}
export function useSaveTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string
      input: TemplateInput
    }) => {
      const result = id
        ? await api.api.admin.config.templates({ id }).put(input)
        : await api.api.admin.config.templates.post(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'templates'] }),
  })
}
