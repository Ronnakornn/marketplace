"use client";

import { formatMinorCurrency, compareMinorUnits, type MinorUnitValue } from "#/lib/money";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useDebouncedSearch } from "../hooks/useDebouncedSearch";
import { useSearchParams } from "next/navigation";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { AlertTriangleIcon, ArrowUpRightIcon, BanknoteIcon, PackageCheckIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { decimalInputToMinorUnits } from "#/lib/input-decimal";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { SellerPageHeader } from "./SellerShell";
import { SellerDataTable } from "./SellerDataTable";
import { SellerFlashSaleEnrollmentForm } from "./SellerFlashSaleEnrollmentForm";
import {
  type SellerDashboard,
  type SellerInventoryResponse,
  type SellerCoupon,
  type SellerFlashSale,
  type SellerPayout,
  type SellerReturn,
  type SellerShipment,
  type SellerShipmentFilters,
  type SellerShopStaff,
  type SellerTransactions,
  useApproveReturn,
  useCreateSellerCoupon,
  useCreateSellerPayout,
  useDeleteSellerCoupon,
  useDeleteSellerFlashSaleItem,
  usePackShipment,
  useRejectReturn,
  useSellerCoupons,
  useSellerFlashSales,
  useSellerDashboard,
  useSellerDashboardReviews,
  useSellerInventory,
  useSellerPayouts,
  useSellerReturns,
  useSellerShopList,
  useSellerShopProfile,
  useSellerShopSettings,
  useSellerShopStaff,
  useSellerShipments,
  useSellerTransactions,
  useSellerWallet,
  useShipShipment,
  useUpdateSellerShopSettings,
  useUpdateSellerShopProfile,
  useInviteSellerShopStaff,
  useRemoveSellerShopStaff,
  useUpdateSellerShopStaff,
  useUpdateSellerCoupon,
  useUpdateSellerFlashSaleItem,
  useUpdateSellerInventory,
} from "../hooks/useSellerManage";

function formatMoney(cents: MinorUnitValue | undefined, currency = "THB") {
  return formatMinorCurrency(cents ?? 0, "en-US", currency ?? "THB");
}

function formatTransactionType(type: string, t: (key: string) => string) {
  const keys: Record<string, string> = {
    order_earning: "orderEarning",
    commission_fee: "commissionFee",
    payout_reserved: "payoutReserved",
    payout_paid: "payoutPaid",
    payout_rejected: "payoutRejected",
    refund_adjustment: "refundAdjustment",
    manual_adjustment: "manualAdjustment",
  };
  const key = keys[type.toLowerCase()];
  return key ? t(`seller.manage.pages.finance.transactionTypes.${key}`) : type.replaceAll("_", " ");
}

function formatTransactionDescription(type: string, description: string | null | undefined, t: (key: string) => string) {
  const keys: Record<string, string> = {
    order_earning: "orderEarning",
    commission_fee: "commissionFee",
    payout_reserved: "payoutReserved",
    payout_paid: "payoutPaid",
    payout_rejected: "payoutRejected",
    refund_adjustment: "refundAdjustment",
    manual_adjustment: "manualAdjustment",
  };
  const key = keys[type.toLowerCase()];
  if (!key) return description;
  const orderNumber = description?.match(/(?:Order earning for|Platform commission for)\s+(.+)$/i)?.[1];
  return t(`seller.manage.pages.finance.transactionDescriptions.${key}`).replace("{orderNo}", orderNumber ?? "");
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusPill({ value }: { value: string }) {
  const t = useTranslations();
  const statusLabels: Record<string, string> = {
    ACTIVE: t("seller.manage.status.active"),
    INACTIVE: t("seller.manage.status.inactive"),
    PENDING: t("seller.manage.status.pending"),
    PENDING_PAYMENT: t("seller.manage.status.pendingPayment"),
    PENDING_PACK: t("seller.manage.status.pendingPack"),
    PACKED: t("seller.manage.status.packed"),
    SHIPPED: t("seller.manage.status.shipped"),
    DELIVERED: t("seller.manage.status.delivered"),
    PAID: t("seller.manage.status.paid"),
    REQUESTED: t("seller.manage.status.requested"),
    APPROVED: t("seller.manage.status.approved"),
    REJECTED: t("seller.manage.status.rejected"),
    RECEIVED: t("admin.statuses.RECEIVED"),
    COMPLETED: t("seller.manage.status.completed"),
    CANCELLED: t("seller.manage.status.cancelled"),
  };
  const normalizedValue = value.toUpperCase().replaceAll("-", "_");
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PENDING_PACK: "bg-amber-50 text-amber-800 border-amber-200",
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    REQUESTED: "bg-amber-50 text-amber-800 border-amber-200",
    PACKED: "bg-sky-50 text-sky-700 border-sky-200",
    SHIPPED: "bg-sky-50 text-sky-700 border-sky-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
    CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return <Badge variant="outline" className={colors[normalizedValue] ?? "border-slate-200 bg-slate-50 text-slate-600"}>{statusLabels[normalizedValue] ?? value.replaceAll("_", " ")}</Badge>;
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  const message = error instanceof Error && error.message !== '[object Object]' ? error.message : t("seller.manage.loadError");
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <p className="text-sm text-red-700">{message}</p>
        <Button type="button" variant="outline" onClick={retry}>{t("seller.manage.retry")}</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">{message}</div>;
}

function LocalizedShopContentForm({ shopId, profile, settings }: {
  shopId: string;
  profile: { description: string | null; descriptionTh: string | null; descriptionEn: string | null };
  settings: { shippingPolicy: string | null; shippingPolicyTh: string | null; shippingPolicyEn: string | null; returnPolicy: string | null; returnPolicyTh: string | null; returnPolicyEn: string | null };
}) {
  const t = useTranslations();
  const updateProfile = useUpdateSellerShopProfile();
  const updateSettings = useUpdateSellerShopSettings();
  const [values, setValues] = useState({
    description: profile.description ?? "", descriptionTh: profile.descriptionTh ?? "", descriptionEn: profile.descriptionEn ?? "",
    shippingPolicy: settings.shippingPolicy ?? "", shippingPolicyTh: settings.shippingPolicyTh ?? "", shippingPolicyEn: settings.shippingPolicyEn ?? "",
    returnPolicy: settings.returnPolicy ?? "", returnPolicyTh: settings.returnPolicyTh ?? "", returnPolicyEn: settings.returnPolicyEn ?? "",
  });
  const field = (name: keyof typeof values, label: string) => <div className="space-y-2"><Label htmlFor={`shop-${name}`}>{label}</Label><Textarea id={`shop-${name}`} value={values[name]} maxLength={5000} rows={3} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} /></div>;

  async function save(event: FormEvent) {
    event.preventDefault();
    const nullable = (value: string) => value.trim() || null;
    try {
      await Promise.all([
        updateProfile.mutateAsync({ shopId, description: nullable(values.description), descriptionTh: nullable(values.descriptionTh), descriptionEn: nullable(values.descriptionEn) }),
        updateSettings.mutateAsync({ shopId, shippingPolicy: nullable(values.shippingPolicy), shippingPolicyTh: nullable(values.shippingPolicyTh), shippingPolicyEn: nullable(values.shippingPolicyEn), returnPolicy: nullable(values.returnPolicy), returnPolicyTh: nullable(values.returnPolicyTh), returnPolicyEn: nullable(values.returnPolicyEn) }),
      ]);
      toast.success(t("seller.manage.localizedContentSaved"));
    } catch { toast.error(t("seller.manage.localizedContentFailed")); }
  }

  return <form className="space-y-4 rounded-lg border border-slate-200 px-3 py-3" onSubmit={save}>
    <p className="text-sm font-semibold text-slate-900">{t("seller.manage.localizedContentTitle")}</p>
    <div className="grid gap-3 md:grid-cols-3">{field("description", t("seller.manage.baseDescription"))}{field("descriptionTh", t("seller.manage.thaiDescription"))}{field("descriptionEn", t("seller.manage.englishDescription"))}</div>
    <div className="grid gap-3 md:grid-cols-3">{field("shippingPolicy", t("seller.manage.baseShippingPolicy"))}{field("shippingPolicyTh", t("seller.manage.thaiShippingPolicy"))}{field("shippingPolicyEn", t("seller.manage.englishShippingPolicy"))}</div>
    <div className="grid gap-3 md:grid-cols-3">{field("returnPolicy", t("seller.manage.baseReturnPolicy"))}{field("returnPolicyTh", t("seller.manage.thaiReturnPolicy"))}{field("returnPolicyEn", t("seller.manage.englishReturnPolicy"))}</div>
    <Button type="submit" size="sm" disabled={updateProfile.isPending || updateSettings.isPending}>{t("seller.manage.saveLocalizedContent")}</Button>
  </form>;
}

function ShippingFeeForm({ shopId, shippingFeeBaht }: { shopId: string; shippingFeeBaht: number | string }) {
  const t = useTranslations();
  const updateSettings = useUpdateSellerShopSettings();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateSettings.mutate({
      shopId,
      shippingFeeBaht: String(data.get("shippingFeeBaht")),
    }, {
      onSuccess: () => toast.success(t("seller.manage.shippingFeeSaved")),
      onError: () => toast.error(t("seller.manage.shippingFeeFailed")),
    });
  }

  return (
    <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={save}>
      <div className="w-full space-y-2 sm:max-w-56">
        <Label htmlFor="shop-shipping-fee">{t("seller.manage.shippingFeeBaht")}</Label>
        <Input
          id="shop-shipping-fee"
          name="shippingFeeBaht"
          type="number"
          min="0"
          max="100000"
          step="0.01"
          defaultValue={shippingFeeBaht}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={updateSettings.isPending}>
        {t("seller.manage.saveShippingFee")}
      </Button>
    </form>
  );
}

