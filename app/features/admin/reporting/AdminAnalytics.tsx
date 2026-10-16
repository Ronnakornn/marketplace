"use client";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
import { ChevronDownIcon, FilterIcon, RotateCcwIcon } from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "#/components/ui/native-select";
import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "../components/AdminTable";
import { useLocalePath } from "#/i18n/navigation";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { useFormatters, useTranslations } from "#/i18n/client";
import { reportingApi, requireData } from "./api";
import { useAdminAccess } from "../access/useAdminAccess";

type AnalyticsQuery = NonNullable<
  Parameters<typeof reportingApi.api.admin.analytics.get>[0]
>["query"];
type Analytics = Treaty.Data<
  ReturnType<typeof reportingApi.api.admin.analytics.get>
>;
type Row = NonNullable<Analytics>["items"][number];
type AnalyticsFilters = NonNullable<AnalyticsQuery>;
const defaultFilters: AnalyticsFilters = {
  group: "day",
  timeZone: "Asia/Bangkok",
  page: 1,
  limit: 25,
};
const filterKeys = [
  "from",
  "to",
  "group",
  "timeZone",
  "shopId",
  "categoryId",
  "region",
] as const;
const groups = [
  "day",
  "month",
  "shop",
  "category",
  "product",
  "region",
] as const;
const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

