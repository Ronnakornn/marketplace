"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "./AdminTable";

import { formatMinorCurrency, type MinorUnitValue } from "#/lib/money";

import { useMemo, useState } from "react";
import { BanknoteIcon, BarChart3Icon, ShieldAlertIcon, Undo2Icon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";

import Link from "next/link";
import { useLocalePath } from "#/i18n/navigation";
import { useTranslations } from "#/i18n/client";
import { AdminDataShell } from "./AdminDataShell";
import { AdminActionDialog } from "./AdminActionDialog";
import { AdminStatusAction } from "./AdminStatusAction";
import { AdminStatusBadge } from "./AdminStatusBadge";

import {
  PAGE_SIZE,
  type AdminFraudCase,
  type AdminPayout,
  type AdminReturn,
  useAdminFraudCasesList,
  useAdminPayoutsList,
  useAdminReports,
  useAdminReturnsList,
  useApprovePayout,
  useMarkPayoutPaid,
  useRejectPayout,
  useResolveFraudCase,
  useReviewFraudCase,
  useUpdateReturnStatus,
} from "../hooks/useAdminOperations";

const RETURN_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "RECEIVED", "COMPLETED", "CANCELLED"] as const;
const PAYOUT_STATUSES = ["requested", "approved", "rejected", "paid", "cancelled"] as const;
const FRAUD_STATUSES = ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] as const;
const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatMoney(cents: MinorUnitValue | undefined, currency = "USD") {
  return formatMinorCurrency(cents ?? 0, "en-US", currency);
}

function textMatch(values: Array<unknown>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(needle),
  );
}

