"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, BanknoteIcon, PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { useFormatters, useTranslations } from "#/i18n/client";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { SellerPageHeader } from "./SellerShell";
import {
  type SellerCoupon,
  type SellerPayout,
  type SellerReturn,
  type SellerShipment,
  type SellerShopStaff,
  useApproveReturn,
  useCreateSellerCoupon,
  useCreateSellerPayout,
  useDeleteSellerCoupon,
  usePackShipment,
  useRejectReturn,
  useSellerCoupons,
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
  useUpdateSellerInventory,
} from "../hooks/useSellerManage";

function formatMoney(cents: number | bigint | undefined, currency = "THB") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents ?? 0) / 100);
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

function sellerTableLabels(t: (key: string) => string) {
  return {
    showing: t("common.showing"),
    of: t("common.of"),
    rows: t("common.rows"),
    previous: t("common.previous"),
    next: t("common.next"),
    previousPage: t("common.previousPage"),
    nextPage: t("common.nextPage"),
    sortBy: t("common.sortBy"),
  };
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
    COMPLETED: t("seller.manage.status.completed"),
    CANCELLED: t("seller.manage.status.cancelled"),
  };
  const normalizedValue = value.toUpperCase().replaceAll("-", "_");
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabels[normalizedValue] ?? value.replaceAll("_", " ")}</span>;
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

