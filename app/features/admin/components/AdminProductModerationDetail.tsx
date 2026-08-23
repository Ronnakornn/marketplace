"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeftIcon, BoxesIcon, CheckCircle2Icon, ClipboardListIcon, ImageIcon, RotateCcwIcon, ShieldCheckIcon, StoreIcon, XCircleIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { Skeleton } from "#/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import { useAdminCatalogProductDetail } from "#/features/catalog";
import type { CatalogProduct } from "#/features/catalog";
import {
  useRestoreCatalogProduct,
  useSuspendCatalogProduct,
} from "../hooks/useAdminOperations";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { useFormatters, useTranslations } from "#/i18n/client";

interface AdminProductModerationDetailProps {
  productId: string;
}

type ModerationCase = {
  id: string;
  status: string;
  reason: string;
  severity: string;
  title?: string | null;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  resolvedAt?: string | Date | null;
  actions: Array<{
    id: string;
    action: string;
    note?: string | null;
    createdAt: string | Date;
  }>;
};
type ModerationAction = ModerationCase["actions"][number];
type ModerationProduct = CatalogProduct & { moderationCase?: ModerationCase | null };

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as { value?: { error?: { message?: string } }; error?: { message?: string }; message?: string };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? fallback;
  }
  return fallback;
}

function totalInventory(product: ModerationProduct) {
  return product.variants.reduce((total, variant) => total + (variant.inventory?.quantityOnHand ?? 0), 0);
}

function DetailPanel(props: { title: string; icon: typeof BoxesIcon; children: ReactNode }) {
  return (
    <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <props.icon className="size-5 text-cyan-200" />
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>{props.children}</CardContent>
    </Card>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-3">
      <p className="text-xs text-slate-500">{props.label}</p>
      <p className="mt-1 truncate text-sm font-medium text-white">{props.value}</p>
    </div>
  );
}

