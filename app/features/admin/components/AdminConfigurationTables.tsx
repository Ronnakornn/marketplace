"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "./AdminTable";

import { useDeferredValue, useState, type FormEvent } from "react";
import { BadgePercentIcon, PencilIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";

import { Textarea } from "#/components/ui/textarea";
import { useFormatters, useTranslations } from "#/i18n/client";
import { AdminDataShell } from "./AdminDataShell";
import { AdminActionDialog } from "./AdminActionDialog";
import { AdminStatusBadge } from "./AdminStatusBadge";

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
  const [decision, setDecision] = useState<{ item: AdminCommission; status: "APPROVED" | "VOID" } | null>(null);

  const columns: ColumnDef<AdminCommission>[] = [
    {
      id: "affiliate",
      header: t("admin.commissions.affiliate"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">{item.affiliateName}</p>
            <p className="text-xs text-muted-foreground">
              {item.affiliateEmail} · {item.linkCode}
            </p>
          </div>
        );
      },
    },
    {
      id: "order",
      header: t("admin.order"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatters.date(item.createdAt)}</p>
          </div>
        );
      },
    },
    {
      id: "eligible",
      header: t("admin.commissions.eligible"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="text-sm text-muted-foreground">
            {formatters.currency(item.eligibleSubtotalCents, item.currency)}
          </div>
        );
      },
    },
    {
      id: "commission",
      header: t("admin.commissions.commission"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="font-semibold text-foreground">
              {formatters.currency(item.commissionCents, item.currency)}
            </p>
            <p className="text-xs text-muted-foreground">{(item.commissionBps / 100).toFixed(2)}%</p>
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
              {item.status === "PENDING" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-background text-foreground"
                  disabled={updateStatus.isPending}
                  onClick={() => setDecision({ item, status: "APPROVED" })}
                >
                  {t("admin.ui.approve")}
                </Button>
              ) : null}
              {item.status !== "VOID" ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={updateStatus.isPending}
                  onClick={() => setDecision({ item, status: "VOID" })}
                >
                  {t("admin.commissions.void")}
                </Button>
              ) : null}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.commissions.title")}
      description={t("admin.commissions.description")}
      icon={BadgePercentIcon}
      search={search}
      searchPlaceholder={t("admin.commissions.search")}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <Select
          value={status || "ALL"}
          onValueChange={(value) => {
            setStatus(value === "ALL" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-foreground md:w-44">
            <SelectValue placeholder={t("admin.filters.statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.common.allStatuses")}</SelectItem>
            {COMMISSION_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`admin.statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <CardContent className="overflow-x-auto p-0">
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
      {decision ? (
        <AdminActionDialog
          key={`${decision.status}-${decision.item.id}`}
          action={t(decision.status === "APPROVED" ? "admin.ui.approve" : "admin.commissions.void")}
          description={t(decision.status === "APPROVED" ? "admin.financialAction.approveCommissionHint" : "admin.financialAction.voidCommissionHint")}
          target={`${decision.item.affiliateName} · ${decision.item.orderNumber}`}
          recordId={decision.item.id}
          amount={formatters.currency(decision.item.commissionCents, decision.item.currency)}
          currency={decision.item.currency}
          destructive={decision.status === "VOID"}
          isPending={updateStatus.isPending}
          field={{ label: t("admin.financialAction.reason"), helper: t("admin.financialAction.commissionReasonHint"), minLength: 3, maxLength: 500, multiline: true }}
          onClose={() => setDecision(null)}
          onConfirm={(reason) => updateStatus.mutateAsync({ id: decision.item.id, status: decision.status, reason })}
        />
      ) : null}
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

  const columns: ColumnDef<AdminSystemSetting>[] = [
    {
      id: "key",
      header: t("admin.settingsEditor.key"),
      accessorFn: (item) => item.key,
      enableSorting: true,
      cell: ({ row }) => {
        const setting = row.original;

        return (
          <div>
            <p className="font-mono text-sm text-foreground">{setting.key}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {setting.description ?? t("admin.settingsEditor.noDescription")}
            </p>
          </div>
        );
      },
    },
    {
      id: "value",
      header: t("admin.settingsEditor.value"),
      accessorFn: (item) => settingValuePreview(item),
      enableSorting: true,
      cell: ({ row }) => {
        const setting = row.original;

        return (
          <div
            className="max-w-sm truncate font-mono text-xs text-muted-foreground"
            title={settingValuePreview(setting)}
          >
            {settingValuePreview(setting)}
          </div>
        );
      },
    },
    {
      id: "type",
      header: t("admin.settingsEditor.type"),
      accessorFn: (item) => item.valueType,
      enableSorting: true,
      cell: ({ row }) => {
        const setting = row.original;

        return (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{setting.valueType}</span>
              {setting.isPublic ? (
                <span className="rounded-full bg-cyan-500/15 px-2 py-1 text-xs text-primary">
                  {t("admin.settingsEditor.public")}
                </span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "updated",
      header: t("admin.settingsEditor.updated"),
      accessorFn: (item) => new Date(item.updatedAt).getTime(),
      enableSorting: true,
      cell: ({ row }) => {
        const setting = row.original;

        return <div className="text-sm text-muted-foreground">{formatters.date(setting.updatedAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const setting = row.original;

        return (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              className="border-border bg-background text-foreground"
              onClick={() => edit(setting)}
            >
              <PencilIcon className="size-4" />
              {t("admin.common.edit")}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card className="admin-panel h-fit rounded-xl border-border bg-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <SettingsIcon className="size-5 text-primary" />
            {form.editing ? t("admin.settingsEditor.edit") : t("admin.settingsEditor.create")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("admin.settingsEditor.description")}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="setting-key" className="text-foreground">
                {t("admin.settingsEditor.key")}
              </Label>
              <Input
                id="setting-key"
                value={form.key}
                disabled={form.editing}
                required
                minLength={2}
                maxLength={120}
                pattern="[a-z][a-z0-9_.-]+"
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                className="border-border bg-muted/40 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("admin.settingsEditor.type")}</Label>
              <Select
                value={form.valueType}
                onValueChange={(value: SettingValueType) =>
                  setForm((current) => ({ ...current, valueType: value }))
                }
              >
                <SelectTrigger className="border-border bg-muted/40 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SETTING_VALUE_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-value" className="text-foreground">
                {t("admin.settingsEditor.value")}
              </Label>
              <Textarea
                id="setting-value"
                value={form.value}
                required
                onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))}
                className="min-h-32 border-border bg-muted/40 font-mono text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-description" className="text-foreground">
                {t("admin.settingsEditor.fieldDescription")}
              </Label>
              <Textarea
                id="setting-description"
                value={form.description}
                maxLength={500}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="border-border bg-muted/40 text-foreground"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
              <div>
                <Label htmlFor="setting-public" className="text-foreground">
                  {t("admin.settingsEditor.public")}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">{t("admin.settingsEditor.publicHint")}</p>
              </div>
              <Switch
                id="setting-public"
                checked={form.isPublic}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isPublic: checked }))}
              />
            </div>
            {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
            {upsert.error ? (
              <p className="text-sm text-destructive">{t("admin.settingsEditor.saveFailed")}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={upsert.isPending}>
                {t("admin.common.save")}
              </Button>
              {form.editing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-background text-foreground"
                  onClick={reset}
                >
                  {t("admin.cancel")}
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <AdminDataShell
        title={t("admin.settingsEditor.listTitle")}
        description={t("admin.settingsEditor.listDescription")}
        icon={SettingsIcon}
        search={settingsSearch}
        searchPlaceholder={t("admin.settingsEditor.search")}
        onSearchChange={setSettingsSearch}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        filters={
          <Button
            type="button"
            variant="outline"
            className="border-border bg-background text-foreground"
            onClick={reset}
          >
            <PlusIcon className="size-4" />
            {t("admin.settingsEditor.new")}
          </Button>
        }
      >
        <CardContent className="overflow-x-auto p-0">
          <AdminTable
            columns={columns}
            data={settingsRows}
            isLoading={query.isLoading}
            emptyMessage={t("admin.settingsEditor.empty")}
            getRowId={(item) => item.id}
          />
        </CardContent>
      </AdminDataShell>
    </div>
  );
}
