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
  safeDescription,
  storeJsonLd,
  websiteJsonLd,
} from "./seo";

const findFirstProductMock = vi.fn();

vi.mock("#server/lib/prisma.ts", () => ({
  prisma: {
    product: {
      findFirst: findFirstProductMock,
    },
  },
}));

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
    reviews: [{ rating: 5 }, { rating: 4 }],
    ...overrides,
  };
}

beforeEach(() => {
  findFirstProductMock.mockReset();
});

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
      image: absoluteUrl("/logo512.png"),
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
      image: absoluteUrl("/logo512.png"),
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

  it("formats BigInt product price for JSON-LD offers", () => {
    expect(formatSeoPriceCents(BigInt(4890))).toBe("48.90");
  });

  it("resolves active public product SEO by id with the public API visibility filters", async () => {
    findFirstProductMock.mockResolvedValueOnce(createSeoProduct());

    const product = await getPublicProductSeo("22222222-2222-4222-8222-222222222222");

    expect(findFirstProductMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { id: "22222222-2222-4222-8222-222222222222" },
          { slug: "22222222-2222-4222-8222-222222222222" },
        ],
        status: "ACTIVE",
        deletedAt: null,
        shop: { status: "ACTIVE" },
      },
    }));
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
    findFirstProductMock.mockResolvedValueOnce(createSeoProduct());

    const product = await getPublicProductSeo("canvas-bag");

    expect(findFirstProductMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ slug: "canvas-bag" }],
        status: "ACTIVE",
        deletedAt: null,
        shop: { status: "ACTIVE" },
      }),
    }));
    expect(product?.urlPath).toBe("/products/22222222-2222-4222-8222-222222222222");
  });

  it("returns null when product SEO lookup cannot find an active public product", async () => {
    findFirstProductMock.mockResolvedValueOnce(null);

    await expect(getPublicProductSeo("missing-product")).resolves.toBeNull();
    expect(findFirstProductMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "ACTIVE",
        deletedAt: null,
        shop: { status: "ACTIVE" },
      }),
    }));
  });
});