function ShopProfileForm({ shopId, profile }: { shopId: string; profile: { name: string; slug: string; contactEmail: string; contactPhone: string; logoUrl: string | null; coverUrl: string | null } }) {
  const t = useTranslations(); const update = useUpdateSellerShopProfile();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const nullable = (name: string) => String(data.get(name) ?? '').trim() || null;
    update.mutate({ shopId, name: String(data.get('name') ?? ''), slug: String(data.get('slug') ?? ''), contactEmail: String(data.get('contactEmail') ?? ''), contactPhone: String(data.get('contactPhone') ?? ''), logoUrl: nullable('logoUrl'), coverUrl: nullable('coverUrl') }, { onSuccess: () => toast.success(t('seller.manage.profileSaved')), onError: () => toast.error(t('seller.manage.profileSaveFailed')) });
  }
  return <form className="grid gap-3 rounded-lg border border-slate-200 px-3 py-3 sm:grid-cols-2" onSubmit={save}>
    <div className="space-y-2"><Label htmlFor="shop-name">{t('seller.manage.shopName')}</Label><Input id="shop-name" name="name" defaultValue={profile.name} required /></div>
    <div className="space-y-2"><Label htmlFor="shop-slug">{t('seller.manage.shopSlug')}</Label><Input id="shop-slug" name="slug" defaultValue={profile.slug} required /></div>
    <div className="space-y-2"><Label htmlFor="shop-email">{t('seller.manage.contactEmail')}</Label><Input id="shop-email" name="contactEmail" type="email" defaultValue={profile.contactEmail} required /></div>
    <div className="space-y-2"><Label htmlFor="shop-phone">{t('seller.manage.contactPhone')}</Label><Input id="shop-phone" name="contactPhone" defaultValue={profile.contactPhone} required /></div>
    <div className="space-y-2"><Label htmlFor="shop-logo">{t('seller.manage.logoUrl')}</Label><Input id="shop-logo" name="logoUrl" defaultValue={profile.logoUrl ?? ''} /></div>
    <div className="space-y-2"><Label htmlFor="shop-cover">{t('seller.manage.coverUrl')}</Label><Input id="shop-cover" name="coverUrl" defaultValue={profile.coverUrl ?? ''} /></div>
    <Button type="submit" size="sm" className="w-fit" disabled={update.isPending}>{t('seller.manage.saveProfile')}</Button>
  </form>
}

