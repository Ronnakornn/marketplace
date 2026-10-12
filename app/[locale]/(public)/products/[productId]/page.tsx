import type { Metadata } from "next";
import { JsonLd } from "#/components/JsonLd";
import { ProductDetailPage } from "#/features/product";
import { breadcrumbJsonLd, productJsonLd, publicPageMetadata, publicProductSeo } from "#/lib/seo";
import { requirePublicProductData } from "#/features/product/product-data.server";
import { resolveLocale } from "#/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; productId: string }> }): Promise<Metadata> {
  const { locale, productId } = await params;
  const data = await requirePublicProductData(productId, resolveLocale(locale));
  const product = publicProductSeo(data.product, data.ratingSummary);

  return publicPageMetadata({
    title: product.title,
    description: product.description,
    path: product.urlPath,
    locale,
    image: product.image,
  });
}

export default async function ProductPage({ params }: { params: Promise<{ locale: string; productId: string }> }) {
  const { productId, locale } = await params;
  const data = await requirePublicProductData(productId, resolveLocale(locale));
  const product = publicProductSeo(data.product, data.ratingSummary);

  return (
    <>
      <JsonLd data={productJsonLd(product)} />
      <JsonLd data={breadcrumbJsonLd([
        { name: "Home", path: "/" },
        ...(product.category ? [{ name: product.category.name, path: `/categories/${product.category.slug}` }] : []),
        { name: product.title, path: product.urlPath },
      ])} />
      <ProductDetailPage productId={productId} initialData={data.product} initialRatingSummary={data.ratingSummary} />
    </>
  );
}