export function AdminProductModerationDetail({ productId }: AdminProductModerationDetailProps) {
  const t = useTranslations();
  const formatters = useFormatters();
  const { data: productData, isLoading, error, refetch } = useAdminCatalogProductDetail(productId);
  const suspend = useSuspendCatalogProduct();
  const restore = useRestoreCatalogProduct();
  const [reasonAction, setReasonAction] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const mutationError = suspend.error ?? restore.error;
  const isMutating = suspend.isPending || restore.isPending;

  const moderationProduct = productData as ModerationProduct | undefined;
  const primaryImage = useMemo(() => moderationProduct?.images.find((image) => image.isPrimary) ?? moderationProduct?.images[0] ?? null, [moderationProduct]);
  const lowestPrice = useMemo(() => moderationProduct ? [...moderationProduct.variants].sort((a, b) => Number(a.price) - Number(b.price))[0] ?? null : null, [moderationProduct]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 rounded-xl bg-white/10" />
        <Skeleton className="h-96 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (error || !moderationProduct) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-red-200">{t("admin.productModeration.loadError")}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/12 bg-white/5 text-slate-100" onClick={() => void refetch()}>{t("admin.common.retry")}</Button>
            <Button asChild variant="outline" className="border-white/12 bg-white/5 text-slate-100">
              <Link href="/admin/products">{t("admin.ui.backToQueue")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  function submitReasonAction() {
    if (!moderationProduct || !reasonAction || !reason.trim()) return;
    const payload = { id: moderationProduct.id, reason: reason.trim() };
    const onSuccess = () => {
      setMessage(t("admin.productModerationDetail.suspended").replace("{title}", moderationProduct.title));
      setReasonAction(false);
      setReason("");
    };
    suspend.mutate(payload, { onSuccess });
  }

  const product = moderationProduct;
  const checklist = [
    { label: t("admin.productModerationDetail.categoryAssigned"), ready: Boolean(product.category), detail: product.category?.name ?? t("admin.productModerationDetail.noCategory") },
    { label: t("admin.productModerationDetail.mediaAvailable"), ready: product.images.length > 0, detail: t("admin.productModerationDetail.imageCount").replace("{count}", String(product.images.length)) },
    { label: t("admin.productModerationDetail.primaryImage"), ready: product.images.some((image) => image.isPrimary), detail: t(product.images.some((image) => image.isPrimary) ? "admin.productModerationDetail.set" : "admin.productModerationDetail.missing") },
    { label: t("admin.productModerationDetail.activePricedVariant"), ready: product.variants.some((variant) => variant.status === "ACTIVE" && Number(variant.price) > 0), detail: t("admin.productModerationDetail.variantCount").replace("{count}", String(product.variants.length)) },
    { label: t("admin.productModerationDetail.availableInventory"), ready: product.variants.some((variant) => (variant.inventory?.quantityOnHand ?? 0) > 0), detail: t("admin.productModerationDetail.onHandCount").replace("{count}", String(totalInventory(product))) },
  ];
  const moderationCase = product.moderationCase ?? null;
  const formatDate = (value: string | Date | null | undefined) => value ? formatters.date(value) : t("admin.productModerationDetail.notAvailable");
  const formatMoney = (cents: number | bigint, currency: string) => formatters.currency(Number(cents), currency);

  return (
    <div className="space-y-6">
      <section className="admin-panel rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-cyan-100 hover:text-cyan-50">
              <ArrowLeftIcon className="size-4" />
              {t("admin.productModerationDetail.title")}
            </Link>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">{product.title}</h1>
              <AdminStatusBadge status={product.status} />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{product.description ?? t("admin.productModerationDetail.noDescription")}</p>
            <p className="mt-3 font-mono text-xs text-slate-500">{product.id}</p>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="outline" className="border-red-400/30 bg-red-500/10 text-red-100" disabled={isMutating || product.status !== "ACTIVE"} onClick={() => setReasonAction(true)}>{t("admin.ui.suspend")}</Button>
            <Button variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={isMutating || product.status !== "SUSPENDED"} onClick={() => restore.mutate(product.id, { onSuccess: () => setMessage(t("admin.productModerationDetail.restored").replace("{title}", product.title)) })}>
              <RotateCcwIcon className="size-4" />
              {restore.isPending ? t("admin.productModerationDetail.restoring") : t("admin.productModerationDetail.restore")}
            </Button>
          </div>
        </div>
        {message ? <div className="mt-5 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-100">{message}</div> : null}
        {mutationError ? <div className="mt-5 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{readErrorMessage(mutationError, t("admin.sellerApplications.operationFailed"))}</div> : null}
      </section>

      {reasonAction ? (
        <section className="admin-panel rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="moderation-detail-reason" className="text-slate-200">{t("admin.productModerationDetail.suspendReason")}</Label>
              <Textarea
                id="moderation-detail-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("admin.productModerationDetail.reasonPlaceholder")}
                className="min-h-28 border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600"
                aria-invalid={reason.trim().length === 0}
              />
              {reason.trim().length === 0 ? <p className="text-sm font-medium text-red-200">{t("admin.ui.reasonRequired")}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/10 bg-white/5 text-slate-100" disabled={isMutating} onClick={() => { setReasonAction(false); setReason(""); }}>{t("admin.ui.cancel")}</Button>
              <Button variant="destructive" disabled={isMutating || reason.trim().length === 0} onClick={submitReasonAction}>{isMutating ? t("admin.productModerationDetail.submitting") : t("admin.productModerationDetail.suspendProduct")}</Button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <DetailPanel title={t("admin.productModerationDetail.mediaPreview")} icon={ImageIcon}>
            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                {primaryImage ? <img src={primaryImage.url} alt={primaryImage.altText ?? product.title} className="size-full object-cover" /> : <ImageIcon className="size-10 text-slate-600" />}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {product.images.slice(0, 6).map((image) => (
                  <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                    <img src={image.url} alt={image.altText ?? product.title} className="size-full object-cover" />
                    {image.isPrimary ? <Badge className="absolute left-2 top-2">{t("admin.ui.primary")}</Badge> : null}
                  </div>
                ))}
                {!product.images.length ? <p className="col-span-full text-sm text-slate-400">{t("admin.ui.noMedia")}</p> : null}
              </div>
            </div>
          </DetailPanel>

          <DetailPanel title={t("admin.productModerationDetail.basicsAndSpecs")} icon={ClipboardListIcon}>
            <div className="grid gap-3 md:grid-cols-2">
              <Metric label={t("admin.productModerationDetail.slug")} value={product.slug} />
              <Metric label={t("admin.ui.category")} value={product.category?.name ?? t("admin.productModerationDetail.unassigned")} />
              <Metric label={t("admin.ui.created")} value={formatDate(product.createdAt)} />
              <Metric label={t("admin.productModerationDetail.updated")} value={formatDate(product.updatedAt)} />
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              <Table>
                <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-4 text-slate-300">{t("admin.ui.spec")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.value")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.signal")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {product.attributes.length ? product.attributes.map((attribute) => (
                    <TableRow key={attribute.id} className="border-white/8 hover:bg-white/4">
                      <TableCell className="px-4 py-3"><p className="font-medium text-white">{attribute.displayName}</p><p className="text-xs text-slate-500">{attribute.attributeKey}</p></TableCell>
                      <TableCell className="text-sm text-slate-300">{attribute.value}</TableCell>
                      <TableCell>{attribute.isFilterable ? <Badge variant="outline">{t("admin.ui.filterable")}</Badge> : <span className="text-xs text-slate-500">{t("admin.ui.displayOnly")}</span>}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={3} className="h-24 text-center text-slate-400">{t("admin.ui.noSpecs")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DetailPanel>

          <DetailPanel title={t("admin.productModerationDetail.variantsAndInventory")} icon={BoxesIcon}>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <Metric label={t("admin.ui.variants")} value={String(product.variants.length)} />
              <Metric label={t("admin.productModerationDetail.fromPrice")} value={lowestPrice ? formatMoney(lowestPrice.price, lowestPrice.currency) : t("admin.productModerationDetail.none")} />
              <Metric label={t("admin.productModerationDetail.totalStock")} value={String(totalInventory(product))} />
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Table>
                <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-4 text-slate-300">{t("admin.ui.variant")}</TableHead><TableHead className="text-slate-300">SKU</TableHead><TableHead className="text-slate-300">{t("admin.ui.price")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.inventory")}</TableHead><TableHead className="text-slate-300">{t("admin.ui.status")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {product.variants.length ? product.variants.map((variant) => (
                    <TableRow key={variant.id} className="border-white/8 hover:bg-white/4">
                      <TableCell className="px-4 py-3 font-medium text-white">{variant.title}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{variant.sku}</TableCell>
                      <TableCell className="text-sm text-slate-300">{formatMoney(variant.price, variant.currency)}</TableCell>
                      <TableCell className="text-sm text-slate-300">{t("admin.productModerationDetail.inventoryCounts").replace("{onHand}", String(variant.inventory?.quantityOnHand ?? 0)).replace("{reserved}", String(variant.inventory?.quantityReserved ?? 0))}</TableCell>
                      <TableCell><AdminStatusBadge status={variant.status} /></TableCell>
                    </TableRow>
                  )) : (
                    <TableRow className="border-white/8 hover:bg-transparent"><TableCell colSpan={5} className="h-24 text-center text-slate-400">{t("admin.ui.noVariants")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DetailPanel>
        </div>

        <div className="space-y-5">
          <DetailPanel title={t("admin.productModerationDetail.shopContext")} icon={StoreIcon}>
            <div className="space-y-3">
              <Metric label={t("admin.ui.shop")} value={product.shop.name} />
              <Metric label={t("admin.productModerationDetail.shopSlug")} value={product.shop.slug} />
              <Metric label={t("admin.productModerationDetail.shopStatus")} value={product.shop.status} />
            </div>
          </DetailPanel>

          <DetailPanel title={t("admin.productModerationDetail.readinessChecklist")} icon={ShieldCheckIcon}>
            <div className="space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  {item.ready ? <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-200" /> : <XCircleIcon className="mt-0.5 size-4 text-amber-200" />}
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </DetailPanel>

          <DetailPanel title={t("admin.productModerationDetail.moderationHistory")} icon={ClipboardListIcon}>
            {moderationCase ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  <Metric label={t("admin.productModerationDetail.caseStatus")} value={moderationCase.status} />
                  <Metric label={t("admin.ui.reason")} value={moderationCase.reason} />
                  <Metric label={t("admin.productModerationDetail.severity")} value={moderationCase.severity} />
                </div>
                <div className="space-y-3">
                  {moderationCase.actions.map((action: ModerationAction) => (
                    <div key={action.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <AdminStatusBadge status={action.action} />
                        <span className="text-xs text-slate-500">{formatDate(action.createdAt)}</span>
                      </div>
                      {action.note ? <p className="mt-2 text-sm text-slate-300">{action.note}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t("admin.ui.noModeration")}</p>
            )}
          </DetailPanel>
        </div>
      </div>
    </div>
  );
}
