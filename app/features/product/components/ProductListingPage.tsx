"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon, StarIcon, XIcon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingGrid } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "#/components/ui/sheet";
import { ProductCard } from "#/features/product/components/ProductCard";
import {
  normalizePublicCategories,
  normalizePublicBrands,
  normalizePublicProductListing,
  normalizePublicSearchSuggestions,
  publicBrandsQueryOptions,
  publicCategoriesQueryOptions,
  publicProductListQueryOptions,
  publicProductSearchQueryOptions,
  publicSearchSuggestionsQueryOptions,
  type BuyerProduct,
  type BuyerListingFacets,
  type BuyerProductListing,
} from "#/features/product/queries";
import { trackDiscoveryEvent, useTrackVisibleProducts } from "#/features/tracking";
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
  brandId?: string;
  attributeFilters?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  rating?: string;
  inStock?: string;
  freeShipping?: string;
  onSale?: string;
}

export function ProductListingPage({
  mode,
  query = "",
  categoryId,
  brandId,
  attributeFilters,
  minPrice,
  maxPrice,
  sort = "relevance",
  rating,
  inStock,
  freeShipping,
  onSale,
}: ProductListingPageProps) {
  const locale = useLocale();
  const t = useTranslations();
  const localePath = useLocalePath();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [accumulatedListing, setAccumulatedListing] = useState<BuyerProductListing | null>(null);
  const minRating = toNumber(rating);
  const currentCategory = mode === "category" ? categoryId : undefined;
  const basePath = mode === "category" && categoryId ? `/categories/${categoryId}` : "/search";
  const listingResetKey = [
    mode,
    query,
    currentCategory ?? categoryId ?? "",
    brandId ?? "",
    attributeFilters ?? "",
    minPrice ?? "",
    maxPrice ?? "",
    sort,
    rating ?? "",
    inStock ?? "",
    freeShipping ?? "",
    onSale ?? "",
    locale,
  ].join("|");
  const productListInput = {
    q: query,
    categoryId: currentCategory ?? categoryId,
    brandId,
    attributeFilters,
    minPrice,
    maxPrice,
    sort,
    rating: minRating,
    inStock: inStock === "true" ? true : undefined,
    freeShipping: freeShipping === "true" ? true : undefined,
    onSale: onSale === "true" ? true : undefined,
    limit: 40,
    page,
    locale,
  };
  const listProductsQuery = useQuery({
    ...publicProductListQueryOptions(productListInput),
    enabled: mode !== "search",
    select: normalizePublicProductListing,
  });
  const searchProductsQuery = useQuery({
    ...publicProductSearchQueryOptions(productListInput),
    enabled: mode === "search",
    select: normalizePublicProductListing,
  });
  const productsQuery = mode === "search" ? searchProductsQuery : listProductsQuery;
  const suggestionsQuery = useQuery({
    ...publicSearchSuggestionsQueryOptions({ q: query, limit: 8, locale }),
    enabled: mode === "search" && query.trim().length > 0,
    select: normalizePublicSearchSuggestions,
  });
  const categoriesQuery = useQuery({
    ...publicCategoriesQueryOptions({ locale }),
    select: normalizePublicCategories,
  });
  const brandsQuery = useQuery({
    ...publicBrandsQueryOptions(),
    select: normalizePublicBrands,
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

  useEffect(() => {
    setPage(1);
    setAccumulatedListing(null);
  }, [listingResetKey]);

  useEffect(() => {
    if (!productsQuery.data) return;
    setAccumulatedListing((current) => mergeListingPages(current, productsQuery.data, page));
  }, [productsQuery.data, page]);

  const title = mode === "home" ? t("product.discover") : mode === "category" ? categoryId ?? t("product.category") : t("common.search");
  const listing = accumulatedListing ?? productsQuery.data ?? null;
  const products = sortProducts(
    (listing?.products ?? [])
      .filter((product) => minRating === undefined || product.rating >= minRating)
      .filter((product) => inStock !== "true" || product.stock > 0)
      .filter((product) => freeShipping !== "true" || product.badges?.some((badge) => badge.toLowerCase() === "free shipping"))
      .filter((product) => onSale !== "true" || product.discountPercent !== null || product.badges?.some((badge) => badge.toLowerCase().includes("sale") || badge.toLowerCase().includes("off"))),
    sort,
  );
  const hasAccumulatedProducts = (accumulatedListing?.products.length ?? 0) > 0;
  const isInitialLoading = productsQuery.isLoading && !hasAccumulatedProducts;
  const isNextPageLoading = productsQuery.isFetching && page > 1;
  const isNextPageError = productsQuery.isError && hasAccumulatedProducts;
  const isInitialError = productsQuery.isError && !hasAccumulatedProducts;
  const canLoadMore = Boolean(listing?.meta.hasNextPage);
  useTrackVisibleProducts(products, mode === "search" ? "search_results" : mode === "category" ? "category_listing" : "product_listing");

  useEffect(() => {
    if (mode !== "search" || !query.trim() || !productsQuery.isSuccess) return;
    trackDiscoveryEvent({
      eventType: "search_submitted",
      query,
      source: "search_page",
      resultCount: products.length,
    });
  }, [mode, query, productsQuery.isSuccess, products.length]);

  useEffect(() => {
    if (mode === "category" && categoryId) {
      trackDiscoveryEvent({ eventType: "category_viewed", categoryId, source: "category_page" });
    }
  }, [mode, categoryId]);

  useEffect(() => {
    const hasFilters = Boolean(brandId || attributeFilters || minPrice || maxPrice || rating || inStock || freeShipping || onSale || (sort && sort !== "relevance"));
    if (!hasFilters || (mode !== "search" && mode !== "category")) return;
    trackDiscoveryEvent({
      eventType: "filter_applied",
      query,
      source: "search_filters",
      filters: { categoryId, brandId, attributeFilters, minPrice, maxPrice, rating, inStock, freeShipping, onSale, sort },
      resultCount: products.length,
    });
  }, [mode, query, categoryId, brandId, attributeFilters, minPrice, maxPrice, rating, inStock, freeShipping, onSale, sort, products.length]);
  const filterProps = useMemo(() => ({
    categories: buildCategoryFilterOptions(listing?.facets.categories, categoriesQuery.data ?? []),
    brands: buildBrandFilterOptions(listing?.facets.brands, brandsQuery.data ?? []),
    price: listing?.facets.price ?? { min: null, max: null, currency: "THB" },
    query,
    categoryId,
    brandId,
    attributeFilters,
    minPrice,
    maxPrice,
    sort,
    rating,
    inStock,
    freeShipping,
    onSale,
    basePath,
    showCategoryFilter: mode === "search",
  }), [listing?.facets, categoriesQuery.data, brandsQuery.data, query, categoryId, brandId, attributeFilters, minPrice, maxPrice, sort, rating, inStock, freeShipping, onSale, basePath, mode]);
  const activeFilters = buildActiveFilters({
    q: query,
    categoryId: mode === "search" ? categoryId : undefined,
    brandId,
    minPrice,
    maxPrice,
    rating,
    inStock,
    freeShipping,
    onSale,
    sort,
  }, filterProps.categories, filterProps.brands, basePath, t);
  const activeFilterCount = activeFilters.length;
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

        <div className={mode !== "home" ? "grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]" : ""}>
          {mode !== "home" ? (
            <>
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="flex h-auto w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium shadow-xs transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <SlidersHorizontalIcon className="size-4 shrink-0 text-orange-600" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-5">{t("product.filterAndSort")}</span>
                          <span className="block truncate text-xs font-normal text-slate-500">
                            {activeFilterCount ? `${activeFilterCount} active` : t("product.searchFilter")}
                          </span>
                        </span>
                      </span>
                      {activeFilterCount ? (
                        <Badge className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-xs text-white">{activeFilterCount}</Badge>
                      ) : null}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-0">
                    <SheetHeader className="border-b border-slate-100 px-4 py-3 text-left">
                      <SheetTitle>{t("product.filterAndSort")}</SheetTitle>
                      <SheetDescription>
                        {activeFilterCount > 0 ? `${activeFilterCount} active filters` : "Refine results without leaving this page."}
                      </SheetDescription>
                    </SheetHeader>
                    <SearchFilterSidebar {...filterProps} compact activeFilterCount={activeFilterCount} />
                  </SheetContent>
                </Sheet>
              </div>
              <SearchFilterSidebar {...filterProps} />
            </>
          ) : null}

          <section className="min-w-0 space-y-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold leading-6 text-slate-950">{mode === "home" ? t("product.recommendedProducts") : resultTitle}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {listing ? formatResultSummary(t("product.itemsFound"), products.length, listing.meta.totalCount) : t("product.loadingResults")}
                </p>
              </div>
              {mode !== "home" ? (
                <SortTabs basePath={basePath} query={query} categoryId={mode === "search" ? categoryId : undefined} brandId={brandId} attributeFilters={attributeFilters} minPrice={minPrice} maxPrice={maxPrice} rating={rating} inStock={inStock} freeShipping={freeShipping} onSale={onSale} sort={sort} />
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={localePath("/search")}>{t("product.viewAll")}</Link>
                </Button>
              )}
            </div>
            {activeFilters.length ? (
              <div className="space-y-2 rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-orange-700">Active filters</p>
                  <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 rounded-full px-2 text-xs text-orange-700">
                    <Link href={buildSearchHref({ q: query }, basePath)}>{t("product.clearFilters")}</Link>
                  </Button>
                </div>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
                  {activeFilters.map((filter) => (
                    <Button key={filter.key} asChild variant="outline" size="sm" className="h-8 max-w-[15rem] shrink-0 rounded-full border-orange-200 bg-white px-3 text-orange-800">
                      <Link href={filter.href} aria-label={`Remove ${filter.label}`}>
                        <span className="truncate">{filter.label}</span>
                        <XIcon className="size-3 shrink-0" />
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {isInitialLoading ? <BuyerLoadingGrid /> : null}
            {isInitialError ? <BuyerErrorState message={getReadableListingErrorMessage(productsQuery.error)} onRetry={() => void productsQuery.refetch()} /> : null}
            {listing && products.length === 0 && !isInitialLoading && !isInitialError ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <BuyerEmptyState title={t("product.noProductsFound")} description={t("product.noProductsDescription")} />
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={buildSearchHref({ q: query }, basePath)}>{t("product.clearFilters")}</Link>
                  </Button>
                  {trendingKeywords.slice(0, 3).map((keyword) => (
                    <Button key={keyword} asChild variant="ghost" size="sm" className="rounded-full">
                      <Link href={buildSearchHref({ q: keyword })}>{keyword}</Link>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
                <div className="flex flex-col items-center gap-2 py-3">
                  {isNextPageError ? (
                    <p className="text-sm text-red-600">{getReadableListingErrorMessage(productsQuery.error)}</p>
                  ) : null}
                  {canLoadMore || isNextPageError ? (
                    <Button
                      type="button"
                      variant={isNextPageError ? "outline" : "default"}
                      className="rounded-full"
                      disabled={isNextPageLoading}
                      onClick={() => {
                        if (isNextPageError) {
                          void productsQuery.refetch();
                          return;
                        }
                        setPage((current) => current + 1);
                      }}
                    >
                      {isNextPageLoading ? "Loading more..." : isNextPageError ? "Retry load more" : "Load more"}
                    </Button>
                  ) : null}
                </div>
              </>
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
  categories: CategoryFilterOption[];
  brands: BrandFilterOption[];
  price: BuyerListingFacets["price"];
  query: string;
  categoryId?: string;
  brandId?: string;
  attributeFilters?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  sort: string;
  inStock?: string;
  freeShipping?: string;
  onSale?: string;
  basePath: string;
  showCategoryFilter: boolean;
  compact?: boolean;
  activeFilterCount?: number;
}) {
  const t = useTranslations();
  const base = {
    q: props.query,
    minPrice: props.minPrice,
    maxPrice: props.maxPrice,
    rating: props.rating,
    inStock: props.inStock,
    freeShipping: props.freeShipping,
    onSale: props.onSale,
    sort: props.sort,
    brandId: props.brandId,
    attributeFilters: props.attributeFilters,
  };
  const minPricePlaceholder = props.minPrice ? t("product.min") : props.price.min !== null ? String(props.price.min) : t("product.min");
  const maxPricePlaceholder = props.maxPrice ? t("product.max") : props.price.max !== null ? String(props.price.max) : t("product.max");
  const hasPriceMetadata = props.price.min !== null || props.price.max !== null;

  return (
    <aside className={`space-y-4 bg-white p-4 lg:sticky lg:top-20 lg:self-start lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm ${props.compact ? "" : "hidden lg:block"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold text-slate-950">
            <SlidersHorizontalIcon className="size-4 shrink-0 text-orange-600" />
            {t("product.searchFilter")}
          </div>
          {props.activeFilterCount ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{props.activeFilterCount} active filters</p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full px-3" asChild>
          <Link href={buildSearchHref({ q: props.query }, props.basePath)}>{t("product.clearFilters")}</Link>
        </Button>
      </div>

      <FilterBlock title="Sort by">
        <SortLinkList {...props} />
      </FilterBlock>

      {props.showCategoryFilter ? <FilterBlock title={t("product.category")}>
        <div className="space-y-1">
          <FilterLink active={!props.categoryId} href={buildSearchHref(base, props.basePath)}>{t("product.allCategories")}</FilterLink>
          {props.categories.map((category) => (
            <FilterLink
              key={category.slug}
              active={props.categoryId === category.slug}
              disabled={category.unavailable}
              href={buildSearchHref({ ...base, categoryId: category.slug }, props.basePath)}
            >
              <FilterOptionLabel label={category.name} count={category.count} />
            </FilterLink>
          ))}
        </div>
      </FilterBlock> : null}

      <FilterBlock title={t("product.priceRange")}>
        <form action={props.basePath} className="space-y-2">
          <input type="hidden" name="q" value={props.query} />
          {props.categoryId ? <input type="hidden" name="categoryId" value={props.categoryId} /> : null}
          {props.brandId ? <input type="hidden" name="brandId" value={props.brandId} /> : null}
          {props.attributeFilters ? <input type="hidden" name="attributeFilters" value={props.attributeFilters} /> : null}
          {props.rating ? <input type="hidden" name="rating" value={props.rating} /> : null}
          {props.inStock ? <input type="hidden" name="inStock" value={props.inStock} /> : null}
          {props.freeShipping ? <input type="hidden" name="freeShipping" value={props.freeShipping} /> : null}
          {props.onSale ? <input type="hidden" name="onSale" value={props.onSale} /> : null}
          <input type="hidden" name="sort" value={props.sort} />
          <div className="grid grid-cols-2 gap-2">
            <Input name="minPrice" defaultValue={props.minPrice} inputMode="numeric" placeholder={minPricePlaceholder} className="h-9 rounded-xl" />
            <Input name="maxPrice" defaultValue={props.maxPrice} inputMode="numeric" placeholder={maxPricePlaceholder} className="h-9 rounded-xl" />
          </div>
          {hasPriceMetadata ? (
            <p className="text-xs leading-5 text-slate-500">
              {formatPriceRangeHelper(props.price)}
            </p>
          ) : null}
          <Button type="submit" size="sm" className="w-full rounded-full bg-orange-600 hover:bg-orange-700">{t("product.applyFilters")}</Button>
        </form>
      </FilterBlock>

      <FilterBlock title="Brand">
        <div className="space-y-1">
          <FilterLink active={!props.brandId} href={buildSearchHref({ ...base, brandId: undefined }, props.basePath)}>All brands</FilterLink>
          {props.brands.map((brand) => (
            <FilterLink key={brand.id} active={props.brandId === brand.id} disabled={brand.unavailable} href={buildSearchHref({ ...base, brandId: brand.id }, props.basePath)}>
              <FilterOptionLabel label={brand.name} count={brand.count} />
            </FilterLink>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title={t("product.rating")}>
        <div className="space-y-1">
          {[5, 4, 3].map((value) => (
            <FilterLink key={value} active={props.rating === String(value)} href={buildSearchHref({ ...base, categoryId: props.showCategoryFilter ? props.categoryId : undefined, rating: String(value) }, props.basePath)}>
              <span className="inline-flex items-center gap-1">
                {Array.from({ length: value }).map((_, index) => <StarIcon key={index} className="size-3 fill-amber-400 text-amber-400" />)}
                & {t("product.up")}
              </span>
            </FilterLink>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title={t("product.servicePromotion")}>
        <FilterLink active={props.inStock === "true"} href={buildSearchHref({ ...base, inStock: props.inStock === "true" ? undefined : "true" }, props.basePath)}>
          {t("product.inStock")}
        </FilterLink>
        <FilterLink active={props.freeShipping === "true"} href={buildSearchHref({ ...base, freeShipping: props.freeShipping === "true" ? undefined : "true" }, props.basePath)}>
          {t("product.freeShipping")}
        </FilterLink>
        <FilterLink active={props.onSale === "true"} href={buildSearchHref({ ...base, onSale: props.onSale === "true" ? undefined : "true" }, props.basePath)}>
          {t("product.onSale")}
        </FilterLink>
      </FilterBlock>

      <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-slate-100 bg-white/95 p-4 backdrop-blur lg:static lg:m-0 lg:border-0 lg:bg-transparent lg:p-0">
        <Button variant="outline" className="w-full rounded-full" asChild>
          <Link href={buildSearchHref({ q: props.query }, props.basePath)}>{t("product.clearFilters")}</Link>
        </Button>
      </div>
    </aside>
  );
}

function SortLinkList(props: {
  query: string;
  categoryId?: string;
  brandId?: string;
  attributeFilters?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  sort: string;
  inStock?: string;
  freeShipping?: string;
  onSale?: string;
  basePath: string;
}) {
  const t = useTranslations();
  const sorts = getSortOptions(t);

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
      {sorts.map(([value, label]) => (
        <FilterLink
          key={value}
          active={props.sort === value}
          href={buildSearchHref({ q: props.query, categoryId: props.categoryId, brandId: props.brandId, attributeFilters: props.attributeFilters, minPrice: props.minPrice, maxPrice: props.maxPrice, rating: props.rating, inStock: props.inStock, freeShipping: props.freeShipping, onSale: props.onSale, sort: value }, props.basePath)}
        >
          {label}
        </FilterLink>
      ))}
    </div>
  );
}

function SortTabs(props: {
  query: string;
  categoryId?: string;
  brandId?: string;
  attributeFilters?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  inStock?: string;
  freeShipping?: string;
  onSale?: string;
  sort: string;
  basePath: string;
}) {
  const t = useTranslations();
  const sorts = getSortOptions(t);

  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1 sm:max-w-[min(100%,34rem)]">
      {sorts.map(([value, label]) => (
        <Button
          key={value}
          size="sm"
          variant={props.sort === value ? "default" : "ghost"}
          className={props.sort === value ? "rounded-full bg-orange-600 hover:bg-orange-700" : "rounded-full"}
          asChild
        >
          <Link href={buildSearchHref({ q: props.query, categoryId: props.categoryId, brandId: props.brandId, attributeFilters: props.attributeFilters, minPrice: props.minPrice, maxPrice: props.maxPrice, rating: props.rating, inStock: props.inStock, freeShipping: props.freeShipping, onSale: props.onSale, sort: value }, props.basePath)}>{label}</Link>
        </Button>
      ))}
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4">
      <h3 className="mb-2 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function FilterLink({ href, active, disabled, children }: { href: string; active?: boolean; disabled?: boolean; children: ReactNode }) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-400"
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`flex min-w-0 rounded-xl px-2 py-1.5 text-sm leading-5 transition ${active ? "bg-orange-50 font-semibold text-orange-700 ring-1 ring-orange-100" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
    >
      {children}
    </Link>
  );
}

function FilterOptionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <span className="min-w-0 truncate">{label}</span>
      {typeof count === "number" ? <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span> : null}
    </span>
  );
}

function getSortOptions(t: ReturnType<typeof useTranslations>) {
  return [
    ["relevance", t("product.relevant")],
    ["newest", t("product.latest")],
    ["best_selling", t("product.topSales")],
    ["price_asc", t("product.priceLow")],
    ["price_desc", t("product.priceHigh")],
    ["rating", t("product.rating")],
  ] as const;
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

function mergeListingPages(current: BuyerProductListing | null, next: BuyerProductListing, page: number): BuyerProductListing {
  if (!current || page <= 1) {
    return {
      ...next,
      products: dedupeProducts(next.products),
    };
  }

  return {
    products: dedupeProducts([...current.products, ...next.products]),
    meta: next.meta,
    facets: next.facets.categories.length || next.facets.brands.length || next.facets.price.min !== null || next.facets.price.max !== null
      ? next.facets
      : current.facets,
  };
}

function dedupeProducts(products: BuyerProduct[]): BuyerProduct[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function formatResultSummary(template: string, visibleCount: number, totalCount: number | null): string {
  const count = totalCount === null ? visibleCount : totalCount;
  const summary = template.replace("{count}", String(count));
  if (totalCount === null || visibleCount >= totalCount) return summary;
  return `${summary} (${visibleCount} shown)`;
}

type CategoryFilterOption = {
  slug: string;
  name: string;
  count?: number;
  unavailable?: boolean;
};

type BrandFilterOption = {
  id: string;
  name: string;
  count?: number;
  unavailable?: boolean;
};

function buildCategoryFilterOptions(
  facets: BuyerListingFacets["categories"] | undefined,
  fallback: Array<{ slug: string; name: string }>,
): CategoryFilterOption[] {
  if (facets?.length) {
    return facets.map((facet) => ({
      slug: facet.slug,
      name: facet.name,
      count: facet.count,
      unavailable: facet.count <= 0 && !facet.active,
    }));
  }
  return fallback.map((category) => ({ slug: category.slug, name: category.name }));
}

function buildBrandFilterOptions(
  facets: BuyerListingFacets["brands"] | undefined,
  fallback: Array<{ id: string; name: string }>,
): BrandFilterOption[] {
  if (facets?.length) {
    return facets.map((facet) => ({
      id: facet.id,
      name: facet.name,
      count: facet.count,
      unavailable: facet.count <= 0 && !facet.active,
    }));
  }
  return fallback.map((brand) => ({ id: brand.id, name: brand.name }));
}

function formatPriceRangeHelper(price: BuyerListingFacets["price"]): string {
  const min = price.min === null ? "*" : String(price.min);
  const max = price.max === null ? "*" : String(price.max);
  return `${price.currency} ${min} - ${max}`;
}

function getReadableListingErrorMessage(error: unknown) {
  return extractErrorText(error) ?? "Products are temporarily unavailable.";
}

function extractErrorText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() && value !== "[object Object]" ? value.trim() : null;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["message", "detail", "error", "reason"]) {
    const nested = extractErrorText(record[key]);
    if (nested) return nested;
  }
  return null;
}

function buildActiveFilters(
  params: Record<string, string | undefined>,
  categories: Array<{ slug: string; name: string }>,
  brands: Array<{ id: string; name: string }>,
  basePath: string,
  t: ReturnType<typeof useTranslations>,
) {
  const labels: Array<{ key: string; label: string; href: string }> = [];
  const sortLabels: Record<string, string> = Object.fromEntries(getSortOptions(t));
  const add = (key: string, label: string) => labels.push({
    key,
    label,
    href: buildSearchHref({ ...params, [key]: undefined }, basePath),
  });
  if (params.categoryId) add("categoryId", `${t("product.category")}: ${categories.find((category) => category.slug === params.categoryId)?.name ?? params.categoryId}`);
  if (params.brandId) add("brandId", `Brand: ${brands.find((brand) => brand.id === params.brandId)?.name ?? params.brandId}`);
  if (params.attributeFilters) add("attributeFilters", params.attributeFilters);
  if (params.minPrice || params.maxPrice) labels.push({
    key: "price",
    label: `${t("product.priceRange")}: ${params.minPrice ?? "0"} - ${params.maxPrice ?? "*"}`,
    href: buildSearchHref({ ...params, minPrice: undefined, maxPrice: undefined }, basePath),
  });
  if (params.rating) add("rating", `${t("product.rating")}: ${params.rating}+`);
  if (params.inStock === "true") add("inStock", t("product.inStock"));
  if (params.freeShipping === "true") add("freeShipping", t("product.freeShipping"));
  if (params.onSale === "true") add("onSale", t("product.onSale"));
  if (params.sort && params.sort !== "relevance") add("sort", `Sort: ${sortLabels[params.sort] ?? params.sort.replaceAll("_", " ")}`);
  return labels;
}

function buildSearchHref(params: Record<string, string | undefined>, basePath = "/search") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
}