function ShopStaffPanel({ shopId }: { shopId: string }) {
  const t = useTranslations();
  const staffQuery = useSellerShopStaff(shopId);
  const invite = useInviteSellerShopStaff();
  const update = useUpdateSellerShopStaff();
  const remove = useRemoveSellerShopStaff();
  const [staffRole, setStaffRole] = useState<'MANAGER' | 'WAREHOUSE' | 'SUPPORT'>('MANAGER');

  function inviteStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    invite.mutate({ shopId, email: String(data.get('staffEmail') ?? ''), role: staffRole }, {
      onSuccess: () => { event.currentTarget.reset(); toast.success(t('seller.manage.staffInviteSaved')); },
      onError: () => toast.error(t('seller.manage.staffInviteFailed')),
    });
  }

  return <div className="space-y-3 rounded-lg border border-slate-200 px-3 py-3">
    <div><p className="text-sm font-semibold text-slate-900">{t('seller.manage.staffTitle')}</p><p className="mt-1 text-xs text-slate-600">{t('seller.manage.staffDescription')}</p></div>
    <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]" onSubmit={inviteStaff}>
      <Input name="staffEmail" type="email" required placeholder={t('seller.manage.staffEmail')} aria-label={t('seller.manage.staffEmail')} />
      <Select value={staffRole} onValueChange={(role) => setStaffRole(role as 'MANAGER' | 'WAREHOUSE' | 'SUPPORT')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANAGER">{t('seller.manage.staffRoles.manager')}</SelectItem><SelectItem value="WAREHOUSE">{t('seller.manage.staffRoles.warehouse')}</SelectItem><SelectItem value="SUPPORT">{t('seller.manage.staffRoles.support')}</SelectItem></SelectContent></Select>
      <Button type="submit" size="sm" disabled={invite.isPending}>{t('seller.manage.inviteStaff')}</Button>
    </form>
    {staffQuery.isLoading ? <p className="text-xs text-slate-500">{t('seller.manage.loadingStaff')}</p> : null}
    {staffQuery.error ? <p className="text-xs text-red-700">{t('seller.manage.staffLoadError')}</p> : null}
    <div className="space-y-2">
      {staffQuery.data?.map((staff: SellerShopStaff) => <div key={staff.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
        <div className="min-w-40 flex-1"><p className="text-sm font-medium text-slate-900">{staff.user.name}</p><p className="text-xs text-slate-500">{staff.user.email} · {staff.permissions.join(', ')}</p></div>
        <Select value={staff.role} onValueChange={(role) => update.mutate({ shopId, staffId: staff.id, role: role as 'MANAGER' | 'WAREHOUSE' | 'SUPPORT' })}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MANAGER">{t('seller.manage.staffRoles.manager')}</SelectItem><SelectItem value="WAREHOUSE">{t('seller.manage.staffRoles.warehouse')}</SelectItem><SelectItem value="SUPPORT">{t('seller.manage.staffRoles.support')}</SelectItem></SelectContent></Select>
        <Button type="button" size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ shopId, staffId: staff.id, status: staff.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' })}>{staff.status === 'SUSPENDED' ? t('seller.manage.activateStaff') : t('seller.manage.suspendStaff')}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ shopId, staffId: staff.id })}>{t('seller.manage.removeStaff')}</Button>
      </div>)}
      {!staffQuery.isLoading && !staffQuery.error && !staffQuery.data?.length ? <p className="text-xs text-slate-500">{t('seller.manage.noStaff')}</p> : null}
    </div>
  </div>
}

export function SellerStaffPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const shopsQuery = useSellerShopList();
  const shopId = searchParams.get('shopId') ?? shopsQuery.data?.activeShopId ?? shopsQuery.data?.shops[0]?.id;
  return <><SellerPageHeader title={t('seller.nav.staff')} description={t('seller.manage.staffDescription')} />{shopId ? <ShopStaffPanel shopId={shopId} /> : <EmptyState message={t('seller.manage.noShopContext')} />}</>;
}

