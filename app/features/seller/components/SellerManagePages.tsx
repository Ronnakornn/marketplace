"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, ArchiveIcon, BanknoteIcon, EditIcon, PackageCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useFormatters, useTranslations } from "#/i18n/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { SellerPageHeader } from "./SellerShell";
import {
  type SellerCoupon,
  type SellerProductImage,
  type SellerPayout,
  type SellerProduct,
  type SellerProductImageInput,
  type SellerVariantInput,
  type SellerReturn,
  type SellerShipment,
  useApproveReturn,
  useCreateSellerCoupon,
  useCreateSellerProductImage,
  useCreateSellerPayout,
  useCreateSellerProduct,
  useCreateSellerVariant,
  useDeleteSellerCoupon,
  useDeleteSellerProductImage,
  useDeleteSellerVariant,
  useDeliverShipment,
  usePackShipment,
  useRejectReturn,
  useSellerBrands,
  useSellerCategories,
  useSellerCoupons,
  useSellerDashboard,
  useSellerDashboardReviews,
  useSellerInventory,
  useSellerPayouts,
  useSellerProducts,
  useSellerReturns,
  useSellerShopList,
  useSellerShopProfile,
  useSellerShopSettings,
  useSellerShipments,
  useSellerTransactions,
  useSellerWallet,
  useShipShipment,
  useArchiveSellerProduct,
  useUpdateSellerShopSettings,
  useUpdateSellerProduct,
  useUpdateSellerCoupon,
  useUpdateSellerInventory,
  useUpdateSellerProductImage,
  useUpdateSellerVariant,
} from "../hooks/useSellerManage";

type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
type SellerProductVariant = SellerProduct["variants"][number];

interface ProductFormState {
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  categoryId: string;
  brandId: string;
  metaTitle: string;
  metaDescription: string;
  warrantyInfo: string;
  condition: string;
  countryOfOrigin: string;
  highlightsText: string;
  attributesText: string;
}

type SellerVariant = SellerProduct["variants"][number];

interface VariantFormState {
  sku: string;
  title: string;
  titleTh: string;
  titleEn: string;
  price: string;
  currency: string;
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
}

interface ImageFormState {
  url: string;
  altText: string;
  sortOrder: string;
  isPrimary: boolean;
  width: string;
  height: string;
}

const emptyProductForm: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
  titleTh: "",
  titleEn: "",
  descriptionTh: "",
  descriptionEn: "",
  categoryId: "",
  brandId: "",
  metaTitle: "",
  metaDescription: "",
  warrantyInfo: "",
  condition: "",
  countryOfOrigin: "",
  highlightsText: "",
  attributesText: "",
};

const emptyVariantForm: VariantFormState = {
  sku: "",
  title: "",
  titleTh: "",
  titleEn: "",
  price: "",
  currency: "USD",
  weightGrams: "",
  lengthMm: "",
  widthMm: "",
  heightMm: "",
};

const emptyImageForm: ImageFormState = {
  url: "",
  altText: "",
  sortOrder: "0",
  isPrimary: false,
  width: "",
  height: "",
};

function productToForm(product: SellerProduct): ProductFormState {
  return {
    title: product.title ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    status: product.status as ProductStatus,
    titleTh: product.titleTh ?? "",
    titleEn: product.titleEn ?? "",
    descriptionTh: product.descriptionTh ?? "",
    descriptionEn: product.descriptionEn ?? "",
    categoryId: product.category?.id ?? product.categoryId ?? "",
    brandId: product.brand?.id ?? product.brandId ?? "",
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    warrantyInfo: product.warrantyInfo ?? "",
    condition: product.condition ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "",
    highlightsText: (product.highlights ?? []).map((highlight: { text?: string }) => highlight.text ?? "").filter(Boolean).join("\n"),
    attributesText: (product.attributes ?? []).map((attribute: { attributeKey?: string; displayName?: string; value?: string; isFilterable?: boolean }) => [
      attribute.attributeKey ?? attribute.displayName ?? "",
      attribute.displayName ?? "",
      attribute.value ?? "",
      attribute.isFilterable ? "filterable" : "",
    ].join("|")).join("\n"),
  };
}

