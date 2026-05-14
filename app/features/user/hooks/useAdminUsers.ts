"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import type { AppRole } from "#/lib/roles";

type GetUsersResponse = Treaty.Data<ReturnType<typeof api.api.users.get>>;
export type AdminUser = GetUsersResponse extends (infer T)[] ? T : never;

function normalizeUsers(data: unknown): AdminUser[] {
  if (Array.isArray(data)) return data as AdminUser[];
  if (
    data &&
    typeof data === "object" &&
    "data" in data &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: AdminUser[] }).data;
  }
  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: AdminUser[] }).items;
  }
  return [];
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.users.get();
      if (error) throw error;
      return normalizeUsers(data);
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; role: AppRole }) => {
      const { id, role } = params;
      const { data, error } = await api.api.admin.users({ userId: id }).role.patch({ role });
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string; email: string; password: string; role: AppRole }) => {
      const { data, error } = await api.api.admin.users.post(params);
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; name: string; email: string; role: AppRole }) => {
      const { id, ...body } = params;
      const { data, error } = await api.api.admin.users({ userId: id }).patch(body);
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.users({ userId: id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