function reportRange(period: "week" | "month", timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const start = new Date(`${today}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  if (period === "week") start.setUTCDate(start.getUTCDate() - 6);
  else start.setUTCDate(1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}
const metricColumns = [
  "gmv",
  "paidMerchandise",
  "shipping",
  "tax",
  "discount",
  "refund",
  "originalCommission",
  "contribution",
] as const;
const field =
  "rounded border border-input bg-background px-3 py-2 text-sm text-foreground";
export function AdminAnalytics({ compact = false }: { compact?: boolean }) {
  const localePath = useLocalePath();
  const access = useAdminAccess();
  const canExport =
    access.data?.permissions.includes("reports.export") ?? false;
  const canImport = access.data?.permissions.includes("catalog.read") ?? false;
  const canReadDocuments =
    access.data?.permissions.includes("orders.read") ?? false;
  const t = useTranslations(),
    format = useFormatters(),
    client = useQueryClient();
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [draft, setDraft] = useState<AnalyticsFilters>(defaultFilters);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasPendingChanges = filterKeys.some(
    (key) => draft[key] !== filters[key],
  );
  const updateDraft = (value: Partial<AnalyticsFilters>) => {
    setDraft((current) => ({ ...current, ...value }));
    setFilterError(null);
  };
  function applyFilters() {
    const shopId = draft.shopId?.trim() || undefined;
    const categoryId = draft.categoryId?.trim() || undefined;
    if (
      [shopId, categoryId].some(
        (value) => value && !new RegExp(`^${uuidPattern}$`).test(value),
      )
    ) {
      setFilterError(t("admin.reporting.filterIdError"));
      setAdvancedOpen(true);
      return;
    }
    if (draft.from && draft.to && draft.from >= draft.to) {
      setFilterError(t("admin.reporting.filterDateError"));
      return;
    }
    setFilterError(null);
    const applied = {
      ...draft,
      shopId,
      categoryId,
      region: draft.region?.trim() || undefined,
      page: 1,
    };
    setDraft(applied);
    setFilters(applied);
  }
  function resetFilters() {
    setFilters(defaultFilters);
    setDraft(defaultFilters);
    setFilterError(null);
  }
  const analytics = useQuery({
    queryKey: ["admin", "analytics", filters],
    queryFn: () =>
      requireData(reportingApi.api.admin.analytics.get({ query: filters })),
  });
  const chartFilters = { ...filters, group: "day", page: 1, limit: 100 } satisfies AnalyticsFilters;
  const charts = useQuery({
    queryKey: ["admin", "analytics-chart", chartFilters],
    queryFn: () =>
      requireData(
        reportingApi.api.admin.analytics.get({
          query: chartFilters,
        }),
      ),
  });
  const exports = useQuery({
    queryKey: ["admin", "report-exports", access.data?.userId],
    queryFn: () => requireData(reportingApi.api.admin["report-exports"].get()),
    enabled: !compact && canExport,
  });
  const exportReport = useMutation({
    mutationFn: (format: "CSV" | "XLSX") =>
      requireData(
        reportingApi.api.admin["report-exports"].post({
          type: "SALES",
          format,
          filters: filters ?? {},
        }),
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin", "report-exports"] }),
  });
  const change = (value: AnalyticsQuery) =>
    setFilters({ ...filters, ...value, page: value?.page ?? 1 });
  const chartRows = charts.data?.items ?? [],
    maximum = chartRows.reduce(
      (max, row) => (BigInt(row.gmv) > max ? BigInt(row.gmv) : max),
      0n,
    );
  const money = (row: Row, key: (typeof metricColumns)[number]) =>
    format.currency(row[key], row.currency);
  const columns: ColumnDef<Row>[] = [
    {
      id: "group",
      header: t("admin.reporting.group"),
      enableSorting: false,
      cell: ({ row }) => (
        <>
          <span>{row.original.label}</span>
          <span className="block text-xs text-muted-foreground">
            {row.original.currency}
          </span>
        </>
      ),
    },
    {
      id: "orders",
      header: t("admin.reporting.orders"),
      enableSorting: false,
      cell: ({ row }) => row.original.orders,
    },
    {
      id: "units",
      header: t("admin.reporting.units"),
      enableSorting: false,
      cell: ({ row }) => row.original.units,
    },
    ...metricColumns.map(
      (key): ColumnDef<Row> => ({
        id: key,
        header: t(`admin.reporting.${key}`),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {money(row.original, key)}
          </span>
        ),
      }),
    ),
  ];
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">
          {t("admin.reporting.analytics")}
        </h2>
        <div className="flex gap-3 text-sm">
          {canExport ? (
            <Link
              href={localePath("/admin/report-schedules")}
              className="text-cyan-200"
            >
              {t("admin.reporting.schedules")}
            </Link>
          ) : null}
          {canImport ? (
            <Link
              href={localePath("/admin/catalog/imports")}
              className="text-cyan-200"
            >
              {t("admin.reporting.imports")}
            </Link>
          ) : null}
          {canReadDocuments ? (
            <Link
              href={localePath("/admin/order-documents")}
              className="text-cyan-200"
            >
              {t("admin.reporting.documents")}
            </Link>
          ) : null}
        </div>
      </div>
      <form
        className="grid gap-4 rounded-lg border border-border bg-background p-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <FilterIcon aria-hidden="true" className="size-4" />
            {t("admin.reporting.filters")}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft(
                  reportRange("week", draft.timeZone ?? "Asia/Bangkok"),
                )
              }
            >
              {t("admin.reporting.lastSevenDays")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                updateDraft(
                  reportRange("month", draft.timeZone ?? "Asia/Bangkok"),
                )
              }
            >
              {t("admin.reporting.thisMonth")}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            {t("admin.reporting.from")}
            <Input
              aria-label={t("admin.reporting.from")}
              type="date"
              value={draft.from ?? ""}
              onChange={(event) =>
                updateDraft({ from: event.target.value || undefined })
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            {t("admin.reporting.toExclusive")}
            <Input
              aria-label={t("admin.reporting.toExclusive")}
              type="date"
              value={draft.to ?? ""}
              min={draft.from}
              onChange={(event) =>
                updateDraft({ to: event.target.value || undefined })
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            {t("admin.reporting.group")}
            <NativeSelect
              value={draft.group}
              onChange={(event) => {
                const group = groups.find(
                  (value) => value === event.target.value,
                );
                if (group) updateDraft({ group });
              }}
            >
              {groups.map((group) => (
                <NativeSelectOption key={group} value={group}>
                  {t(`admin.reporting.${group}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1.5 text-sm text-muted-foreground">
            {t("admin.reporting.timeZone")}
            <NativeSelect
              value={draft.timeZone}
              onChange={(event) =>
                updateDraft({
                  timeZone:
                    event.target.value === "UTC" ? "UTC" : "Asia/Bangkok",
                })
              }
            >
              <NativeSelectOption value="Asia/Bangkok">
                Asia/Bangkok
              </NativeSelectOption>
              <NativeSelectOption value="UTC">UTC</NativeSelectOption>
            </NativeSelect>
          </label>
        </div>
        {!compact ? (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="-ml-2">
                <ChevronDownIcon
                  aria-hidden="true"
                  className={advancedOpen ? "size-4 rotate-180" : "size-4"}
                />
                {t("admin.reporting.moreFilters")}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm text-muted-foreground">
                  {t("admin.reporting.shopId")}
                  <Input
                    value={draft.shopId ?? ""}
                    onChange={(event) =>
                      updateDraft({ shopId: event.target.value || undefined })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-muted-foreground">
                  {t("admin.reporting.categoryId")}
                  <Input
                    value={draft.categoryId ?? ""}
                    onChange={(event) =>
                      updateDraft({
                        categoryId: event.target.value || undefined,
                      })
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-muted-foreground">
                  {t("admin.reporting.region")}
                  <Input
                    value={draft.region ?? ""}
                    onChange={(event) =>
                      updateDraft({ region: event.target.value || undefined })
                    }
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("admin.reporting.advancedFilterHint")}
              </p>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
        {filterError ? (
          <p role="alert" className="text-sm text-destructive">
            {filterError}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p role="status" className="text-xs text-muted-foreground">
            {t(
              hasPendingChanges
                ? "admin.reporting.pendingFilters"
                : "admin.reporting.appliedFilters",
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcwIcon aria-hidden="true" className="size-4" />
              {t("admin.reporting.resetFilters")}
            </Button>
            <Button type="submit" disabled={!hasPendingChanges}>
              {t("admin.reporting.applyFilters")}
            </Button>
          </div>
        </div>
      </form>
      {analytics.isPending ? (
        <p role="status" className="text-slate-300">
          {t("admin.reporting.loading")}
        </p>
      ) : null}
      {analytics.error ? (
        <p role="alert" className="text-red-300">
          {analytics.error.message}
        </p>
      ) : null}
      {analytics.data?.totals.map((total) => (
        <div
          key={total.currency}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {(["gmv", "paidMerchandise", "refund", "contribution"] as const).map(
            (key) => (
              <div
                key={key}
                className="rounded border border-white/10 bg-slate-950/40 p-4"
              >
                <p className="text-sm text-slate-300">
                  {t(`admin.reporting.${key}`)} · {total.currency}
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {format.currency(total[key], total.currency)}
                </p>
              </div>
            ),
          )}
        </div>
      ))}
      {analytics.data?.totals.map((total) =>
        total.operatingContribution !== null ? (
          <p
            key={`expenses-${total.currency}`}
            className="text-sm text-slate-300"
          >
            {t("admin.reporting.recordedExpenses")}:{" "}
            {format.currency(total.recordedExpenses ?? "0", total.currency)} ·{" "}
            {t("admin.reporting.operatingContribution")}:{" "}
            {format.currency(total.operatingContribution, total.currency)}
          </p>
        ) : null,
      )}
      {analytics.data?.totals.some(
        (total) => BigInt(total.snapshotMissing) > 0n,
      ) ? (
        <p className="text-sm text-amber-200">
          {t("admin.reporting.legacyNote")}
        </p>
      ) : null}
      <div>
        <h3 className="mb-2 text-sm text-slate-300">
          {t("admin.reporting.dailyGmv")}
        </h3>
        <div
          className="flex h-32 items-end gap-1 overflow-x-auto"
          role="img"
          aria-label={t("admin.reporting.dailyGmv")}
        >
          {chartRows.map((row) => (
            <div
              key={`${row.key}-${row.currency}`}
              className="min-w-3 flex-1 rounded-t bg-primary/75"
              style={{
                height: `${maximum === 0n ? 0 : Number((BigInt(row.gmv) * 10000n) / maximum) / 100}%`,
              }}
              title={`${row.key} ${format.currency(row.gmv, row.currency)}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {t("admin.reporting.chartLimit")}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        {t("admin.reporting.metricNote")}
      </p>
      {!compact ? (
        <>
          <div className="flex gap-2">
            {canExport &&
              (["CSV", "XLSX"] as const).map((format) => (
                <Button
                  variant="outline"
                  key={format}
                  className={field}
                  disabled={exportReport.isPending || hasPendingChanges}
                  onClick={() => exportReport.mutate(format)}
                >
                  {t("admin.reporting.export")} {format}
                </Button>
              ))}
          </div>
          {exportReport.error ? (
            <p role="alert" className="text-red-300">
              {exportReport.error.message}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <AdminTable
              columns={columns}
              data={analytics.data?.items ?? []}
              hidePagination
              pagination={{
                pageIndex: (filters?.page ?? 1) - 1,
                pageSize: 25,
                totalRows: analytics.data?.items.length ?? 0,
                onPaginationChange: () => {},
              }}
            />
            {analytics.data?.items.length === 0 ? (
              <p className="py-5 text-slate-300">
                {t("admin.reporting.empty")}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={field}
              disabled={(filters?.page ?? 1) <= 1}
              onClick={() => change({ page: (filters?.page ?? 1) - 1 })}
            >
              {t("admin.reporting.previous")}
            </Button>
            <span className="text-sm text-slate-300">
              {filters?.page ?? 1} · {analytics.data?.total ?? "0"}
            </span>
            <Button
              variant="outline"
              className={field}
              disabled={
                BigInt((filters?.page ?? 1) * 25) >=
                BigInt(analytics.data?.total ?? "0")
              }
              onClick={() => change({ page: (filters?.page ?? 1) + 1 })}
            >
              {t("admin.reporting.next")}
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 font-medium text-white">
                {t("admin.reporting.searchQueries")}
              </h3>
              {analytics.data?.searchQueries.map((item) => (
                <p
                  key={item.query}
                  className="flex justify-between border-b border-white/10 py-2 text-sm text-slate-300"
                >
                  <span>{item.query}</span>
                  <span>
                    {item.count} · {t("admin.reporting.zeroResults")}{" "}
                    {item.zeroResults}
                  </span>
                </p>
              ))}
            </div>
            {canExport ? (
              <div>
                <h3 className="mb-2 font-medium text-white">
                  {t("admin.reporting.exports")}
                </h3>
                {exports.data?.map((job) => (
                  <div
                    key={job.id}
                    className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm text-slate-300"
                  >
                    <div>
                      {job.format} · {t(`admin.reporting.status.${job.status}`)}
                      {job.error ? (
                        <p className="text-red-300">{job.error}</p>
                      ) : null}
                    </div>
                    {job.status === "COMPLETED" ? (
                      <a
                        href={`/api/admin/report-exports/${job.id}/download`}
                        className="text-cyan-200"
                      >
                        {t("admin.reporting.download")}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