export function SellerShopProfilePage({ shopId: selectedShopId }: { shopId?: string }) {
  const t = useTranslations();
  const shopsQuery = useSellerShopList();
  const shopId = selectedShopId ?? shopsQuery.data?.activeShopId ?? shopsQuery.data?.shops[0]?.id;
  const profileQuery = useSellerShopProfile(shopId); const settingsQuery = useSellerShopSettings(shopId); const updateSettings = useUpdateSellerShopSettings();
  const retry = () => { void profileQuery.refetch(); void settingsQuery.refetch(); };
  const toggle = (field: 'vacationMode' | 'chatEnabled') => {
    if (!shopId || !settingsQuery.data) return;
    updateSettings.mutate({ shopId, [field]: !settingsQuery.data[field] }, { onSuccess: () => toast.success(t('seller.manage.shopSettingsSaved')), onError: () => toast.error(t('seller.manage.shopSettingsFailed')) });
  };
  return <><SellerPageHeader title={t('seller.nav.shopProfile')} description={t('seller.manage.shopProfileDescription')} />
    {!shopId ? <EmptyState message={t('seller.manage.noShopContext')} /> : null}
    {shopId && (profileQuery.isLoading || settingsQuery.isLoading) ? <EmptyState message={t('seller.manage.loadingShopProfile')} /> : null}
    {shopId && (profileQuery.error || settingsQuery.error) ? <ErrorState error={profileQuery.error ?? settingsQuery.error} retry={retry} /> : null}
    {shopId && profileQuery.data && settingsQuery.data ? <div className="space-y-4"><ShopProfileForm key={`profile-${shopId}`} shopId={shopId} profile={profileQuery.data} /><section className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-sm font-semibold text-slate-900">{t('seller.manage.shopSettingsLabel')}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={updateSettings.isPending} onClick={() => toggle('vacationMode')}>{settingsQuery.data.vacationMode ? t('seller.manage.disableVacation') : t('seller.manage.enableVacation')}</Button><Button type="button" size="sm" variant="outline" disabled={updateSettings.isPending} onClick={() => toggle('chatEnabled')}>{settingsQuery.data.chatEnabled ? t('seller.manage.disableChat') : t('seller.manage.enableChat')}</Button></div><ShippingFeeForm shopId={shopId} shippingFeeBaht={settingsQuery.data.shippingFeeBaht} /></section><LocalizedShopContentForm key={`content-${shopId}`} shopId={shopId} profile={profileQuery.data} settings={settingsQuery.data} /></div> : null}
  </>;
}

export function SellerDashboardPage() {
  const t = useTranslations();
  const localePath = useLocalePath();
  const searchParams = useSearchParams();
  const selectedShopId = searchParams.get("shopId") || undefined;
  const dashboardQuery = useSellerDashboard(selectedShopId);
  const reviewsQuery = useSellerDashboardReviews({ shopId: selectedShopId, limit: 5 });
  const dashboard = dashboardQuery.data;
  const sellerHref = (path: string, filter?: string) => {
    const params = new URLSearchParams();
    if (selectedShopId) params.set("shopId", selectedShopId);
    if (filter) params.set("status", filter);
    return localePath(`${path}${params.size ? `?${params}` : ""}`);
  };
  const recentOrderColumns: ColumnDef<NonNullable<SellerDashboard>["recentOrders"][number]>[] = [
    { accessorKey: "orderNo", header: t("seller.manage.pages.orders.order"), cell: ({ row }) => <Link href={sellerHref("/seller/orders")} className="font-semibold text-slate-900 hover:underline">{row.original.orderNo}</Link> },
    { id: "items", header: t("seller.manage.pages.orders.items"), accessorFn: (order) => order.items.length, cell: ({ row }) => <span className="text-slate-500">{row.original.items.length} {t("seller.manage.itemsLabel")}</span> },
    { accessorKey: "totalCents", sortingFn: (first, second) => compareMinorUnits(first.original.totalCents, second.original.totalCents), header: t("seller.operationsUi.amount"), cell: ({ row }) => <span className="font-medium tabular-nums">{formatMoney(row.original.totalCents)}</span> },
    { accessorKey: "status", header: t("seller.manage.pages.orders.status"), cell: ({ row }) => <StatusPill value={row.original.status} /> },
  ];

  if (dashboardQuery.error) return <ErrorState error={dashboardQuery.error} retry={() => void dashboardQuery.refetch()} />;

  const cards = [
    { label: t("seller.manage.cards.todaySales"), value: formatMoney(dashboard?.sales.todaySalesCents), icon: BanknoteIcon },
    { label: t("seller.manage.cards.monthSales"), value: formatMoney(dashboard?.sales.thisMonthSalesCents), icon: BanknoteIcon },
    { label: t("seller.manage.cards.pendingPack"), value: String(dashboard?.orders.pendingPack ?? 0), icon: PackageCheckIcon, href: sellerHref("/seller/orders", "pending_pack"), action: t("seller.operationsUi.packOrders") },
    { label: t("seller.manage.cards.lowStock"), value: String(dashboard?.products.lowStock ?? 0), icon: AlertTriangleIcon, href: sellerHref("/seller/inventory"), action: t("seller.manage.restock") },
  ];

  function formatReviewStatus(status: string) {
    if (status === "PENDING") return t("seller.manage.reviewStatus.pending");
    if (status === "PUBLISHED") return t("seller.manage.reviewStatus.published");
    if (status === "REJECTED") return t("seller.manage.reviewStatus.rejected");
    if (status === "HIDDEN") return t("seller.manage.reviewStatus.hidden");
    return status;
  }

  return (
    <>
      <SellerPageHeader title={t("seller.manage.dashboardTitle")} description={t("seller.manage.dashboardDescription")} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-xl border-slate-200 bg-white shadow-none">
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{dashboardQuery.isLoading ? "..." : card.value}</p>
                {card.href ? <Link href={card.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-orange-600">{card.action}<ArrowUpRightIcon className="size-3.5" aria-hidden="true" /></Link> : null}
              </div>
              <span className="rounded-lg bg-slate-50 p-2 text-slate-500"><card.icon className="size-5" aria-hidden="true" /></span>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 rounded-xl border-slate-200 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base">{t("seller.manage.recentOrdersTitle")}</CardTitle><Link href={sellerHref("/seller/orders")} className="text-xs font-medium text-slate-500 hover:text-orange-600">{t("seller.operationsUi.viewOrders")}</Link></CardHeader>
          <CardContent>
            <SellerDataTable columns={recentOrderColumns} data={dashboard?.recentOrders ?? []} getRowId={(order) => order.orderId} isLoading={dashboardQuery.isLoading} loadingMessage={t("seller.manage.loadingOrders")} emptyMessage={t("seller.manage.noRecentOrders")} hidePagination pageSize={6} searchable={false} columnVisibilityEnabled={false} />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-none">
          <CardHeader><CardTitle>{t("seller.manage.lowStockTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.lowStockItems.length ? dashboard.lowStockItems.slice(0, 6).map((item) => (
              <div key={item.variantId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{item.productTitle}</p>
                  <p className="text-xs text-slate-500">{item.sku} · {t("seller.manage.availableLabel")} {item.availableQuantity}</p>
                </div>
                <Link href={sellerHref("/seller/inventory")} className="shrink-0 text-xs font-semibold text-slate-700 hover:text-orange-600">{t("seller.manage.restock")}</Link>
              </div>
            )) : <EmptyState message={dashboardQuery.isLoading ? t("seller.manage.loadingAlerts") : t("seller.manage.noLowStock")} />}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>{t("seller.manage.shopInsightsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.manage.avgRating")}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{Number(dashboard?.shopInsights.averageRating ?? 0).toFixed(2)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.manage.publishedReviews")}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{dashboard?.shopInsights.publishedReviewCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.manage.pendingModeration")}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{dashboard?.shopInsights.pendingReviewCount ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{t("seller.manage.recentShopReviewsTitle")}</p>
              {reviewsQuery.isLoading ? <EmptyState message={t("seller.manage.loadingReviews")} /> : null}
              {reviewsQuery.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">{t("seller.manage.reviewsLoadError")}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void reviewsQuery.refetch()}>
                    {t("seller.manage.retry")}
                  </Button>
                </div>
              ) : null}
              {!reviewsQuery.isLoading && !reviewsQuery.error && !reviewsQuery.data?.length ? (
                <EmptyState message={t("seller.manage.noReviewsYet")} />
              ) : null}
              {reviewsQuery.data?.map((review) => (
                <div key={review.reviewId} className="rounded-lg border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{review.shopName}</p>
                    <StatusPill value={formatReviewStatus(review.status)} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{review.buyerName} · {review.rating}/5</p>
                  <p className="mt-2 text-sm text-slate-700">{review.comment || t("seller.manage.noReviewComment")}</p>
                  {review.status === "REJECTED" || review.status === "HIDDEN" ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">{t("seller.manage.reviewModerationReason")}: {review.moderationReason || t("seller.manage.noModerationReason")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </section>
    </>
  );
}

export function SellerInventoryPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const debouncedSearch = useDebouncedSearch(search, setPagination);
  const query = useSellerInventory({ page: pagination.pageIndex + 1, limit: pagination.pageSize, q: debouncedSearch || undefined, status: stockFilter === "all" ? undefined : stockFilter, shopId: searchParams.get("shopId") || undefined });
  const updateInventory = useUpdateSellerInventory();
  const variants = query.data?.data ?? [];
  const columns = useMemo<ColumnDef<NonNullable<SellerInventoryResponse>["data"][number]>[]>(() => [
    {
      id: "variant",
      accessorFn: (row) => `${row.productTitle} ${row.variantTitle} ${row.sku}`,
      header: t("seller.manage.pages.inventory.variant"),
      cell: ({ row }) => <><p className="font-medium text-slate-900">{row.original.productTitle}</p><p className="text-xs text-slate-500">{row.original.sku} · {row.original.variantTitle}</p></>,
      enableHiding: false,
    },
    { accessorKey: "quantityOnHand", header: t("seller.manage.pages.inventory.onHand") },
    {
      accessorKey: "quantityReserved",
      header: t("seller.manage.pages.inventory.reserved"),
      cell: ({ row }) => <Input aria-label={t("seller.manage.pages.inventory.reservedStock").replace("{sku}", row.original.sku)} value={row.original.quantityReserved} readOnly className="w-20 border-transparent bg-slate-50 text-slate-500 shadow-none" />,
    },
    {
      accessorKey: "availableStock",
      header: t("seller.manage.pages.inventory.available"),
      cell: ({ row }) => <span className={row.original.availableStock <= row.original.reorderLevel ? "font-semibold text-amber-700" : "font-medium tabular-nums"}>{row.original.availableStock}</span>,
    },
    { accessorKey: "reorderLevel", header: t("seller.manage.pages.inventory.reorder") },
    {
      id: "update",
      header: () => <span className="sr-only">{t("seller.manage.pages.inventory.update")}</span>,
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => <form className="flex min-w-56 justify-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        updateInventory.mutate({ productId: row.original.productId, variantId: row.original.variantId, quantityOnHand: Number(formData.get("quantityOnHand")), reorderLevel: Number(formData.get("reorderLevel")) }, { onError: (error) => toast.error(error instanceof Error ? error.message : t("seller.manage.pages.inventory.updateFailed")) });
      }}><Input name="quantityOnHand" aria-label={t("seller.manage.pages.inventory.quantityOnHand")} type="number" min={0} defaultValue={row.original.quantityOnHand} className="w-24" /><Input name="reorderLevel" aria-label={t("seller.manage.pages.inventory.reorderLevel")} type="number" min={0} defaultValue={row.original.reorderLevel} className="w-24" /><Button type="submit" size="sm" disabled={updateInventory.isPending}>{t("seller.manage.pages.inventory.save")}</Button></form>,
    },
  ], [t, updateInventory]);

  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.inventory.title")} description={t("seller.manage.pages.inventory.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="pt-6">{updateInventory.isPending ? <p className="mb-3 text-sm text-slate-500">{t("seller.manage.pages.inventory.saving")}</p> : null}<SellerDataTable columns={columns} data={variants} getRowId={(row) => row.variantId} searchable={false} isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.inventory.loading")} emptyMessage={t("seller.manage.pages.inventory.empty")} pagination={{ ...pagination, totalRows: query.data?.meta.totalCount ?? 0, onPaginationChange: setPagination }} className="overflow-x-auto" renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder={t("seller.manage.pages.inventory.search")} aria-label={t("seller.manage.pages.inventory.search")} className="sm:max-w-sm" /><Select value={stockFilter} onValueChange={(value) => { if (value === "all" || value === "low" || value === "out") { setStockFilter(value); setPagination((current) => ({ ...current, pageIndex: 0 })); } }}><SelectTrigger className="sm:w-56" aria-label={t("seller.manage.pages.inventory.filterStock")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("seller.manage.pages.inventory.allStock")}</SelectItem><SelectItem value="low">{t("seller.manage.pages.inventory.lowStockOnly")}</SelectItem><SelectItem value="out">{t("seller.manage.pages.inventory.outOfStock")}</SelectItem></SelectContent></Select></div>} /></CardContent></Card>
    </>
  );
}

export function SellerOrdersPage() {
  const t = useTranslations();
  const shippingTrigger = useRef<HTMLButtonElement | null>(null);
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const status = searchParams.get("status");
    return status && ["pending_pack", "packed", "shipped", "delivered"].includes(status) ? status : "all";
  });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [shipping, setShipping] = useState<{
    shipment: SellerShipment;
    carrier: string;
    trackingNo: string;
    open: boolean;
    error: string;
  } | null>(null);
  const status: SellerShipmentFilters["status"] = statusFilter === "pending_pack" ? "PENDING_PACK"
    : statusFilter === "packed" ? "PACKED" : statusFilter === "shipped" ? "SHIPPED"
    : statusFilter === "delivered" ? "DELIVERED" : undefined;
  const debouncedSearch = useDebouncedSearch(search, setPagination);
  const query = useSellerShipments({ page: pagination.pageIndex + 1, limit: pagination.pageSize, q: debouncedSearch || undefined, status, shopId: searchParams.get("shopId") || undefined });
  const pack = usePackShipment();
  const ship = useShipShipment();
  const rows = query.data?.data ?? [];
  const columns = useMemo<ColumnDef<SellerShipment>[]>(() => [
    {
      accessorKey: "orderNo",
      header: t("seller.manage.pages.orders.order"),
      cell: ({ row }) => <span className="font-medium">{row.original.orderNo}</span>,
    },
    {
      id: "recipient",
      accessorFn: (shipment) => shipment.shippingAddress.name,
      header: t("seller.manage.pages.orders.recipient"),
      cell: ({ row }) => row.original.shippingAddress.name,
    },
    {
      id: "items",
      header: t("seller.manage.pages.orders.items"),
      cell: ({ row }) => (
        <div className="max-w-64 space-y-0.5 text-sm">
          {row.original.items.map((item) => (
            <p key={item.id}>{item.productTitle} x{item.quantity}</p>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t("seller.manage.pages.orders.status"),
      cell: ({ row }) => <StatusPill value={row.original.status} />,
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">{t("seller.manage.pages.orders.actions")}</span>,
      cell: ({ row }) => {
        const shipment = row.original;
        return (
          <div className="flex justify-end gap-2">
            {shipment.status === "pending_pack" ? <Button type="button" size="sm" variant="outline" disabled={pack.isPending} onClick={() => pack.mutate(shipment.id, { onSuccess: () => toast.success(t("seller.operationsUi.packedSaved")), onError: () => toast.error(t("seller.operationsUi.packFailed")) })}>
              <PackageCheckIcon className="size-4" aria-hidden="true" />
              {t("seller.manage.pages.orders.markPacked")}
            </Button> : null}
            {shipment.status === "packed" ? <Button type="button" size="sm" disabled={ship.isPending} onClick={(event) => {
              shippingTrigger.current = event.currentTarget;
              setShipping((current) => current?.shipment.id === shipment.id ? { ...current, shipment, open: true, error: "" } : { shipment, carrier: shipment.carrier ?? "", trackingNo: shipment.trackingNumber ?? "", open: true, error: "" });
            }}><TruckIcon className="size-4" aria-hidden="true" />{t("seller.manage.pages.orders.ship")}</Button> : null}
            {shipment.status === "shipped" || shipment.status === "delivered" ? <span className="text-xs text-slate-500">{[shipment.carrier, shipment.trackingNumber].filter(Boolean).join(" · ")}</span> : null}
          </div>
        );
      },
    },
  ], [pack, ship, t]);

  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.orders.title")} description={t("seller.manage.pages.orders.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="p-4 sm:p-6">
          <SellerDataTable
            columns={columns}
            data={rows}
            pagination={{ ...pagination, totalRows: query.data?.meta.totalCount ?? 0, onPaginationChange: setPagination }}
            getRowId={(row) => row.id}
            searchable={false}
            isLoading={query.isLoading}
            loadingMessage={t("seller.manage.pages.orders.loading")}
            emptyMessage={t("seller.manage.pages.orders.empty")}
            pageSize={10}
            className="overflow-x-auto"
            renderToolbar={() => (
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <Input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder={t("seller.manage.pages.orders.search")} aria-label={t("seller.manage.pages.orders.search")} className="sm:max-w-sm" />
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPagination((current) => ({ ...current, pageIndex: 0 })); }}>
                  <SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.orders.filterStatus")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("seller.manage.pages.orders.allStatuses")}</SelectItem>
                    <SelectItem value="pending_pack">{t("seller.manage.status.pendingPack")}</SelectItem>
                    <SelectItem value="packed">{t("seller.manage.status.packed")}</SelectItem>
                    <SelectItem value="shipped">{t("seller.manage.status.shipped")}</SelectItem>
                    <SelectItem value="delivered">{t("seller.manage.status.delivered")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </CardContent>
      </Card>
      <Dialog open={shipping?.open ?? false} onOpenChange={(open) => { if (!ship.isPending) setShipping((current) => current ? { ...current, open } : null); }}>
        <DialogContent showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); shippingTrigger.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t("seller.operationsUi.shipDialogTitle")}</DialogTitle>
            <DialogDescription>{t("seller.operationsUi.shipDialogDescription").replace("{orderNo}", shipping?.shipment.orderNo ?? "")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-5" noValidate onSubmit={(event) => {
            event.preventDefault();
            if (!shipping || ship.isPending) return;
            const carrier = shipping.carrier.trim();
            const trackingNo = shipping.trackingNo.trim();
            if (!carrier || !trackingNo) {
              setShipping({ ...shipping, error: t("seller.operationsUi.shippingRequired") });
              return;
            }
            ship.mutate({ shipmentId: shipping.shipment.id, carrier, trackingNo }, {
              onSuccess: () => { toast.success(t("seller.operationsUi.shippingSaved")); setShipping(null); },
              onError: () => setShipping((current) => current ? { ...current, error: t("seller.operationsUi.shippingFailed") } : null),
            });
          }}>
            <div className="space-y-2"><Label htmlFor="shipment-carrier">{t("seller.manage.pages.orders.carrier")}</Label><Input id="shipment-carrier" name="carrier" value={shipping?.carrier ?? ""} required disabled={ship.isPending} aria-invalid={Boolean(shipping?.error && !shipping.carrier.trim())} aria-describedby={shipping?.error ? "shipment-error" : undefined} onChange={(event) => setShipping((current) => current ? { ...current, carrier: event.target.value, error: "" } : null)} /></div>
            <div className="space-y-2"><Label htmlFor="shipment-tracking">{t("seller.manage.pages.orders.tracking")}</Label><Input id="shipment-tracking" name="trackingNo" value={shipping?.trackingNo ?? ""} required disabled={ship.isPending} aria-invalid={Boolean(shipping?.error && !shipping.trackingNo.trim())} aria-describedby={shipping?.error ? "shipment-error" : undefined} onChange={(event) => setShipping((current) => current ? { ...current, trackingNo: event.target.value, error: "" } : null)} /></div>
            {shipping?.error ? <p id="shipment-error" role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{shipping.error}</p> : null}
            <DialogFooter><Button type="button" variant="outline" disabled={ship.isPending} onClick={() => setShipping((current) => current ? { ...current, open: false } : null)}>{t("common.cancel")}</Button><Button type="submit" disabled={ship.isPending}>{ship.isPending ? t("seller.operationsUi.shippingSaving") : t("seller.manage.pages.orders.ship")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SellerReturnsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const debouncedSearch = useDebouncedSearch(search, setPagination);
  const query = useSellerReturns({ page: pagination.pageIndex + 1, limit: pagination.pageSize, q: debouncedSearch || undefined, status: statusFilter === "all" ? undefined : statusFilter });
  const approve = useApproveReturn();
  const reject = useRejectReturn();
  const columns = useMemo<ColumnDef<SellerReturn>[]>(() => [
    {
      id: "return",
      accessorFn: (request) => request.reason,
      enableHiding: false,
      header: t("seller.manage.pages.returns.return"),
      cell: ({ row }) => <><p className="font-medium">{row.original.reason ?? t("seller.manage.pages.returns.request")}</p><p className="text-xs text-slate-500">{formatDate(row.original.createdAt)}</p></>,
    },
    {
      id: "items",
      header: t("seller.manage.pages.returns.items"),
      cell: ({ row }) => row.original.items.map((item) => `${item.productTitle} x${item.quantity}`).join(", "),
    },
    {
      accessorKey: "status",
      header: t("seller.manage.pages.returns.status"),
      cell: ({ row }) => <StatusPill value={row.original.status} />,
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">{t("seller.manage.pages.returns.actions")}</span>,
      cell: ({ row }) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={approve.isPending || row.original.status !== "requested"} onClick={() => approve.mutate(row.original.id)}>{t("seller.manage.pages.returns.approve")}</Button><Button size="sm" variant="destructive" disabled={reject.isPending || row.original.status !== "requested"} onClick={() => reject.mutate(row.original.id)}>{t("seller.manage.pages.returns.reject")}</Button></div>,
    },
  ], [approve, reject, t]);
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.returns.title")} description={t("seller.manage.pages.returns.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-4 sm:p-6">
        <SellerDataTable columns={columns} data={query.data?.data ?? []} getRowId={(row) => row.id}
          pagination={{ ...pagination, totalRows: query.data?.meta.totalCount ?? 0, onPaginationChange: setPagination }}
          isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.returns.loading")} emptyMessage={t("seller.manage.pages.returns.empty")} className="overflow-x-auto"
          renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder={t("seller.manage.pages.returns.search")} aria-label={t("seller.manage.pages.returns.search")} className="sm:max-w-sm" />
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPagination((page) => ({ ...page, pageIndex: 0 })); }}><SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.returns.filterStatus")}><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="all">{t("seller.manage.pages.returns.allStatuses")}</SelectItem>
              <SelectItem value="requested">{t("seller.manage.status.requested")}</SelectItem>
              <SelectItem value="approved">{t("seller.manage.status.approved")}</SelectItem>
              <SelectItem value="rejected">{t("seller.manage.status.rejected")}</SelectItem>
              <SelectItem value="received">{t("admin.statuses.RECEIVED")}</SelectItem>
              <SelectItem value="completed">{t("seller.manage.status.completed")}</SelectItem>
              <SelectItem value="cancelled">{t("seller.manage.status.cancelled")}</SelectItem>
            </SelectContent></Select>
          </div>} />
      </CardContent></Card>
    </>
  );
}

