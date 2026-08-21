"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon, BarChart3Icon, ShieldAlertIcon, Undo2Icon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { useTranslations } from "#/i18n/client";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusAction } from "./AdminStatusAction";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { AdminTablePagination } from "./AdminTablePagination";
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
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(cents: number | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);
}

function textMatch(values: Array<unknown>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function FilterSelect(props: { value: string; onChange: (value: string) => void; placeholder: string; options: readonly string[] }) {
  const t = useTranslations();
  return (
    <Select value={props.value || "ALL"} onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}>
      <SelectTrigger className="h-10 w-full border-white/10 bg-slate-950/60 text-slate-100 md:w-44">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{t("admin.common.allStatuses")}</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`admin.statuses.${option}`) === `admin.statuses.${option}` ? option.replaceAll("_", " ") : t(`admin.statuses.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const t = useTranslations();
  return (
    <TableRow className="border-white/8 hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-32 text-center text-slate-400">
        {t("admin.ui.noRecords")}
      </TableCell>
    </TableRow>
  );
}

export function AdminReturnsTable() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminReturnsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateReturnStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((item: AdminReturn) =>
    textMatch([item.id, item.order.orderNumber, item.user.email, item.reason, item.status], search),
  ), [query.data, search]);

  return (
    <AdminDataShell title={t("admin.pages.returns.title")} description={t("admin.pages.returns.description")} icon={Undo2Icon} search={search} searchPlaceholder={t("admin.search.returns")} onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder={t("admin.filters.statuses")} options={RETURN_STATUSES} />}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">{t("admin.refund")}</TableHead><TableHead className="text-slate-300">{t("admin.common.buyer")}</TableHead><TableHead className="text-slate-300">{t("admin.common.items")}</TableHead><TableHead className="text-slate-300">{t("admin.status")}</TableHead><TableHead className="text-right text-slate-300">{t("admin.action")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminReturn) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.order.orderNumber}</p><p className="text-xs text-slate-500">{item.reason ?? t("admin.common.noReason")} · {formatDate(item.createdAt)}</p></TableCell>
                <TableCell><p className="text-sm text-slate-200">{item.user.name}</p><p className="text-xs text-slate-500">{item.user.email}</p></TableCell>
                <TableCell className="text-sm text-slate-300">{t("admin.common.returnCounts").replace("{items}", String(item.items.length)).replace("{refunds}", String(item.refunds.length))}</TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell className="flex justify-end"><AdminStatusAction label={item.order.orderNumber} currentStatus={item.status} options={RETURN_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: item.id, status: next })} /></TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminPayoutsTable() {
  const t = useTranslations();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminPayoutsList({ status });
  const approve = useApprovePayout();
  const reject = useRejectPayout();
  const markPaid = useMarkPayoutPaid();
  const rows = useMemo(() => (query.data ?? []).filter((item: AdminPayout) =>
    textMatch([item.id, item.shop.name, item.status, item.amount], search),
  ), [query.data, search]);

  return (
    <AdminDataShell title={t("admin.pages.payouts.title")} description={t("admin.pages.payouts.description")} icon={BanknoteIcon} search={search} searchPlaceholder={t("admin.search.payouts")} onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={setStatus} placeholder={t("admin.filters.statuses")} options={PAYOUT_STATUSES} />}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">{t("admin.shop")}</TableHead><TableHead className="text-slate-300">{t("admin.amount")}</TableHead><TableHead className="text-slate-300">{t("admin.status")}</TableHead><TableHead className="text-slate-300">{t("admin.created")}</TableHead><TableHead className="text-right text-slate-300">{t("admin.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminPayout) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.shop.name}</p><p className="text-xs text-slate-500">{item.id}</p></TableCell>
                <TableCell className="text-sm font-semibold text-slate-100">{formatMoney(item.amount, item.currency)}</TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell className="text-sm text-slate-300">{formatDate(item.requestedAt)}</TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={approve.isPending || item.status !== "requested"} onClick={() => approve.mutate(item.id)}>{t("admin.ui.approve")}</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={markPaid.isPending || item.status !== "approved"} onClick={() => { const externalReference = window.prompt(t("admin.payouts.externalReferencePrompt"))?.trim(); if (externalReference) markPaid.mutate({ id: item.id, externalReference }); }}>{t("admin.ui.paid")}</Button><Button size="sm" variant="destructive" disabled={reject.isPending || (item.status !== "requested" && item.status !== "approved")} onClick={() => { const reason = window.prompt(t("admin.payouts.rejectionReasonPrompt"))?.trim(); if (reason) reject.mutate({ id: item.id, reason }); }}>{t("admin.ui.reject")}</Button></div></TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
      </CardContent>
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
  const rows = useMemo(() => (query.data?.items ?? []).filter((item: AdminFraudCase) =>
    textMatch([item.id, item.entityType, item.entityId, item.userId, item.riskLevel, item.status, item.reasons.join(" ")], search),
  ), [query.data, search]);

  return (
    <AdminDataShell title={t("admin.pages.fraud.title")} description={t("admin.pages.fraud.description")} icon={ShieldAlertIcon} search={search} searchPlaceholder={t("admin.search.cases")} onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<><FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder={t("admin.filters.statuses")} options={FRAUD_STATUSES} /><FilterSelect value={riskLevel} onChange={(value) => { setRiskLevel(value); setPage(1); }} placeholder={t("admin.filters.risk")} options={RISK_LEVELS} /></>}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">{t("admin.entity")}</TableHead><TableHead className="text-slate-300">{t("admin.status")}</TableHead><TableHead className="text-slate-300">{t("admin.reason")}</TableHead><TableHead className="text-slate-300">{t("admin.status")}</TableHead><TableHead className="text-right text-slate-300">{t("admin.actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminFraudCase) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.entityType}</p><p className="text-xs text-slate-500">{item.entityId}</p></TableCell>
                <TableCell><p className="text-sm font-semibold text-slate-100">{item.riskScore}</p><AdminStatusBadge status={item.riskLevel} /></TableCell>
                <TableCell className="max-w-md text-sm text-slate-300">{item.reasons.join(", ") || t("admin.common.noReason")}</TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={review.isPending || item.status !== "OPEN"} onClick={() => review.mutate(item.id)}>{t("admin.ui.review")}</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"} onClick={() => resolve.mutate({ id: item.id, status: "RESOLVED" })}>{t("admin.ui.resolve")}</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"} onClick={() => resolve.mutate({ id: item.id, status: "DISMISSED" })}>{t("admin.ui.dismiss")}</Button></div></TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminReportsOverview() {
  const t = useTranslations();
  const query = useAdminReports();
  const report = query.data;
  const cards = [
    { label: t("admin.reports.grossPaidSales"), value: formatMoney(report?.sales.grossCents), detail: t("admin.reports.paidOrders").replace("{count}", String(report?.sales.paidOrderCount ?? 0)) },
    { label: t("admin.reports.averageOrder"), value: formatMoney(report?.sales.averageOrderValueCents), detail: t("admin.reports.paidOrdersOnly") },
    { label: t("admin.reports.refundExposure"), value: formatMoney(report?.refunds.totalCents), detail: t("admin.reports.pendingCount").replace("{count}", String(report?.refunds.pending ?? 0)) },
    { label: t("admin.reports.requestedPayouts"), value: formatMoney(report?.payouts.requestedCents), detail: t("admin.reports.requestCount").replace("{count}", String(report?.payouts.requested ?? 0)) },
    { label: t("admin.reports.approvedCommissions"), value: formatMoney(report?.commissions.approvedCents), detail: t("admin.reports.pendingAmount").replace("{amount}", formatMoney(report?.commissions.pendingCents)) },
    { label: t("admin.reports.activeProducts"), value: String(report?.marketplace.activeProducts ?? 0), detail: t("admin.reports.totalProducts").replace("{count}", String(report?.marketplace.products ?? 0)) },
  ];

  return (
    <AdminDataShell title={t("admin.pages.reports.title")} description={t("admin.pages.reports.description")} icon={BarChart3Icon} search="" searchPlaceholder={t("admin.pages.reports.title")} onSearchChange={() => undefined} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={null}>
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-lg border-white/10 bg-slate-950/45">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-300">{card.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold text-white">{card.value}</p><p className="mt-1 text-sm text-slate-400">{card.detail}</p></CardContent>
          </Card>
        ))}
      </CardContent>
    </AdminDataShell>
  );
}
