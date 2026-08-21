"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { fetchAdminAffiliates, updateAdminAffiliateStatus, type AdminAffiliate } from "#/features/affiliate/api";
import { adminProductsQueryOptions, invalidateProductMutationQueries, productQueryKeys } from "#/features/product/queries";

export const PAGE_SIZE = 10;

export type AdminDashboard = Treaty.Data<ReturnType<typeof api.api.admin.dashboard.get>>;
export type AdminReports = Treaty.Data<ReturnType<typeof api.api.admin.reports.get>>;
export type AdminCommissionsResponse = Treaty.Data<ReturnType<typeof api.api.admin.commissions.get>>;
export type AdminCommission = AdminCommissionsResponse extends { items: Array<infer T> } ? T : never;
export type AdminSettingsResponse = Treaty.Data<ReturnType<typeof api.api.admin.settings.get>>;
export type AdminSystemSetting = AdminSettingsResponse extends Array<infer T> ? T : never;
export type AdminUsersResponse = Treaty.Data<ReturnType<typeof api.api.admin.users.get>>;
export type AdminUser = AdminUsersResponse extends { items: Array<infer T> } ? T : never;
export type AdminShopsResponse = Treaty.Data<ReturnType<typeof api.api.admin.shops.get>>;
export type AdminShop = AdminShopsResponse extends { items: Array<infer T> } ? T : never;
export type AdminProductsResponse = Treaty.Data<ReturnType<typeof api.api.admin.products.get>>;
export type AdminProduct = AdminProductsResponse extends { items: Array<infer T> } ? T : never;
export type AdminCatalogModerationResponse = Treaty.Data<ReturnType<typeof api.api.admin.catalog.products.moderation.get>>;
export type AdminCatalogModerationProduct = AdminCatalogModerationResponse extends { data: Array<infer T> } ? T : never;
export type AdminModerationReviewsResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["content-moderation"]["reviews"]["get"]>>;
export type AdminModerationReview = AdminModerationReviewsResponse extends { items: Array<infer T> } ? T : never;
export type AdminModerationReviewReportsResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["content-moderation"]["review-reports"]["get"]>>;
export type AdminModerationReviewReport = AdminModerationReviewReportsResponse extends { items: Array<infer T> } ? T : never;
export type AdminModerationQuestionsResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["content-moderation"]["questions"]["get"]>>;
export type AdminModerationQuestion = AdminModerationQuestionsResponse extends { items: Array<infer T> } ? T : never;
export type AdminModerationAnswersResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["content-moderation"]["answers"]["get"]>>;
export type AdminModerationAnswer = AdminModerationAnswersResponse extends { items: Array<infer T> } ? T : never;
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
export type AdminBrandsResponse = Treaty.Data<ReturnType<typeof api.api.admin.brands.get>>;
export type AdminBrand = AdminBrandsResponse extends { items: Array<infer T> } ? T : never;
export type { AdminAffiliate };

export interface AdminListFilters {
  page: number;
  limit?: number;
  role?: string;
  status?: string;
  q?: string;
  shopId?: string;
  paymentState?: string;
  shipmentState?: string;
}

export interface AdminShopMutationInput {
  ownerId?: string;
  ownerEmail?: string;
  name?: string;
  slug?: string;
  status?: string;
}

export interface AdminBrandMutationInput {
  name: string;
  nameTh?: string | null;
  nameEn?: string | null;
  slug?: string;
  code?: string | null;
  description?: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  countryCode?: string | null;
  sortOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface AdminSystemSettingMutationInput {
  key: string;
  value: unknown;
  valueType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
  description?: string | null;
  isPublic?: boolean;
}

function cleanQuery(filters: AdminListFilters) {
  return Object.fromEntries(
    Object.entries({
      page: filters.page,
      limit: filters.limit ?? PAGE_SIZE,
      role: filters.role || undefined,
      status: filters.status || undefined,
      q: filters.q || undefined,
      shopId: filters.shopId || undefined,
      paymentState: filters.paymentState || undefined,
      shipmentState: filters.shipmentState || undefined,
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
  return useQuery(adminProductsQueryOptions(cleanQuery(filters)));
}

export function useAdminCatalogModerationList(filters: AdminListFilters & { q?: string }) {
  const query = Object.fromEntries(
    Object.entries({
      q: filters.q || undefined,
      status: filters.status || undefined,
      limit: filters.limit ?? PAGE_SIZE,
    }).filter(([, value]) => value !== undefined),
  );
  return useQuery({
    queryKey: ["admin", "catalog", "moderation", query],
    queryFn: async () => {
      const { data, error } = await api.api.admin.catalog.products.moderation.get({ query });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminModerationReviewsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("content-moderation-reviews", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin["content-moderation"].reviews.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminModerationReviewReportsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("content-moderation-review-reports", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin["content-moderation"]["review-reports"].get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminModerationQuestionsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("content-moderation-questions", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin["content-moderation"].questions.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminModerationAnswersList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("content-moderation-answers", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin["content-moderation"].answers.get({ query: cleanQuery(filters) });
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

export function useConfirmShipmentDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, evidenceReference }: { shipmentId: string; evidenceReference: string }) => {
      const { data, error } = await api.api.admin.shipments({ shipmentId }).deliver.patch({ evidenceReference });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
  });
}

export function useAdminCommissionsList(filters: AdminListFilters) {
  return useQuery({
    queryKey: listKey("commissions", filters),
    queryFn: async () => {
      const { data, error } = await api.api.admin.commissions.get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdminSystemSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await api.api.admin.settings.get();
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

export function useAdminBrandsList(filters: { page: number; limit?: number; q?: string; isActive?: boolean | "" }) {
  const query = Object.fromEntries(
    Object.entries({
      page: filters.page,
      limit: filters.limit ?? PAGE_SIZE,
      q: filters.q || undefined,
      isActive: filters.isActive === "" ? undefined : filters.isActive,
    }).filter(([, value]) => value !== undefined),
  );
  return useQuery({
    queryKey: ["admin", "brands", query],
    queryFn: async () => {
      const { data, error } = await api.api.admin.brands.get({ query });
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
    onSuccess: async (_data, variables) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: variables.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
    },
  });
}

export function useApproveCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).approve.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: data.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "moderation"] });
    },
  });
}

export function useRejectCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).reject.patch({ reason });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, { productId: data.id });
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "moderation"] });
    },
  });
}