export function SellerPromotionsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [discountType, setDiscountType] = useState("fixed");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const debouncedSearch = useDebouncedSearch(search, setPagination);
  const query = useSellerCoupons({ page: pagination.pageIndex + 1, limit: pagination.pageSize, q: debouncedSearch || undefined, isActive: activeFilter === "all" ? undefined : activeFilter === "active" });
  const createCoupon = useCreateSellerCoupon();
  const updateCoupon = useUpdateSellerCoupon();
  const deleteCoupon = useDeleteSellerCoupon();
  const rows = query.data?.data ?? [];
  const columns = useMemo<ColumnDef<SellerCoupon>[]>(() => [
    {
      id: "coupon",
      accessorFn: (coupon) => coupon.code,
      enableHiding: false,
      header: t("seller.manage.pages.promotions.coupon"),
      cell: ({ row }) => <><p className="font-medium">{row.original.code}</p><p className="text-xs text-slate-500">{row.original.titleEn ?? row.original.titleTh ?? t("seller.manage.pages.promotions.untitled")}</p></>,
    },
    {
      id: "discount",
      accessorFn: (coupon) => coupon.discountType,
      header: t("seller.manage.pages.promotions.discount"),
      cell: ({ row }) => row.original.discountType,
    },
    {
      id: "active",
      accessorFn: (coupon) => coupon.isActive,
      header: t("seller.manage.pages.promotions.active"),
      cell: ({ row }) => row.original.isActive ? t("seller.manage.status.active") : t("seller.manage.status.inactive"),
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: () => <span className="sr-only">{t("seller.manage.pages.promotions.actions")}</span>,
      cell: ({ row }) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={updateCoupon.isPending} onClick={() => updateCoupon.mutate({ couponId: row.original.id, isActive: !row.original.isActive })}>{row.original.isActive ? t("seller.manage.pages.promotions.disable") : t("seller.manage.pages.promotions.enable")}</Button><Button size="sm" variant="destructive" disabled={deleteCoupon.isPending} onClick={() => deleteCoupon.mutate(row.original.id)}>{t("seller.manage.pages.promotions.delete")}</Button></div>,
    },
  ], [deleteCoupon, t, updateCoupon]);
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.promotions.title")} description={t("seller.manage.pages.promotions.description")} />
      <SellerFlashSalePanel />
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="pt-6">
        <form className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px_auto]" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const type = discountType === "percent" ? "percent" : discountType === "free_shipping" ? "free_shipping" : "fixed";
          const value = decimalInputToMinorUnits(String(data.get("amount") ?? ""));
          createCoupon.mutate({ code: String(data.get("code") ?? ""), titleEn: String(data.get("title") ?? ""),
            discountType: type, discountValueCents: type === "fixed" ? value : null,
            discountPercentBps: type === "percent" ? value : null, isActive: true });
        }}>
          <Input name="code" placeholder={t("seller.manage.pages.promotions.code")} required />
          <Input name="title" placeholder={t("seller.manage.pages.promotions.titleField")} />
          <Select name="discountType" value={discountType} onValueChange={setDiscountType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">{t("seller.manage.pages.promotions.fixed")}</SelectItem><SelectItem value="percent">{t("seller.manage.pages.promotions.percent")}</SelectItem><SelectItem value="free_shipping">{t("home.freeShipping")}</SelectItem></SelectContent></Select>
          <Input name="amount" type="number" min="0.01" step="0.01" max={discountType === "percent" ? 100 : undefined}
            required={discountType !== "free_shipping"} disabled={discountType === "free_shipping"}
            placeholder={t(discountType === "percent" ? "seller.manage.pages.promotions.percent" : "seller.manage.pages.promotions.amount")} />
          <Button type="submit" disabled={createCoupon.isPending}>{t("seller.manage.pages.promotions.create")}</Button>
        </form>
      </CardContent></Card>
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-4 sm:p-6"><SellerDataTable columns={columns} data={rows} pagination={{ ...pagination, totalRows: query.data?.meta.totalCount ?? 0, onPaginationChange: setPagination }} getRowId={(row) => row.id} searchable={false} isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.promotions.loading")} emptyMessage={t("seller.manage.pages.promotions.empty")} pageSize={10} className="overflow-x-auto" renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder={t("seller.manage.pages.promotions.search")} aria-label={t("seller.manage.pages.promotions.search")} className="sm:max-w-sm" /><Select value={activeFilter} onValueChange={(value) => { setActiveFilter(value); setPagination(current => ({ ...current, pageIndex: 0 })); }}><SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.promotions.filterStatus")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("seller.manage.pages.promotions.allStatuses")}</SelectItem><SelectItem value="active">{t("seller.manage.status.active")}</SelectItem><SelectItem value="inactive">{t("seller.manage.status.inactive")}</SelectItem></SelectContent></Select></div>} /></CardContent></Card>
    </>
  );
}

