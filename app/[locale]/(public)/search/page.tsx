import type { Metadata } from "next";
import { ProductListingPage } from "#/features/product";
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
  return publicPageMetadata({
    title: query ? `Search results for ${query}` : "Search",
    description: safeDescription(undefined, "Search marketplace products and sellers."),
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
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    rating?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <ProductListingPage
      mode="search"
      query={params.q ?? params.keyword ?? ""}
      categoryId={params.categoryId}
      minPrice={params.minPrice}
      maxPrice={params.maxPrice}
      sort={params.sort}
      rating={params.rating}
    />
  );
}
