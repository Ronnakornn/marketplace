import type { Metadata } from "next";
import { ProductListingPage } from "#/features/product/components/ProductListingPage";
import { getInitialProductListing } from "#/features/product/listing-data.server";
import { resolveLocale } from "#/i18n/config";
import { createTranslator } from "#/i18n/server";
import { publicPageMetadata, safeDescription } from "#/lib/seo";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; keyword?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams.q ?? resolvedSearchParams.keyword ?? "").trim();
  const t = createTranslator(locale);
  return publicPageMetadata({
    title: query ? t("product.searchResultsFor").replace("{query}", query) : t("common.search"),
    description: safeDescription(undefined, t("seo.searchDescription")),
    path: "/search",
    locale,
    noindex: true,
  });
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    keyword?: string;
    categoryId?: string;
    brandId?: string;
    attributeFilters?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    rating?: string;
    inStock?: string;
  }>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const query = filters.q ?? filters.keyword ?? "";
  const initialListing = await getInitialProductListing({ ...filters, query }, resolveLocale(locale));
  return (
    <ProductListingPage
      mode="search"
      query={query}
      categoryId={filters.categoryId}
      brandId={filters.brandId}
      attributeFilters={filters.attributeFilters}
      minPrice={filters.minPrice}
      maxPrice={filters.maxPrice}
      sort={filters.sort}
      rating={filters.rating}
      inStock={filters.inStock}
      initialListing={initialListing}
    />
  );
}