function SellerFlashSalePanel() {
  const t = useTranslations();
  const formatters = useFormatters();
  const campaigns = useSellerFlashSales();
  const shopId = useSearchParams().get("shopId") || undefined;
  const update = useUpdateSellerFlashSaleItem();
  const remove = useDeleteSellerFlashSaleItem();

  return <Card className="rounded-lg border-slate-200 bg-white">
    <CardHeader><CardTitle>{t("seller.manage.pages.promotions.flashSalesTitle")}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {campaigns.error ? <ErrorState error={campaigns.error} retry={() => void campaigns.refetch()} /> : null}
      {campaigns.isLoading ? <EmptyState message={t("seller.manage.pages.promotions.flashSalesLoading")} /> : null}
      {!campaigns.isLoading && !campaigns.data?.length ? <EmptyState message={t("seller.manage.pages.promotions.flashSalesEmpty")} /> : null}
      {campaigns.data?.map((campaign: SellerFlashSale) => <section key={campaign.id} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="font-semibold text-slate-950">{campaign.title}</p><p className="text-xs text-slate-500">{formatters.date(campaign.startsAt)} – {formatters.date(campaign.endsAt)}</p></div>
          <StatusPill value={campaign.status} />
        </div>
        {campaign.status === "SCHEDULED" ? <SellerFlashSaleEnrollmentForm key={`${campaign.id}:${shopId ?? "active-shop"}`} flashSaleId={campaign.id} shopId={shopId} /> : null}
        <div className="space-y-2">{campaign.items.map((item) => <form key={item.id} className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]" onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          update.mutate({ itemId: item.id, salePriceBaht: values.get("salePriceBaht") ? String(values.get("salePriceBaht")) : undefined, stockLimit: values.get("stockLimit") ? Number(values.get("stockLimit")) : undefined, perUserLimit: values.get("perUserLimit") ? Number(values.get("perUserLimit")) : undefined });
        }}>
          <div><p className="text-sm font-medium">{item.productId}</p><p className="text-xs text-slate-500">{item.variantId} · {formatMoney(item.salePrice)}</p></div>
          <Input name="salePriceBaht" disabled={!canManageSellerFlashSale(campaign)} type="number" min="0.01" step="0.01" placeholder={t("seller.manage.pages.promotions.salePriceBaht")} />
          <Input name="stockLimit" disabled={!canManageSellerFlashSale(campaign)} type="number" min={item.soldCount} placeholder={`${t("seller.manage.pages.promotions.stockLimit")}: ${item.stockLimit}`} />
          <Input name="perUserLimit" disabled={!canManageSellerFlashSale(campaign)} type="number" min="1" placeholder={`${t("seller.manage.pages.promotions.perUserLimit")}: ${item.perUserLimit ?? "—"}`} />
          <div className="flex gap-2"><Button type="submit" size="sm" variant="outline" disabled={!canManageSellerFlashSale(campaign) || update.isPending}>{t("common.save")}</Button><Button type="button" size="sm" variant="destructive" disabled={!canManageSellerFlashSale(campaign) || remove.isPending} onClick={() => remove.mutate(item.id)}>{t("seller.manage.pages.promotions.delete")}</Button></div>
        </form>)}</div>
      </section>)}
      {update.isError || remove.isError ? <p className="text-sm text-red-700">{t("seller.manage.pages.promotions.flashSaleSaveFailed")}</p> : null}
    </CardContent>
  </Card>;
}