function FilterSelect(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  const t = useTranslations();
  return (
    <Select
      value={props.value || "ALL"}
      onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}
    >
      <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-foreground md:w-44">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{props.placeholder}</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`admin.statuses.${option}`) === `admin.statuses.${option}`
              ? option.replaceAll("_", " ")
              : t(`admin.statuses.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminReturnsTable() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminReturnsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateReturnStatus();
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((item: AdminReturn) =>
        textMatch([item.id, item.order.orderNumber, item.user.email, item.reason, item.status], search),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminReturn>[] = [
    {
      id: "refund",
      header: t("admin.refund"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">{item.order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">
              {item.reason ?? t("admin.common.noReason")} · {formatDate(item.createdAt)}
            </p>
          </div>
        );
      },
    },
    {
      id: "buyer",
      header: t("admin.common.buyer"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <Link
              href={localePath(`/admin/users/${item.user.id}`)}
              className="text-sm text-foreground underline underline-offset-4"
            >
              {item.user.name}
            </Link>
            <p className="text-xs text-muted-foreground">{item.user.email}</p>
          </div>
        );
      },
    },
    {
      id: "items",
      header: t("admin.common.items"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="text-sm text-muted-foreground">
            {t("admin.common.returnCounts")
              .replace("{items}", String(item.items.length))
              .replace("{refunds}", String(item.refunds.length))}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "action",
      header: t("admin.action"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex justify-end">
            <AdminStatusAction
              label={item.order.orderNumber}
              currentStatus={item.status}
              options={RETURN_STATUSES}
              isPending={updateStatus.isPending}
              onConfirm={(next) => updateStatus.mutate({ id: item.id, status: next })}
            />
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.returns.title")}
      description={`${t("admin.pages.returns.description")} ${t("admin.table.searchPageDescription")}`}
      icon={Undo2Icon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <FilterSelect
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          placeholder={t("admin.filters.statuses")}
          options={RETURN_STATUSES}
        />
      }
    >
      <CardContent className="p-0">
        <AdminTable
          columns={columns}
          data={rows}
          isLoading={query.isLoading}
          emptyMessage={t("admin.ui.noRecords")}
          getRowId={(item) => item.id}
          pagination={{
            pageIndex: page - 1,
            pageSize: PAGE_SIZE,
            totalRows: query.data?.pagination.total ?? 0,
            onPaginationChange: (updater) => {
              const current = { pageIndex: page - 1, pageSize: PAGE_SIZE };
              const next = typeof updater === "function" ? updater(current) : updater;
              setPage(next.pageIndex + 1);
            },
          }}
        />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminPayoutsTable() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminPayoutsList({ status });
  const approve = useApprovePayout();
  const reject = useRejectPayout();
  const markPaid = useMarkPayoutPaid();
  const [action, setAction] = useState<{ kind: "approve" | "paid" | "reject"; payout: AdminPayout } | null>(null);
  const actionPending = approve.isPending || reject.isPending || markPaid.isPending;
  const rows = useMemo(
    () =>
      (query.data ?? []).filter((item: AdminPayout) =>
        textMatch([item.id, item.shop.name, item.status, item.amount], search),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminPayout>[] = [
    {
      id: "shop",
      header: t("admin.shop"),
      accessorFn: (item) => item.shop.name,
      enableSorting: true,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <Link
              href={localePath(`/admin/shops/${item.shop.id}`)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {item.shop.name}
            </Link>
            <p className="text-xs text-muted-foreground">{item.id}</p>
          </div>
        );
      },
    },
    {
      id: "amount",
      header: t("admin.amount"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="text-sm font-semibold text-foreground">
            {formatMoney(item.amount, item.currency)}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.status"),
      accessorFn: (item) => item.status,
      enableSorting: true,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.created"),
      accessorFn: (item) => new Date(item.requestedAt).getTime(),
      enableSorting: true,
      cell: ({ row }) => {
        const item = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(item.requestedAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={actionPending || item.status !== "requested"}
                onClick={() => setAction({ kind: "approve", payout: item })}
              >
                {t("admin.ui.approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={actionPending || item.status !== "approved"}
                onClick={() => setAction({ kind: "paid", payout: item })}
              >
                {t("admin.ui.paid")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={actionPending || (item.status !== "requested" && item.status !== "approved")}
                onClick={() => setAction({ kind: "reject", payout: item })}
              >
                {t("admin.ui.reject")}
              </Button>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.payouts.title")}
      description={t("admin.pages.payouts.description")}
      icon={BanknoteIcon}
      search={search}
      searchPlaceholder={t("admin.search.payouts")}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder={t("admin.filters.statuses")}
          options={PAYOUT_STATUSES}
        />
      }
    >
      <CardContent className="p-0">
        <AdminTable
          columns={columns}
          data={rows}
          isLoading={query.isLoading}
          emptyMessage={t("admin.ui.noRecords")}
          getRowId={(item) => item.id}
        />
      </CardContent>
      {action ? (
        <AdminActionDialog
          key={`${action.kind}-${action.payout.id}`}
          action={t(action.kind === "approve" ? "admin.ui.approve" : action.kind === "paid" ? "admin.ui.paid" : "admin.ui.reject")}
          description={t(action.kind === "approve" ? "admin.financialAction.approvePayoutHint" : action.kind === "paid" ? "admin.financialAction.markPaidHint" : "admin.financialAction.rejectPayoutHint")}
          target={action.payout.shop.name}
          recordId={action.payout.id}
          amount={formatMoney(action.payout.amount, action.payout.currency)}
          currency={action.payout.currency}
          destructive={action.kind === "reject"}
          isPending={actionPending}
          field={action.kind === "approve" ? undefined : {
            label: t(action.kind === "paid" ? "admin.financialAction.externalReference" : "admin.financialAction.reason"),
            helper: t(action.kind === "paid" ? "admin.financialAction.externalReferenceHint" : "admin.financialAction.reasonHint"),
            minLength: 1,
            maxLength: action.kind === "paid" ? 200 : 500,
            multiline: action.kind === "reject",
          }}
          onClose={() => setAction(null)}
          onConfirm={(value) => {
            if (action.kind === "approve") return approve.mutateAsync(action.payout.id);
            if (action.kind === "paid") return markPaid.mutateAsync({ id: action.payout.id, externalReference: value });
            return reject.mutateAsync({ id: action.payout.id, reason: value });
          }}
        />
      ) : null}
    </AdminDataShell>
  );
}

export function AdminFraudCasesTable() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminFraudCasesList({ page, limit: PAGE_SIZE, status, riskLevel });
  const review = useReviewFraudCase();
  const resolve = useResolveFraudCase();
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((item: AdminFraudCase) =>
        textMatch(
          [
            item.id,
            item.entityType,
            item.entityId,
            item.userId,
            item.riskLevel,
            item.status,
            item.reasons.join(" "),
          ],
          search,
        ),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminFraudCase>[] = [
    {
      id: "entity",
      header: t("admin.entity"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">{item.entityType}</p>
            <p className="text-xs text-muted-foreground">{item.entityId}</p>
          </div>
        );
      },
    },
    {
      id: "risk",
      header: t("admin.filters.risk"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm font-semibold text-foreground">{item.riskScore}</p>
            <AdminStatusBadge status={item.riskLevel} />
          </div>
        );
      },
    },
    {
      id: "reason",
      header: t("admin.reason"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="max-w-md text-sm text-muted-foreground">
            {item.reasons.join(", ") || t("admin.common.noReason")}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t("admin.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={review.isPending || item.status !== "OPEN"}
                onClick={() => review.mutate(item.id)}
              >
                {t("admin.ui.review")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"}
                onClick={() => resolve.mutate({ id: item.id, status: "RESOLVED" })}
              >
                {t("admin.ui.resolve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"}
                onClick={() => resolve.mutate({ id: item.id, status: "DISMISSED" })}
              >
                {t("admin.ui.dismiss")}
              </Button>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.fraud.title")}
      description={`${t("admin.pages.fraud.description")} ${t("admin.table.searchPageDescription")}`}
      icon={ShieldAlertIcon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <>
          <FilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.statuses")}
            options={FRAUD_STATUSES}
          />
          <FilterSelect
            value={riskLevel}
            onChange={(value) => {
              setRiskLevel(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.risk")}
            options={RISK_LEVELS}
          />
        </>
      }
    >
      <CardContent className="p-0">
        <AdminTable
          columns={columns}
          data={rows}
          isLoading={query.isLoading}
          emptyMessage={t("admin.ui.noRecords")}
          getRowId={(item) => item.id}
          pagination={{
            pageIndex: page - 1,
            pageSize: PAGE_SIZE,
            totalRows: query.data?.pagination.total ?? 0,
            onPaginationChange: (updater) => {
              const current = { pageIndex: page - 1, pageSize: PAGE_SIZE };
              const next = typeof updater === "function" ? updater(current) : updater;
              setPage(next.pageIndex + 1);
            },
          }}
        />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminReportsOverview() {
  const t = useTranslations();
  const query = useAdminReports();
  const report = query.data;
  const cards = [
    {
      label: t("admin.reports.grossPaidSales"),
      value: formatMoney(report?.sales.grossCents),
      detail: t("admin.reports.paidOrders").replace("{count}", String(report?.sales.paidOrderCount ?? 0)),
    },
    {
      label: t("admin.reports.averageOrder"),
      value: formatMoney(report?.sales.averageOrderValueCents),
      detail: t("admin.reports.paidOrdersOnly"),
    },
    {
      label: t("admin.reports.refundExposure"),
      value: formatMoney(report?.refunds.totalCents),
      detail: t("admin.reports.pendingCount").replace("{count}", String(report?.refunds.pending ?? 0)),
    },
    {
      label: t("admin.reports.requestedPayouts"),
      value: formatMoney(report?.payouts.requestedCents),
      detail: t("admin.reports.requestCount").replace("{count}", String(report?.payouts.requested ?? 0)),
    },
    {
      label: t("admin.reports.approvedCommissions"),
      value: formatMoney(report?.commissions.approvedCents),
      detail: t("admin.reports.pendingAmount").replace(
        "{amount}",
        formatMoney(report?.commissions.pendingCents),
      ),
    },
    {
      label: t("admin.reports.activeProducts"),
      value: String(report?.marketplace.activeProducts ?? 0),
      detail: t("admin.reports.totalProducts").replace("{count}", String(report?.marketplace.products ?? 0)),
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.reports.title")}
      description={t("admin.pages.reports.description")}
      icon={BarChart3Icon}
      search=""
      searchPlaceholder={t("admin.pages.reports.title")}
      onSearchChange={() => undefined}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={null}
    >
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-lg border-border bg-muted/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </AdminDataShell>
  );
}