function ShippingFeeForm({ shopId, shippingFeeBaht }: { shopId: string; shippingFeeBaht: number }) {
  const t = useTranslations();
  const updateSettings = useUpdateSellerShopSettings();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateSettings.mutate({
      shopId,
      shippingFeeBaht: Number(data.get("shippingFeeBaht")),
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
  const searchParams = useSearchParams();
  const selectedShopId = searchParams.get("shopId") || undefined;
  const dashboardQuery = useSellerDashboard(selectedShopId);
  const reviewsQuery = useSellerDashboardReviews({ shopId: selectedShopId, limit: 5 });
  const shopListQuery = useSellerShopList();
  const resolvedShopId = selectedShopId ?? shopListQuery.data?.activeShopId ?? shopListQuery.data?.shops[0]?.id;
  const profileQuery = useSellerShopProfile(resolvedShopId);
  const settingsQuery = useSellerShopSettings(resolvedShopId);
  const updateShopSettings = useUpdateSellerShopSettings();
  const dashboard = dashboardQuery.data;

  if (dashboardQuery.error) return <ErrorState error={dashboardQuery.error} retry={() => void dashboardQuery.refetch()} />;

  const cards = [
    { label: t("seller.manage.cards.todaySales"), value: formatMoney(dashboard?.sales.todaySalesCents), icon: BanknoteIcon },
    { label: t("seller.manage.cards.monthSales"), value: formatMoney(dashboard?.sales.thisMonthSalesCents), icon: BanknoteIcon },
    { label: t("seller.manage.cards.pendingPack"), value: String(dashboard?.orders.pendingPack ?? 0), icon: PackageCheckIcon },
    { label: t("seller.manage.cards.lowStock"), value: String(dashboard?.products.lowStock ?? 0), icon: AlertTriangleIcon },
  ];

  function formatReviewStatus(status: string) {
    if (status === "PENDING") return t("seller.manage.reviewStatus.pending");
    if (status === "PUBLISHED") return t("seller.manage.reviewStatus.published");
    if (status === "REJECTED") return t("seller.manage.reviewStatus.rejected");
    if (status === "HIDDEN") return t("seller.manage.reviewStatus.hidden");
    return status;
  }

  function retryShopSurface() {
    void profileQuery.refetch();
    void settingsQuery.refetch();
  }

  function toggleShopSetting(setting: "vacationMode" | "chatEnabled") {
    if (!resolvedShopId || !settingsQuery.data) return;
    const nextValue = !settingsQuery.data[setting];
    updateShopSettings.mutate({
      shopId: resolvedShopId,
      [setting]: nextValue,
    }, {
      onSuccess: () => {
        toast.success(t("seller.manage.shopSettingsSaved"));
      },
      onError: () => {
        toast.error(t("seller.manage.shopSettingsFailed"));
      },
    });
  }

  return (
    <>
      <SellerPageHeader title={t("seller.manage.dashboardTitle")} description={t("seller.manage.dashboardDescription")} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-lg border-slate-200 bg-white">
            <CardContent className="flex items-start justify-between gap-3 pt-6">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{dashboardQuery.isLoading ? "..." : card.value}</p>
              </div>
              <card.icon className="size-5 text-emerald-600" />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle>{t("seller.manage.lowStockTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.lowStockItems.length ? dashboard.lowStockItems.slice(0, 6).map((item) => (
              <div key={item.variantId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{item.productTitle}</p>
                  <p className="text-xs text-slate-500">{item.sku} · {t("seller.manage.availableLabel")} {item.availableQuantity}</p>
                </div>
                <Link href="/seller/inventory" className="text-sm font-semibold text-emerald-700 no-underline">{t("seller.manage.restock")}</Link>
              </div>
            )) : <EmptyState message={dashboardQuery.isLoading ? t("seller.manage.loadingAlerts") : t("seller.manage.noLowStock")} />}
          </CardContent>
        </Card>
        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader><CardTitle>{t("seller.manage.recentOrdersTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dashboard?.recentOrders.length ? dashboard.recentOrders.slice(0, 6).map((order) => (
              <div key={order.orderId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{order.orderNo}</p>
                  <p className="text-xs text-slate-500">{order.items.length} {t("seller.manage.itemsLabel")} · {formatMoney(order.totalCents)}</p>
                </div>
                <StatusPill value={order.status} />
              </div>
            )) : <EmptyState message={dashboardQuery.isLoading ? t("seller.manage.loadingOrders") : t("seller.manage.noRecentOrders")} />}
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

        <Card className="rounded-lg border-slate-200 bg-white">
          <CardHeader>
            <CardTitle>{t("seller.manage.profileAndStaffTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resolvedShopId ? <EmptyState message={t("seller.manage.noShopContext")} /> : null}
            {resolvedShopId && (profileQuery.isLoading || settingsQuery.isLoading) ? (
              <EmptyState message={t("seller.manage.loadingShopProfile")} />
            ) : null}
            {resolvedShopId && (profileQuery.error || settingsQuery.error) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{t("seller.manage.shopProfileLoadError")}</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={retryShopSurface}>
                  {t("seller.manage.retry")}
                </Button>
              </div>
            ) : null}
            {resolvedShopId && profileQuery.data && settingsQuery.data ? (
              <>
                <div className="rounded-lg border border-slate-200 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.manage.shopProfileLabel")}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{profileQuery.data.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{profileQuery.data.slug} · {profileQuery.data.contactEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">{profileQuery.data.contactPhone}</p>
                </div>

                <div className="rounded-lg border border-slate-200 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("seller.manage.shopSettingsLabel")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateShopSettings.isPending}
                      onClick={() => toggleShopSetting("vacationMode")}
                    >
                      {settingsQuery.data.vacationMode ? t("seller.manage.disableVacation") : t("seller.manage.enableVacation")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateShopSettings.isPending}
                      onClick={() => toggleShopSetting("chatEnabled")}
                    >
                      {settingsQuery.data.chatEnabled ? t("seller.manage.disableChat") : t("seller.manage.enableChat")}
                    </Button>
                  </div>
                  <ShippingFeeForm shopId={resolvedShopId} shippingFeeBaht={settingsQuery.data.shippingFeeBaht} />
                </div>
                <ShopProfileForm key={`profile-${resolvedShopId}`} shopId={resolvedShopId} profile={profileQuery.data} />

                <LocalizedShopContentForm key={resolvedShopId} shopId={resolvedShopId} profile={profileQuery.data} settings={settingsQuery.data} />

                <ShopStaffPanel shopId={resolvedShopId} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export function SellerInventoryPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const query = useSellerInventory();
  const updateInventory = useUpdateSellerInventory();
  const variants = useMemo(() => {
    const data = query.data as any;
    const rows = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row: any) => {
      const inventory = row.inventory ?? row;
      const available = (inventory.quantityOnHand ?? 0) - (inventory.quantityReserved ?? 0);
      const productTitle = row.productTitle ?? row.product?.title ?? row.variant?.product?.title ?? "";
      const variantTitle = row.variantTitle ?? row.variant?.title ?? "";
      const sku = row.sku ?? row.variant?.sku ?? "";
      const matchesSearch = !normalizedSearch || `${productTitle} ${variantTitle} ${sku}`.toLowerCase().includes(normalizedSearch);
      const matchesStock = stockFilter === "all"
        || (stockFilter === "out" && available <= 0)
        || (stockFilter === "low" && available > 0 && available <= (inventory.reorderLevel ?? 0));
      return matchesSearch && matchesStock;
    });
  }, [query.data, search, stockFilter]);
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: "variant",
      header: t("seller.manage.pages.inventory.variant"),
      cell: ({ row }) => {
        const variant = row.original.variant ?? row.original;
        const product = row.original.product ?? variant.product ?? { title: row.original.productTitle ?? t("seller.manage.pages.inventory.product") };
        return <><p className="font-medium">{product.title}</p><p className="text-xs text-slate-500">{row.original.sku ?? variant.sku} · {row.original.variantTitle ?? variant.title}</p></>;
      },
    },
    {
      id: "onHand",
      header: t("seller.manage.pages.inventory.onHand"),
      cell: ({ row }) => row.original.inventory?.quantityOnHand ?? row.original.quantityOnHand ?? 0,
    },
    {
      id: "reserved",
      header: t("seller.manage.pages.inventory.reserved"),
      cell: ({ row }) => {
        const variant = row.original.variant ?? row.original;
        const inventory = row.original.inventory ?? variant.inventory ?? row.original;
        return <Input aria-label={t("seller.manage.pages.inventory.reservedStock").replace("{sku}", row.original.sku ?? variant.sku)} value={inventory.quantityReserved ?? 0} readOnly className="w-20" />;
      },
    },
    {
      id: "available",
      header: t("seller.manage.pages.inventory.available"),
      cell: ({ row }) => {
        const inventory = row.original.inventory ?? row.original;
        const available = (inventory.quantityOnHand ?? 0) - (inventory.quantityReserved ?? 0);
        return <span className={available <= (inventory.reorderLevel ?? 0) ? "font-semibold text-red-600" : ""}>{available}</span>;
      },
    },
    {
      id: "reorder",
      header: t("seller.manage.pages.inventory.reorder"),
      cell: ({ row }) => row.original.inventory?.reorderLevel ?? row.original.reorderLevel ?? 0,
    },
    {
      id: "update",
      header: () => <span className="sr-only">{t("seller.manage.pages.inventory.update")}</span>,
      cell: ({ row }) => {
        const variant = row.original.variant ?? row.original;
        const inventory = row.original.inventory ?? variant.inventory ?? row.original;
        const quantityOnHand = inventory.quantityOnHand ?? 0;
        const reorderLevel = inventory.reorderLevel ?? 0;
        const variantId = row.original.variantId ?? variant.id;
        return <form className="flex min-w-56 justify-end gap-2" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); updateInventory.mutate({ productId: row.original.productId ?? row.original.product?.id, variantId, quantityOnHand: Number(formData.get("quantityOnHand")), reorderLevel: Number(formData.get("reorderLevel")) }, { onError: (error) => toast.error(error instanceof Error ? error.message : t("seller.manage.pages.inventory.updateFailed")) }); }}><Input name="quantityOnHand" aria-label={t("seller.manage.pages.inventory.quantityOnHand")} type="number" min={0} defaultValue={quantityOnHand} className="w-24" /><Input name="reorderLevel" aria-label={t("seller.manage.pages.inventory.reorderLevel")} type="number" min={0} defaultValue={reorderLevel} className="w-24" /><Button type="submit" size="sm" disabled={updateInventory.isPending}>{t("seller.manage.pages.inventory.save")}</Button></form>;
      },
    },
  ], [t, updateInventory]);

  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.inventory.title")} description={t("seller.manage.pages.inventory.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="pt-6">{updateInventory.isPending ? <p className="mb-3 text-sm text-slate-500">{t("seller.manage.pages.inventory.saving")}</p> : null}<DataTable columns={columns} data={variants} isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.inventory.loading")} emptyMessage={t("seller.manage.pages.inventory.empty")} pageSize={10} className="overflow-x-auto" labels={sellerTableLabels(t)} renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("seller.manage.pages.inventory.search")} aria-label={t("seller.manage.pages.inventory.search")} className="sm:max-w-sm" /><Select value={stockFilter} onValueChange={(value) => setStockFilter(value as "all" | "low" | "out")}><SelectTrigger className="sm:w-56" aria-label={t("seller.manage.pages.inventory.filterStock")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("seller.manage.pages.inventory.allStock")}</SelectItem><SelectItem value="low">{t("seller.manage.pages.inventory.lowStockOnly")}</SelectItem><SelectItem value="out">{t("seller.manage.pages.inventory.outOfStock")}</SelectItem></SelectContent></Select></div>} /></CardContent></Card>
    </>
  );
}