function variantToForm(variant: SellerVariant): VariantFormState {
  return {
    sku: variant.sku ?? "",
    title: variant.title ?? "",
    titleTh: variant.titleTh ?? "",
    titleEn: variant.titleEn ?? "",
    price: String(Number(variant.price ?? 0) / 100),
    currency: variant.currency ?? "USD",
    weightGrams: variant.weightGrams == null ? "" : String(variant.weightGrams),
    lengthMm: variant.lengthMm == null ? "" : String(variant.lengthMm),
    widthMm: variant.widthMm == null ? "" : String(variant.widthMm),
    heightMm: variant.heightMm == null ? "" : String(variant.heightMm),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function optionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function parseHighlights(value: string) {
  return value
    .split("\n")
    .map((text, index) => ({ text: text.trim(), sortOrder: index }))
    .filter((highlight) => highlight.text);
}

function parseAttributes(value: string) {
  return value
    .split("\n")
    .map((line, index) => {
      const [key, name, attributeValue, filterable] = line.split("|").map((part) => part.trim());
      return {
        attributeKey: key || undefined,
        displayName: name || key || "",
        value: attributeValue || "",
        sortOrder: index,
        isFilterable: filterable?.toLowerCase() === "filterable" || filterable === "true",
      };
    })
    .filter((attribute) => attribute.displayName && attribute.value);
}

function isProductFormDirty(form: ProductFormState, initial: ProductFormState) {
  return JSON.stringify(form) !== JSON.stringify(initial);
}

function isVariantFormDirty(form: VariantFormState, initial: VariantFormState) {
  return JSON.stringify(form) !== JSON.stringify(initial);
}

function getVariantPriceContext(product: SellerProduct) {
  const variants = product.variants ?? [];
  if (!variants.length) return "No variants";
  const prices = variants.map((variant) => Number(variant.price ?? 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants[0]?.currency ?? "USD";
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
}

function getVariantStockContext(product: SellerProduct) {
  const variants = product.variants ?? [];
  if (!variants.length) return "No stock";
  const available = variants.reduce((total, variant) => {
    const inventory = variant.inventory;
    return total + ((inventory?.quantityOnHand ?? 0) - (inventory?.quantityReserved ?? 0));
  }, 0);
  return `${available} available`;
}

function formatMoney(cents: number | bigint | undefined, currency = "USD") {
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
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex items-center justify-between gap-3 pt-6">
        <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load seller data."}</p>
        <Button type="button" variant="outline" onClick={retry}>Retry</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">{message}</div>;
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
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-900">{t("seller.manage.staffTitle")}</p>
                  <p className="mt-1 text-xs text-slate-600">{t("seller.manage.staffDescription")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill value={t("seller.manage.staffStatus.owner") as string} />
                    <StatusPill value={t("seller.manage.staffStatus.comingSoon") as string} />
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

export function SellerProductsLegacyPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [q, setQ] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyProductForm);
  const [initialForm, setInitialForm] = useState<ProductFormState>(emptyProductForm);
  const [formError, setFormError] = useState("");
  const [imageForm, setImageForm] = useState<ImageFormState>(emptyImageForm);
  const [imageFormError, setImageFormError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<SellerProduct | null>(null);
  const [variantDialogMode, setVariantDialogMode] = useState<"create" | "edit" | null>(null);
  const [variantProduct, setVariantProduct] = useState<SellerProduct | null>(null);
  const [editingVariant, setEditingVariant] = useState<SellerVariant | null>(null);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [initialVariantForm, setInitialVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [variantFormError, setVariantFormError] = useState("");
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<{ product: SellerProduct; variant: SellerVariant } | null>(null);
  const query = useSellerProducts({ q, status, cursor });
  const categoriesQuery = useSellerCategories();
  const brandsQuery = useSellerBrands();
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const archiveProduct = useArchiveSellerProduct();
  const createImage = useCreateSellerProductImage();
  const updateImage = useUpdateSellerProductImage();
  const deleteImage = useDeleteSellerProductImage();
  const createVariant = useCreateSellerVariant();
  const updateVariant = useUpdateSellerVariant();
  const deleteVariant = useDeleteSellerVariant();
  const products = query.data?.data ?? [];
  const isMutatingProduct = createProduct.isPending || updateProduct.isPending;
  const isMutatingImage = createImage.isPending || updateImage.isPending || deleteImage.isPending;
  const isMutatingVariant = createVariant.isPending || updateVariant.isPending;
  const isDialogOpen = dialogMode !== null;
  const isVariantDialogOpen = variantDialogMode !== null;
  const dirty = isDialogOpen && isProductFormDirty(form, initialForm);
  const variantDirty = isVariantDialogOpen && isVariantFormDirty(variantForm, initialVariantForm);

  function openCreateDialog() {
    setDialogMode("create");
    setEditingProduct(null);
    setForm(emptyProductForm);
    setInitialForm(emptyProductForm);
    setFormError("");
    setImageForm(emptyImageForm);
    setImageFormError("");
  }

  function openEditDialog(product: SellerProduct) {
    const nextForm = productToForm(product);
    setDialogMode("edit");
    setEditingProduct(product);
    setForm(nextForm);
    setInitialForm(nextForm);
    setFormError("");
    setImageForm(emptyImageForm);
    setImageFormError("");
  }

  function requestDialogClose(open: boolean) {
    if (open) return;
    if (dirty && !window.confirm("Discard unsaved product changes?")) return;
    setDialogMode(null);
    setEditingProduct(null);
    setFormError("");
    setImageFormError("");
  }

  function openCreateVariantDialog(product: SellerProduct) {
    setVariantDialogMode("create");
    setVariantProduct(product);
    setEditingVariant(null);
    setVariantForm(emptyVariantForm);
    setInitialVariantForm(emptyVariantForm);
    setVariantFormError("");
  }

  function openEditVariantDialog(product: SellerProduct, variant: SellerVariant) {
    const nextForm = variantToForm(variant);
    setVariantDialogMode("edit");
    setVariantProduct(product);
    setEditingVariant(variant);
    setVariantForm(nextForm);
    setInitialVariantForm(nextForm);
    setVariantFormError("");
  }

  function requestVariantDialogClose(open: boolean) {
    if (open) return;
    if (variantDirty && !window.confirm("Discard unsaved variant changes?")) return;
    setVariantDialogMode(null);
    setVariantProduct(null);
    setEditingVariant(null);
    setVariantFormError("");
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    const slug = form.slug.trim();

    if (!title) {
      setFormError("Product title is required.");
      return;
    }

    const input = {
      title,
      slug: slug || undefined,
      description: optionalText(form.description),
      status: form.status,
      titleTh: optionalText(form.titleTh),
      titleEn: optionalText(form.titleEn),
      descriptionTh: optionalText(form.descriptionTh),
      descriptionEn: optionalText(form.descriptionEn),
      categoryId: optionalText(form.categoryId),
      brandId: optionalText(form.brandId),
      metaTitle: optionalText(form.metaTitle),
      metaDescription: optionalText(form.metaDescription),
      warrantyInfo: optionalText(form.warrantyInfo),
      condition: optionalText(form.condition),
      countryOfOrigin: optionalText(form.countryOfOrigin),
      highlights: parseHighlights(form.highlightsText),
      attributes: parseAttributes(form.attributesText),
    };

    const options = {
      onSuccess: () => {
        toast.success(dialogMode === "edit" ? "Product updated." : "Product created.");
        setDialogMode(null);
        setEditingProduct(null);
        setForm(emptyProductForm);
        setInitialForm(emptyProductForm);
        setFormError("");
      },
      onError: (error: unknown) => {
        setFormError(error instanceof Error ? error.message : "Product could not be saved.");
        toast.error("Product could not be saved.");
      },
    };

    if (dialogMode === "edit" && editingProduct) {
      updateProduct.mutate({ productId: editingProduct.id, ...input }, options);
      return;
    }

    createProduct.mutate(input, options);
  }

  function getPublishReadinessMessage(product: SellerProduct | null = editingProduct) {
    if (form.status !== "ACTIVE") return "Drafts can be saved without category, images, or variants.";
    const hasCategory = Boolean(form.categoryId);
    const hasImage = Boolean(product?.images?.length);
    const hasActivePaidVariant = Boolean(product?.variants?.some((variant) => variant.status === "ACTIVE" && Number(variant.price) > 0));
    const missing = [
      hasCategory ? null : "category",
      hasImage ? null : "at least one image",
      hasActivePaidVariant ? null : "an active priced variant",
    ].filter(Boolean);
    return missing.length ? `Active products still need ${missing.join(", ")}.` : "This product has the required category, image, and active priced variant for publishing.";
  }

  function submitImage() {
    if (!editingProduct) {
      setImageFormError("Save the product before adding images.");
      return;
    }
    const sortOrder = optionalInteger(imageForm.sortOrder);
    const width = optionalInteger(imageForm.width);
    const height = optionalInteger(imageForm.height);
    if (!imageForm.url.trim()) {
      setImageFormError("Image URL is required.");
      return;
    }
    if (Number.isNaN(sortOrder) || Number.isNaN(width) || Number.isNaN(height)) {
      setImageFormError("Image sort order, width, and height must be whole numbers.");
      return;
    }
    const input: SellerProductImageInput = {
      url: imageForm.url.trim(),
      altText: optionalText(imageForm.altText),
      sortOrder: sortOrder ?? 0,
      isPrimary: imageForm.isPrimary,
      width,
      height,
    };
    createImage.mutate({ productId: editingProduct.id, ...input }, {
      onSuccess: () => {
        toast.success("Product image saved.");
        setImageForm(emptyImageForm);
        setImageFormError("");
      },
      onError: (error: unknown) => {
        setImageFormError(error instanceof Error ? error.message : "Product image could not be saved.");
        toast.error("Product image could not be saved.");
      },
    });
  }

  function markImagePrimary(image: SellerProductImage) {
    if (!editingProduct) return;
    updateImage.mutate({ productId: editingProduct.id, imageId: image.id, isPrimary: true }, {
      onSuccess: () => toast.success("Primary image updated."),
      onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Image could not be updated."),
    });
  }

  function removeImage(image: SellerProductImage) {
    if (!editingProduct) return;
    deleteImage.mutate({ productId: editingProduct.id, imageId: image.id }, {
      onSuccess: () => toast.success("Product image deleted."),
      onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Image could not be deleted."),
    });
  }

  function confirmArchiveProduct() {
    if (!archiveTarget) return;
    archiveProduct.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success("Product archived.");
        setArchiveTarget(null);
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Product could not be archived.");
      },
    });
  }

  function submitVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variantProduct) return;

    const sku = variantForm.sku.trim();
    const title = variantForm.title.trim();
    const currency = variantForm.currency.trim().toUpperCase();
    const priceValue = Number(variantForm.price);

    if (!sku) {
      setVariantFormError("Variant SKU is required.");
      return;
    }

    if (!title) {
      setVariantFormError("Variant title is required.");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setVariantFormError("Variant price must be greater than zero.");
      return;
    }

    if (!currency) {
      setVariantFormError("Variant currency is required.");
      return;
    }

    const input: SellerVariantInput = {
      sku,
      title,
      titleTh: optionalText(variantForm.titleTh),
      titleEn: optionalText(variantForm.titleEn),
      price: Math.round(priceValue * 100),
      currency,
      weightGrams: optionalInteger(variantForm.weightGrams),
      lengthMm: optionalInteger(variantForm.lengthMm),
      widthMm: optionalInteger(variantForm.widthMm),
      heightMm: optionalInteger(variantForm.heightMm),
    };

    if (["weightGrams", "lengthMm", "widthMm", "heightMm"].some((field) => Number.isNaN(input[field as keyof SellerVariantInput]))) {
      setVariantFormError("Weight and dimensions must be whole numbers.");
      return;
    }

    const options = {
      onSuccess: () => {
        toast.success(variantDialogMode === "edit" ? "Variant updated." : "Variant created.");
        setVariantDialogMode(null);
        setVariantProduct(null);
        setEditingVariant(null);
        setVariantForm(emptyVariantForm);
        setInitialVariantForm(emptyVariantForm);
        setVariantFormError("");
      },
      onError: (error: unknown) => {
        setVariantFormError(error instanceof Error ? error.message : "Variant could not be saved.");
        toast.error("Variant could not be saved.");
      },
    };

    if (variantDialogMode === "edit" && editingVariant) {
      updateVariant.mutate({ productId: variantProduct.id, variantId: editingVariant.id, ...input }, options);
      return;
    }

    createVariant.mutate({ productId: variantProduct.id, ...input }, options);
  }

  function confirmDeleteVariant() {
    if (!deleteVariantTarget) return;
    deleteVariant.mutate({ productId: deleteVariantTarget.product.id, variantId: deleteVariantTarget.variant.id }, {
      onSuccess: () => {
        toast.success("Variant deleted.");
        setDeleteVariantTarget(null);
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Variant could not be deleted.");
      },
    });
  }

  const columns = useMemo<ColumnDef<SellerProduct>[]>(() => [
    {
      accessorKey: "title",
      header: "Product",
      cell: ({ row }) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-950">{row.original.title}</p>
          <p className="text-xs text-slate-500">{row.original.slug}</p>
          {(row.original.titleTh || row.original.titleEn) ? (
            <p className="mt-1 text-xs text-slate-500">{[row.original.titleTh, row.original.titleEn].filter(Boolean).join(" / ")}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            {row.original.category?.name ?? "No category"} · {row.original.brand?.name ?? "No brand"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill value={row.original.status} />,
    },
    {
      id: "variants",
      header: "Assets",
      cell: ({ row }) => (
        <div className="text-sm">
          <p>{row.original.images?.length ?? 0} images</p>
          <p className="text-xs text-slate-500">{row.original.variants.length} variants</p>
        </div>
      ),
    },
    {
      id: "priceStock",
      header: "Price / stock",
      cell: ({ row }) => (
        <div className="min-w-36 text-sm">
          <p>{getVariantPriceContext(row.original)}</p>
          <p className="text-xs text-slate-500">{getVariantStockContext(row.original)}</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={`Edit ${row.original.title}`} onClick={() => openEditDialog(row.original)}>
            <EditIcon className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Archive ${row.original.title}`} onClick={() => setArchiveTarget(row.original)} disabled={row.original.status === "ARCHIVED"}>
            <ArchiveIcon className="size-4" />
            <span className="sr-only">Archive</span>
          </Button>
        </div>
      ),
    },
  ], []);

  const variantColumns = useMemo<ColumnDef<SellerProductVariant>[]>(() => [
    {
      accessorKey: "title",
      header: "Variant",
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium text-slate-950">{row.original.title}</p>
          <p className="text-xs text-slate-500">{row.original.sku}</p>
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => formatMoney(row.original.price, row.original.currency),
    },
    {
      id: "shipping",
      header: "Shipping data",
      cell: ({ row }) => <span className="text-sm text-slate-700">{row.original.weightGrams ?? "-"} g · {[row.original.lengthMm, row.original.widthMm, row.original.heightMm].map((value) => value ?? "-").join("x")} mm</span>,
    },
    {
      id: "inventory",
      header: "Inventory context",
      cell: ({ row }) => {
        const available = (row.original.inventory?.quantityOnHand ?? 0) - (row.original.inventory?.quantityReserved ?? 0);
        return <><span className="text-sm text-slate-700">{available} available</span><span className="ml-2 text-xs text-slate-500">({row.original.inventory?.quantityReserved ?? 0} reserved)</span></>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={`Edit variant ${row.original.sku}`} onClick={() => {
            const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === row.original.id));
            if (product) openEditVariantDialog(product, row.original);
          }}>
            <EditIcon className="size-4" /><span className="sr-only">Edit variant</span>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={`Delete variant ${row.original.sku}`} onClick={() => {
            const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === row.original.id));
            if (product) setDeleteVariantTarget({ product, variant: row.original });
          }}>
            <Trash2Icon className="size-4" /><span className="sr-only">Delete variant</span>
          </Button>
        </div>
      ),
    },
  ], [products]);

  return (
    <>
      <SellerPageHeader title="Products" description="Create products, monitor catalog status, and prepare variants for your shop." />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={products}
            isLoading={query.isLoading}
            loadingMessage="Loading products..."
            emptyMessage="No products found."
            pageSize={10}
            className="overflow-x-auto"
            labels={sellerTableLabels(t)}
            renderToolbar={() => (
              <>
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Input
                    value={q}
                    onChange={(event) => {
                      setQ(event.target.value);
                      setCursor(undefined);
                    }}
                    placeholder="Search products"
                    aria-label="Search products"
                    className="sm:max-w-sm"
                  />
                  <Select
                    value={status || "ALL"}
                    onValueChange={(value) => {
                      setStatus(value === "ALL" ? "" : value as ProductStatus);
                      setCursor(undefined);
                    }}
                  >
                    <SelectTrigger className="sm:w-48" aria-label="Filter by product status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={openCreateDialog} className="w-full sm:w-auto">
                  <PlusIcon className="size-4" />
                  Create product
                </Button>
              </>
            )}
          />
          {query.data?.meta.nextCursor ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setCursor(query.data.meta.nextCursor ?? undefined)}>Load next page</Button>
            </div>
          ) : null}
          <div className="mt-6 space-y-4" aria-label="Variant management">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Variants</h2>
                <p className="text-sm text-slate-500">Manage SKU and pricing here. Stock remains editable from Inventory.</p>
              </div>
            </div>
            {products.length ? products.map((product) => (
              <section key={product.id} className="rounded-lg border border-slate-200 p-4" aria-label={`${product.title} variants`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-medium text-slate-950">{product.title}</h3>
                    <p className="text-xs text-slate-500">{product.variants.length} variants ยท {getVariantStockContext(product)}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" aria-label={`Create variant for ${product.title}`} onClick={() => openCreateVariantDialog(product)}>
                    <PlusIcon className="size-4" />
                    Create variant
                  </Button>
                </div>
                <DataTable
                  columns={variantColumns}
                  data={product.variants.filter((variant) => {
                    const term = variantSearch.trim().toLowerCase();
                    if (!term) return true;
                    return `${variant.title} ${variant.sku}`.toLowerCase().includes(term);
                  })}
                  emptyMessage="No variants configured for this product."
                  pageSize={10}
                  className="overflow-x-auto"
                  labels={sellerTableLabels(t)}
                  renderToolbar={() => (
                    <Input
                      value={variantSearch}
                      onChange={(event) => setVariantSearch(event.target.value)}
                      placeholder="Search variants"
                      aria-label="Search variants"
                      className="sm:max-w-sm"
                    />
                  )}
                />
              </section>
            )) : null}
          </div>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={requestDialogClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!dirty}>
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>Manage listing details, category, brand, and URL-based image metadata. Inventory quantities stay in the seller inventory workspace.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitProduct}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-title">Title</Label>
                <Input id="product-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={formError ? "product-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-slug">Slug</Label>
                <Input id="product-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="optional-slug" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-description">Description</Label>
              <Textarea id="product-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProductStatus }))}>
                <SelectTrigger id="product-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-category">Category</Label>
                <Select value={form.categoryId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-category" aria-label="Category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No category</SelectItem>
                    {(categoriesQuery.data ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-brand">Brand</Label>
                <Select value={form.brandId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, brandId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-brand" aria-label="Brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No brand</SelectItem>
                    {(brandsQuery.data ?? []).map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-sm ${form.status === "ACTIVE" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              {getPublishReadinessMessage()}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-title-th">Thai title</Label>
                <Input id="product-title-th" value={form.titleTh} onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-title-en">English title</Label>
                <Input id="product-title-en" value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="product-description-th">Thai description</Label>
                <Textarea id="product-description-th" value={form.descriptionTh} onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-description-en">English description</Label>
                <Textarea id="product-description-en" value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} rows={3} />
              </div>
            </div>
            <section className="space-y-3 rounded-lg border border-slate-200 p-3" aria-label="Product enrichment">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Enrichment</h3>
                <p className="text-xs text-slate-500">Buyer-facing SEO, facts, highlights, and exact-match specifications.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-meta-title">SEO title</Label>
                  <Input id="product-meta-title" value={form.metaTitle} onChange={(event) => setForm((current) => ({ ...current, metaTitle: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-condition">Condition</Label>
                  <Input id="product-condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} placeholder="New" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-meta-description">SEO description</Label>
                <Textarea id="product-meta-description" value={form.metaDescription} onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))} rows={2} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-warranty">Warranty info</Label>
                  <Input id="product-warranty" value={form.warrantyInfo} onChange={(event) => setForm((current) => ({ ...current, warrantyInfo: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-origin">Country of origin</Label>
                  <Input id="product-origin" value={form.countryOfOrigin} onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))} placeholder="TH" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-highlights">Highlights</Label>
                <Textarea id="product-highlights" value={form.highlightsText} onChange={(event) => setForm((current) => ({ ...current, highlightsText: event.target.value }))} rows={3} placeholder="One highlight per line" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-attributes">Specifications</Label>
                <Textarea id="product-attributes" value={form.attributesText} onChange={(event) => setForm((current) => ({ ...current, attributesText: event.target.value }))} rows={3} placeholder="color|Color|Black|filterable" />
                <p className="text-xs text-slate-500">Use one row per specification: key|display name|value|filterable.</p>
              </div>
            </section>
            <section className="space-y-3 rounded-lg border border-slate-200 p-3" aria-label="Product image metadata">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Images</h3>
                <p className="text-xs text-slate-500">Add public image URLs and metadata only. Binary uploads are not part of this workflow.</p>
              </div>
              {editingProduct ? (
                <>
                  <div className="space-y-2">
                    {(editingProduct.images ?? []).length ? editingProduct.images.map((image) => (
                      <div key={image.id} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{image.url}</p>
                          <p className="text-xs text-slate-500">{image.isPrimary ? "Primary · " : ""}{image.altText ?? "No alt text"} · {image.width ?? "?"}x{image.height ?? "?"}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" disabled={isMutatingImage || image.isPrimary} onClick={() => markImagePrimary(image)}>Set primary</Button>
                          <Button type="button" variant="outline" size="sm" disabled={isMutatingImage} onClick={() => removeImage(image)}>Delete</Button>
                        </div>
                      </div>
                    )) : <p className="text-sm text-slate-500">No product images yet.</p>}
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="product-image-url">Image URL</Label>
                      <Input id="product-image-url" value={imageForm.url} onChange={(event) => setImageForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://example.com/product.jpg" aria-describedby={imageFormError ? "product-image-form-error" : undefined} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="product-image-alt">Alt text</Label>
                        <Input id="product-image-alt" value={imageForm.altText} onChange={(event) => setImageForm((current) => ({ ...current, altText: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-image-sort">Sort order</Label>
                        <Input id="product-image-sort" type="number" min="0" step="1" value={imageForm.sortOrder} onChange={(event) => setImageForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="product-image-width">Width pixels</Label>
                        <Input id="product-image-width" type="number" min="1" step="1" value={imageForm.width} onChange={(event) => setImageForm((current) => ({ ...current, width: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-image-height">Height pixels</Label>
                        <Input id="product-image-height" type="number" min="1" step="1" value={imageForm.height} onChange={(event) => setImageForm((current) => ({ ...current, height: event.target.value }))} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={imageForm.isPrimary} onChange={(event) => setImageForm((current) => ({ ...current, isPrimary: event.target.checked }))} />
                      Primary image
                    </label>
                    {imageFormError ? <p id="product-image-form-error" className="text-sm text-red-600">{imageFormError}</p> : null}
                    <Button type="button" variant="outline" disabled={isMutatingImage} onClick={submitImage}>{isMutatingImage ? "Saving image..." : "Add image metadata"}</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Save the product draft before adding image metadata.</p>
              )}
            </section>
            {formError ? <p id="product-form-error" className="text-sm text-red-600">{formError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestDialogClose(false)}>Cancel</Button>
              <Button type="submit" disabled={isMutatingProduct}>{isMutatingProduct ? "Saving..." : "Save product"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isVariantDialogOpen} onOpenChange={requestVariantDialogClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" showCloseButton={!variantDirty}>
          <DialogHeader>
            <DialogTitle>{variantDialogMode === "edit" ? "Edit variant" : "Create variant"}</DialogTitle>
            <DialogDescription>Manage variant SKU, title, and price. Inventory quantities stay in the seller inventory workspace.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitVariant}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-sku">SKU</Label>
                <Input id="variant-sku" value={variantForm.sku} onChange={(event) => setVariantForm((current) => ({ ...current, sku: event.target.value }))} required aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-title">Title</Label>
                <Input id="variant-title" value={variantForm.title} onChange={(event) => setVariantForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-title-th">Thai title</Label>
                <Input id="variant-title-th" value={variantForm.titleTh} onChange={(event) => setVariantForm((current) => ({ ...current, titleTh: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-title-en">English title</Label>
                <Input id="variant-title-en" value={variantForm.titleEn} onChange={(event) => setVariantForm((current) => ({ ...current, titleEn: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-price">Price</Label>
                <Input id="variant-price" type="number" min="0.01" step="0.01" value={variantForm.price} onChange={(event) => setVariantForm((current) => ({ ...current, price: event.target.value }))} required aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-currency">Currency</Label>
                <Input id="variant-currency" value={variantForm.currency} onChange={(event) => setVariantForm((current) => ({ ...current, currency: event.target.value }))} required aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="variant-weight-grams">Weight grams</Label>
                <Input id="variant-weight-grams" type="number" min="0" step="1" value={variantForm.weightGrams} onChange={(event) => setVariantForm((current) => ({ ...current, weightGrams: event.target.value }))} aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-length-mm">Length mm</Label>
                <Input id="variant-length-mm" type="number" min="0" step="1" value={variantForm.lengthMm} onChange={(event) => setVariantForm((current) => ({ ...current, lengthMm: event.target.value }))} aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-width-mm">Width mm</Label>
                <Input id="variant-width-mm" type="number" min="0" step="1" value={variantForm.widthMm} onChange={(event) => setVariantForm((current) => ({ ...current, widthMm: event.target.value }))} aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant-height-mm">Height mm</Label>
                <Input id="variant-height-mm" type="number" min="0" step="1" value={variantForm.heightMm} onChange={(event) => setVariantForm((current) => ({ ...current, heightMm: event.target.value }))} aria-describedby={variantFormError ? "variant-form-error" : undefined} />
              </div>
            </div>
            {variantFormError ? <p id="variant-form-error" className="text-sm text-red-600">{variantFormError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestVariantDialogClose(false)}>Cancel</Button>
              <Button type="submit" disabled={isMutatingVariant}>{isMutatingVariant ? "Saving..." : "Save variant"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product</AlertDialogTitle>
            <AlertDialogDescription>
              Archive {archiveTarget?.title ?? "this product"}? Archived products stay in history but are removed from active seller management flows.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveProduct.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={archiveProduct.isPending} onClick={confirmArchiveProduct}>
              {archiveProduct.isPending ? "Archiving..." : "Archive product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deleteVariantTarget)} onOpenChange={(open) => { if (!open) setDeleteVariantTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant</AlertDialogTitle>
            <AlertDialogDescription>
              Delete variant {deleteVariantTarget?.variant.sku ?? "this variant"} from {deleteVariantTarget?.product.title ?? "this product"}? This action requires confirmation and does not edit inventory records here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteVariant.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleteVariant.isPending} onClick={confirmDeleteVariant}>
              {deleteVariant.isPending ? "Deleting..." : "Delete variant"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        const product = row.original.product ?? variant.product ?? { title: row.original.productTitle ?? "Product" };
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
        return <Input aria-label={`Reserved stock ${row.original.sku ?? variant.sku}`} value={inventory.quantityReserved ?? 0} readOnly className="w-20" />;
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
        return <form className="flex min-w-56 justify-end gap-2" onSubmit={(event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); updateInventory.mutate({ productId: row.original.productId ?? row.original.product?.id, variantId, quantityOnHand: Number(formData.get("quantityOnHand")), reorderLevel: Number(formData.get("reorderLevel")) }, { onError: (error) => toast.error(error instanceof Error ? error.message : t("seller.manage.pages.inventory.updateFailed")) }); }}><Input name="quantityOnHand" aria-label="Quantity on hand" type="number" min={0} defaultValue={quantityOnHand} className="w-24" /><Input name="reorderLevel" aria-label="Reorder level" type="number" min={0} defaultValue={reorderLevel} className="w-24" /><Button type="submit" size="sm" disabled={updateInventory.isPending}>{t("seller.manage.pages.inventory.save")}</Button></form>;
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
  const deliver = useDeliverShipment();
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
            <Button type="button" size="sm" variant="outline" disabled={deliver.isPending || shipment.status !== "shipped"} onClick={() => deliver.mutate(shipment.id)}>
              {t("seller.manage.pages.orders.markDelivered")}
            </Button>
          </div>
        );
      },
    },
  ], [deliver, pack, ship, t]);

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
