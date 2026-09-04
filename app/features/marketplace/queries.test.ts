import { describe, expect, it } from "vitest";
import { normalizeMarketplaceHome, type DiscoveryHomeResponse } from "./queries";

describe("normalizeMarketplaceHome", () => {
  it("uses API-provided flash stock and public metrics", () => {
    const home = normalizeMarketplaceHome({
      sections: {
        flashSale: {
          id: "flash-1",
          title: "Flash Sale",
          description: null,
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: new Date("2026-01-02T00:00:00.000Z"),
          items: [{
            id: "item-1",
            salePrice: 900,
            originalPrice: 1200,
            stockLimit: 10,
            soldCount: 2,
            availableStock: 3,
            rating: 4.7,
            perUserLimit: 1,
            product: { id: "product-1", title: "Tee", slug: "tee", coverImage: null, shop: { id: "shop-1", name: "Shop", slug: "shop" } },
            variant: { id: "variant-1", sku: "TEE", title: "Default", currency: "THB" },
          }],
        },
        categories: [],
        recommendedProducts: [],
        newArrivals: [],
        recentlyViewed: [],
      },
      meta: { limit: 12, generatedAt: "2026-01-01T00:00:00.000Z" },
    } as DiscoveryHomeResponse);

    expect(home.flashSale?.items[0]).toMatchObject({ stock: 3, rating: 4.7, soldCount: 2 });
  });

  it("surfaces malformed discovery records instead of silently removing them", () => {
    expect(() => normalizeMarketplaceHome({
      sections: { categories: [{ id: "category-1", slug: "fashion", name: "" }] },
    } as unknown as DiscoveryHomeResponse)).toThrow(/malformed category/i);
    expect(() => normalizeMarketplaceHome({
      sections: { categories: {} },
    } as unknown as DiscoveryHomeResponse)).toThrow(/categories must be an array/i);
  });
});
