"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { BoxesIcon, Building2Icon, CheckCircle2Icon, ClockIcon, Edit3Icon, ImageIcon, LinkIcon, PlusIcon, RotateCcwIcon, ShoppingBagIcon, Trash2Icon, UsersIcon, XCircleIcon } from "lucide-react";
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
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusAction } from "./AdminStatusAction";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { AdminTablePagination } from "./AdminTablePagination";
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
  useAdminRefundsList,
  useAdminShopsList,
  useAdminUsersList,
  useApproveCatalogProduct,
  useCreateAdminShop,
  useDeleteAdminShop,
  useRejectCatalogProduct,
  useRestoreCatalogProduct,
  useSuspendCatalogProduct,
  useUpdateAdminShop,
  useUpdateAffiliateStatus,
  useUpdateRefundStatus,
  useUpdateShopStatus,
  useUpdateUserStatus,
} from "../hooks/useAdminOperations";

const USER_ROLES = ["USER", "ADMIN"] as const;
const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const SHOP_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const PRODUCT_STATUSES = ["PENDING_REVIEW", "ACTIVE", "REJECTED", "SUSPENDED", "ARCHIVED", "DRAFT"] as const;
const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELED", "REFUNDED"] as const;
const REFUND_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;
const AFFILIATE_STATUSES = ["ACTIVE", "DISABLED"] as const;
const emptyShopForm = { name: "", slug: "", ownerEmail: "", status: "PENDING" };

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatOptionalDate(value: string | Date | null | undefined) {
  if (!value) return "Not submitted";
  return formatDate(value);
}

function formatMoney(cents: number | bigint, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents) / 100);
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
      <Label htmlFor={props.id} className="text-slate-300">{props.label}</Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600"
      />
    </div>
  );
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as { value?: { error?: { message?: string } }; error?: { message?: string }; message?: string };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? "Operation failed.";
  }
  return "Operation failed.";
}

function readinessFlags(product: AdminCatalogModerationProduct) {
  const hasPrimaryImage = product.images.some((image) => image.isPrimary) || product.images.length > 0;
  const hasVariant = product.variants.some((variant) => variant.status === "ACTIVE" && Number(variant.price) > 0);
  const hasCategory = Boolean(product.category);
  const hasStock = product.variants.some((variant) => (variant.inventory?.quantityOnHand ?? 0) > 0);
  return [
    { label: "Category", ready: hasCategory },
    { label: "Media", ready: hasPrimaryImage },
    { label: "Variant", ready: hasVariant },
    { label: "Stock", ready: hasStock },
  ];
}

function readProductDate(product: AdminCatalogModerationProduct, key: "submittedAt" | "updatedAt" | "createdAt") {
  const value = (product as AdminCatalogModerationProduct & Record<string, unknown>)[key];
  return typeof value === "string" || value instanceof Date ? value : null;
}

function ModerationActionError(props: { error: unknown }) {
  if (!props.error) return null;
  return (
    <div className="border-t border-white/10 bg-red-500/10 px-5 py-3 text-sm text-red-200">
      {readErrorMessage(props.error)}
    </div>
  );
}

export function AdminUsersTable() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminUsersList({ page, limit: PAGE_SIZE, role, status });
  const updateStatus = useUpdateUserStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((user: AdminUser) => textMatch([user.name, user.email, user.role, user.status], search)), [query.data, search]);

  return (
    <AdminDataShell title="Users" description="Review account roles and suspend compromised or abusive accounts." icon={UsersIcon} search={search} searchPlaceholder="Search users" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<><FilterSelect value={role} onChange={(value) => { setRole(value); setPage(1); }} placeholder="Roles" options={USER_ROLES} /><FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={USER_STATUSES} /></>}>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">User</TableHead><TableHead className="text-slate-300">Role</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length ? rows.map((user: AdminUser) => (
              <TableRow key={user.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4"><p className="font-medium text-white">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></TableCell>
                <TableCell><AdminStatusBadge status={user.role} /></TableCell>
                <TableCell><AdminStatusBadge status={user.status} /></TableCell>
                <TableCell className="text-sm text-slate-300">{formatDate(user.createdAt)}</TableCell>
                <TableCell className="flex justify-end"><AdminStatusAction label={user.email} currentStatus={user.status} options={USER_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: user.id, status: next })} /></TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
      </CardContent>
    </AdminDataShell>
  );
}