export function SellerOrdersPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const query = useSellerShipments();
  const pack = usePackShipment();
  const ship = useShipShipment();
  const rows = query.data ?? [];
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((shipment) => {
      const haystack = `${shipment.orderNo} ${shipment.shippingAddress.name} ${shipment.items.map((item) => item.productTitle).join(" ")}`.toLowerCase();
      return (!normalizedSearch || haystack.includes(normalizedSearch)) &&
        (statusFilter === "all" || shipment.status.toLowerCase() === statusFilter);
    });
  }, [rows, search, statusFilter]);
  const columns = useMemo<ColumnDef<SellerShipment>[]>(() => [
    {
      accessorKey: "orderNo",
      header: t("seller.manage.pages.orders.order"),
      cell: ({ row }) => <span className="font-medium">{row.original.orderNo}</span>,
    },
    {
      id: "recipient",
      header: t("seller.manage.pages.orders.recipient"),
      cell: ({ row }) => row.original.shippingAddress.name,
    },
    {
      id: "items",
      header: t("seller.manage.pages.orders.items"),
      cell: ({ row }) => (
        <div className="max-w-64 space-y-0.5 text-sm">
          {row.original.items.map((item, index) => (
            <p key={`${item.productTitle}-${item.quantity}-${index}`}>{item.productTitle} x{item.quantity}</p>
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
      header: () => <span className="sr-only">{t("seller.manage.pages.orders.actions")}</span>,
      cell: ({ row }) => {
        const shipment = row.original;
        return (
          <div className="flex min-w-72 flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pack.isPending || shipment.status !== "pending_pack"} onClick={() => pack.mutate(shipment.id)}>
              {t("seller.manage.pages.orders.markPacked")}
            </Button>
            <form className="flex min-w-72 flex-1 gap-2" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              ship.mutate({ shipmentId: shipment.id, carrier: String(data.get("carrier") ?? ""), trackingNo: String(data.get("trackingNo") ?? "") });
            }}>
              <Input name="carrier" aria-label={t("seller.manage.pages.orders.carrier")} placeholder={t("seller.manage.pages.orders.carrier")} defaultValue={shipment.carrier ?? ""} />
              <Input name="trackingNo" aria-label={t("seller.manage.pages.orders.tracking")} placeholder={t("seller.manage.pages.orders.tracking")} defaultValue={shipment.trackingNumber ?? ""} />
              <Button type="submit" size="sm" disabled={ship.isPending || shipment.status !== "packed"}>{t("seller.manage.pages.orders.ship")}</Button>
            </form>
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
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredRows}
            isLoading={query.isLoading}
            loadingMessage={t("seller.manage.pages.orders.loading")}
            emptyMessage={t("seller.manage.pages.orders.empty")}
            pageSize={10}
            className="overflow-x-auto"
            labels={sellerTableLabels(t)}
            renderToolbar={() => (
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("seller.manage.pages.orders.search")} aria-label={t("seller.manage.pages.orders.search")} className="sm:max-w-sm" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
    </>
  );
}

export function SellerReturnsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const query = useSellerReturns();
  const approve = useApproveReturn();
  const reject = useRejectReturn();
  const rows = query.data ?? [];
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((item) => {
      const haystack = `${item.reason ?? ""} ${item.items.map((entry) => entry.productTitle).join(" ")}`.toLowerCase();
      return (!normalizedSearch || haystack.includes(normalizedSearch)) && (statusFilter === "all" || item.status.toLowerCase() === statusFilter);
    });
  }, [rows, search, statusFilter]);
  const columns = useMemo<ColumnDef<SellerReturn>[]>(() => [
    {
      id: "return",
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
      header: () => <span className="sr-only">{t("seller.manage.pages.returns.actions")}</span>,
      cell: ({ row }) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={approve.isPending || row.original.status !== "requested"} onClick={() => approve.mutate(row.original.id)}>{t("seller.manage.pages.returns.approve")}</Button><Button size="sm" variant="destructive" disabled={reject.isPending || row.original.status !== "requested"} onClick={() => reject.mutate(row.original.id)}>{t("seller.manage.pages.returns.reject")}</Button></div>,
    },
  ], [approve, reject, t]);
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.returns.title")} description={t("seller.manage.pages.returns.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-0"><DataTable columns={columns} data={filteredRows} isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.returns.loading")} emptyMessage={t("seller.manage.pages.returns.empty")} pageSize={10} className="overflow-x-auto" labels={sellerTableLabels(t)} renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("seller.manage.pages.returns.search")} aria-label={t("seller.manage.pages.returns.search")} className="sm:max-w-sm" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.returns.filterStatus")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("seller.manage.pages.returns.allStatuses")}</SelectItem><SelectItem value="requested">{t("seller.manage.status.requested")}</SelectItem><SelectItem value="approved">{t("seller.manage.status.approved")}</SelectItem><SelectItem value="rejected">{t("seller.manage.status.rejected")}</SelectItem><SelectItem value="completed">{t("seller.manage.status.completed")}</SelectItem></SelectContent></Select></div>} /></CardContent></Card>
    </>
  );
}

