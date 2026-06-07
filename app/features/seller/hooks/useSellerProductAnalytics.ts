"use client";

import { useQuery } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";

export type SellerProductAnalyticsRange = "7d" | "30d" | "90d" | "custom";

export interface SellerProductAnalyticsFilters {
  range: SellerProductAnalyticsRange;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

type SummaryResponse = Treaty.Data<ReturnType<typeof api.api.seller.analytics.products.summary.get>>;
type DailyResponse = Treaty.Data<ReturnType<typeof api.api.seller.analytics.products.daily.get>>;
type ProductsResponse = Treaty.Data<ReturnType<typeof api.api.seller.analytics.products.get>>;
type SkusResponse = Treaty.Data<ReturnType<typeof api.api.seller.analytics.products.skus.get>>;

export type SellerProductAnalyticsSummary = NonNullable<SummaryResponse>;
export type SellerProductAnalyticsDailyItem = NonNullable<DailyResponse>["items"][number];
export type SellerProductAnalyticsProductMetric = NonNullable<ProductsResponse>["items"][number];
export type SellerProductAnalyticsSkuMetric = NonNullable<SkusResponse>["items"][number];

export const sellerProductAnalyticsQueryKey = (filters: SellerProductAnalyticsFilters) => [
  "seller",
  "product-analytics",
  filters,
] as const;

function cleanQuery(filters: SellerProductAnalyticsFilters) {
  return {
    range: filters.range,
    from: filters.range === "custom" ? filters.from : undefined,
    to: filters.range === "custom" ? filters.to : undefined,
    q: filters.q?.trim() || undefined,
    sort: filters.sort || undefined,
    page: filters.page,
    limit: filters.limit,
  };
}

export function validateSellerProductAnalyticsRange(filters: SellerProductAnalyticsFilters) {
  if (filters.range !== "custom") return "";
  if (!filters.from || !filters.to) return "Choose both start and end dates for a custom range.";
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "Custom range dates must be valid dates.";
  if (from > to) return "Custom range start date must be before the end date.";
  return "";
}

export function useSellerProductAnalytics(filters: SellerProductAnalyticsFilters) {
  const validationError = validateSellerProductAnalyticsRange(filters);
  const query = cleanQuery(filters);

  return useQuery({
    queryKey: sellerProductAnalyticsQueryKey(filters),
    enabled: !validationError,
    queryFn: async () => {
      const [summary, daily, products, skus] = await Promise.all([
        api.api.seller.analytics.products.summary.get({ query }),
        api.api.seller.analytics.products.daily.get({ query }),
        api.api.seller.analytics.products.get({ query }),
        api.api.seller.analytics.products.skus.get({ query: { ...query, limit: 5 } }),
      ]);
      if (summary.error) throw summary.error;
      if (daily.error) throw daily.error;
      if (products.error) throw products.error;
      if (skus.error) throw skus.error;
      return {
        summary: summary.data,
        daily: daily.data?.items ?? [],
        products: products.data?.items ?? [],
        productPagination: products.data?.pagination,
        skus: skus.data?.items ?? [],
      };
    },
  });
}
