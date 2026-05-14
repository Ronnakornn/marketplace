"use client";

import { useMemo, useState } from "react";
import { BoxesIcon, Building2Icon, RotateCcwIcon, ShoppingBagIcon, UsersIcon } from "lucide-react";
import { CardContent } from "#/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusAction } from "./AdminStatusAction";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { AdminTablePagination } from "./AdminTablePagination";
import {
  PAGE_SIZE,
  type AdminOrder,
  type AdminProduct,
  type AdminRefund,
  type AdminShop,
  type AdminUser,
  useAdminOrdersList,
  useAdminProductsList,
  useAdminRefundsList,
  useAdminShopsList,
  useAdminUsersList,
  useUpdateProductStatus,
  useUpdateRefundStatus,
  useUpdateShopStatus,
  useUpdateUserStatus,
} from "../hooks/useAdminOperations";

const USER_ROLES = ["USER", "SELLER", "ADMIN"] as const;
const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
const SHOP_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELED", "REFUNDED"] as const;
const REFUND_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
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
  const query = useAdminShopsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateShopStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((shop: AdminShop) => textMatch([shop.name, shop.slug, shop.owner.name, shop.owner.email, shop.status], search)), [query.data, search]);

  return (
    <AdminDataShell title="Shops" description="Approve, activate, or suspend seller storefronts." icon={Building2Icon} search={search} searchPlaceholder="Search shops" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={SHOP_STATUSES} />}>
      <CardContent className="p-0"><Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Shop</TableHead><TableHead className="text-slate-300">Owner</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Action</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((shop: AdminShop) => <TableRow key={shop.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{shop.name}</p><p className="text-xs text-slate-500">{shop.slug}</p></TableCell><TableCell><p className="text-sm text-slate-200">{shop.owner.name}</p><p className="text-xs text-slate-500">{shop.owner.email}</p></TableCell><TableCell><AdminStatusBadge status={shop.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(shop.createdAt)}</TableCell><TableCell className="flex justify-end"><AdminStatusAction label={shop.name} currentStatus={shop.status} options={SHOP_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: shop.id, status: next })} /></TableCell></TableRow>) : <EmptyRow colSpan={5} />}
      </TableBody></Table><AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} /></CardContent>
    </AdminDataShell>
  );
}

export function AdminProductsModerationTable() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const query = useAdminProductsList({ page, limit: PAGE_SIZE, status });
  const updateStatus = useUpdateProductStatus();
  const rows = useMemo(() => (query.data?.items ?? []).filter((product: AdminProduct) => textMatch([product.title, product.slug, product.shop.name, product.status], search)), [query.data, search]);

  return (
    <AdminDataShell title="Product Moderation" description="Moderate marketplace listings without entering the catalog editor." icon={BoxesIcon} search={search} searchPlaceholder="Search products" onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} filters={<FilterSelect value={status} onChange={(value) => { setStatus(value); setPage(1); }} placeholder="Statuses" options={PRODUCT_STATUSES} />}>
      <CardContent className="p-0"><Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Product</TableHead><TableHead className="text-slate-300">Shop</TableHead><TableHead className="text-slate-300">Variants</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-right text-slate-300">Action</TableHead></TableRow></TableHeader><TableBody>
        {rows.length ? rows.map((product: AdminProduct) => <TableRow key={product.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{product.title}</p><p className="text-xs text-slate-500">{product.slug}</p></TableCell><TableCell className="text-sm text-slate-200">{product.shop.name}</TableCell><TableCell className="text-sm text-slate-300">{product.variants.length}</TableCell><TableCell><AdminStatusBadge status={product.status} /></TableCell><TableCell className="flex justify-end"><AdminStatusAction label={product.title} currentStatus={product.status} options={PRODUCT_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: product.id, status: next })} /></TableCell></TableRow>) : <EmptyRow colSpan={5} />}
      </TableBody></Table><AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} /></CardContent>
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
        {rows.length ? rows.map((order: AdminOrder) => <TableRow key={order.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{order.orderNumber}</p><p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p></TableCell><TableCell><AdminStatusBadge status={order.status} /></TableCell><TableCell><AdminStatusBadge status={order.paymentStatus} /></TableCell><TableCell className="text-sm text-slate-200">{formatMoney(order.grandTotalCents, order.currency)}</TableCell><TableCell className="text-sm text-slate-300">{order.items.length} items, {order.shipments.length} shipments, {order.refunds.length} refunds</TableCell></TableRow>) : <EmptyRow colSpan={5} />}
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
        {rows.length ? rows.map((refund: AdminRefund) => <TableRow key={refund.id} className="border-white/8 hover:bg-white/4"><TableCell className="px-5 py-4"><p className="font-medium text-white">{refund.reason ?? "Refund request"}</p><p className="text-xs text-slate-500">{formatDate(refund.createdAt)}</p></TableCell><TableCell><p className="text-sm text-slate-200">{refund.order.orderNumber}</p><p className="text-xs text-slate-500">{refund.payment.provider}</p></TableCell><TableCell className="text-sm text-slate-200">{formatMoney(refund.amountCents, refund.payment.currency)}</TableCell><TableCell><AdminStatusBadge status={refund.status} /></TableCell><TableCell className="flex justify-end"><AdminStatusAction label={refund.order.orderNumber} currentStatus={refund.status} options={REFUND_STATUSES} isPending={updateStatus.isPending} onConfirm={(next) => updateStatus.mutate({ id: refund.id, status: next })} /></TableCell></TableRow>) : <EmptyRow colSpan={5} />}
      </TableBody></Table><AdminTablePagination page={page} totalPages={query.data?.pagination.totalPages ?? 1} total={query.data?.pagination.total ?? 0} visible={rows.length} onPageChange={setPage} /></CardContent>
    </AdminDataShell>
  );
}