export function SellerPromotionsPage() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const query = useSellerCoupons();
  const createCoupon = useCreateSellerCoupon();
  const updateCoupon = useUpdateSellerCoupon();
  const deleteCoupon = useDeleteSellerCoupon();
  const rows = query.data ?? [];
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((coupon) => {
      const haystack = `${coupon.code} ${coupon.titleEn ?? ""} ${coupon.titleTh ?? ""}`.toLowerCase();
      return (!normalizedSearch || haystack.includes(normalizedSearch))
        && (activeFilter === "all" || (activeFilter === "active" ? coupon.isActive : !coupon.isActive));
    });
  }, [activeFilter, rows, search]);
  const columns = useMemo<ColumnDef<SellerCoupon>[]>(() => [
    {
      id: "coupon",
      header: t("seller.manage.pages.promotions.coupon"),
      cell: ({ row }) => <><p className="font-medium">{row.original.code}</p><p className="text-xs text-slate-500">{row.original.titleEn ?? row.original.titleTh ?? t("seller.manage.pages.promotions.untitled")}</p></>,
    },
    {
      id: "discount",
      header: t("seller.manage.pages.promotions.discount"),
      cell: ({ row }) => row.original.discountType,
    },
    {
      id: "active",
      header: t("seller.manage.pages.promotions.active"),
      cell: ({ row }) => row.original.isActive ? t("seller.manage.status.active") : t("seller.manage.status.inactive"),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("seller.manage.pages.promotions.actions")}</span>,
      cell: ({ row }) => <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={updateCoupon.isPending} onClick={() => updateCoupon.mutate({ couponId: row.original.id, isActive: !row.original.isActive })}>{row.original.isActive ? t("seller.manage.pages.promotions.disable") : t("seller.manage.pages.promotions.enable")}</Button><Button size="sm" variant="destructive" disabled={deleteCoupon.isPending} onClick={() => deleteCoupon.mutate(row.original.id)}>{t("seller.manage.pages.promotions.delete")}</Button></div>,
    },
  ], [deleteCoupon, t, updateCoupon]);
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.promotions.title")} description={t("seller.manage.pages.promotions.description")} />
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="pt-6"><form className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px_auto]" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); createCoupon.mutate({ code: String(data.get("code") ?? ""), titleEn: String(data.get("title") ?? ""), discountType: String(data.get("discountType")) as "fixed" | "percent", discountValueCents: Math.round(Number(data.get("amount") || 0) * 100), discountPercentBps: Math.round(Number(data.get("percent") || 0) * 100), isActive: true }); }}><Input name="code" placeholder={t("seller.manage.pages.promotions.code")} required /><Input name="title" placeholder={t("seller.manage.pages.promotions.titleField")} /><Select name="discountType" defaultValue="fixed"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">{t("seller.manage.pages.promotions.fixed")}</SelectItem><SelectItem value="percent">{t("seller.manage.pages.promotions.percent")}</SelectItem></SelectContent></Select><Input name="amount" placeholder={t("seller.manage.pages.promotions.amount")} /><Button type="submit" disabled={createCoupon.isPending}>{t("seller.manage.pages.promotions.create")}</Button></form></CardContent></Card>
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white"><CardContent className="p-0"><DataTable columns={columns} data={filteredRows} isLoading={query.isLoading} loadingMessage={t("seller.manage.pages.promotions.loading")} emptyMessage={t("seller.manage.pages.promotions.empty")} pageSize={10} className="overflow-x-auto" labels={sellerTableLabels(t)} renderToolbar={() => <div className="flex w-full flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("seller.manage.pages.promotions.search")} aria-label={t("seller.manage.pages.promotions.search")} className="sm:max-w-sm" /><Select value={activeFilter} onValueChange={setActiveFilter}><SelectTrigger className="sm:w-52" aria-label={t("seller.manage.pages.promotions.filterStatus")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("seller.manage.pages.promotions.allStatuses")}</SelectItem><SelectItem value="active">{t("seller.manage.status.active")}</SelectItem><SelectItem value="inactive">{t("seller.manage.status.inactive")}</SelectItem></SelectContent></Select></div>} /></CardContent></Card>
    </>
  );
}

