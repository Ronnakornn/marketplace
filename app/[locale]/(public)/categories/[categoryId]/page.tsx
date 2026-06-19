import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import { ProductListingPage } from "#/features/product";
import { createTranslator } from "#/i18n/server";
import { breadcrumbJsonLd, collectionPageJsonLd, getSiteName, publicPageMetadata, requirePublicCategorySeo } from "#/lib/seo";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; categoryId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const { locale, categoryId } = await params;
  const query = await searchParams;
  const category = await requirePublicCategorySeo(categoryId);
  const t = createTranslator(locale);

  return publicPageMetadata({
    title: t("seo.categoryProductsTitle").replace("{category}", category.name),
    description: t("seo.categoryProductsDescription")
      .replace("{category}", category.name)
      .replace("{site}", getSiteName()),
    path: `/categories/${category.slug}`,
    locale,
    noindex: hasIndexUnsafeCategoryFilters(query),
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; categoryId: string }>;
  searchParams: Promise<{
    brandId?: string;
    attributeFilters?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    rating?: string;
    inStock?: string;
    freeShipping?: string;
    onSale?: string;
  }>;
}) {
  const { locale, categoryId } = await params;
  const query = await searchParams;
  const category = await requirePublicCategorySeo(categoryId);
  const t = createTranslator(locale);

  return (
    <>
      <JsonLd data={collectionPageJsonLd(category)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: t("common.home"), path: "/" },
        { name: category.name, path: `/categories/${category.slug}` },
      ])} />
      <ProductListingPage
        mode="category"
        categoryId={category.slug}
        brandId={query.brandId}
        attributeFilters={query.attributeFilters}
        minPrice={query.minPrice}
        maxPrice={query.maxPrice}
        sort={query.sort}
        rating={query.rating}
        inStock={query.inStock}
        freeShipping={query.freeShipping}
        onSale={query.onSale}
      />
    </>
  );
}

function hasIndexUnsafeCategoryFilters(query: Record<string, string | undefined>) {
  return Boolean(
    query.brandId
      || query.attributeFilters
      || query.minPrice
      || query.maxPrice
      || query.sort
      || query.rating
      || query.inStock
      || query.freeShipping
      || query.onSale,
  );
}
