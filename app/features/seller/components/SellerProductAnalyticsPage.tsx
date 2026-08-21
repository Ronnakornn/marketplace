"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3Icon, BoxesIcon, RefreshCwIcon, SearchIcon, ShoppingCartIcon, TrendingDownIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import { Input } from "#/components/ui/input";
import { SellerPageHeader } from "./SellerShell";
import { useTranslations } from "#/i18n/client";
import {
  type SellerProductAnalyticsFilters,
  type SellerProductAnalyticsProductMetric,
  type SellerProductAnalyticsRange,
  type SellerProductAnalyticsSkuMetric,
  useSellerProductAnalytics,
  validateSellerProductAnalyticsRange,
} from "../hooks/useSellerProductAnalytics";

const rangeOptions: SellerProductAnalyticsRange[] = ["7d", "30d", "90d", "custom"];

export function SellerProductAnalyticsPage() {
  const t = useTranslations();
  const [filters, setFilters] = useState<SellerProductAnalyticsFilters>({ range: "30d", sort: "revenue", page: 1, limit: 20 });
  const validationError = validateSellerProductAnalyticsRange(filters);
  const query = useSellerProductAnalytics(filters);
  const data = query.data;
  const summary = data?.summary;
  const isEmpty = !query.isLoading && !validationError && !summary?.views && !summary?.addToCart && !summary?.orders && !summary?.unitsSold && !summary?.revenue;

  const maxTrendValue = useMemo(() => Math.max(1, ...(data?.daily ?? []).map((item) => Math.max(item.views, item.addToCart, item.orders))), [data?.daily]);
  const productColumns = useMemo<ColumnDef<SellerProductAnalyticsProductMetric>[]>(() => [
    {
      id: "product",
      header: t("seller.analytics.product"),
      cell: ({ row }) => <div className="min-w-64"><Link href={`/seller/products/${row.original.productId}`} className="font-semibold text-slate-950 no-underline">{row.original.title}</Link><p className="text-xs text-slate-500">{row.original.shop.name} / {row.original.status}</p></div>,
    },
    { accessorKey: "views", header: t("seller.analytics.views"), cell: ({ row }) => formatNumber(row.original.views) },
    { accessorKey: "addToCart", header: t("seller.analytics.addToCart"), cell: ({ row }) => formatNumber(row.original.addToCart) },
    { accessorKey: "orders", header: t("seller.analytics.orders"), cell: ({ row }) => formatNumber(row.original.orders) },
    { accessorKey: "unitsSold", header: t("seller.analytics.units"), cell: ({ row }) => formatNumber(row.original.unitsSold) },
    { accessorKey: "revenue", header: t("seller.analytics.revenue"), cell: ({ row }) => formatMoney(row.original.revenue, row.original.currency) },
    { accessorKey: "conversionRate", header: t("seller.analytics.conversion"), cell: ({ row }) => formatRate(row.original.conversionRate) },
  ], [t]);

  function setRange(range: SellerProductAnalyticsRange) {
    setFilters((current) => ({ ...current, range, page: 1 }));
  }

  function setCustomDate(key: "from" | "to", value: string) {
    setFilters((current) => ({ ...current, [key]: value, range: "custom", page: 1 }));
  }

  function submitSearch(formData: FormData) {
    setFilters((current) => ({ ...current, q: String(formData.get("q") ?? ""), page: 1 }));
  }

  return (
    <>
      <SellerPageHeader title={t("seller.analytics.title")} description={t("seller.analytics.description")} />

      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("seller.analytics.dateRange")}>
              {rangeOptions.map((option) => (
                <Button key={option} type="button" variant={filters.range === option ? "default" : "outline"} onClick={() => setRange(option)}>
                  {option === "7d" ? t("seller.analytics.days7") : option === "30d" ? t("seller.analytics.days30") : option === "90d" ? t("seller.analytics.days90") : t("seller.analytics.custom")}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                {t("seller.analytics.startDate")}
                <Input type="date" value={filters.from ?? ""} onChange={(event) => setCustomDate("from", event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                {t("seller.analytics.endDate")}
                <Input type="date" value={filters.to ?? ""} onChange={(event) => setCustomDate("to", event.target.value)} />
              </label>
            </div>
            {validationError ? <p className="text-sm font-medium text-red-700">{validationError}</p> : null}
          </div>
          <form action={submitSearch} className="flex min-w-0 gap-2">
            <Input name="q" aria-label={t("seller.analytics.searchAnalytics")} placeholder={t("seller.analytics.searchProduct")} defaultValue={filters.q ?? ""} />
            <Button type="submit" variant="outline"><SearchIcon className="size-4" />{t("seller.analytics.search")}</Button>
          </form>
        </CardContent>
      </Card>

      {query.error ? <AnalyticsErrorState error={query.error} retry={() => void query.refetch()} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label={t("seller.analytics.views")} value={formatNumber(summary?.views)} loading={query.isLoading} />
        <KpiCard label={t("seller.analytics.addToCart")} value={formatNumber(summary?.addToCart)} loading={query.isLoading} />
        <KpiCard label={t("seller.analytics.orders")} value={formatNumber(summary?.orders)} loading={query.isLoading} />
        <KpiCard label={t("seller.analytics.unitsSold")} value={formatNumber(summary?.unitsSold)} loading={query.isLoading} />
        <KpiCard label={t("seller.analytics.revenue")} value={formatMoney(summary?.revenue, summary?.currency)} loading={query.isLoading} />
        <KpiCard label={t("seller.analytics.conversion")} value={formatRate(summary?.conversionRate)} loading={query.isLoading} />
      </section>

      {isEmpty ? <EmptyState message={t("seller.analytics.emptyRange")} /> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><BarChart3Icon className="size-4 text-emerald-600" />{t("seller.analytics.dailyTrend")}</CardTitle>
            {query.isLoading ? <span className="text-sm text-slate-500">{t("seller.analytics.loadingChart")}</span> : null}
          </CardHeader>
          <CardContent>
            {data?.daily.length ? (
              <div className="h-72 overflow-x-auto">
                <div className="flex h-full min-w-[620px] items-end gap-2 border-b border-l border-slate-200 px-3 pb-6">
                  {data.daily.map((item) => (
                    <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-52 w-full items-end justify-center gap-1">
                        <TrendBar label={t("seller.analytics.trendViews").replace("{date}", item.date)} value={item.views} max={maxTrendValue} className="bg-slate-700" />
                        <TrendBar label={t("seller.analytics.trendAddToCart").replace("{date}", item.date)} value={item.addToCart} max={maxTrendValue} className="bg-emerald-600" />
                        <TrendBar label={t("seller.analytics.trendOrders").replace("{date}", item.date)} value={item.orders} max={maxTrendValue} className="bg-amber-500" />
                      </div>
                      <span className="w-16 truncate text-center text-[11px] text-slate-500">{formatTrendDate(item.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState message={query.isLoading ? t("seller.analytics.loadingDailyTrend") : t("seller.analytics.emptyDailyTrend")} />}
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShoppingCartIcon className="size-4 text-emerald-600" />{t("seller.analytics.topSkus")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(summary?.topSkus?.length ? summary.topSkus : data?.skus ?? []).length ? (summary?.topSkus?.length ? summary.topSkus : data?.skus ?? []).map((sku) => (
              <SkuRow key={sku.variantId} sku={sku} />
            )) : <EmptyState message={query.isLoading ? t("seller.analytics.loadingSkus") : t("seller.analytics.emptySkus")} />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BoxesIcon className="size-4 text-emerald-600" />{t("seller.analytics.performance")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <DataTable columns={productColumns} data={data?.products ?? []} isLoading={query.isLoading} loadingMessage={t("seller.analytics.loadingProducts")} emptyMessage={t("seller.analytics.emptyProducts")} pageSize={10} className="overflow-x-auto" labels={{ showing: t("common.showing"), of: t("common.of"), rows: t("common.rows"), previous: t("common.previous"), next: t("common.next"), previousPage: t("common.previousPage"), nextPage: t("common.nextPage"), sortBy: t("common.sortBy") }} />
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingDownIcon className="size-4 text-amber-600" />{t("seller.analytics.lowPerforming")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {summary?.lowPerformingProducts?.length ? summary.lowPerformingProducts.map((product) => (
              <div key={product.productId} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{product.title}</p>
                    <p className="text-xs text-slate-500">{t("seller.analytics.lowPerformerSummary").replace("{views}", formatNumber(product.views)).replace("{conversion}", formatRate(product.conversionRate))}</p>
                  </div>
                  <Link href={`/seller/products/${product.productId}`} className="shrink-0 text-xs font-semibold text-emerald-700 no-underline">{t("seller.analytics.tune")}</Link>
                </div>
              </div>
            )) : <EmptyState message={query.isLoading ? t("seller.analytics.loadingLowPerformers") : t("seller.analytics.emptyLowPerformers")} />}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function KpiCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white">
      <CardContent className="pt-6">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{loading ? "..." : value}</p>
      </CardContent>
    </Card>
  );
}

function TrendBar({ label, value, max, className }: { label: string; value: number; max: number; className: string }) {
  return <div role="img" aria-label={`${label}: ${value}`} className={`w-3 rounded-t ${className}`} style={{ height: `${Math.max(4, (value / max) * 100)}%` }} />;
}

function SkuRow({ sku }: { sku: SellerProductAnalyticsSkuMetric }) {
  const t = useTranslations();
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{sku.sku}</p>
          <p className="truncate text-xs text-slate-500">{sku.productTitle} / {sku.title}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-950">{formatMoney(sku.revenue, sku.currency)}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">{t("seller.analytics.skuSummary").replace("{units}", formatNumber(sku.unitsSold)).replace("{orders}", formatNumber(sku.orders))}</p>
    </div>
  );
}

function AnalyticsErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-red-700">{error instanceof Error ? error.message : t("seller.analytics.loadError")}</p>
        <Button type="button" variant="outline" onClick={retry}><RefreshCwIcon className="size-4" />{t("common.retry")}</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatMoney(cents: number | null | undefined, currency: string | null | undefined = "THB") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "THB" }).format(Number(cents ?? 0) / 100);
}

function formatRate(value: number | null | undefined) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value ?? 0)}%`;
}

function formatTrendDate(value: unknown) {
  if (typeof value === "string") return value.slice(5);
  if (value instanceof Date) return value.toISOString().slice(5);
  return String(value ?? "").slice(5);
}
