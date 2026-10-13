"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "./AdminTable";

import { formatMinorCurrency, compareMinorUnits, type MinorUnitValue } from "#/lib/money";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  BoxesIcon,
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  Edit3Icon,
  ImageIcon,
  LinkIcon,
  PlusIcon,
  RotateCcwIcon,
  ShoppingBagIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";

import { Textarea } from "#/components/ui/textarea";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusAction } from "./AdminStatusAction";
import { PrepareCancellationRefund, RefundSettlementActions } from "./AdminSettlementRefundActions";
import { AdminStatusBadge } from "./AdminStatusBadge";

import {
  PAGE_SIZE,
  type AdminAffiliate,
  type AdminCatalogModerationProduct,
  type AdminOrder,
  type AdminRefund,
  type AdminShop,
  type AdminUser,
  useAdminAffiliatesList,
  useAdminCatalogModerationList,
  useAdminOrdersList,
  useConfirmShipmentDelivery,
  useAdminRefundsList,
  useAdminShopsList,
  useAdminUsersList,
  useCreateAdminShop,
  useDeleteAdminShop,
  useRestoreCatalogProduct,
  useSuspendCatalogProduct,
  useUpdateAdminShop,
  useUpdateAffiliateStatus,
  useUpdateShopStatus,
  useUpdateUserStatus,
} from "../hooks/useAdminOperations";

const USER_ROLES = ["USER", "ADMIN"] as const;
const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const SHOP_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const PRODUCT_STATUSES = [
  "PENDING_REVIEW",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
  "ARCHIVED",
  "DRAFT",
] as const;
const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "CANCELED",
  "REFUNDED",
] as const;
const PAYMENT_EXCEPTION_STATES = ["PENDING", "FAILED"] as const;
const SHIPMENT_EXCEPTION_STATES = ["DELAYED"] as const;
const REFUND_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;
const AFFILIATE_STATUSES = ["ACTIVE", "DISABLED"] as const;
const emptyShopForm = { name: "", slug: "", ownerEmail: "", status: "PENDING" };

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatOptionalDate(value: string | Date | null | undefined) {
  if (!value) return "Not submitted";
  return formatDate(value);
}

