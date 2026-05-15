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

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; categoryId: string }> }) {
  const { categoryId } = await params;
  const category = await requirePublicCategorySeo(categoryId);

  return (
    <>
      <JsonLd data={collectionPageJsonLd(category)} />
      <ProductListingPage mode="category" categoryId={category.slug} />
    </>
  );
}
