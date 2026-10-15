"use client";

import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { useTranslations } from "#/i18n/client";
import { useEnrollSellerFlashSaleItem, useSellerProducts } from "../hooks/useSellerManage";

const PRODUCT_PAGE_SIZE = 50;

export function SellerFlashSaleEnrollmentForm({ flashSaleId, shopId }: { flashSaleId: string; shopId?: string }) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState({ q: "", page: 1 });
  const [selected, setSelected] = useState<{ productId: string; variantId: string; label: string }>();
  const products = useSellerProducts({ status: "ACTIVE", limit: PRODUCT_PAGE_SIZE, shopId, ...filter });
  const enroll = useEnrollSellerFlashSaleItem();
  const options = (products.data?.data ?? []).flatMap((product) => product.variants
    .filter((variant) => variant.status === "ACTIVE")
    .map((variant) => ({ productId: product.id, variantId: variant.id, label: `${product.title} · ${variant.title} (${variant.sku})` })));
  if (selected && !options.some((option) => option.variantId === selected.variantId)) options.unshift(selected);
  const applySearch = () => setFilter({ q: search.trim(), page: 1 });

  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    enroll.mutate({ flashSaleId, productId: selected.productId, variantId: selected.variantId,
      salePriceBaht: String(values.get("salePriceBaht")), stockLimit: Number(values.get("stockLimit")),
      perUserLimit: values.get("perUserLimit") ? Number(values.get("perUserLimit")) : null,
    }, { onSuccess: () => { form.reset(); setSelected(undefined); } });
  }}>
    <div className="flex gap-2">
      <Input aria-label={t("seller.manage.pages.promotions.searchProducts")} placeholder={t("seller.manage.pages.promotions.searchProducts")} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); applySearch(); }
      }} />
      <Button type="button" variant="outline" onClick={applySearch}>{t("common.search")}</Button>
    </div>
    {products.error ? <div role="alert" className="flex items-center justify-between gap-2 text-sm text-red-700">
      <p>{t("seller.manage.pages.promotions.productsLoadFailed")}</p>
      <Button type="button" variant="outline" onClick={() => void products.refetch()}>{t("seller.manage.retry")}</Button>
    </div> : null}
    <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto]">
      <Select value={selected ? `${selected.productId}:${selected.variantId}` : ""} onValueChange={(value) => setSelected(options.find((option) => `${option.productId}:${option.variantId}` === value))}>
        <SelectTrigger aria-label={t("seller.manage.pages.promotions.selectProduct")}><SelectValue placeholder={t("seller.manage.pages.promotions.selectProduct")} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.variantId} value={`${option.productId}:${option.variantId}`}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      <Input name="salePriceBaht" required type="number" min="0.01" step="0.01" placeholder={t("seller.manage.pages.promotions.salePriceBaht")} />
      <Input name="stockLimit" required type="number" min="1" placeholder={t("seller.manage.pages.promotions.stockLimit")} />
      <Input name="perUserLimit" type="number" min="1" placeholder={t("seller.manage.pages.promotions.perUserLimit")} />
      <Button type="submit" disabled={!selected || enroll.isPending}>{t("seller.manage.pages.promotions.enroll")}</Button>
    </div>
    <div className="flex items-center justify-between gap-2">
      <p role="status" className="text-xs text-slate-500">{products.isLoading ? t("seller.manage.pages.promotions.productsLoading") : t("seller.manage.pages.promotions.productsPage").replace("{page}", String(filter.page)).replace("{count}", String(products.data?.meta.totalCount ?? 0))}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" disabled={filter.page === 1 || products.isFetching} onClick={() => setFilter((current) => ({ ...current, page: current.page - 1 }))}>{t("common.previous")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={products.isFetching || Boolean(products.error) || filter.page * PRODUCT_PAGE_SIZE >= (products.data?.meta.totalCount ?? 0)} onClick={() => setFilter((current) => ({ ...current, page: current.page + 1 }))}>{t("common.next")}</Button>
      </div>
    </div>
    {enroll.isError ? <p role="alert" className="text-sm text-red-700">{t("seller.manage.pages.promotions.flashSaleSaveFailed")}</p> : null}
  </form>;
}
