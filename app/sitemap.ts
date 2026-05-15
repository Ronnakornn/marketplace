import type { MetadataRoute } from "next";
import { locales, withLocale } from "#/i18n/config";
import { absoluteUrl, getSitemapEntries } from "#/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories, shops } = await getSitemapEntries();

  return locales.flatMap((locale) => [
    {
      url: absoluteUrl(withLocale("/", locale)),
      changeFrequency: "daily",
      priority: 1,
    },
    ...categories.map((category) => ({
      url: absoluteUrl(withLocale(`/categories/${category.slug}`, locale)),
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(withLocale(`/products/${product.id}`, locale)),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...shops.map((shop) => ({
      url: absoluteUrl(withLocale(`/shops/${shop.id}`, locale)),
      lastModified: shop.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ]);
}