export function SellerFinancePage() {
  const t = useTranslations();
  const formatters = useFormatters();
  const wallet = useSellerWallet();
  const transactions = useSellerTransactions();
  const payouts = useSellerPayouts();
  const createPayout = useCreateSellerPayout();
  return (
    <>
      <SellerPageHeader title={t("seller.manage.pages.finance.title")} description={t("seller.manage.pages.finance.description")} />
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg border-slate-200 bg-white md:col-span-1"><CardContent className="pt-6"><p className="text-sm text-slate-500">{t("seller.manage.pages.finance.available")}</p><p className="mt-2 text-3xl font-semibold">{formatters.currency(Number(wallet.data?.availableBalanceCents ?? 0), wallet.data?.currency)}</p><p className="mt-1 text-sm text-slate-500">{wallet.data?.shopName ?? t("seller.manage.pages.finance.shop")}</p></CardContent></Card>
        <Card className="rounded-lg border-slate-200 bg-white md:col-span-2"><CardHeader><CardTitle>{t("seller.manage.pages.finance.requestPayout")}</CardTitle></CardHeader><CardContent><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); createPayout.mutate(Math.round(Number(data.get("amount") || 0) * 100)); }}><Input name="amount" placeholder={t("seller.manage.pages.finance.amount")} type="number" min="1" step="0.01" /><Button type="submit" disabled={createPayout.isPending}>{t("seller.manage.pages.finance.request")}</Button></form></CardContent></Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg border-slate-200 bg-white"><CardHeader><CardTitle>{t("seller.manage.pages.finance.transactions")}</CardTitle></CardHeader><CardContent className="space-y-2">{transactions.data?.items.length ? transactions.data.items.map((item) => <div key={item.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-3"><div><p className="text-sm font-medium">{formatTransactionType(item.type, t)}</p><p className="text-xs text-slate-500">{formatTransactionDescription(item.type, item.description, t) ?? formatters.date(item.createdAt)}</p></div><p className={item.amount < 0 ? "text-red-600" : "text-emerald-700"}>{formatters.currency(item.amount, item.currency)}</p></div>) : <EmptyState message={transactions.isLoading ? t("seller.manage.pages.finance.loadingTransactions") : t("seller.manage.pages.finance.emptyTransactions")} />}</CardContent></Card>
        <Card className="rounded-lg border-slate-200 bg-white"><CardHeader><CardTitle>{t("seller.manage.pages.finance.payoutHistory")}</CardTitle></CardHeader><CardContent className="space-y-2">{payouts.data?.length ? payouts.data.map((item: SellerPayout) => <div key={item.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-3"><div><p className="text-sm font-medium">{formatters.currency(item.amount, item.currency)}</p><p className="text-xs text-slate-500">{formatters.date(item.requestedAt)}</p></div><StatusPill value={item.status} /></div>) : <EmptyState message={payouts.isLoading ? t("seller.manage.pages.finance.loadingPayouts") : t("seller.manage.pages.finance.emptyPayouts")} />}</CardContent></Card>
      </section>
    </>
  );
}
