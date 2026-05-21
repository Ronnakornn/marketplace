import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  collectionPageJsonLd,
  formatSeoPriceCents,
  productJsonLd,
  publicPageMetadata,
  resolveSeoImage,
  safeDescription,
  storeJsonLd,
  websiteJsonLd,
} from "./seo";

describe("SEO helpers", () => {
  it("builds canonical URLs and social metadata with a fallback image", () => {
    const metadata = publicPageMetadata({
      title: "Canvas Bag",
      description: "Durable canvas bag.",
      path: "/products/product-1",
    });

    expect(metadata.alternates).toEqual({
      canonical: absoluteUrl("/th/products/product-1"),
      languages: {
        en: absoluteUrl("/en/products/product-1"),
        th: absoluteUrl("/th/products/product-1"),
      },
    });
    expect(metadata.openGraph).toMatchObject({
      title: "Canvas Bag",
      description: "Durable canvas bag.",
      url: absoluteUrl("/th/products/product-1"),
    });
    expect(resolveSeoImage()).toBe(absoluteUrl("/logo512.png"));
  });

  it("marks unsafe search pages as noindex", () => {
    const metadata = publicPageMetadata({
      title: "Search",
      description: "Search marketplace products.",
      path: "/search",
      noindex: true,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("builds Product JSON-LD with offers and aggregate rating", () => {
    const data = productJsonLd({
      id: "product-1",
      title: "Canvas Bag",
      description: "Durable canvas bag.",
      slug: "canvas-bag",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
      urlPath: "/products/product-1",
      image: absoluteUrl("/logo512.png"),
      price: "48.90",
      currency: "USD",
      availability: "https://schema.org/InStock",
      shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop" },
      category: null,
      aggregateRating: { ratingValue: 4.8, reviewCount: 12 },
    });

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Canvas Bag",
      offers: {
        "@type": "Offer",
        price: "48.90",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: 4.8,
        reviewCount: 12,
      },
    });
  });

  it("builds public page JSON-LD shapes", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      potentialAction: { "@type": "SearchAction" },
    });
    expect(storeJsonLd({
      id: "shop-1",
      name: "Demo Shop",
      slug: "demo-shop",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
      products: [],
    })).toMatchObject({ "@type": "Store", name: "Demo Shop" });
    expect(collectionPageJsonLd({
      id: "category-1",
      name: "Fashion",
      slug: "fashion",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    })).toMatchObject({ "@type": "CollectionPage", name: "Fashion products" });
  });

  it("trims long or missing descriptions safely", () => {
    expect(safeDescription(null, "Fallback description.")).toBe("Fallback description.");
    expect(safeDescription("x".repeat(200))).toHaveLength(160);
  });

  it("formats BigInt product price for JSON-LD offers", () => {
    expect(formatSeoPriceCents(BigInt(4890))).toBe("48.90");
  });
});
