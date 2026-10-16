import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductPage, { generateMetadata } from "./page";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("#/features/product/product-data.server", () => ({ requirePublicProductData: load }));
vi.mock("#/features/product/components/ProductDetailPage", () => ({
  ProductDetailPage: ({ productId, initialData, initialRatingSummary }: {
    productId: string;
    initialData: { id: string; title: string; variants: Array<{ price: string }> };
    initialRatingSummary: { totalReviewCount: number };
  }) => <div data-requested-id={productId} data-canonical-id={initialData.id}>
    <h1>{initialData.title}</h1><p>{initialData.variants[0].price}</p><p>{initialRatingSummary.totalReviewCount} reviews</p>
  </div>,
}));

const id = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://marketplace.test");
  load.mockReset().mockImplementation(async (_productId: string, locale: string) => ({
    product: {
      id, title: locale === "en" ? "Canvas Bag" : "กระเป๋าผ้า", description: "Durable bag", slug: "canvas-bag", updatedAt: new Date("2026-10-12T00:00:00.000Z"),
      shop: { id: "shop-1", name: "Shop", slug: "shop" }, brand: null, category: null, images: [{ url: "/bag.jpg" }],
      variants: [{ price: "9007199254740993", currency: "THB", inventory: { quantityOnHand: 3, quantityReserved: 1 } }],
    },
    ratingSummary: { averageRating: 4.5, totalReviewCount: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } },
  }));
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("server product page", () => {
  it.each([["en", "Canvas Bag"], ["th", "กระเป๋าผ้า"]])("shares %s locale loader arguments and hydrates the exact public DTO", async (locale, title) => {
    const props = { params: Promise.resolve({ locale, productId: "canvas-bag" }) };
    const metadata = await generateMetadata(props);
    const html = renderToStaticMarkup(await ProductPage(props));
    expect(metadata.title).toBe(title);
    expect(metadata.alternates?.canonical).toBe(`https://marketplace.test/${locale}/products/${id}`);
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain('data-requested-id="canvas-bag"');
    expect(html).toContain(`data-canonical-id="${id}"`);
    expect(html).toContain("9007199254740993");
    expect(html).toContain('"price":"90071992547409.93"');
    expect(html).toContain('"ratingValue":4.5,"reviewCount":2');
    expect(load.mock.calls).toEqual([["canvas-bag", locale], ["canvas-bag", locale]]);
  });
});
