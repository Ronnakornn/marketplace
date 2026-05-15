import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import { ProductDetailPage } from "#/features/product";
import { productJsonLd, publicPageMetadata, requirePublicProductSeo } from "#/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; productId: string }> }): Promise<Metadata> {
  const { locale, productId } = await params;
  const product = await requirePublicProductSeo(productId);

  return publicPageMetadata({
    title: product.title,
    description: product.description,
    path: product.urlPath,
    locale,
    image: product.image,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; productId: string }> }) {
  const { productId } = await params;
  const product = await requirePublicProductSeo(productId);

  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <ProductDetailPage productId={productId} />
    </>
  );
}