function canManageSellerFlashSale(campaign: { status: string }) {
  return campaign.status === "SCHEDULED";
}

export function SellerFinancePage() {
  const t = useTranslations();
  const formatters = useFormatters();
  const [transactionPage, setTransactionPage] = useState(1);
  const transactionLimit = 20;
  const wallet = useSellerWallet();
  const transactions = useSellerTransactions(transactionPage, transactionLimit);
  const [payoutPagination, setPayoutPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutStatus, setPayoutStatus] = useState("all");
  const debouncedPayoutSearch = useDebouncedSearch(payoutSearch, setPayoutPagination);
  const payouts = useSellerPayouts({ page: payoutPagination.pageIndex + 1, limit: payoutPagination.pageSize, q: debouncedPayoutSearch || undefined, status: payoutStatus === "all" ? undefined : payoutStatus });
  const createPayout = useCreateSellerPayout();
  const transactionColumns: ColumnDef<NonNullable<SellerTransactions>["items"][number]>[] = [
    { accessorKey: "type", header: t("seller.operationsUi.transaction"), enableSorting: false, cell: ({ row }) => <div className="min-w-44"><p className="font-medium">{formatTransactionType(row.original.type, t)}</p><p className="mt-1 text-xs text-slate-500">{formatTransactionDescription(row.original.type, row.original.description, t)}</p></div> },
    { accessorKey: "createdAt", header: t("seller.operationsUi.date"), enableSorting: false, cell: ({ row }) => <span className="whitespace-nowrap text-xs text-slate-500">{formatters.date(row.original.createdAt)}</span> },
    { accessorKey: "amount", header: t("seller.operationsUi.amount"), enableSorting: false, cell: ({ row }) => <span className={`whitespace-nowrap font-medium tabular-nums ${compareMinorUnits(row.original.amount, 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatters.currency(row.original.amount, row.original.currency)}</span> },
  ];
  const payoutColumns: ColumnDef<SellerPayout>[] = [
    { accessorKey: "amount", sortingFn: (first, second) => first.original.currency.localeCompare(second.original.currency) || compareMinorUnits(first.original.amount, second.original.amount), header: t("seller.operationsUi.amount"), cell: ({ row }) => <span className="font-medium tabular-nums">{formatters.currency(row.original.amount, row.original.currency)}</span> },
    { accessorKey: "requestedAt", header: t("seller.operationsUi.date"), cell: ({ row }) => <span className="text-xs text-slate-500">{formatters.date(row.original.requestedAt)}</span> },
    { accessorKey: "status", header: t("seller.manage.pages.orders.status"), cell: ({ row }) => <StatusPill value={row.original.status} /> },
  ];
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.finance.title")} description={t("seller.manage.pages.finance.description")} />
      {wallet.error ? <ErrorState error={wallet.error} retry={() => void wallet.refetch()} /> : null}
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="rounded-xl border-slate-200 bg-white shadow-none"><CardContent className="pt-6"><p className="text-sm text-slate-500">{t("seller.manage.pages.finance.available")}</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{formatters.currency(wallet.data?.availableBalanceCents ?? 0, wallet.data?.currency)}</p><p className="mt-1 text-sm text-slate-500">{wallet.data?.shopName ?? t("seller.manage.pages.finance.shop")}</p>{compareMinorUnits(wallet.data?.sellerDebtCents ?? 0, 0) > 0 ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{t("seller.manage.pages.finance.sellerDebt")}</p><p className="mt-1 font-semibold">{formatters.currency(wallet.data?.sellerDebtCents ?? 0, wallet.data?.currency)}</p><p className="mt-2">{t("seller.manage.pages.finance.debtRecovery")}</p></div> : null}</CardContent></Card>
        <Card className="rounded-xl border-slate-200 bg-white shadow-none"><CardHeader><CardTitle className="text-base">{t("seller.manage.pages.finance.requestPayout")}</CardTitle></CardHeader><CardContent><form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          createPayout.mutate(decimalInputToMinorUnits(String(data.get("amount") ?? "")));
        }}><div className="flex-1 space-y-2"><Label htmlFor="payout-amount">{t("seller.manage.pages.finance.amount")}</Label><Input id="payout-amount" name="amount" placeholder={t("seller.manage.pages.finance.amount")} type="number" min="1" step="0.01" required /></div><Button type="submit" disabled={createPayout.isPending}>{t("seller.manage.pages.finance.request")}</Button></form>{createPayout.isError ? <p role="alert" className="mt-3 text-sm text-red-700">{t("seller.operationsUi.payoutFailed")}</p> : null}{createPayout.isSuccess ? <p role="status" className="mt-3 text-sm text-emerald-700">{t("seller.operationsUi.payoutSaved")}</p> : null}</CardContent></Card>
      </section>
      <section className="space-y-5">
        <Card className="min-w-0 rounded-xl border-slate-200 bg-white shadow-none"><CardHeader><CardTitle className="text-base">{t("seller.manage.pages.finance.transactions")}</CardTitle></CardHeader><CardContent className="space-y-4">
          {transactions.error ? <ErrorState error={transactions.error} retry={() => void transactions.refetch()} /> : null}
          <SellerDataTable key={transactionPage} columns={transactionColumns} data={transactions.data?.items ?? []} getRowId={(row) => row.id} searchable={false} hidePagination pageSize={transactionLimit} isLoading={transactions.isLoading} loadingMessage={t("seller.manage.pages.finance.loadingTransactions")} emptyMessage={t("seller.manage.pages.finance.emptyTransactions")} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500" aria-live="polite">{t("seller.operationsUi.transactionPage").replace("{page}", String(transactionPage)).replace("{count}", String(transactions.data?.items.length ?? 0))}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={transactionPage === 1 || transactions.isLoading} onClick={() => setTransactionPage((page) => page - 1)}>{t("common.previous")}</Button><Button type="button" variant="outline" size="sm" disabled={transactions.isLoading || Boolean(transactions.error) || (transactions.data?.items.length ?? 0) < transactionLimit} onClick={() => setTransactionPage((page) => page + 1)}>{t("common.next")}</Button></div></div>
        </CardContent></Card>
        <Card className="min-w-0 rounded-xl border-slate-200 bg-white shadow-none"><CardHeader><CardTitle className="text-base">{t("seller.manage.pages.finance.payoutHistory")}</CardTitle></CardHeader><CardContent>
          {payouts.error ? <ErrorState error={payouts.error} retry={() => void payouts.refetch()} /> : null}
          <SellerDataTable columns={payoutColumns} data={payouts.data?.data ?? []} getRowId={(row) => row.id}
            pagination={{ ...payoutPagination, totalRows: payouts.data?.meta.totalCount ?? 0, onPaginationChange: setPayoutPagination }}
            isLoading={payouts.isLoading} loadingMessage={t("seller.manage.pages.finance.loadingPayouts")} emptyMessage={t("seller.manage.pages.finance.emptyPayouts")}
            renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row">
              <Input value={payoutSearch} onChange={(event) => { setPayoutSearch(event.target.value); }} placeholder={t("seller.ui.table.searchPlaceholder")} aria-label={t("seller.ui.table.search")} className="sm:max-w-sm" />
              <Select value={payoutStatus} onValueChange={(value) => { setPayoutStatus(value); setPayoutPagination((page) => ({ ...page, pageIndex: 0 })); }}><SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.returns.filterStatus")}><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="all">{t("seller.manage.pages.returns.allStatuses")}</SelectItem>
                {(["requested", "approved", "rejected", "paid", "cancelled"] as const).map((status) => <SelectItem key={status} value={status}>{t(`seller.manage.status.${status}`)}</SelectItem>)}
              </SelectContent></Select>
            </div>} />
        </CardContent></Card>
      </section>
    </>
  );
}
