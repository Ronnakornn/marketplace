"use client";

import { useDeferredValue, useState, type FormEvent } from "react";
import { BadgePercentIcon, PencilIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import { useFormatters, useTranslations } from "#/i18n/client";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { AdminTablePagination } from "./AdminTablePagination";
import {
  PAGE_SIZE,
  type AdminCommission,
  type AdminSystemSetting,
  type AdminSystemSettingMutationInput,
  useAdminCommissionsList,
  useAdminSystemSettings,
  useUpdateCommissionStatus,
  useUpsertSystemSetting,
} from "../hooks/useAdminOperations";

const COMMISSION_STATUSES = ["PENDING", "APPROVED", "VOID"] as const;
const SETTING_VALUE_TYPES = ["STRING", "NUMBER", "BOOLEAN", "JSON"] as const;

type SettingValueType = (typeof SETTING_VALUE_TYPES)[number];

interface SettingFormState {
  key: string;
  value: string;
  valueType: SettingValueType;
  description: string;
  isPublic: boolean;
  editing: boolean;
}

const emptySettingForm: SettingFormState = {
  key: "",
  value: "{}",
  valueType: "JSON",
  description: "",
  isPublic: false,
  editing: false,
};

function settingValueForEditor(setting: AdminSystemSetting): string {
  if (setting.valueType === "STRING") return String(setting.value);
  return JSON.stringify(setting.value, null, 2);
}

function parseSettingValue(value: string, valueType: SettingValueType): unknown {
  if (valueType === "STRING") return value;
  if (valueType === "NUMBER") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("invalid-number");
    return parsed;
  }
  if (valueType === "BOOLEAN") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error("invalid-boolean");
  }
  return JSON.parse(value) as unknown;
}

function settingValuePreview(setting: AdminSystemSetting): string {
  const value = setting.valueType === "STRING" ? String(setting.value) : JSON.stringify(setting.value);
  return value.length > 90 ? `${value.slice(0, 87)}...` : value;
}

