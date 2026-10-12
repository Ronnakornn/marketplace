'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Treaty } from '@elysiajs/eden'
import { api } from '#/lib/eden'

export type AdminAccess = Treaty.Data<
  ReturnType<typeof api.api.admin.me.access.get>
>
export type TeamMember = Treaty.Data<
  ReturnType<typeof api.api.admin.team.get>
>['items'][number]
export type AccessRule = Treaty.Data<
  ReturnType<(typeof api.api.admin)['access-rules']['get']>
>['items'][number]
export type TeamInput = Parameters<
  ReturnType<typeof api.api.admin.team>['put']
>[0]
export type RuleInput = Parameters<
  (typeof api.api.admin)['access-rules']['post']
>[0]

export function useAdminAccess() {
  return useQuery({
    queryKey: ['admin', 'access'],
    queryFn: async () => {
      const result = await api.api.admin.me.access.get()
      if (result.error) throw result.error
      return result.data
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}
export function useAdminTeam(page: number) {
  return useQuery({
    queryKey: ['admin', 'team', page],
    queryFn: async () => {
      const result = await api.api.admin.team.get({
        query: { page, limit: 20 },
      })
      if (result.error) throw result.error
      return result.data
    },
  })
}
export function useSaveTeamMember() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      input,
    }: {
      userId: string
      input: TeamInput
    }) => {
      const result = await api.api.admin.team({ userId }).put(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }),
  })
}
export function useAdminAccessRules(page: number) {
  return useQuery({
    queryKey: ['admin', 'access-rules', page],
    queryFn: async () => {
      const result = await api.api.admin['access-rules'].get({
        query: { page, limit: 20 },
      })
      if (result.error) throw result.error
      return result.data
    },
  })
}
export function useSaveAccessRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: RuleInput }) => {
      const result = id
        ? await api.api.admin['access-rules']({ id }).put(input)
        : await api.api.admin['access-rules'].post(input)
      if (result.error) throw result.error
      return result.data
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'access-rules'] }),
  })
}