export function AdminShopsTable() {
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
  const rows = useMemo(() => (query.data?.items ?? []).filter((shop: AdminShop) => textMatch([shop.name, shop.slug, shop.owner.name, shop.owner.email, shop.status], search)), [query.data, search]);
  const isMutating = createShop.isPending || updateShop.isPending;
  const mutationError = createShop.error ?? updateShop.error ?? deleteShop.error;

  function resetForm() {
    setForm(emptyShopForm);
    setEditingShop(null);
  }

  function startEdit(shop: AdminShop) {
    setEditingShop(shop);
    setForm({ name: shop.name, slug: shop.slug, ownerEmail: shop.owner.email, status: shop.status });
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

  return (
    <AdminDataShell title="Shops" description="Approve, activate, or suspend seller storefronts." icon={Building2Icon} search={search} searchPlaceholder="Search shops" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={SHOP_STATUSES} />}>
      <CardContent className="space-y-4 p-5">
        <form onSubmit={submitShop} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="grid flex-1 gap-3 md:grid-cols-4">
              <AdminShopField id="shop-name" label="Shop name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} required />
              <AdminShopField id="shop-slug" label="Slug" value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: value }))} placeholder="auto-from-name" />
              <AdminShopField id="shop-owner" label="Owner email" value={form.ownerEmail} onChange={(value) => setForm((current) => ({ ...current, ownerEmail: value }))} required />
              <div className="space-y-2">
                <Label htmlFor="shop-status" className="text-slate-300">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger id="shop-status" className="border-white/10 bg-slate-950/60 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOP_STATUSES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isMutating} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <PlusIcon className="size-4" />
                {editingShop ? "Save shop" : "Create shop"}
              </Button>
              {editingShop ? <Button type="button" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={resetForm}>Cancel</Button> : null}
            </div>
          </div>
          {mutationError ? <p className="mt-3 text-sm text-red-300">{readErrorMessage(mutationError)}</p> : null}
          <p className="mt-2 text-xs text-slate-500">Owner must be an ACTIVE account. Delete is only available for shops without marketplace records.</p>
        </form>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Shop</TableHead><TableHead className="text-slate-300">Owner</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader><TableBody>
            {rows.length ? rows.map((shop: AdminShop) => <TableRow key={shop.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{shop.name}</p><p className="text-xs text-slate-500">{shop.slug}</p></TableCell><TableCell><p className="text-sm text-slate-200">{shop.owner.name}</p><p className="text-xs text-slate-500">{shop.owner.email}</p></TableCell><TableCell><AdminStatusBadge status={shop.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(shop.createdAt)}</TableCell><TableCell><div className="flex justify-end gap-2"><Button type="button" size="icon-sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={() => startEdit(shop)}><Edit3Icon className="size-4" /><span className="sr-only">Edit {shop.name}</span></Button><Button type="button" size="icon-sm" variant="outline" className="border-red-400/30 bg-red-500/10 text-red-200" disabled={deleteShop.isPending} onClick={() => setDeleteTarget(shop)}><Trash2Icon className="size-4" /><span className="sr-only">Delete {shop.name}</span></Button><AdminStatusAction label={shop.name} currentStatus={shop.status} options={SHOP_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: shop.id, status: next })} /></div></TableCell></TableRow>) : <EmptyRow colSpan={5} />}
          </TableBody></Table>
        </div>
        <AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} />
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete shop</AlertDialogTitle>
              <AlertDialogDescription>
                Delete {deleteTarget?.name}. This only succeeds when the shop has no products, orders, shipments, coupons, followers, chat, wallet, or payout records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  variant="destructive"
                  disabled={!deleteTarget || deleteShop.isPending}
                  onClick={() => {
                    if (!deleteTarget) return;
                    deleteShop.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
                  }}
                >
                  Delete
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
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [search, setSearch] = useState("");
  const [reasonAction, setReasonAction] = useState<{ type: "reject" | "suspend"; product: AdminCatalogModerationProduct } | null>(null);
  const [reason, setReason] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const query = useAdminCatalogModerationList({ page, limit: PAGE_SIZE, status, q: search });
  const approve = useApproveCatalogProduct();
  const reject = useRejectCatalogProduct();
  const suspend = useSuspendCatalogProduct();
  const restore = useRestoreCatalogProduct();
  const rows = useMemo(() => (query.data?.data ?? []).filter((product: AdminCatalogModerationProduct) => textMatch([product.title, product.slug, product.shop.name, product.shop.slug, product.status, product.category?.name, product.category?.slug], search)), [query.data, search]);
  const isReasonMissing = Boolean(reasonAction) && reason.trim().length === 0;
  const pendingProductId = approve.variables ?? restore.variables ?? reject.variables?.id ?? suspend.variables?.id ?? null;
  const mutationError = approve.error ?? reject.error ?? suspend.error ?? restore.error;
  const isAnyMutationPending = approve.isPending || reject.isPending || suspend.isPending || restore.isPending;

  function closeReasonDialog() {
    setReasonAction(null);
    setReason("");
  }

  function submitReasonAction() {
    if (!reasonAction || !reason.trim()) return;
    const payload = { id: reasonAction.product.id, reason: reason.trim() };
    if (reasonAction.type === "reject") {
      reject.mutate(payload, {
        onSuccess: () => {
          setActionMessage(`${reasonAction.product.title} rejected.`);
          closeReasonDialog();
        },
      });
      return;
    }
    suspend.mutate(payload, {
      onSuccess: () => {
        setActionMessage(`${reasonAction.product.title} suspended.`);
        closeReasonDialog();
      },
    });
  }

  return (
    <AdminDataShell title="Product Moderation" description="Review submitted listings, inspect readiness signals, and apply traceable moderation decisions." icon={BoxesIcon} search={search} searchPlaceholder="Search products, shops, or categories" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value || ""); setPage(1); }} placeholder="Statuses" options={PRODUCT_STATUSES} />}>
      <CardContent className="p-0">
        {actionMessage ? (
          <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100">
            {actionMessage}
          </div>
        ) : null}
        <ModerationActionError error={mutationError} />
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">Product</TableHead>
              <TableHead className="text-slate-300">Shop</TableHead>
              <TableHead className="text-slate-300">Category</TableHead>
              <TableHead className="text-slate-300">Readiness</TableHead>
              <TableHead className="text-slate-300">Dates</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-right text-slate-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((product) => {
              const primaryImage = product.images.find((image) => image.isPrimary) ?? product.images[0] ?? null;
              const flags = readinessFlags(product);
              const isRowPending = pendingProductId === product.id;
              return (
                <TableRow key={product.id} className="border-white/8 hover:bg-white/4">
                  <TableCell className="px-5 py-4">
                    <div className="flex min-w-64 items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                        {primaryImage ? (
                          <img src={primaryImage.url} alt={primaryImage.altText ?? product.title} className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="size-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{product.title}</p>
                        <p className="truncate text-xs text-slate-500">{product.slug}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-600">{product.id}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-200">
                    <p>{product.shop.name}</p>
                    <p className="text-xs text-slate-500">{product.shop.slug}</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-200">
                    <p>{product.category?.name ?? "Unassigned"}</p>
                    <p className="text-xs text-slate-500">{product.category?.slug ?? "No category"}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {flags.map((flag) => (
                        <span key={flag.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${flag.ready ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
                          {flag.ready ? <CheckCircle2Icon className="size-3" /> : <XCircleIcon className="size-3" />}
                          {flag.label}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    <p className="flex items-center gap-1"><ClockIcon className="size-3" /> Submitted {formatOptionalDate(readProductDate(product, "submittedAt") ?? product.updatedAt)}</p>
                    <p className="mt-1 text-slate-500">Updated {formatOptionalDate(readProductDate(product, "updatedAt"))}</p>
                  </TableCell>
                  <TableCell><AdminStatusBadge status={product.status} /></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button asChild size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100">
                        <Link href={`/admin/products/${product.id}`}>Detail</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100" disabled={isAnyMutationPending || product.status !== "PENDING_REVIEW"} onClick={() => approve.mutate(product.id, { onSuccess: () => setActionMessage(`${product.title} approved.`) })}>{isRowPending && approve.isPending ? "Approving..." : "Approve"}</Button>
                      <Button size="sm" variant="outline" className="border-amber-400/30 bg-amber-500/10 text-amber-100" disabled={isAnyMutationPending || product.status !== "PENDING_REVIEW"} onClick={() => setReasonAction({ type: "reject", product })}>Reject</Button>
                      <Button size="sm" variant="outline" className="border-red-400/30 bg-red-500/10 text-red-100" disabled={isAnyMutationPending || product.status === "SUSPENDED"} onClick={() => setReasonAction({ type: "suspend", product })}>Suspend</Button>
                      <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={isAnyMutationPending || product.status !== "SUSPENDED"} onClick={() => restore.mutate(product.id, { onSuccess: () => setActionMessage(`${product.title} restored.`) })}>{isRowPending && restore.isPending ? "Restoring..." : "Restore"}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }) : <EmptyRow colSpan={7} />}
          </TableBody>
        </Table>
        <AdminTablePagination page={page} totalPages={query.data?.meta.hasNextPage ? page + 1 : page} total={rows.length} visible={rows.length} onPageChange={setPage} />
        <AlertDialog open={Boolean(reasonAction)} onOpenChange={(open) => { if (!open) closeReasonDialog(); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{reasonAction?.type === "reject" ? "Reject product" : "Suspend product"}</AlertDialogTitle>
              <AlertDialogDescription>
                Provide a reason for {reasonAction?.product.title}. The seller will see this moderation note.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="product-moderation-reason">Reason</Label>
              <textarea
                id="product-moderation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                placeholder="Explain what the seller must fix."
              />
              {isReasonMissing ? <p className="text-sm font-medium text-red-600">Reason is required.</p> : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant={reasonAction?.type === "reject" ? "default" : "destructive"} disabled={!reasonAction || reason.trim().length === 0 || reject.isPending || suspend.isPending} onClick={submitReasonAction}>
                  {reject.isPending || suspend.isPending ? "Submitting..." : reasonAction?.type === "reject" ? "Reject" : "Suspend"}
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
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminOrdersList({ page, limit: PAGE_SIZE, status });
  const rows = useMemo(() => (query.data?.items ?? []).filter((order: AdminOrder) => textMatch([order.orderNumber, order.status, order.paymentStatus, order.userId], search)), [query.data, search]);

  return (
    <AdminDataShell title="Orders" description="Monitor order payment, fulfillment, shipment, and refund signals." icon={ShoppingBagIcon} search={search} searchPlaceholder="Search orders" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={ORDER_STATUSES} />}>
      <CardContent className="p-0"><Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Order</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Payment</TableHead><TableHead className="text-slate-300">Total</TableHead><TableHead className="text-slate-300">Activity</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((order: AdminOrder) => <TableRow key={order.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{order.orderNumber}</p><p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p></TableCell><TableCell><AdminStatusBadge status={order.status} /></TableCell><TableCell><AdminStatusBadge status={order.paymentStatus} /></TableCell><TableCell className="text-sm text-slate-200">{formatMoney(order.grandTotal, order.currency)}</TableCell><TableCell className="text-sm text-slate-300">{order.items.length} items, {order.shipments.length} shipments, {order.refunds.length} refunds</TableCell></TableRow>) : <EmptyRow colSpan={5} />}
      </TableBody></Table><AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} /></CardContent>
    </AdminDataShell>
  );
}

export function AdminRefundsTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminRefundsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateRefundStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((refund: AdminRefund) => textMatch([refund.id, refund.order.orderNumber, refund.status, refund.reason], search)), [query.data, search]);

  return (
    <AdminDataShell title="Refunds" description="Process refund review states while keeping provider confirmation separate." icon={RotateCcwIcon} search={search} searchPlaceholder="Search refunds" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={REFUND_STATUSES} />}>
      <CardContent className="p-0"><Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Refund</TableHead><TableHead className="text-slate-300">Order</TableHead><TableHead className="text-slate-300">Amount</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-right text-slate-300">Action</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((refund: AdminRefund) => <TableRow key={refund.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{refund.reason ?? "Refund request"}</p><p className="text-xs text-slate-500">{formatDate(refund.createdAt)}</p></TableCell><TableCell><p className="text-sm text-slate-200">{refund.order.orderNumber}</p><p className="text-xs text-slate-500">{refund.payment.provider}</p></TableCell><TableCell className="text-sm text-slate-200">{formatMoney(refund.amount, refund.payment.currency)}</TableCell><TableCell><AdminStatusBadge status={refund.status} /></TableCell><TableCell className="flex justify-end"><AdminStatusAction label={refund.order.orderNumber} currentStatus={refund.status} options={REFUND_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: refund.id, status: next })} /></TableCell></TableRow>) : <EmptyRow colSpan={5} />}
      </TableBody></Table><AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} /></CardContent>
    </AdminDataShell>
  );
}

export function AdminAffiliatesTable() {
  const [search, setSearch] = useState("");
  const query = useAdminAffiliatesList();
  const updateStatus = useUpdateAffiliateStatus();
  const rows = useMemo(() => (query.data ?? []).filter((affiliate: AdminAffiliate) =>
    textMatch([affiliate.user.name, affiliate.user.email, affiliate.status, affiliate.links.map((link) => link.code).join(" ")], search),
  ), [query.data, search]);

  return (
    <AdminDataShell title="Affiliates" description="Monitor creator accounts, tracking links, and account availability." icon={LinkIcon} search={search} searchPlaceholder="Search affiliates" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={null}>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
              <TableHead className="px-5 text-slate-300">Creator</TableHead>
              <TableHead className="text-slate-300">Links</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-slate-300">Created</TableHead>
              <TableHead className="text-right text-slate-300">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((affiliate: AdminAffiliate) => (
              <TableRow key={affiliate.id} className="border-white/8 hover:bg-white/4">
                <TableCell className="px-5 py-4">
                  <p className="font-medium text-white">{affiliate.user.name}</p>
                  <p className="text-xs text-slate-500">{affiliate.user.email}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm font-semibold text-slate-200">{affiliate.links.length} links</p>
                  <p className="max-w-64 truncate text-xs text-slate-500">{affiliate.links.map((link) => link.code).join(", ") || "No links yet"}</p>
                </TableCell>
                <TableCell><AdminStatusBadge status={affiliate.status} /></TableCell>
                <TableCell className="text-sm text-slate-300">{formatDate(affiliate.createdAt)}</TableCell>
                <TableCell className="flex justify-end">
                  <AdminStatusAction label={affiliate.user.email} currentStatus={affiliate.status} options={AFFILIATE_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ affiliateId: affiliate.id, status: next as "ACTIVE" | "DISABLED" })} />
                </TableCell>
              </TableRow>
            )) : <EmptyRow colSpan={5} />}
          </TableBody>
        </Table>
      </CardContent>
    </AdminDataShell>
  );
}
