"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

export const PAGE_SIZE = 10;

export type AdminDashboard = Treaty.Data<ReturnType<typeof api.api.admin.dashboard.get>>;
export type AdminUsersResponse = Treaty.Data<ReturnType<typeof api.api.admin.users.get>>;
export type AdminUser = AdminUsersResponse extends { items: Array<infer T> } ? T : never;
export type AdminShopsResponse = Treaty.Data<ReturnType<typeof api.api.admin.shops.get>>;
export type AdminShop = AdminShopsResponse extends { items: Array<infer T> } ? T : never;
export type AdminProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.products.get>>;
export type AdminProduct = AdminProductsResponse extends { items: Array<infer T> } ? T : never;
export type AdminOrdersResponse = Treaty.Data<ReturnType<typeof api.api.admin.orders.get>>;
export type AdminOrder = AdminOrdersResponse extends { items: Array<infer T> } ? T : never;
export type AdminRefundsResponse = Treaty.Data<ReturnType<typeof api.api.admin.refunds.get>>;
export type AdminRefund = AdminRefundsResponse extends { items: Array<infer T> } ? T : never;

export interface AdminListFilters {
  page: number;
  limit?: number;
  role?: string;
  status?: string;
}

function cleanQuery(filters: AdminListFilters) {
  return Object.fromEntries(
    Object.entries({
      page: filters.page,
      limit: filters.limit ?? PAGE_SIZE,
      role: filters.role || undefined,
      status: filters.status || undefined,
    }).filter(([, value]) => value !== undefined),
  );
}

function listKey(resource: string, filters: AdminListFilters) {
  return ["admin", resource, cleanQuery(filters)] as const;
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.dashboard.get();
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminUsersList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("users", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.users.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminShopsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("shops", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.shops.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminProductsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("products", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.products.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminOrdersList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("orders", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.orders.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminRefundsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("refunds", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.refunds.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await api.api.admin.users({ userId: id }).status.patch({ status: status as "ACTIVE" | "SUSPENDED" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateShopStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await api.api.admin.shops({ shopId: id }).status.patch({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await api.api.admin.products({ productId: id }).status.patch({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateRefundStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await api.api.admin.refunds({ refundId: id }).status.patch({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}
