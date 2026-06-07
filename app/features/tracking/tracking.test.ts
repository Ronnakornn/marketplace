// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRecentlyViewedProducts,
  getAnonymousSessionId,
  getLocalRecentlyViewedProducts,
  normalizeLocalRecentlyViewedProducts,
  normalizeRecentlyViewedProducts,
  saveLocalRecentlyViewedProduct,
  trackDiscoveryEvent,
} from "./tracking";

describe("tracking utilities", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reuses an anonymous session id", () => {
    const first = getAnonymousSessionId();
    const second = getAnonymousSessionId();

    expect(first).toMatch(/[0-9a-f-]{36}/);
    expect(second).toBe(first);
  });

  it("stores recently viewed products locally without duplicates", () => {
    saveLocalRecentlyViewedProduct({ productId: "p1", title: "Tee", imageUrl: null, href: "/products/p1" });
    saveLocalRecentlyViewedProduct({ productId: "p2", title: "Bag", imageUrl: "/bag.jpg", href: "/products/p2" });
    saveLocalRecentlyViewedProduct({ productId: "p1", title: "Tee", imageUrl: null, href: "/products/p1" });

    const items = getLocalRecentlyViewedProducts();
    expect(items.map((item) => item.productId)).toEqual(["p1", "p2"]);
  });

  it("sends tracking events with anonymous session data without awaiting navigation", () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}"));
    Object.defineProperty(window.navigator, "sendBeacon", { value: undefined, configurable: true });

    trackDiscoveryEvent({ eventType: "search_submitted", query: "tee", source: "search" });

    expect(fetchMock).toHaveBeenCalledWith("/api/discovery/track", expect.objectContaining({
      method: "POST",
      keepalive: true,
    }));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ eventType: "search_submitted", query: "tee", source: "search" });
    expect(body.sessionId).toEqual(expect.any(String));
  });

  it("normalizes API and local recently viewed products for compact cards", () => {
    expect(normalizeRecentlyViewedProducts([{
      productId: "p1",
      title: "Tee",
      coverImage: "/tee.jpg",
      minPrice: "1200",
      currency: "THB",
      shop: { id: "shop-1", name: "Shop One" },
    }])).toEqual([{
      productId: "p1",
      title: "Tee",
      imageUrl: "/tee.jpg",
      href: "/products/p1",
      minPrice: 1200,
      currency: "THB",
      shop: { id: "shop-1", name: "Shop One" },
      viewedAt: null,
    }]);

    expect(normalizeLocalRecentlyViewedProducts([{
      productId: "p2",
      title: "Bag",
      imageUrl: "/bag.jpg",
      href: "/products/p2",
      viewedAt: "2026-01-01T00:00:00.000Z",
    }])[0]).toMatchObject({
      productId: "p2",
      title: "Bag",
      imageUrl: "/bag.jpg",
      href: "/products/p2",
    });
  });

  it("fetches recently viewed products with the anonymous session id", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      productId: "p1",
      title: "Tee",
      shop: { id: "shop-1", name: "Shop One" },
    }]), { status: 200 }));

    const result = await fetchRecentlyViewedProducts(4);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/discovery\/recently-viewed\?limit=4&sessionId=/), {
      credentials: "include",
    });
    expect(result[0]?.productId).toBe("p1");
  });
});
