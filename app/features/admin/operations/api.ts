"use client";

import { treaty, type Treaty } from "@elysiajs/eden";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { createAdminOperationsRoutes } from "#server/modules/admin-operations/operations.routes.ts";

const baseUrl =
  typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    : window.location.origin;
export const operationsApi = treaty<
  ReturnType<typeof createAdminOperationsRoutes>
>(baseUrl, { fetch: { credentials: "include" } }).api.admin.operations;
export type PolicyRows = Treaty.Data<
  ReturnType<(typeof operationsApi)["shop-policies"]["get"]>
>;
export type PolicyRow = NonNullable<PolicyRows>["items"][number];
export type ProviderRows = Treaty.Data<
  ReturnType<typeof operationsApi.shipping.providers.get>
>;
export type ProviderRow = NonNullable<ProviderRows>["items"][number];
export type RateRows = Treaty.Data<
  ReturnType<typeof operationsApi.shipping.rates.get>
>;
export type RateRow = NonNullable<RateRows>["items"][number];
export type BannerRows = Treaty.Data<
  ReturnType<typeof operationsApi.marketing.banners.get>
>;
export type BannerRow = NonNullable<BannerRows>["items"][number];
export type ContentRows = Treaty.Data<
  ReturnType<typeof operationsApi.content.pages.get>
>;
export type ContentRow = NonNullable<ContentRows>["items"][number];
export type TemplateRows = Treaty.Data<
  ReturnType<typeof operationsApi.templates.get>
>;
export type TemplateRow = NonNullable<TemplateRows>["items"][number];
export type EvidenceRows = Treaty.Data<
  ReturnType<typeof operationsApi.finance.reconciliation.get>
>;
export type EvidenceRow = NonNullable<EvidenceRows>["items"][number];
export type CycleRows = Treaty.Data<
  ReturnType<typeof operationsApi.finance.cycles.get>
>;
export type EvidenceInput = Parameters<
  typeof operationsApi.finance.reconciliation.post
>[0];
export type StatementInput = Parameters<
  typeof operationsApi.finance.statements.preview.post
>[0];
export type ProviderInput = Parameters<
  typeof operationsApi.shipping.providers.post
>[0];
export type RateInput = Parameters<typeof operationsApi.shipping.rates.post>[0];
export type BannerInput = Parameters<
  typeof operationsApi.marketing.banners.post
>[0];
export type ContentInput = Parameters<
  typeof operationsApi.content.pages.post
>[0];
export type TemplateInput = Parameters<typeof operationsApi.templates.post>[0];
export type PolicyInput = Parameters<
  ReturnType<(typeof operationsApi)["shop-policies"]>["patch"]
>[0];

export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error("EMPTY_RESPONSE");
  return result.data;
}
export function useOperationQuery<T>(
  key: readonly unknown[],
  fetcher: () => Promise<{ data: T | null; error: unknown }>,
) {
  return useQuery({
    queryKey: ["admin-operations", ...key],
    queryFn: async () => unwrap(await fetcher()),
  });
}
export function useOperationMutation<T>(
  run: (input: T) => Promise<{ data: unknown; error: unknown }>,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => unwrap(await run(input)),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["admin-operations"] }),
  });
}

export type StatementFileInput = Parameters<
  (typeof operationsApi.finance.statements)["file-import"]["post"]
>[0];
export type StatementFilePreview = Awaited<
  ReturnType<(typeof operationsApi.finance.statements)["file-preview"]["post"]>
>["data"];