export function useSuspendCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).suspend.patch({ reason });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: data.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "moderation"] });
    },
  });
}

export function useRestoreCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.admin.catalog.products({ productId: id }).restore.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateProductMutationQueries(queryClient, {
        productId: data.id,
        affectsPublic: true,
        affectsAffiliateTargets: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog", "moderation"] });
    },
  });
}

async function invalidateContentModerationQueries(queryClient: ReturnType<typeof useQueryClient>, productId?: string | null, affectsReviews = false, affectsQuestions = false) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin", "content-moderation"] }),
    productId && affectsReviews ? queryClient.invalidateQueries({ queryKey: productQueryKeys.public.reviews(productId) }) : Promise.resolve(),
    productId && affectsReviews ? queryClient.invalidateQueries({ queryKey: productQueryKeys.public.ratingSummary(productId) }) : Promise.resolve(),
    productId && affectsQuestions ? queryClient.invalidateQueries({ queryKey: productQueryKeys.public.questions(productId) }) : Promise.resolve(),
  ]);
}

export function useUpdateModerationReviewStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data, error } = await api.api.admin["content-moderation"].reviews({ reviewId: id }).status.patch({ status, note });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateContentModerationQueries(queryClient, data.product?.id, true);
    },
  });
}

export function useUpdateModerationReviewReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data, error } = await api.api.admin["content-moderation"]["review-reports"]({ reportId: id }).status.patch({ status, note });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateContentModerationQueries(queryClient, data.review?.product?.id, true);
    },
  });
}

export function useUpdateModerationQuestionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data, error } = await api.api.admin["content-moderation"].questions({ questionId: id }).status.patch({ status, note });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateContentModerationQueries(queryClient, data.product?.id, false, true);
    },
  });
}

export function useUpdateModerationAnswerStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data, error } = await api.api.admin["content-moderation"].answers({ answerId: id }).status.patch({ status, note });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateContentModerationQueries(queryClient, data.question?.product?.id, false, true);
    },
  });
}

export function useUpdateRefundStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, externalReference }: { id: string; status: string; externalReference?: string }) => {
      const { data, error } = await api.api.admin.refunds({ refundId: id }).status.patch({ status, externalReference });
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

export function useUpdateCommissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: "APPROVED" | "VOID"; reason: string }) => {
      const { data, error } = await api.api.admin.commissions({ commissionId: id }).status.patch({ status, reason });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "commissions"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
      ]);
    },
  });
}

export function useUpsertSystemSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, ...input }: AdminSystemSettingMutationInput) => {
      const { data, error } = await api.api.admin.settings({ key }).put(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }),
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
    mutationFn: async ({ id, externalReference }: { id: string; externalReference: string }) => {
      const { data, error } = await api.api.admin.payouts({ payoutId: id })["mark-paid"].patch({ externalReference });
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

export function useReviewSellerApplicationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      documentId,
      decision,
      rejectionReason,
    }: {
      applicationId: string;
      documentId: string;
      decision: "APPROVED" | "REJECTED";
      rejectionReason?: string;
    }) => {
      const { data, error } = await api.api.admin["seller-applications"]({ applicationId }).documents({ documentId }).review.patch({
        decision,
        rejectionReason,
      });
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

export function useCreateAdminBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminBrandMutationInput) => {
      const { data, error } = await api.api.admin.brands.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "brands"] }),
  });
}

export function useUpdateAdminBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AdminBrandMutationInput> & { id: string }) => {
      const { data, error } = await api.api.admin.brands({ brandId: id }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "brands"] }),
  });
}

export function useToggleAdminBrandActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const endpoint = api.api.admin.brands({ brandId: id });
      const { data, error } = isActive
        ? await endpoint.reactivate.patch()
        : await endpoint.deactivate.patch();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "brands"] }),
  });
}

export function useUpdateAffiliateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminAffiliateStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "affiliates"] }),
  });
}
