import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, resolveLocale, type Locale, withLocale } from "#/i18n/config";
import { isSecretStorageUrl } from "#/lib/assets";

const DEFAULT_SITE_URL = "http://localhost:3000";
const DEFAULT_SITE_NAME = "Marketplace";
const FALLBACK_IMAGE_PATH = "/icons/icon-512.png";
const DEFAULT_DESCRIPTION = "Shop active products from trusted marketplace sellers.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getSiteUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_SITE_URL;
  return rawUrl.replace(/\/+$/, "");
}

export function getSiteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME?.trim() || DEFAULT_SITE_NAME;
}

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function resolveSeoImage(image?: string | null): string {
  if (!image) return absoluteUrl(FALLBACK_IMAGE_PATH);
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return absoluteUrl(image.startsWith("/") ? image : `/${image}`);
}

export function resolvePublicSeoImage(...images: Array<string | null | undefined>): string {
  const image = images.find((candidate) => candidate && !isSecretStorageUrl(candidate) && (/^https?:\/\//.test(candidate) || candidate.startsWith("/")));
  return resolveSeoImage(image);
}

export function safeTitle(value: string, fallback: string): string {
  const title = value.replace(/\s+/g, " ").trim() || fallback;
  return title.slice(0, 60).trim();
}

export function safeDescription(value?: string | null, fallback = DEFAULT_DESCRIPTION): string {
  const description = value?.replace(/\s+/g, " ").trim();
  if (!description) return fallback;
  return description.length > 160 ? `${description.slice(0, 157).trim()}...` : description;
}

export function formatSeoPriceCents(value?: bigint | number | null): string {
  return (Number(value ?? 0) / 100).toFixed(2);
}

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  locale?: string;
  image?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const siteName = getSiteName();
  const locale = resolveLocale(input.locale);
  const localizedPath = withLocale(input.path, locale);
  const url = absoluteUrl(localizedPath);
  const image = resolveSeoImage(input.image);

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        locales.map((targetLocale) => [targetLocale, absoluteUrl(withLocale(input.path, targetLocale))]),
      ) as Record<Locale, string>,
    },
    robots: input.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName,
      type: input.type ?? "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

export const privatePageMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export async function getPublicProductSeo(productId: string) {
  const { prisma } = await import("#server/lib/prisma.ts");
  const product = await prisma.product.findFirst({
    where: {
      OR: [
        ...(UUID_PATTERN.test(productId) ? [{ id: productId }] : []),
        { slug: productId },
      ],
      status: "ACTIVE",
      deletedAt: null,
      shop: { status: "ACTIVE" },
    },
    select: {
      id: true,
      title: true,
      description: true,
      slug: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
      brand: {
        select: {
          name: true,
        },
      },
      shop: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          url: true,
        },
      },
      variants: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          price: true,
          currency: true,
          inventory: {
            select: {
              quantityOnHand: true,
              quantityReserved: true,
            },
          },
        },
      },
      reviews: {
        where: { status: "PUBLISHED" },
        select: {
          rating: true,
        },
      },
    },
  });

  if (!product) return null;
  const firstVariant = product.variants[0];
  const availableStock = product.variants.reduce((total, variant) => {
    const inventory = variant.inventory;
    return total + Math.max(0, (inventory?.quantityOnHand ?? 0) - (inventory?.quantityReserved ?? 0));
  }, 0);
  const ratingCount = product.reviews.length;
  const ratingValue = ratingCount
    ? product.reviews.reduce((total, review) => total + review.rating, 0) / ratingCount
    : null;

  return {
    id: product.id,
    title: product.title,
    description: safeDescription(product.description, `Buy ${product.title} from ${product.shop.name} on ${getSiteName()}.`),
    slug: product.slug,
    updatedAt: product.updatedAt,
    urlPath: `/products/${product.id}`,
    image: resolveSeoImage(product.images[0]?.url),
    price: firstVariant ? formatSeoPriceCents(firstVariant.price) : null,
    currency: firstVariant?.currency ?? null,
    availability: availableStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    shop: product.shop,
    brand: product.brand,
    category: product.category?.isActive ? product.category : null,
    aggregateRating: ratingValue
      ? {
          ratingValue: Number(ratingValue.toFixed(1)),
          reviewCount: ratingCount,
        }
      : null,
  };
}

export async function requirePublicProductSeo(productId: string) {
  const product = await getPublicProductSeo(productId);
  if (!product) notFound();
  return product;
}

export async function getPublicCategorySeo(categoryId: string) {
  const { prisma } = await import("#server/lib/prisma.ts");
  return prisma.category.findFirst({
    where: {
      slug: categoryId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
    },
  });
}

export async function requirePublicCategorySeo(categoryId: string) {
  const category = await getPublicCategorySeo(categoryId);
  if (!category) notFound();
  return category;
}

export async function getSitemapEntries() {
  const { prisma } = await import("#server/lib/prisma.ts");
  const [products, categories, shops] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        shop: { status: "ACTIVE" },
      },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 1000,
    }),
    prisma.shop.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  return { products, categories, shops };
}

export function productJsonLd(product: Awaited<ReturnType<typeof requirePublicProductSeo>>) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: [product.image],
    brand: {
      "@type": "Brand",
      name: product.brand?.name ?? product.shop.name,
    },
  };

  if (product.price && product.currency) {
    data.offers = {
      "@type": "Offer",
      url: absoluteUrl(product.urlPath),
      price: product.price,
      priceCurrency: product.currency,
      availability: product.availability,
    };
  }

  if (product.aggregateRating) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.aggregateRating.ratingValue,
      reviewCount: product.aggregateRating.reviewCount,
    };
  }

  return data;
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: getSiteName(),
    url: absoluteUrl(withLocale("/", "th")),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl(withLocale("/search", "th"))}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function storeJsonLd(shop: { id?: string; name: string; slug: string; logoUrl?: string | null; coverUrl?: string | null; updatedAt?: Date; products?: unknown[] }, locale: Locale = "th") {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    url: absoluteUrl(withLocale(`/shops/${shop.slug}`, locale)),
    image: resolvePublicSeoImage(shop.coverUrl, shop.logoUrl),
  };
}

export function collectionPageJsonLd(category: Awaited<ReturnType<typeof requirePublicCategorySeo>>) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} products`,
    url: absoluteUrl(withLocale(`/categories/${category.slug}`, "th")),
    description: `Browse active ${category.name} products on ${getSiteName()}.`,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(withLocale(item.path, "th")),
    })),
  };
}
