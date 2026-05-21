"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { fetchAdminAffiliates, updateAdminAffiliateStatus, type AdminAffiliate } from "#/features/affiliate/api";

export const PAGE_SIZE = 10;

export type AdminDashboard = Treaty.Data<ReturnType<typeof api.api.admin.dashboard.get>>;
export type AdminReports = Treaty.Data<ReturnType<typeof api.api.admin.reports.get>>;
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
export type AdminReturnsResponse = Treaty.Data<ReturnType<typeof api.api.admin.returns.get>>;
export type AdminReturn = AdminReturnsResponse extends { items: Array<infer T> } ? T : never;
export type AdminPayoutsResponse = Treaty.Data<ReturnType<typeof api.api.admin.payouts.get>>;
export type AdminPayout = AdminPayoutsResponse extends Array<infer T> ? T : never;
export type AdminFraudCasesResponse = Treaty.Data<ReturnType<typeof api.api.admin.fraud.cases.get>>;
export type AdminFraudCase = AdminFraudCasesResponse extends { items: Array<infer T> } ? T : never;
export type AdminSellerApplicationsResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["seller-applications"]["get"]>>;
export type AdminSellerApplication = AdminSellerApplicationsResponse extends Array<infer T> ? T : never;
export type { AdminAffiliate };

export interface AdminListFilters {
  page: number;
  limit?: number;
  role?: string;
  status?: string;
}

export interface AdminShopMutationInput {
  ownerId?: string;
  ownerEmail?: string;
  name?: string;
  slug?: string;
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

export function useAdminReports() {
  return useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.reports.get();
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

export function useAdminReturnsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("returns", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.returns.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminPayoutsList(filters: { status?: string } = {}) {
  return useQuery({
    queryKey: ["admin", "payouts", filters.status || "ALL"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.payouts.get({ query: { status: filters.status || undefined } });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminFraudCasesList(filters: AdminListFilters & { riskLevel?: string }) {
  return useQuery({
    queryKey: ["admin", "fraud-cases", cleanQuery(filters), filters.riskLevel || ""],
    queryFn: async () => {
      const { data, error } = await api.api.admin.fraud.cases.get({
        query: {
          ...cleanQuery(filters),
          riskLevel: filters.riskLevel || undefined,
        },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminSellerApplicationsList(status = "SUBMITTED") {
  return useQuery({
    queryKey: ["admin", "seller-applications", status],
    queryFn: async () => {
      const { data, error } = await api.api.admin["seller-applications"].get({
        query: { status: status as "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminAffiliatesList() {
  return useQuery({
    queryKey: ["admin", "affiliates"],
    queryFn: fetchAdminAffiliates,
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

export function useCreateAdminShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminShopMutationInput) => {
      const { data, error } = await api.api.admin.shops.post(input as { ownerId?: string; ownerEmail?: string; name: string; slug?: string; status?: string });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useUpdateAdminShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AdminShopMutationInput & { id: string }) => {
      const { data, error } = await api.api.admin.shops({ shopId: id }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useDeleteAdminShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.shops({ shopId: id }).delete();
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

export function useUpdateReturnStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await api.api.admin.returns({ returnId: id }).status.patch({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useApprovePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.payouts({ payoutId: id }).approve.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useRejectPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await api.api.admin.payouts({ payoutId: id }).reject.patch({ reason });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useMarkPayoutPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.payouts({ payoutId: id })["mark-paid"].patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useReviewFraudCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.fraud.cases({ caseId: id }).review.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useResolveFraudCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "RESOLVED" | "DISMISSED" }) => {
      const { data, error } = await api.api.admin.fraud.cases({ caseId: id }).resolve.patch({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export function useReviewSellerApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, rejectionReason }: { id: string; decision: "APPROVED" | "REJECTED"; rejectionReason?: string }) => {
      const { data, error } = await api.api.admin["seller-applications"]({ applicationId: id }).review.patch({ decision, rejectionReason });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin"] }),
        queryClient.invalidateQueries({ queryKey: ["seller", "application"] }),
      ]);
    },
  });
}

export function useUpdateAffiliateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminAffiliateStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] }),
  });
}
