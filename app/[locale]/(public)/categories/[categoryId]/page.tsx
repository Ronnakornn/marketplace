import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import { ProductListingPage } from "#/features/product";
import { collectionPageJsonLd, getSiteName, publicPageMetadata, requirePublicCategorySeo } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; categoryId: string }> }): Promise<Metadata> {
  const { locale, categoryId } = await params;
  const category = await requirePublicCategorySeo(categoryId);

  return publicPageMetadata({
    title: `${category.name} products`,
    description: `Browse active ${category.name} products on ${getSiteName()}.`,
    path: `/categories/${category.slug}`,
    locale,
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
  const { categoryId } = await params;
  const query = await searchParams;
  const category = await requirePublicCategorySeo(categoryId);

  return (
    <>
      <JsonLd data={collectionPageJsonLd(category)} />
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