function formatMoney(cents: MinorUnitValue, currency = "USD") {
  return formatMinorCurrency(cents, "en-US", currency);
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
  label: string;
  options: readonly string[];
}) {
  const t = useTranslations();
  const id = useId();
  return (
    <div className="w-full space-y-1.5 sm:w-44">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {props.label}
      </Label>
      <Select
        value={props.value || "ALL"}
        onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}
      >
        <SelectTrigger
          id={id}
          aria-label={props.label}
          className="h-9 w-full bg-background text-foreground"
        >
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{props.placeholder}</SelectItem>
          {props.options.map((option) => (
            <SelectItem key={option} value={option}>
              {filterValueLabel(t, option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function filterValueLabel(t: ReturnType<typeof useTranslations>, value: string) {
  if (!value) return "";
  if (value === "USER" || value === "ADMIN") return t(`admin.directory.roles.${value}`);
  const key = `admin.statuses.${value}`;
  const label = t(key);
  return label === key ? value.replaceAll("_", " ") : label;
}

function ShopFilterSelect(props: {
  value: string;
  onChange: (value: string) => void;
  shops: AdminShop[];
  placeholder: string;
  label: string;
}) {
  const id = useId();
  return (
    <div className="w-full space-y-1.5 sm:w-52">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {props.label}
      </Label>
      <Select
        value={props.value || "ALL"}
        onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}
      >
        <SelectTrigger
          id={id}
          aria-label={props.label}
          className="h-9 w-full bg-background text-foreground"
        >
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{props.placeholder}</SelectItem>
          {props.shops.map((shop) => (
            <SelectItem key={shop.id} value={shop.id}>
              {shop.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AdminShopField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id} className="text-muted-foreground">
        {props.label}
      </Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as {
      value?: { error?: { message?: string } };
      error?: { message?: string };
      message?: string;
    };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? fallback;
  }
  return fallback;
}

function readinessFlags(
  product: AdminCatalogModerationProduct,
  labels: { category: string; media: string; variant: string; stock: string },
) {
  const hasPrimaryImage =
    product.images.some((image) => image.isPrimary) || product.images.length > 0;
  const hasVariant = product.variants.some(
    (variant) => variant.status === "ACTIVE" && compareMinorUnits(variant.price, 0) > 0,
  );
  const hasCategory = Boolean(product.category);
  const hasStock = product.variants.some((variant) => (variant.inventory?.quantityOnHand ?? 0) > 0);
  return [
    { label: labels.category, ready: hasCategory },
    { label: labels.media, ready: hasPrimaryImage },
    { label: labels.variant, ready: hasVariant },
    { label: labels.stock, ready: hasStock },
  ];
}

function readProductDate(
  product: AdminCatalogModerationProduct,
  key: "submittedAt" | "updatedAt" | "createdAt",
) {
  const value = (product as AdminCatalogModerationProduct & Record<string, unknown>)[key];
  return typeof value === "string" || value instanceof Date ? value : null;
}

function ModerationActionError(props: { error: unknown; fallback: string }) {
  if (!props.error) return null;
  return (
    <div className="border-t border-border bg-red-500/10 px-5 py-3 text-sm text-destructive">
      {readErrorMessage(props.error, props.fallback)}
    </div>
  );
}

export function AdminUsersTable() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminUsersList({ page, limit: PAGE_SIZE, role, status });
  const updateStatus = useUpdateUserStatus();
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((user: AdminUser) =>
        textMatch([user.name, user.email, user.role, user.status], search),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: "user",
      header: t("admin.user"),
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div>
            <Link
              href={localePath(`/admin/users/${user.id}`)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {user.name}
            </Link>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        );
      },
    },
    {
      id: "role",
      header: t("admin.role"),
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div>
            <AdminStatusBadge status={user.role} />
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div>
            <AdminStatusBadge status={user.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</div>;
      },
    },
    {
      id: "action",
      header: t("admin.action"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div className="flex justify-end">
            <AdminStatusAction
              label={user.email}
              currentStatus={user.status}
              options={USER_STATUSES}
              isPending={updateStatus.isPending}
              onConfirm={(next) => updateStatus.mutate({ id: user.id, status: next })}
            />
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.users.title")}
      description={t("admin.pages.users.description")}
      icon={UsersIcon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      searchHint={t("admin.table.searchPageDescription")}
      activeFilters={[
        {
          id: "role",
          label: t("admin.filters.roleLabel"),
          value: filterValueLabel(t, role),
          onRemove: () => {
            setRole("");
            setPage(1);
          },
        },
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setRole("");
        setStatus("");
        setPage(1);
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <>
          <FilterSelect
            value={role}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.roles")}
            label={t("admin.filters.roleLabel")}
            options={USER_ROLES}
          />
          <FilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.statuses")}
            label={t("admin.filters.statusLabel")}
            options={USER_STATUSES}
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

export function AdminShopsTable() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyShopForm);
  const [editingShop, setEditingShop] = useState<AdminShop | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminShop | null>(null);
  const query = useAdminShopsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateShopStatus();
  const createShop = useCreateAdminShop();
  const updateShop = useUpdateAdminShop();
  const deleteShop = useDeleteAdminShop();
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((shop: AdminShop) =>
        textMatch([shop.name, shop.slug, shop.owner.name, shop.owner.email, shop.status], search),
      ),
    [query.data, search],
  );
  const isMutating = createShop.isPending || updateShop.isPending;
  const mutationError = createShop.error ?? updateShop.error ?? deleteShop.error;

  function resetForm() {
    setForm(emptyShopForm);
    setEditingShop(null);
  }

  function startEdit(shop: AdminShop) {
    setEditingShop(shop);
    setForm({
      name: shop.name,
      slug: shop.slug,
      ownerEmail: shop.owner.email,
      status: shop.status,
    });
  }

  function submitShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      ownerEmail: form.ownerEmail,
      status: form.status,
    };
    if (editingShop) {
      updateShop.mutate({ id: editingShop.id, ...payload }, { onSuccess: resetForm });
      return;
    }
    createShop.mutate(payload, { onSuccess: resetForm });
  }

  const columns: ColumnDef<AdminShop>[] = [
    {
      id: "shop",
      header: t("admin.ui.shop"),
      enableSorting: false,
      cell: ({ row }) => {
        const shop = row.original;

        return (
          <div>
            <Link
              href={localePath(`/admin/shops/${shop.id}`)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {shop.name}
            </Link>
            <p className="text-xs text-muted-foreground">{shop.slug}</p>
          </div>
        );
      },
    },
    {
      id: "owner",
      header: t("admin.ui.owner"),
      enableSorting: false,
      cell: ({ row }) => {
        const shop = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{shop.owner.name}</p>
            <p className="text-xs text-muted-foreground">{shop.owner.email}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const shop = row.original;

        return (
          <div>
            <AdminStatusBadge status={shop.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const shop = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(shop.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const shop = row.original;

        return (
          <div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                onClick={() => startEdit(shop)}
              >
                <Edit3Icon className="size-4" />
                <span className="sr-only">
                  {t("admin.common.edit")} {shop.name}
                </span>
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="border-red-400/30 bg-red-500/10 text-destructive"
                disabled={deleteShop.isPending}
                onClick={() => setDeleteTarget(shop)}
              >
                <Trash2Icon className="size-4" />
                <span className="sr-only">
                  {t("admin.ui.delete")} {shop.name}
                </span>
              </Button>
              <AdminStatusAction
                label={shop.name}
                currentStatus={shop.status}
                options={SHOP_STATUSES}
                isPending={updateStatus.isPending}
                onConfirm={(next) => updateStatus.mutate({ id: shop.id, status: next })}
              />
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.shops.title")}
      description={t("admin.pages.shops.description")}
      icon={Building2Icon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      searchHint={t("admin.table.searchPageDescription")}
      activeFilters={[
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
        setPage(1);
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
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
          label={t("admin.filters.statusLabel")}
          options={SHOP_STATUSES}
        />
      }
    >
      <CardContent className="space-y-4 p-5">
        <form onSubmit={submitShop} className="rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="grid flex-1 gap-3 md:grid-cols-4">
              <AdminShopField
                id="shop-name"
                label={t("admin.operations.shopName")}
                value={form.name}
                onChange={(value) => setForm((current) => ({ ...current, name: value }))}
                required
              />
              <AdminShopField
                id="shop-slug"
                label={t("admin.productModerationDetail.slug")}
                value={form.slug}
                onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
                placeholder="auto-from-name"
              />
              <AdminShopField
                id="shop-owner"
                label={t("admin.operations.ownerEmail")}
                value={form.ownerEmail}
                onChange={(value) => setForm((current) => ({ ...current, ownerEmail: value }))}
                required
              />
              <div className="space-y-2">
                <Label htmlFor="shop-status" className="text-muted-foreground">
                  {t("admin.ui.status")}
                </Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger
                    id="shop-status"
                    className="border-border bg-muted/40 text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOP_STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {t(`admin.statuses.${item}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <PlusIcon className="size-4" />
                {t(editingShop ? "admin.operations.saveShop" : "admin.operations.createShop")}
              </Button>
              {editingShop ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-background text-foreground"
                  onClick={resetForm}
                >
                  {t("admin.ui.cancel")}
                </Button>
              ) : null}
            </div>
          </div>
          {mutationError ? (
            <p className="mt-3 text-sm text-destructive">
              {readErrorMessage(mutationError, t("admin.sellerApplications.operationFailed"))}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">{t("admin.ui.shopOwnerRule")}</p>
        </form>

        <div className="overflow-hidden rounded-lg border border-border">
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
        </div>

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.ui.deleteShop")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.operations.deleteShopDescription").replace(
                  "{shop}",
                  deleteTarget?.name ?? "-",
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.ui.cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={!deleteTarget || deleteShop.isPending}
                  onClick={() => {
                    if (!deleteTarget) return;
                    deleteShop.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                  }}
                >
                  {t("admin.ui.delete")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminProductsModerationTable() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [reasonAction, setReasonAction] = useState<AdminCatalogModerationProduct | null>(null);
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const query = useAdminCatalogModerationList({ page, limit: PAGE_SIZE, status, q: search });
  const suspend = useSuspendCatalogProduct();
  const restore = useRestoreCatalogProduct();
  const rows = query.data?.data ?? [];
  const isReasonMissing = Boolean(reasonAction) && reason.trim().length === 0;
  const pendingProductId = restore.variables ?? suspend.variables?.id ?? null;
  const mutationError = suspend.error ?? restore.error;
  const isAnyMutationPending = suspend.isPending || restore.isPending;

  function closeReasonDialog() {
    setReasonAction(null);
    setReason("");
  }

  function submitReasonAction() {
    if (!reasonAction || !reason.trim()) return;
    const payload = { id: reasonAction.id, reason: reason.trim() };
    suspend.mutate(payload, {
      onSuccess: () => {
        setActionMessage(
          t("admin.productModerationDetail.suspended").replace("{title}", reasonAction.title),
        );
        closeReasonDialog();
      },
    });
  }

  const columns: ColumnDef<AdminCatalogModerationProduct>[] = [
    {
      id: "product",
      header: t("admin.ui.product"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;
        const primaryImage =
          product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;
        return (
          <div>
            <div className="flex min-w-64 items-center gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
                {primaryImage ? (
                  <img
                    src={primaryImage.url}
                    alt={primaryImage.altText ?? product.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{product.title}</p>
                <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{product.id}</p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "shop",
      header: t("admin.ui.shop"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="text-sm text-foreground">
            <p>{product.shop.name}</p>
            <p className="text-xs text-muted-foreground">{product.shop.slug}</p>
          </div>
        );
      },
    },
    {
      id: "category",
      header: t("admin.ui.category"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="text-sm text-foreground">
            <p>{product.category?.name ?? t("admin.productModerationDetail.unassigned")}</p>
            <p className="text-xs text-muted-foreground">
              {product.category?.slug ?? t("admin.productModerationDetail.noCategory")}
            </p>
          </div>
        );
      },
    },
    {
      id: "readiness",
      header: t("admin.ui.readiness"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;
        const flags = readinessFlags(product, {
          category: t("admin.ui.category"),
          media: t("admin.operations.media"),
          variant: t("admin.ui.variant"),
          stock: t("admin.operations.stock"),
        });
        return (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {flags.map((flag) => (
                <Badge
                  key={flag.label}
                  variant="outline"
                  className={`gap-1 ${flag.ready ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-700 dark:text-emerald-300" : "border-amber-300/25 bg-amber-300/10 text-amber-700 dark:text-amber-300"}`}
                >
                  {flag.ready ? (
                    <CheckCircle2Icon className="size-3" />
                  ) : (
                    <XCircleIcon className="size-3" />
                  )}
                  {flag.label}
                </Badge>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "dates",
      header: t("admin.ui.dates"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div className="text-xs text-muted-foreground">
            <p className="flex items-center gap-1">
              <ClockIcon className="size-3" /> {t("admin.sellerApplications.submitted")}{" "}
              {formatOptionalDate(readProductDate(product, "submittedAt") ?? product.updatedAt)}
            </p>
            <p className="mt-1 text-muted-foreground">
              {t("admin.productModerationDetail.updated")}{" "}
              {formatOptionalDate(readProductDate(product, "updatedAt"))}
            </p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original;

        return (
          <div>
            <AdminStatusBadge status={product.status} />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const product = row.original;
        const isRowPending = pendingProductId === product.id;
        return (
          <div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
              >
                <Link href={localePath(`/admin/products/${product.id}`)}>
                  {t("admin.ui.detail")}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-400/30 bg-red-500/10 text-destructive"
                disabled={isAnyMutationPending || product.status !== "ACTIVE"}
                onClick={() => setReasonAction(product)}
              >
                {t("admin.ui.suspend")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border bg-background text-foreground"
                disabled={isAnyMutationPending || product.status !== "SUSPENDED"}
                onClick={() =>
                  restore.mutate(product.id, {
                    onSuccess: () =>
                      setActionMessage(
                        t("admin.productModerationDetail.restored").replace(
                          "{title}",
                          product.title,
                        ),
                      ),
                  })
                }
              >
                {isRowPending && restore.isPending
                  ? t("admin.productModerationDetail.restoring")
                  : t("admin.productModerationDetail.restore")}
              </Button>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.products.title")}
      description={t("admin.pages.products.description")}
      icon={BoxesIcon}
      search={search}
      searchPlaceholder={t("admin.search.products")}
      onSearchChange={(value) => {
        setSearch(value);
        setPage(1);
      }}
      searchHint={t("admin.table.searchAllDescription")}
      activeFilters={[
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
        setPage(1);
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <FilterSelect
          value={status}
          onChange={(value) => {
            setStatus(value || "");
            setPage(1);
          }}
          placeholder={t("admin.filters.statuses")}
          label={t("admin.filters.statusLabel")}
          options={PRODUCT_STATUSES}
        />
      }
    >
      <CardContent className="p-0">
        {actionMessage ? (
          <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {actionMessage}
          </div>
        ) : null}
        <ModerationActionError
          error={mutationError}
          fallback={t("admin.sellerApplications.operationFailed")}
        />
        <AdminTable
          columns={columns}
          data={rows}
          isLoading={query.isLoading}
          emptyMessage={t("admin.ui.noRecords")}
          getRowId={(item) => item.id}
          pagination={{
            pageIndex: page - 1,
            pageSize: PAGE_SIZE,
            totalRows: query.data?.meta.totalCount ?? 0,
            onPaginationChange: (updater) => {
              const current = { pageIndex: page - 1, pageSize: PAGE_SIZE };
              const next = typeof updater === "function" ? updater(current) : updater;
              setPage(next.pageIndex + 1);
            },
          }}
        />

        <AlertDialog
          open={Boolean(reasonAction)}
          onOpenChange={(open) => {
            if (!open) closeReasonDialog();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("admin.productModerationDetail.suspendProduct")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.operations.moderationDescription").replace(
                  "{title}",
                  reasonAction?.title ?? "-",
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="product-moderation-reason">{t("admin.ui.reason")}</Label>
              <Textarea
                id="product-moderation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                placeholder={t("admin.operations.moderationPlaceholder")}
              />
              {isReasonMissing ? (
                <p className="text-sm font-medium text-red-600">{t("admin.ui.reasonRequired")}</p>
              ) : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.ui.cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={!reasonAction || reason.trim().length === 0 || suspend.isPending}
                  onClick={submitReasonAction}
                >
                  {suspend.isPending
                    ? t("admin.productModerationDetail.submitting")
                    : t("admin.ui.suspend")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminOrdersMonitoringTable() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [shopId, setShopId] = useState("");
  const [paymentState, setPaymentState] = useState(searchParams.get("paymentState") ?? "");
  const [shipmentState, setShipmentState] = useState(searchParams.get("shipmentState") ?? "");
  const [search, setSearch] = useState("");
  const query = useAdminOrdersList({
    page,
    limit: PAGE_SIZE,
    status,
    shopId,
    paymentState,
    shipmentState,
  });
  const shopsQuery = useAdminShopsList({ page: 1, limit: 50 });
  const confirmDelivery = useConfirmShipmentDelivery();
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((order: AdminOrder) =>
        textMatch(
          [
            order.orderNumber,
            order.status,
            order.paymentStatus,
            order.userId,
            ...order.items.map((item) => item.shopName),
          ],
          search,
        ),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminOrder>[] = [
    {
      id: "order",
      header: t("admin.ui.order"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
          </div>
        );
      },
    },
    {
      id: "shop",
      header: t("admin.ui.shop"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div className="text-sm text-foreground">
            {Array.from(new Set(order.items.map((item) => item.shopName))).join(", ") || "—"}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div>
            <AdminStatusBadge status={order.status} />
          </div>
        );
      },
    },
    {
      id: "payment",
      header: t("admin.ui.payment"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div>
            <AdminStatusBadge status={order.paymentStatus} />
          </div>
        );
      },
    },
    {
      id: "total",
      header: t("admin.ui.total"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div className="text-sm text-foreground">
            {formatMoney(order.grandTotal, order.currency)}
          </div>
        );
      },
    },
    {
      id: "activity",
      header: t("admin.ui.activity"),
      enableSorting: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div className="text-sm text-muted-foreground">
            {t("admin.operations.orderActivity")
              .replace("{items}", String(order.items.length))
              .replace("{shipments}", String(order.shipments.length))
              .replace("{refunds}", String(order.refunds.length))}
          </div>
        );
      },
    },
    {
      id: "action",
      header: t("admin.ui.action"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const order = row.original;

        return (
          <div>
            <div className="flex flex-wrap justify-end gap-2">
              <PrepareCancellationRefund order={order} />
              {order.shipments
                .filter((shipment) => shipment.status === "SHIPPED")
                .map((shipment) => (
                  <Button
                    key={shipment.id}
                    size="sm"
                    variant="outline"
                    disabled={confirmDelivery.isPending}
                    onClick={() => {
                      const evidenceReference = window
                        .prompt(
                          t("admin.shipments.evidenceReferencePrompt"),
                          shipment.trackingNumber ?? "",
                        )
                        ?.trim();
                      if (evidenceReference)
                        confirmDelivery.mutate({ shipmentId: shipment.id, evidenceReference });
                    }}
                  >
                    {t("admin.shipments.confirmDelivered")}
                  </Button>
                ))}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.orders.title")}
      description={t("admin.pages.orders.description")}
      icon={ShoppingBagIcon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      searchHint={t("admin.table.searchPageDescription")}
      activeFilters={[
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
        {
          id: "payment",
          label: t("admin.filters.paymentLabel"),
          value: filterValueLabel(t, paymentState),
          onRemove: () => {
            setPaymentState("");
            setPage(1);
          },
        },
        {
          id: "shipment",
          label: t("admin.filters.shipmentLabel"),
          value: filterValueLabel(t, shipmentState),
          onRemove: () => {
            setShipmentState("");
            setPage(1);
          },
        },
        {
          id: "shop",
          label: t("admin.filters.shopLabel"),
          value: shopId
            ? (shopsQuery.data?.items.find((shop) => shop.id === shopId)?.name ?? shopId)
            : "",
          onRemove: () => {
            setShopId("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
        setPaymentState("");
        setShipmentState("");
        setShopId("");
        setPage(1);
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
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
            label={t("admin.filters.statusLabel")}
            options={ORDER_STATUSES}
          />
          <FilterSelect
            value={paymentState}
            onChange={(value) => {
              setPaymentState(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.paymentExceptions")}
            label={t("admin.filters.paymentLabel")}
            options={PAYMENT_EXCEPTION_STATES}
          />
          <FilterSelect
            value={shipmentState}
            onChange={(value) => {
              setShipmentState(value);
              setPage(1);
            }}
            placeholder={t("admin.filters.shipmentExceptions")}
            label={t("admin.filters.shipmentLabel")}
            options={SHIPMENT_EXCEPTION_STATES}
          />
          <ShopFilterSelect
            value={shopId}
            onChange={(value) => {
              setShopId(value);
              setPage(1);
            }}
            shops={shopsQuery.data?.items ?? []}
            placeholder={t("admin.filters.shops")}
            label={t("admin.filters.shopLabel")}
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

export function AdminRefundsTable() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminRefundsList({ page, limit: PAGE_SIZE, status });
  const rows = useMemo(
    () =>
      (query.data?.items ?? []).filter((refund: AdminRefund) =>
        textMatch([refund.id, refund.order.orderNumber, refund.status, refund.reason], search),
      ),
    [query.data, search],
  );

  const columns: ColumnDef<AdminRefund>[] = [
    {
      id: "refund",
      header: t("admin.ui.refund"),
      enableSorting: false,
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">
              {refund.reason ?? t("admin.refunds.requestFallback")}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(refund.createdAt)}</p>
          </div>
        );
      },
    },
    {
      id: "order",
      header: t("admin.ui.order"),
      enableSorting: false,
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{refund.order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{refund.payment.provider}</p>
          </div>
        );
      },
    },
    {
      id: "amount",
      header: t("admin.ui.amount"),
      enableSorting: false,
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div className="text-sm text-foreground">
            {formatMoney(refund.amount, refund.payment.currency)}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div>
            <AdminStatusBadge status={refund.status} />
          </div>
        );
      },
    },
    {
      id: "action",
      header: t("admin.ui.action"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const refund = row.original;

        return (
          <div className="min-w-64 whitespace-normal align-top">
            <RefundSettlementActions refund={refund} />
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.refunds.title")}
      description={t("admin.pages.refunds.description")}
      icon={RotateCcwIcon}
      search={search}
      searchPlaceholder={t("admin.table.searchPage")}
      onSearchChange={setSearch}
      searchHint={t("admin.table.searchPageDescription")}
      activeFilters={[
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => {
            setStatus("");
            setPage(1);
          },
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
        setPage(1);
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
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
          label={t("admin.filters.statusLabel")}
          options={REFUND_STATUSES}
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

export function AdminAffiliatesTable() {
  const t = useTranslations();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminAffiliatesList();
  const updateStatus = useUpdateAffiliateStatus();
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (affiliate: AdminAffiliate) =>
          (!status || affiliate.status === status) &&
          textMatch(
            [
              affiliate.user.name,
              affiliate.user.email,
              affiliate.status,
              affiliate.links.map((link) => link.code).join(" "),
            ],
            search,
          ),
      ),
    [query.data, search, status],
  );

  const columns: ColumnDef<AdminAffiliate>[] = [
    {
      id: "creator",
      header: t("admin.ui.creator"),
      accessorFn: (item) => item.user.name,
      enableSorting: true,
      cell: ({ row }) => {
        const affiliate = row.original;

        return (
          <div>
            <p className="font-medium text-foreground">{affiliate.user.name}</p>
            <p className="text-xs text-muted-foreground">{affiliate.user.email}</p>
          </div>
        );
      },
    },
    {
      id: "links",
      header: t("admin.ui.links"),
      accessorFn: (item) => item.links.length,
      enableSorting: true,
      cell: ({ row }) => {
        const affiliate = row.original;

        return (
          <div>
            <p className="text-sm font-semibold text-foreground">{affiliate.links.length} links</p>
            <p className="max-w-64 truncate text-xs text-muted-foreground">
              {affiliate.links.map((link) => link.code).join(", ") || t("admin.ui.noLinks")}
            </p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      accessorFn: (item) => item.status,
      enableSorting: true,
      cell: ({ row }) => {
        const affiliate = row.original;

        return (
          <div>
            <AdminStatusBadge status={affiliate.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      accessorFn: (item) => new Date(item.createdAt).getTime(),
      enableSorting: true,
      cell: ({ row }) => {
        const affiliate = row.original;

        return (
          <div className="text-sm text-muted-foreground">{formatDate(affiliate.createdAt)}</div>
        );
      },
    },
    {
      id: "action",
      header: t("admin.ui.action"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const affiliate = row.original;

        return (
          <div className="flex justify-end">
            <AdminStatusAction
              label={affiliate.user.email}
              currentStatus={affiliate.status}
              options={AFFILIATE_STATUSES}
              isPending={updateStatus.isPending}
              onConfirm={(next) =>
                updateStatus.mutate({
                  affiliateId: affiliate.id,
                  status: next as "ACTIVE" | "DISABLED",
                })
              }
            />
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.affiliates.title")}
      description={t("admin.pages.affiliates.description")}
      icon={LinkIcon}
      search={search}
      searchPlaceholder={t("admin.search.affiliates")}
      onSearchChange={setSearch}
      searchHint={t("admin.table.searchAllDescription")}
      activeFilters={[
        {
          id: "status",
          label: t("admin.filters.statusLabel"),
          value: filterValueLabel(t, status),
          onRemove: () => setStatus(""),
        },
      ]}
      onResetFilters={() => {
        setSearch("");
        setStatus("");
      }}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      hasData={query.data !== undefined}
      error={query.error}
      onRetry={() => void query.refetch()}
      filters={
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder={t("admin.filters.statuses")}
          label={t("admin.filters.statusLabel")}
          options={AFFILIATE_STATUSES}
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
    </AdminDataShell>
  );
}
