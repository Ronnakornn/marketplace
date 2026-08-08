"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { ProductCard } from "#/features/product/components/ProductCard";
import { normalizePublicProductListing, publicShopProductsQueryOptions, type BuyerProduct } from "#/features/product/queries";
import { useTranslations } from "#/i18n/client";

const PAGE_SIZE = 12;
const SORTS = ["newest", "price_asc", "price_desc"] as const;
type StorefrontSort = (typeof SORTS)[number];

export function StorefrontCatalog({ shopId, locale }: { shopId: string; locale: "th" | "en" }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.slice(0, 100) ?? "";
  const category = searchParams.get("category") ?? "";
  const requestedSort = searchParams.get("sort");
  const sort: StorefrontSort = SORTS.includes(requestedSort as StorefrontSort) ? requestedSort as StorefrontSort : "newest";
  const filterKey = `${q}\u0000${category}\u0000${sort}`;
  const [search, setSearch] = useState(q);
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<BuyerProduct[]>([]);
  const query = useQuery(publicShopProductsQueryOptions({ shopId, locale, q: q || undefined, categoryId: category || undefined, sort, page, limit: PAGE_SIZE }));
  const listing = useMemo(() => query.data ? normalizePublicProductListing(query.data) : null, [query.data]);

  useEffect(() => { setSearch(q); setPage(1); setProducts([]); }, [filterKey, q]);
  useEffect(() => {
    if (!listing) return;
    setProducts((current) => {
      const next = page === 1 ? [] : current;
      return [...new Map([...next, ...listing.products].map((product) => [product.id, product])).values()];
    });
  }, [listing, page]);
  useEffect(() => {
    const timer = setTimeout(() => { if (search !== q) updateUrl({ q: search || null }); }, 350);
    return () => clearTimeout(timer);
  }, [search, q]);

  function updateUrl(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) value ? next.set(key, value) : next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  const categories = useMemo(() => listing?.facets.categories ?? [], [listing?.facets.categories]);
  const total = listing?.meta.totalCount ?? products.length;
  const initialLoading = query.isLoading && page === 1;
  const nextError = query.isError && page > 1;

  return <section aria-labelledby="storefront-catalog-title" className="space-y-5">
    <div><h2 id="storefront-catalog-title" className="text-xl font-semibold text-slate-950">{t("storefront.catalogTitle")}</h2><p className="text-sm text-slate-500">{t("storefront.resultSummary").replace("{shown}", String(products.length)).replace("{total}", String(total))}</p></div>
    <div className="grid gap-3 md:grid-cols-[1fr_14rem_12rem]">
      <Input aria-label={t("storefront.searchLabel")} placeholder={t("storefront.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} />
      <Select value={category || "all"} onValueChange={(value) => updateUrl({ category: value === "all" ? null : value })}><SelectTrigger aria-label={t("storefront.categoryLabel")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("storefront.allCategories")}</SelectItem>{categories.map((facet) => <SelectItem key={facet.id} value={facet.slug}>{facet.name} ({facet.count})</SelectItem>)}</SelectContent></Select>
      <Select value={sort} onValueChange={(value) => updateUrl({ sort: value === "newest" ? null : value })}><SelectTrigger aria-label={t("storefront.sortLabel")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">{t("storefront.sortNewest")}</SelectItem><SelectItem value="price_asc">{t("storefront.sortPriceAsc")}</SelectItem><SelectItem value="price_desc">{t("storefront.sortPriceDesc")}</SelectItem></SelectContent></Select>
    </div>
    {initialLoading ? <p className="py-12 text-center text-sm text-slate-500">{t("storefront.catalogLoading")}</p> : null}
    {query.isError && page === 1 ? <div className="py-12 text-center"><p className="text-sm text-red-700">{t("storefront.catalogError")}</p><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>{t("storefront.retry")}</Button></div> : null}
    {!initialLoading && !query.isError && products.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">{t("storefront.catalogEmpty")}</p> : null}
    {products.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} showShopIdentity={false} />)}</div> : null}
    {nextError ? <div className="text-center"><p className="text-sm text-red-700">{t("storefront.nextPageError")}</p><Button className="mt-2" variant="outline" onClick={() => void query.refetch()}>{t("storefront.retry")}</Button></div> : null}
    {listing?.meta.hasNextPage && !nextError ? <div className="text-center"><Button variant="outline" disabled={query.isFetching} onClick={() => setPage((current) => current + 1)}>{query.isFetching ? t("storefront.loadingMore") : t("storefront.loadMore")}</Button></div> : null}
    {products.length > 0 && listing && !listing.meta.hasNextPage && !nextError ? <p className="text-center text-sm text-slate-500">{t("storefront.endOfResults")}</p> : null}
  </section>;
}
