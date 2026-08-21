import type { Metadata } from "next";
import { ProductListingPage } from "#/features/product";
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
  searchParams,
}: {
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
  const params = await searchParams;
  return (
    <ProductListingPage
      mode="search"
      query={params.q ?? params.keyword ?? ""}
      categoryId={params.categoryId}
      brandId={params.brandId}
      attributeFilters={params.attributeFilters}
      minPrice={params.minPrice}
      maxPrice={params.maxPrice}
      sort={params.sort}
      rating={params.rating}
      inStock={params.inStock}
    />
  );
}
