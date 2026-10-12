import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  formatSeoPriceCents,
  getPublicProductSeo,
  productJsonLd,
  publicPageMetadata,
  resolveSeoImage,
  resolvePublicSeoImage,
  safeTitle,
  safeDescription,
  storeJsonLd,
  websiteJsonLd,
} from "./seo";

const { loadProductMock } = vi.hoisted(() => ({ loadProductMock: vi.fn() }));
vi.mock("#/features/product/product-data.server", () => ({ getPublicProductData: loadProductMock }));

function createSeoProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Canvas Bag",
    description: "Durable canvas bag.",
    slug: "canvas-bag",
    updatedAt: new Date("2026-05-14T00:00:00.000Z"),
    category: { id: "cat-1", name: "Fashion", slug: "fashion", isActive: true },
    brand: { name: "Demo Brand" },
    shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop" },
    images: [{ url: "/uploads/canvas-bag.jpg" }],
    variants: [
      {
        id: "variant-1",
        price: BigInt(4890),
        currency: "THB",
        inventory: { quantityOnHand: 10, quantityReserved: 2 },
      },
    ],
    ratingSummary: { averageRating: 4.5, totalReviewCount: 2 },
    ...overrides,
  };
}

beforeEach(() => {
  loadProductMock.mockReset();
});

describe("SEO helpers", () => {
  it("keeps exact minor units in exported SEO price text", () => {
    expect(formatSeoPriceCents("9007199254740991")).toBe("90071992547409.91");
    expect(formatSeoPriceCents("9007199254740993")).toBe("90071992547409.93");
    expect(formatSeoPriceCents(-1)).toBe("-0.01");
    expect(() => formatSeoPriceCents(9007199254740992)).toThrow(RangeError);
  });

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
    expect(resolveSeoImage()).toBe(absoluteUrl("/icons/icon-512.png"));
  });

  it("marks unsafe search pages as noindex", () => {
    const metadata = publicPageMetadata({
      title: "Search",
      description: "Search marketplace products.",
      path: "/search",
      noindex: true,
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("builds Product JSON-LD with offers and aggregate rating", () => {
    const data = productJsonLd({
      id: "product-1",
      title: "Canvas Bag",
      description: "Durable canvas bag.",
      slug: "canvas-bag",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
      urlPath: "/products/product-1",
      image: absoluteUrl("/icons/icon-512.png"),
      price: "48.90",
      currency: "USD",
      availability: "https://schema.org/InStock",
      shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop" },
      brand: { name: "Demo Brand" },
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
      brand: {
        "@type": "Brand",
        name: "Demo Brand",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: 4.8,
        reviewCount: 12,
      },
    });
  });

  it("builds BreadcrumbList JSON-LD with absolute localized URLs", () => {
    expect(breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Fashion", path: "/categories/fashion" },
    ])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/th") },
        { "@type": "ListItem", position: 2, name: "Fashion", item: absoluteUrl("/th/categories/fashion") },
      ],
    });
  });

  it("omits Product offers when no backed price exists", () => {
    const data = productJsonLd({
      id: "product-1",
      title: "Canvas Bag",
      description: "Durable canvas bag.",
      slug: "canvas-bag",
      updatedAt: new Date("2026-05-14T00:00:00.000Z"),
      urlPath: "/products/product-1",
      image: absoluteUrl("/icons/icon-512.png"),
      price: null,
      currency: "USD",
      availability: "https://schema.org/OutOfStock",
      shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop" },
      brand: null,
      category: null,
      aggregateRating: null,
    });

    expect(data).not.toHaveProperty("offers");
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

  it("bounds titles and rejects secret social images before falling back", () => {
    expect(safeTitle("x".repeat(80), "Fallback")).toHaveLength(60);
    expect(resolvePublicSeoImage("https://bucket.test/cover?X-Amz-Signature=secret", "/logo.jpg")).toBe(absoluteUrl("/logo.jpg"));
  });

  it("formats BigInt product price for JSON-LD offers", () => {
    expect(formatSeoPriceCents(BigInt(4890))).toBe("48.90");
  });

  it("uses the shared public DTO for product SEO and exact prices", async () => {
    loadProductMock.mockResolvedValueOnce({ product: createSeoProduct(), ratingSummary: {
      averageRating: 4.5, totalReviewCount: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    } });

    const product = await getPublicProductSeo("22222222-2222-4222-8222-222222222222");

    expect(loadProductMock).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222", "th");
    expect(product).toMatchObject({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Canvas Bag",
      urlPath: "/products/22222222-2222-4222-8222-222222222222",
      price: "48.90",
      currency: "THB",
      availability: "https://schema.org/InStock",
      aggregateRating: { ratingValue: 4.5, reviewCount: 2 },
    });
  });

  it("resolves supported slug product SEO while keeping canonical id URL", async () => {
    loadProductMock.mockResolvedValueOnce({ product: createSeoProduct() });

    const product = await getPublicProductSeo("canvas-bag", "en");

    expect(loadProductMock).toHaveBeenCalledWith("canvas-bag", "en");
    expect(product?.urlPath).toBe("/products/22222222-2222-4222-8222-222222222222");
  });

  it("returns null when product SEO lookup cannot find an active public product", async () => {
    loadProductMock.mockResolvedValueOnce(null);

    await expect(getPublicProductSeo("missing-product")).resolves.toBeNull();
  });

  it("rounds the aggregate distribution once at one decimal, including halfway values", async () => {
    loadProductMock.mockResolvedValueOnce({ product: createSeoProduct(), ratingSummary: {
      averageRating: 4.15, totalReviewCount: 20, distribution: { 1: 0, 2: 0, 3: 0, 4: 17, 5: 3 },
    } });
    expect((await getPublicProductSeo("canvas-bag"))?.aggregateRating).toEqual({ ratingValue: 4.2, reviewCount: 20 });
    loadProductMock.mockResolvedValueOnce({ product: createSeoProduct(), ratingSummary: {
      averageRating: 4.15, totalReviewCount: 27, distribution: { 1: 0, 2: 0, 3: 0, 4: 23, 5: 4 },
    } });
    expect((await getPublicProductSeo("canvas-bag"))?.aggregateRating).toEqual({ ratingValue: 4.1, reviewCount: 27 });
  });

  it("omits aggregateRating for no published reviews and uses exact large offer money", async () => {
    loadProductMock.mockResolvedValueOnce({ product: createSeoProduct({
      variants: [{ price: "9007199254740993", currency: "THB", inventory: { quantityOnHand: 0, quantityReserved: 0 } }],
    }), ratingSummary: { averageRating: 0, totalReviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } });
    expect(await getPublicProductSeo("canvas-bag")).toMatchObject({
      price: "90071992547409.93", availability: "https://schema.org/OutOfStock", aggregateRating: null,
    });
  });
});
