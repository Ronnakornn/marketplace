"use client";

import { useMemo, useState } from "react";
import { BanknoteIcon, BarChart3Icon, ShieldAlertIcon, Undo2Icon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
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
  return (
    <Select value={props.value || "ALL"} onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}>
      <SelectTrigger className="h-10 w-full border-white/10 bg-slate-950/60 text-slate-100 md:w-44">
        <SelectValue placeholder={props.placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All {props.placeholder.toLowerCase()}</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option} value={option}>
            {option.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow className="border-white/8 hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-32 text-center text-slate-400">
        No records match the current filters.
      </TableCell>
    </TableRow>
  );
}

export function AdminReturnsTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminReturnsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateReturnStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((item: AdminReturn) =>
    textMatch([item.id, item.order.orderNumber, item.user.email, item.reason, item.status], search),
  ), [query.data, search]);

  return (
    <AdminDataShell title="Returns" description="Review return requests and resolve escalated return states." icon={Undo2Icon} search={search} searchPlaceholder="Search returns" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={RETURN_STATUSES} />}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Return</TableHead><TableHead className="text-slate-300">Buyer</TableHead><TableHead className="text-slate-300">Items</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-right text-slate-300">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminReturn) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.order.orderNumber}</p><p className="text-xs text-slate-500">{item.reason ?? "No reason"} · {formatDate(item.createdAt)}</p></TableCell>
                <TableCell><p className="text-sm text-slate-200">{item.user.name}</p><p className="text-xs text-slate-500">{item.user.email}</p></TableCell>
                <TableCell className="text-sm text-slate-300">{item.items.length} item(s), {item.refunds.length} refund(s)</TableCell>
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
    <AdminDataShell title="Payouts & Commissions" description="Approve seller payouts and monitor commission settlement pressure." icon={BanknoteIcon} search={search} searchPlaceholder="Search payouts" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={setStatus} placeholder="Statuses" options={PAYOUT_STATUSES} />}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Shop</TableHead><TableHead className="text-slate-300">Amount</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Requested</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminPayout) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.shop.name}</p><p className="text-xs text-slate-500">{item.id}</p></TableCell>
                <TableCell className="text-sm font-semibold text-slate-100">{formatMoney(item.amount, item.currency)}</TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell className="text-sm text-slate-300">{formatDate(item.requestedAt)}</TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={approve.isPending || item.status !== "requested"} onClick={() => approve.mutate(item.id)}>Approve</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={markPaid.isPending || item.status !== "approved"} onClick={() => markPaid.mutate(item.id)}>Paid</Button><Button size="sm" variant="destructive" disabled={reject.isPending || (item.status !== "requested" && item.status !== "approved")} onClick={() => reject.mutate({ id: item.id, reason: "Rejected from admin console" })}>Reject</Button></div></TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminFraudCasesTable() {
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
    <AdminDataShell title="Fraud Cases" description="Review risk cases created by fraud rules across orders, refunds, affiliates, and coupons." icon={ShieldAlertIcon} search={search} searchPlaceholder="Search cases" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<><FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={FRAUD_STATUSES} /><FilterSelect value={riskLevel} onChange={(value) => { setRiskLevel(value); setPage(1); }} placeholder="Risk" options={RISK_LEVELS} /></>}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Case</TableHead><TableHead className="text-slate-300">Risk</TableHead><TableHead className="text-slate-300">Reason</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminFraudCase) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{item.entityType}</p><p className="text-xs text-slate-500">{item.entityId}</p></TableCell>
                <TableCell><p className="text-sm font-semibold text-slate-100">{item.riskScore}</p><AdminStatusBadge status={item.riskLevel} /></TableCell>
                <TableCell className="max-w-md text-sm text-slate-300">{item.reasons.join(", ") || "No reason"}</TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={review.isPending || item.status !== "OPEN"} onClick={() => review.mutate(item.id)}>Review</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"} onClick={() => resolve.mutate({ id: item.id, status: "RESOLVED" })}>Resolve</Button><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={resolve.isPending || item.status === "RESOLVED" || item.status === "DISMISSED"} onClick={() => resolve.mutate({ id: item.id, status: "DISMISSED" })}>Dismiss</Button></div></TableCell>
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
  const query = useAdminReports();
  const report = query.data;
  const cards = [
    { label: "Gross paid sales", value: formatMoney(report?.sales.grossCents), detail: `${report?.sales.paidOrderCount ?? 0} paid orders` },
    { label: "Average order", value: formatMoney(report?.sales.averageOrderValueCents), detail: "Paid orders only" },
    { label: "Refund exposure", value: formatMoney(report?.refunds.totalCents), detail: `${report?.refunds.pending ?? 0} pending` },
    { label: "Requested payouts", value: formatMoney(report?.payouts.requestedCents), detail: `${report?.payouts.requested ?? 0} requests` },
    { label: "Approved commissions", value: formatMoney(report?.commissions.approvedCents), detail: `${formatMoney(report?.commissions.pendingCents)} pending` },
    { label: "Active products", value: String(report?.marketplace.activeProducts ?? 0), detail: `${report?.marketplace.products ?? 0} total products` },
  ];

  return (
    <AdminDataShell title="Reports" description="Derived marketplace metrics from trusted backend state." icon={BarChart3Icon} search="" searchPlaceholder="Reports" onSearchChange={() => undefined} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={null}>
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
