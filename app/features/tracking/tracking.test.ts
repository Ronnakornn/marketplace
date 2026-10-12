// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchRecentlyViewedProducts,
  getAnonymousSessionId,
  normalizeRecentlyViewedProducts,
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

  it("persists a UUID and submits events when crypto.randomUUID is unavailable", () => {
    const browserCrypto = window.crypto;
    const randomUUIDDescriptor = Object.getOwnPropertyDescriptor(browserCrypto, "randomUUID");
    Object.defineProperty(browserCrypto, "randomUUID", { value: undefined, configurable: true });
    vi.stubGlobal("crypto", browserCrypto);
    vi.stubGlobal("navigator", { sendBeacon: undefined });

    try {
      const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(new Response("{}"));
      const sessionId = getAnonymousSessionId();

      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(window.localStorage.getItem("marketplace-anonymous-session-id")).toBe(sessionId);
      expect(getAnonymousSessionId()).toBe(sessionId);

      trackDiscoveryEvent({ eventType: "search_submitted", query: "tee", source: "search" });

      expect(fetchMock).toHaveBeenCalledWith("/api/discovery/track", expect.objectContaining({
        method: "POST",
        keepalive: true,
      }));
      expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
        eventType: "search_submitted",
        query: "tee",
        source: "search",
        sessionId,
      });
    } finally {
      if (randomUUIDDescriptor) Object.defineProperty(browserCrypto, "randomUUID", randomUUIDDescriptor);
      else Reflect.deleteProperty(browserCrypto, "randomUUID");
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      window.localStorage.clear();
    }
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

  it("normalizes API recently viewed products for compact cards", () => {
    expect(normalizeRecentlyViewedProducts([{
      productId: "p1",
      title: "Tee",
      slug: "tee",
      coverImage: "/tee.jpg",
      minPrice: "1200",
      currency: "THB",
      rating: 4.8,
      soldCount: 34,
      shop: { id: "shop-1", name: "Shop One", slug: "shop-one" },
    }])).toEqual([{
      productId: "p1",
      title: "Tee",
      imageUrl: "/tee.jpg",
      href: "/products/p1",
      minPrice: "1200",
      currency: "THB",
      rating: 4.8,
      soldCount: 34,
      shop: { id: "shop-1", name: "Shop One" },
      viewedAt: null,
    }]);

  });

  it("fetches recently viewed products with the anonymous session id", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(new Response(JSON.stringify([{
      productId: "p1",
      title: "Tee",
      shop: { id: "shop-1", name: "Shop One" },
    }]), { status: 200 }));

    const result = await fetchRecentlyViewedProducts(4);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/discovery\/recently-viewed\?limit=4&sessionId=/),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result[0]?.productId).toBe("p1");
  });

  it("surfaces malformed recently viewed API records", () => {
    expect(() => normalizeRecentlyViewedProducts([{
      productId: "p1",
      title: "Tee",
      slug: "tee",
      coverImage: null,
      minPrice: "1200",
      currency: "THB",
      rating: 4,
      soldCount: 2,
      shop: { id: "", name: "Shop", slug: "shop" },
    }])).toThrow(/recently viewed api response/i);
  });
});
