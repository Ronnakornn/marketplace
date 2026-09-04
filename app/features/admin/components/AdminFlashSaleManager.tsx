"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BoltIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { useFormatters, useTranslations } from "#/i18n/client";
import { api } from "#/lib/eden";
import { useAdminProductsList } from "../hooks/useAdminOperations";
import { AdminDataShell } from "./AdminDataShell";

const statuses = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "CANCELLED"] as const;
type FlashSaleStatus = (typeof statuses)[number];

function toIsoDate(value: FormDataEntryValue | null) {
  return new Date(String(value ?? "")).toISOString();
}

function formatMoney(cents: number | bigint) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(Number(cents) / 100);
}

export function AdminFlashSaleManager() {
  const t = useTranslations();
  const formatters = useFormatters();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin", "flash-sales"],
    queryFn: async () => {
      const { data, error } = await api.api.admin["flash-sales"].get();
      if (error) throw error;
      return data;
    },
  });
  const productsQuery = useAdminProductsList({ page: 1, limit: 100, status: "ACTIVE" });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "flash-sales"] });
  const create = useMutation({
    mutationFn: async (input: { title: string; status: FlashSaleStatus; startsAt: string; endsAt: string }) => {
      const { data, error } = await api.api.admin["flash-sales"].post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ flashSaleId, ...input }: { flashSaleId: string; status: FlashSaleStatus }) => {
      const { data, error } = await api.api.admin["flash-sales"]({ flashSaleId }).patch(input);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const addItem = useMutation({
    mutationFn: async (input: { flashSaleId: string; productId: string; variantId: string; salePriceBaht: number; stockLimit: number; perUserLimit: number | null }) => {
      const { flashSaleId, ...body } = input;
      const { data, error } = await api.api.admin["flash-sales"]({ flashSaleId }).items.post(body);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const updateItem = useMutation({
    mutationFn: async ({ itemId, ...body }: { itemId: string; salePriceBaht?: number; stockLimit?: number; perUserLimit?: number | null }) => {
      const { data, error } = await api.api.admin["flash-sale-items"]({ itemId }).patch(body);
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await api.api.admin["flash-sale-items"]({ itemId }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
  const rows = (query.data ?? []).filter((sale) => sale.title.toLowerCase().includes(search.toLowerCase()));
  const productOptions = (productsQuery.data?.items ?? []).flatMap((product) => product.variants
    .filter((variant) => variant.status === "ACTIVE")
    .map((variant) => ({ productId: product.id, variantId: variant.id, label: `${product.title} · ${variant.title} (${variant.sku})` })));
  const hasMutationError = create.isError || update.isError || addItem.isError || updateItem.isError || deleteItem.isError;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    create.mutate({
      title: String(values.get("title") ?? "").trim(),
      status: String(values.get("status")) as FlashSaleStatus,
      startsAt: toIsoDate(values.get("startsAt")),
      endsAt: toIsoDate(values.get("endsAt")),
    }, { onSuccess: () => form.reset() });
  }

  return <AdminDataShell title={t("admin.flashSales.title")} description={t("admin.flashSales.description")} icon={BoltIcon} search={search} searchPlaceholder={t("admin.flashSales.search")} onSearchChange={setSearch} isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()}>
    <CardContent className="space-y-5 p-5">
      <form className="grid gap-3 rounded-xl border border-cyan-300/15 bg-slate-950/40 p-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreate}>
        <Input name="title" required placeholder={t("admin.flashSales.name")} className="border-white/10 bg-slate-950 text-white" />
        <Select name="status" defaultValue="DRAFT"><SelectTrigger className="border-white/10 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{t(`admin.flashSales.status.${status}`)}</SelectItem>)}</SelectContent></Select>
        <Label className="text-slate-300">{t("admin.flashSales.startsAt")}<Input name="startsAt" required type="datetime-local" className="mt-1 border-white/10 bg-slate-950 text-white" /></Label>
        <Label className="text-slate-300">{t("admin.flashSales.endsAt")}<Input name="endsAt" required type="datetime-local" className="mt-1 border-white/10 bg-slate-950 text-white" /></Label>
        <Button type="submit" disabled={create.isPending} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200 xl:col-span-4"><PlusIcon className="size-4" />{t("admin.flashSales.create")}</Button>
      </form>
      {hasMutationError ? <p className="text-sm text-red-300">{t("admin.flashSales.saveFailed")}</p> : null}
      <div className="grid gap-3">{rows.length ? rows.map((sale) => <article key={sale.id} className="space-y-4 rounded-xl border border-white/10 bg-slate-950/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><p className="font-semibold text-white">{sale.title}</p><p className="text-xs text-slate-400">{formatters.date(sale.startsAt)} – {formatters.date(sale.endsAt)}</p></div>
          <div className="flex items-center gap-2"><Select value={sale.status} onValueChange={(status) => update.mutate({ flashSaleId: sale.id, status: status as FlashSaleStatus })}><SelectTrigger className="w-40 border-white/10 bg-slate-950 text-white"><SelectValue /></SelectTrigger><SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{t(`admin.flashSales.status.${status}`)}</SelectItem>)}</SelectContent></Select><span className="text-xs text-slate-400">{t("admin.flashSales.items").replace("{count}", String(sale.items.length))}</span></div>
        </div>
        {sale.status === "DRAFT" || sale.status === "SCHEDULED" ? <FlashItemForm campaignId={sale.id} productOptions={productOptions} pending={addItem.isPending} t={t} onSubmit={(input, form) => addItem.mutate(input, { onSuccess: () => form.reset() })} /> : null}
        <div className="space-y-2">{sale.items.map((item) => <form key={item.id} className="grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]" onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          updateItem.mutate({ itemId: item.id, salePriceBaht: values.get("salePriceBaht") ? Number(values.get("salePriceBaht")) : undefined, stockLimit: values.get("stockLimit") ? Number(values.get("stockLimit")) : undefined, perUserLimit: values.get("perUserLimit") ? Number(values.get("perUserLimit")) : undefined });
        }}>
          <div><p className="text-sm font-medium text-white">{item.productId}</p><p className="text-xs text-slate-400">{item.variantId} · {formatMoney(item.salePrice)}</p></div>
          <Input name="salePriceBaht" disabled={!canManageFlashSaleItems(sale)} type="number" min="0.01" step="0.01" placeholder={t("admin.flashSales.salePrice")} className="border-white/10 bg-slate-950 text-white" />
          <Input name="stockLimit" disabled={!canManageFlashSaleItems(sale)} type="number" min={item.soldCount} placeholder={`${t("admin.flashSales.stockLimit")}: ${item.stockLimit}`} className="border-white/10 bg-slate-950 text-white" />
          <Input name="perUserLimit" disabled={!canManageFlashSaleItems(sale)} type="number" min="1" placeholder={`${t("admin.flashSales.perUserLimit")}: ${item.perUserLimit ?? "—"}`} className="border-white/10 bg-slate-950 text-white" />
          <div className="flex gap-2"><Button type="submit" variant="outline" disabled={!canManageFlashSaleItems(sale) || updateItem.isPending}>{t("common.save")}</Button><Button type="button" size="icon" variant="destructive" disabled={!canManageFlashSaleItems(sale) || deleteItem.isPending} onClick={() => deleteItem.mutate(item.id)} aria-label={t("admin.flashSales.removeItem")}><Trash2Icon className="size-4" /></Button></div>
        </form>)}</div>
      </article>) : <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">{t("admin.flashSales.empty")}</p>}</div>
    </CardContent>
  </AdminDataShell>;
}

function canManageFlashSaleItems(sale: { status: string }) {
  return ["DRAFT", "SCHEDULED"].includes(sale.status);
}

function FlashItemForm({ campaignId, productOptions, pending, t, onSubmit }: {
  campaignId: string;
  productOptions: Array<{ productId: string; variantId: string; label: string }>;
  pending: boolean;
  t: (key: string) => string;
  onSubmit: (input: { flashSaleId: string; productId: string; variantId: string; salePriceBaht: number; stockLimit: number; perUserLimit: number | null }, form: HTMLFormElement) => void;
}) {
  return <form className="grid gap-2 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const [productId, variantId] = String(values.get("variant") ?? "").split(":");
    if (!productId || !variantId) return;
    onSubmit({ flashSaleId: campaignId, productId, variantId, salePriceBaht: Number(values.get("salePriceBaht")), stockLimit: Number(values.get("stockLimit")), perUserLimit: values.get("perUserLimit") ? Number(values.get("perUserLimit")) : null }, form);
  }}>
    <Select name="variant" required><SelectTrigger className="border-white/10 bg-slate-950 text-white"><SelectValue placeholder={t("admin.flashSales.selectProduct")} /></SelectTrigger><SelectContent>{productOptions.map((option) => <SelectItem key={option.variantId} value={`${option.productId}:${option.variantId}`}>{option.label}</SelectItem>)}</SelectContent></Select>
    <Input name="salePriceBaht" required type="number" min="0.01" step="0.01" placeholder={t("admin.flashSales.salePrice")} className="border-white/10 bg-slate-950 text-white" />
    <Input name="stockLimit" required type="number" min="1" placeholder={t("admin.flashSales.stockLimit")} className="border-white/10 bg-slate-950 text-white" />
    <Input name="perUserLimit" type="number" min="1" placeholder={t("admin.flashSales.perUserLimit")} className="border-white/10 bg-slate-950 text-white" />
    <Button type="submit" disabled={pending}>{t("admin.flashSales.addItem")}</Button>
  </form>;
}
