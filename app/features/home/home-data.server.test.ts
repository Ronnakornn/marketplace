import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMarketplaceHome } from "#/features/marketplace/queries";
import { getInitialMarketplaceHome } from "./home-data.server";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn<typeof fetch>();

function discoverySnapshot(campaignId: string, availableStock: number) {
  return {
    sections: {
      categories: [], recommendedProducts: [], newArrivals: [], recentlyViewed: [],
      flashSale: {
        id: campaignId, title: campaignId, description: null,
        startsAt: "2026-10-04T00:00:00.000Z", endsAt: "2026-10-04T12:00:00.000Z",
        items: [{
          id: `${campaignId}-item`, salePrice: "9000", originalPrice: "10000",
          stockLimit: 20, soldCount: 0, availableStock, rating: 0, perUserLimit: 10,
          product: { id: "product-1", title: "Held stock", slug: "held-stock", coverImage: null,
            shop: { id: "shop-1", name: "Shop", slug: "shop" } },
          variant: { id: "variant-1", sku: "HELD", title: "Default", currency: "THB" },
        }],
      },
    },
    meta: { limit: 12, generatedAt: "2026-10-04T01:00:00.000Z" },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3001");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("initial marketplace discovery freshness", () => {
  it("loads changed campaign and physical availability on successive server requests without persistent fetch caching", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(discoverySnapshot("previous-campaign", 5)))
      .mockResolvedValueOnce(Response.json(discoverySnapshot("current-campaign", 0)));
    const first = await getInitialMarketplaceHome("en");
    const second = await getInitialMarketplaceHome("en");
    expect(first?.sections.flashSale?.id).toBe("previous-campaign");
    expect(second?.sections.flashSale?.id).toBe("current-campaign");
    if (!first || !second) throw new Error("Both discovery responses must be available");
    expect(normalizeMarketplaceHome(first).flashSale?.items[0]).toMatchObject({ stock: 5, price: "9000" });
    expect(normalizeMarketplaceHome(second).flashSale?.items[0]).toMatchObject({ stock: 0, price: "9000" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      expect(call).toEqual(["http://127.0.0.1:3001/api/discovery/home?locale=en&limit=12", { cache: "no-store" }]);
    }
  });

  it("preserves the configured API base, Thai locale and discovery limit", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:4101");
    fetchMock.mockResolvedValue(Response.json(discoverySnapshot("thai-campaign", 1)));
    expect((await getInitialMarketplaceHome("th"))?.sections.flashSale?.id).toBe("thai-campaign");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:4101/api/discovery/home?locale=th&limit=12", { cache: "no-store" });
  });

  it("preserves the default local API base when none is configured", async () => {
    vi.stubEnv("API_BASE_URL", undefined);
    fetchMock.mockResolvedValue(Response.json(discoverySnapshot("default-campaign", 1)));
    expect((await getInitialMarketplaceHome("en"))?.sections.flashSale?.id).toBe("default-campaign");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:3001/api/discovery/home?locale=en&limit=12", { cache: "no-store" });
  });

  it("preserves client fallback for unsuccessful discovery responses", async () => {
    fetchMock.mockResolvedValue(new Response("Unavailable", { status: 503 }));
    await expect(getInitialMarketplaceHome("en")).resolves.toBeUndefined();
  });

  it("preserves client fallback when the discovery request fails", async () => {
    fetchMock.mockRejectedValue(new Error("Connection unavailable"));
    await expect(getInitialMarketplaceHome("en")).resolves.toBeUndefined();
  });

  it("preserves client fallback for malformed discovery JSON", async () => {
    fetchMock.mockResolvedValue(new Response("invalid JSON", { status: 200 }));
    await expect(getInitialMarketplaceHome("en")).resolves.toBeUndefined();
  });
});
