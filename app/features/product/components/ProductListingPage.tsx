"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon, StarIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "#/components/ui/sheet";
import { fetchCategories, fetchProducts, fetchSearchProducts, fetchSearchSuggestions, type BuyerProduct } from "#/features/buyer/api";
import { ProductCard } from "#/features/product/components/ProductCard";
import { useLocale, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

const homeCategories = [
  { id: "fashion", label: "Fashion" },
  { id: "beauty", label: "Beauty" },
  { id: "electronics", label: "Electronics" },
  { id: "home", label: "Home" },
  { id: "groceries", label: "Groceries" },
];
const trendingKeywords = ["phone", "beauty", "fashion", "home", "deal", "gaming"];

interface ProductListingPageProps {
  mode: "home" | "search" | "category";
  query?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  rating?: string;
}

export function ProductListingPage({
  mode,
  query = "",
  categoryId,
  minPrice,
  maxPrice,
  sort = "relevance",
  rating,
}: ProductListingPageProps) {
  const locale = useLocale();
  const t = useTranslations();
  const localePath = useLocalePath();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const minRating = toNumber(rating);
  const productsQuery = useQuery({
    queryKey: ["buyer-products", locale, mode, query, categoryId, minPrice, maxPrice, sort, minRating],
    queryFn: () => mode === "search"
      ? fetchSearchProducts({ q: query, categoryId, minPrice, maxPrice, sort: sort === "relevance" ? "newest" : sort, rating: minRating, limit: 40, locale })
      : fetchProducts({ q: query, categoryId, minPrice, maxPrice, locale }),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["buyer-search-suggestions", locale, query],
    queryFn: () => fetchSearchSuggestions(query, 8, locale),
    enabled: mode === "search" && query.trim().length > 0,
  });
  const categoriesQuery = useQuery({
    queryKey: ["buyer-categories", locale],
    queryFn: () => fetchCategories(locale),
  });

  useEffect(() => {
    if (mode !== "search") return;
    const stored = JSON.parse(window.localStorage.getItem("buyer-recent-searches") ?? "[]") as unknown;
    setRecentSearches(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string").slice(0, 6) : []);
  }, [mode]);

  useEffect(() => {
    const value = query.trim();
    if (mode !== "search" || !value) return;
    const next = [value, ...recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 6);
    window.localStorage.setItem("buyer-recent-searches", JSON.stringify(next));
  }, [mode, query]);

  const title = mode === "home" ? t("product.discover") : mode === "category" ? categoryId ?? t("product.category") : t("common.search");
  const products = sortProducts(
    (productsQuery.data ?? []).filter((product) => minRating === undefined || product.rating >= minRating),
    sort,
  );
  const filterProps = useMemo(() => ({
    categories: categoriesQuery.data ?? [],
    query,
    categoryId,
    minPrice,
    maxPrice,
    sort,
    rating,
  }), [categoriesQuery.data, query, categoryId, minPrice, maxPrice, sort, rating]);
  const resultTitle = query
    ? t("product.searchResultsFor").replace("{query}", query)
    : mode === "category"
      ? `${categoryId} ${t("product.products")}`
      : t("product.products");

  return (
    <>
      <BuyerTopBar title={title} searchQuery={query} />
      <div className="mx-auto max-w-6xl space-y-5 px-3 pb-28 pt-4">
        {mode === "home" ? <HomeBlocks /> : null}

        {mode === "category" ? (
          <div className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-orange-600">{t("product.category")}</p>
            <h1 className="mt-1 text-xl font-bold capitalize text-slate-950">{categoryId}</h1>
          </div>
        ) : null}

        {mode === "search" && !query ? (
          <SearchDiscovery recentSearches={recentSearches} />
        ) : null}

        {mode === "search" && suggestionsQuery.data?.length ? (
          <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            {suggestionsQuery.data.map((suggestion) => (
              <Button key={suggestion} asChild variant="outline" size="sm" className="rounded-full">
                <Link href={buildSearchHref({ q: suggestion })}>{suggestion}</Link>
              </Button>
            ))}
          </div>
        ) : null}

        <div className={mode === "search" ? "grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]" : ""}>
          {mode === "search" ? (
            <>
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="w-full rounded-2xl"><SlidersHorizontalIcon className="size-4" />{t("product.filterAndSort")}</Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-0">
                    <SheetHeader><SheetTitle>{t("product.filterAndSort")}</SheetTitle></SheetHeader>
                    <div className="p-4"><SearchFilterSidebar {...filterProps} compact /></div>
                  </SheetContent>
                </Sheet>
              </div>
              <SearchFilterSidebar {...filterProps} />
            </>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{mode === "home" ? t("product.recommendedProducts") : resultTitle}</h2>
                <p className="text-xs text-slate-500">
                  {productsQuery.isSuccess ? t("product.itemsFound").replace("{count}", String(products.length)) : t("product.loadingResults")}
                </p>
              </div>
              {mode === "search" ? (
                <SortTabs query={query} categoryId={categoryId} minPrice={minPrice} maxPrice={maxPrice} rating={rating} sort={sort} />
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={localePath("/search")}>{t("product.viewAll")}</Link>
                </Button>
              )}
            </div>

            {productsQuery.isLoading ? <BuyerLoadingGrid /> : null}
            {productsQuery.isError ? <BuyerErrorState message={productsQuery.error.message} onRetry={() => void productsQuery.refetch()} /> : null}
            {productsQuery.isSuccess && products.length === 0 ? (
              <BuyerEmptyState title={t("product.noProductsFound")} description={t("product.noProductsDescription")} />
            ) : null}
            {productsQuery.isSuccess && products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}

function SearchDiscovery({ recentSearches }: { recentSearches: string[] }) {
  const t = useTranslations();
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 className="text-xl font-bold text-slate-950">{t("product.searchMarketplace")}</h1>
      <div className="mt-4 space-y-3">
        {recentSearches.length ? (
          <KeywordRow title={t("product.recentSearches")} keywords={recentSearches} />
        ) : null}
        <KeywordRow title={t("product.trendingNow")} keywords={trendingKeywords} />
      </div>
    </section>
  );
}

function KeywordRow({ title, keywords }: { title: string; keywords: string[] }) {
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-950">{title}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {keywords.map((keyword) => (
          <Button key={keyword} asChild variant="outline" size="sm" className="rounded-full">
            <Link href={buildSearchHref({ q: keyword })}>{keyword}</Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function HomeBlocks() {
  const t = useTranslations();
  const localePath = useLocalePath();
  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-950">{t("product.shopTrustedStores")}</h1>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {homeCategories.map((category) => (
            <Link key={category.id} href={localePath(`/categories/${category.id}`)} className="rounded-2xl border border-orange-100 bg-orange-50 px-2 py-3 text-center text-xs font-semibold text-orange-700 transition hover:bg-orange-100">
              {category.label}
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-orange-600">{t("product.flashSale")}</p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">{t("product.specialDealsSoon")}</h2>
          </div>
          <Badge className="rounded-md bg-orange-600">{t("product.soon")}</Badge>
        </div>
      </section>
    </>
  );
}

function SearchFilterSidebar(props: {
  categories: Array<{ slug: string; name: string }>;
  query: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  sort: string;
  compact?: boolean;
}) {
  const t = useTranslations();
  const base = {
    q: props.query,
    minPrice: props.minPrice,
    maxPrice: props.maxPrice,
    rating: props.rating,
    sort: props.sort,
  };

  return (
    <aside className={`space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:self-start ${props.compact ? "" : "hidden lg:block"}`}>
      <div className="flex items-center gap-2 font-bold text-slate-950">
        <SlidersHorizontalIcon className="size-4 text-orange-600" />
        {t("product.searchFilter")}
      </div>

      <FilterBlock title={t("product.category")}>
        <div className="space-y-1">
          <FilterLink active={!props.categoryId} href={buildSearchHref(base)}>{t("product.allCategories")}</FilterLink>
          {props.categories.map((category) => (
            <FilterLink
              key={category.slug}
              active={props.categoryId === category.slug}
              href={buildSearchHref({ ...base, categoryId: category.slug })}
            >
              {category.name}
            </FilterLink>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title={t("product.priceRange")}>
        <form action="/search" className="space-y-2">
          <input type="hidden" name="q" value={props.query} />
          {props.categoryId ? <input type="hidden" name="categoryId" value={props.categoryId} /> : null}
          {props.rating ? <input type="hidden" name="rating" value={props.rating} /> : null}
          <input type="hidden" name="sort" value={props.sort} />
          <div className="grid grid-cols-2 gap-2">
            <Input name="minPrice" defaultValue={props.minPrice} inputMode="numeric" placeholder={t("product.min")} className="h-9 rounded-xl" />
            <Input name="maxPrice" defaultValue={props.maxPrice} inputMode="numeric" placeholder={t("product.max")} className="h-9 rounded-xl" />
          </div>
          <Button type="submit" size="sm" className="w-full rounded-full bg-orange-600 hover:bg-orange-700">{t("product.applyFilters")}</Button>
        </form>
      </FilterBlock>

      <FilterBlock title={t("product.rating")}>
        <div className="space-y-1">
          {[5, 4, 3].map((value) => (
            <FilterLink key={value} active={props.rating === String(value)} href={buildSearchHref({ ...base, categoryId: props.categoryId, rating: String(value) })}>
              <span className="inline-flex items-center gap-1">
                {Array.from({ length: value }).map((_, index) => <StarIcon key={index} className="size-3 fill-amber-400 text-amber-400" />)}
                & {t("product.up")}
              </span>
            </FilterLink>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title={t("product.servicePromotion")}>
        <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-600">
          <input type="checkbox" className="size-4 rounded border-slate-300 accent-orange-600" />
          {t("product.shopeeMall")}
        </label>
        <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-600">
          <input type="checkbox" className="size-4 rounded border-slate-300 accent-orange-600" />
          {t("product.freeShipping")}
        </label>
        <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-slate-600">
          <input type="checkbox" className="size-4 rounded border-slate-300 accent-orange-600" />
          {t("product.onSale")}
        </label>
      </FilterBlock>

      <Button variant="outline" className="w-full rounded-full" asChild>
        <Link href={buildSearchHref({ q: props.query })}>{t("product.clearFilters")}</Link>
      </Button>
    </aside>
  );
}

function SortTabs(props: {
  query: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  sort: string;
}) {
  const t = useTranslations();
  const sorts = [
    ["relevance", t("product.relevant")],
    ["newest", t("product.latest")],
    ["best_selling", t("product.topSales")],
    ["price_asc", t("product.priceLow")],
    ["price_desc", t("product.priceHigh")],
  ] as const;

  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1">
      {sorts.map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          variant={props.sort === value ? "default" : "ghost"}
          className={props.sort === value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"}
          asChild
        >
          <Link href={buildSearchHref({ q: props.query, categoryId: props.categoryId, minPrice: props.minPrice, maxPrice: props.maxPrice, rating: props.rating, sort: value })}>{label}</Link>
        </Button>
      ))}
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3">
      <h3 className="mb-2 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex rounded-xl px-2 py-1.5 text-sm transition ${active ? "bg-orange-50 font-semibold text-orange-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
    >
      {children}
    </Link>
  );
}

function toNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sortProducts(products: BuyerProduct[], sort: string): BuyerProduct[] {
  const items = [...products];
  switch (sort) {
    case "price_asc":
      return items.sort((a, b) => a.price - b.price || a.title.localeCompare(b.title));
    case "price_desc":
      return items.sort((a, b) => b.price - a.price || a.title.localeCompare(b.title));
    case "best_selling":
      return items.sort((a, b) => b.soldCount - a.soldCount || a.title.localeCompare(b.title));
    case "rating":
      return items.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
    case "newest":
    case "relevance":
    default:
      return items;
  }
}

function buildSearchHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `/search?${serialized}` : "/search";
}
