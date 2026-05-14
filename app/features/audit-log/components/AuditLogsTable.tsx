"use client";

import { useMemo, useState } from "react";
import { FileClockIcon } from "lucide-react";
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { AdminDataShell } from "#/features/admin/components/AdminDataShell";
import { AdminStatusBadge } from "#/features/admin/components/AdminStatusBadge";
import { AdminTablePagination } from "#/features/admin/components/AdminTablePagination";
import { PAGE_SIZE } from "#/features/admin/hooks/useAdminOperations";
import { type AuditLog, useAuditLogs } from "../hooks/useAuditLogs";

const ACTIONS = [
  "USER_STATUS_CHANGED",
  "SHOP_STATUS_CHANGED",
  "PRODUCT_STATUS_CHANGED",
  "ORDER_STATUS_CHANGED",
  "SHIPMENT_STATUS_CHANGED",
  "REFUND_STATUS_CHANGED",
  "RETURN_STATUS_CHANGED",
  "ADMIN_LOGIN",
  "ADMIN_CONFIG_CHANGED",
] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function textMatch(values: Array<unknown>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

export function AuditLogsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actorUserId, setActorUserId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useAuditLogs({ actorUserId, action, entityType, entityId, from, to, page, limit: PAGE_SIZE });
  const rows = useMemo(() => (query.data?.items ?? []).filter((log: AuditLog) => textMatch([log.actorUserId, log.action, log.entityType, log.entityId], search)), [query.data, search]);

  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <AdminDataShell
      title="Audit Logs"
      description="Read-only trail of administrator actions and sensitive status changes."
      icon={FileClockIcon}
      search={search}
      searchPlaceholder="Search visible logs"
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <div className="grid w-full gap-2 md:grid-cols-3 xl:w-[680px]">
          <Input value={actorUserId} onChange={(event) => resetPage(setActorUserId)(event.target.value)} placeholder="Actor ID" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500" />
          <Input value={entityType} onChange={(event) => resetPage(setEntityType)(event.target.value)} placeholder="Entity type" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500" />
          <Input value={entityId} onChange={(event) => resetPage(setEntityId)(event.target.value)} placeholder="Entity ID" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500" />
          <Input type="date" value={from} onChange={(event) => resetPage(setFrom)(event.target.value)} className="border-white/10 bg-slate-950/60 text-slate-100" />
          <Input type="date" value={to} onChange={(event) => resetPage(setTo)(event.target.value)} className="border-white/10 bg-slate-950/60 text-slate-100" />
          <Select value={action || "ALL"} onValueChange={(value) => resetPage(setAction)(value === "ALL" ? "" : value)}>
            <SelectTrigger className="border-white/10 bg-slate-950/60 text-slate-100"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              {ACTIONS.map((item) => <SelectItem key={item} value={item}>{item.replaceAll("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">Action</TableHead>
              <TableHead className="text-slate-300">Actor</TableHead>
              <TableHead className="text-slate-300">Entity</TableHead>
              <TableHead className="text-slate-300">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((log: AuditLog) => (
              <TableRow key={log.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><AdminStatusBadge status={log.action} /></TableCell>
                <TableCell><p className="text-sm text-slate-200">{log.actorRole}</p><p className="text-xs text-slate-500">{log.actorUserId ?? "System"}</p></TableCell>
                <TableCell><p className="text-sm text-slate-200">{log.entityType}</p><p className="text-xs text-slate-500">{log.entityId}</p></TableCell>
                <TableCell className="text-sm text-slate-300">{formatDate(log.createdAt)}</TableCell>
              </TableRow>
            )) : (
              <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={4} className="h-32 text-center text-slate-400">No audit logs match the current filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
      </CardContent>
    </AdminDataShell>
  );
}