export function AdminCommissionsTable() {
  const t = useTranslations();
  const formatters = useFormatters();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const query = useAdminCommissionsList({ page, limit: PAGE_SIZE, status, q: deferredSearch });
  const updateStatus = useUpdateCommissionStatus();
  const rows = query.data?.items ?? [];

  const decide = (item: AdminCommission, nextStatus: "APPROVED" | "VOID") => {
    const reason = window.prompt(t("admin.commissions.reasonPrompt"))?.trim();
    if (reason) updateStatus.mutate({ id: item.id, status: nextStatus, reason });
  };

  return (
    <AdminDataShell
      title={t("admin.commissions.title")}
      description={t("admin.commissions.description")}
      icon={BadgePercentIcon}
      search={search}
      searchPlaceholder={t("admin.commissions.search")}
      onSearchChange={(value) => { setSearch(value); setPage(1); }}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={(
        <Select value={status || "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? "" : value); setPage(1); }}>
          <SelectTrigger className="h-10 w-full border-white/10 bg-slate-950/60 text-slate-100 md:w-44">
            <SelectValue placeholder={t("admin.filters.statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.common.allStatuses")}</SelectItem>
            {COMMISSION_STATUSES.map((value) => <SelectItem key={value} value={value}>{t(`admin.statuses.${value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    >
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">{t("admin.commissions.affiliate")}</TableHead>
              <TableHead className="text-slate-300">{t("admin.order")}</TableHead>
              <TableHead className="text-slate-300">{t("admin.commissions.eligible")}</TableHead>
              <TableHead className="text-slate-300">{t("admin.commissions.commission")}</TableHead>
              <TableHead className="text-slate-300">{t("admin.status")}</TableHead>
              <TableHead className="text-right text-slate-300">{t("admin.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((item: AdminCommission) => (
              <TableRow key={item.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4">
                  <p className="font-medium text-white">{item.affiliateName}</p>
                  <p className="text-xs text-slate-500">{item.affiliateEmail} · {item.linkCode}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-slate-200">{item.orderNumber}</p>
                  <p className="text-xs text-slate-500">{formatters.date(item.createdAt)}</p>
                </TableCell>
                <TableCell className="text-sm text-slate-300">{formatters.currency(item.eligibleSubtotalCents, item.currency)}</TableCell>
                <TableCell>
                  <p className="font-semibold text-white">{formatters.currency(item.commissionCents, item.currency)}</p>
                  <p className="text-xs text-slate-500">{(item.commissionBps / 100).toFixed(2)}%</p>
                </TableCell>
                <TableCell><AdminStatusBadge status={item.status} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {item.status === "PENDING" ? (
                      <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={updateStatus.isPending} onClick={() => decide(item, "APPROVED")}>{t("admin.ui.approve")}</Button>
                    ) : null}
                    {item.status !== "VOID" ? (
                      <Button size="sm" variant="destructive" disabled={updateStatus.isPending} onClick={() => decide(item, "VOID")}>{t("admin.commissions.void")}</Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={6} className="h-32 text-center text-slate-400">{t("admin.commissions.empty")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminSettingsManager() {
  const t = useTranslations();
  const formatters = useFormatters();
  const query = useAdminSystemSettings();
  const upsert = useUpsertSystemSetting();
  const [form, setForm] = useState<SettingFormState>(emptySettingForm);
  const [validationError, setValidationError] = useState("");
  const [settingsSearch, setSettingsSearch] = useState("");
  const settingsRows = (query.data ?? []).filter((setting) => {
    const needle = settingsSearch.trim().toLowerCase();
    return !needle || `${setting.key} ${setting.description ?? ""}`.toLowerCase().includes(needle);
  });

  const reset = () => {
    setForm(emptySettingForm);
    setValidationError("");
  };

  const edit = (setting: AdminSystemSetting) => {
    setForm({
      key: setting.key,
      value: settingValueForEditor(setting),
      valueType: setting.valueType,
      description: setting.description ?? "",
      isPublic: setting.isPublic,
      editing: true,
    });
    setValidationError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const input: AdminSystemSettingMutationInput = {
        key: form.key,
        value: parseSettingValue(form.value, form.valueType),
        valueType: form.valueType,
        description: form.description || null,
        isPublic: form.isPublic,
      };
      setValidationError("");
      upsert.mutate(input, { onSuccess: reset });
    } catch {
      setValidationError(t("admin.settingsEditor.invalidValue"));
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="admin-panel h-fit rounded-xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><SettingsIcon className="size-5 text-cyan-200" />{form.editing ? t("admin.settingsEditor.edit") : t("admin.settingsEditor.create")}</CardTitle>
          <p className="text-sm text-slate-400">{t("admin.settingsEditor.description")}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="setting-key" className="text-slate-200">{t("admin.settingsEditor.key")}</Label><Input id="setting-key" value={form.key} disabled={form.editing} required minLength={2} maxLength={120} pattern="[a-z][a-z0-9_.-]+" onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} className="border-white/10 bg-slate-950/60 text-slate-100" /></div>
            <div className="space-y-2"><Label className="text-slate-200">{t("admin.settingsEditor.type")}</Label><Select value={form.valueType} onValueChange={(value: SettingValueType) => setForm((current) => ({ ...current, valueType: value }))}><SelectTrigger className="border-white/10 bg-slate-950/60 text-slate-100"><SelectValue /></SelectTrigger><SelectContent>{SETTING_VALUE_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="setting-value" className="text-slate-200">{t("admin.settingsEditor.value")}</Label><Textarea id="setting-value" value={form.value} required onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} className="min-h-32 border-white/10 bg-slate-950/60 font-mono text-slate-100" /></div>
            <div className="space-y-2"><Label htmlFor="setting-description" className="text-slate-200">{t("admin.settingsEditor.fieldDescription")}</Label><Textarea id="setting-description" value={form.description} maxLength={500} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="border-white/10 bg-slate-950/60 text-slate-100" /></div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-950/40 p-3"><div><Label htmlFor="setting-public" className="text-slate-200">{t("admin.settingsEditor.public")}</Label><p className="mt-1 text-xs text-slate-500">{t("admin.settingsEditor.publicHint")}</p></div><Switch id="setting-public" checked={form.isPublic} onCheckedChange={(checked) => setForm((current) => ({ ...current, isPublic: checked }))} /></div>
            {validationError ? <p className="text-sm text-red-300">{validationError}</p> : null}
            {upsert.error ? <p className="text-sm text-red-300">{t("admin.settingsEditor.saveFailed")}</p> : null}
            <div className="flex gap-2"><Button type="submit" disabled={upsert.isPending}>{t("admin.common.save")}</Button>{form.editing ? <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={reset}>{t("admin.cancel")}</Button> : null}</div>
          </form>
        </CardContent>
      </Card>

      <AdminDataShell title={t("admin.settingsEditor.listTitle")} description={t("admin.settingsEditor.listDescription")} icon={SettingsIcon} search={settingsSearch} searchPlaceholder={t("admin.settingsEditor.search")} onSearchChange={setSettingsSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<Button type="button" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={reset}><PlusIcon className="size-4" />{t("admin.settingsEditor.new")}</Button>}>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">{t("admin.settingsEditor.key")}</TableHead><TableHead className="text-slate-300">{t("admin.settingsEditor.value")}</TableHead><TableHead className="text-slate-300">{t("admin.settingsEditor.type")}</TableHead><TableHead className="text-slate-300">{t("admin.settingsEditor.updated")}</TableHead><TableHead className="text-right text-slate-300">{t("admin.actions")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {settingsRows.length ? settingsRows.map((setting: AdminSystemSetting) => (
                <TableRow key={setting.id} className="border-white/8 hover:bg-white/4">
                  <TableCell className="px-5 py-4"><p className="font-mono text-sm text-white">{setting.key}</p><p className="mt-1 max-w-sm text-xs text-slate-500">{setting.description ?? t("admin.settingsEditor.noDescription")}</p></TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs text-slate-300" title={settingValuePreview(setting)}>{settingValuePreview(setting)}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><span className="text-xs text-slate-300">{setting.valueType}</span>{setting.isPublic ? <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs text-cyan-200">{t("admin.settingsEditor.public")}</span> : null}</div></TableCell>
                  <TableCell className="text-sm text-slate-300">{formatters.date(setting.updatedAt)}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={() => edit(setting)}><PencilIcon className="size-4" />{t("admin.common.edit")}</Button></TableCell>
                </TableRow>
              )) : <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={5} className="h-32 text-center text-slate-400">{t("admin.settingsEditor.empty")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </AdminDataShell>
    </div>
  );
}
