import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicProductData, requirePublicProductData } from "./product-data.server";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn<typeof fetch>();
const canonicalId = "22222222-2222-4222-8222-222222222222";
const product = {
  id: canonicalId, title: "English Bag", slug: "canvas-bag", status: "ACTIVE", deletedAt: null,
  description: "Durable bag", updatedAt: "2026-10-12T00:00:00.000Z", shop: { id: "shop-1", name: "Shop", status: "ACTIVE" },
  variants: [{ id: "variant-1", price: "9007199254740993", currency: "THB" }],
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3009");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public product server data", () => {
  it("fetches the localized public DTO and aggregate rating using its canonical UUID", async () => {
    const summary = { averageRating: 4.5, totalReviewCount: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } };
    fetchMock.mockResolvedValueOnce(Response.json(product)).mockResolvedValueOnce(Response.json(summary));
    const result = await getPublicProductData("canvas-bag", "en");
    expect(result?.product).toMatchObject({ id: canonicalId, title: "English Bag", variants: [{ price: "9007199254740993" }] });
    expect(result?.ratingSummary).toEqual(summary);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://127.0.0.1:3009/api/products/canvas-bag?locale=en",
      `http://127.0.0.1:3009/api/products/${canonicalId}/rating-summary`,
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options?.cache === "no-store")).toBe(true);
  });

  it("uses Next's 404 for missing or nonpublic products and preserves backend failures", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Product not found" }, { status: 404 }));
    await expect(requirePublicProductData("hidden-bag", "th")).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Backend unavailable" }, { status: 503 }));
    await expect(getPublicProductData("canvas-bag", "th")).rejects.toMatchObject({ status: 503 });
  });

  it("exposes structured backend failures as meaningful Error instances", async () => {
    const payload = { error: { code: "SERVICE_UNAVAILABLE", message: "Catalog temporarily unavailable" } };
    fetchMock.mockResolvedValueOnce(Response.json(payload, { status: 503 }));
    const failure = await getPublicProductData("canvas-bag", "th").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).toMatchObject({
      message: "Catalog temporarily unavailable",
      status: 503,
      cause: { status: 503, value: payload },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ message: "Backend unavailable" }, "Backend unavailable"],
    ["Upstream unavailable", "Upstream unavailable"],
    [{ error: { message: " " } }, "Product request failed (HTTP 502)"],
  ])("preserves readable backend messages and supplies a status fallback for %j", async (payload, message) => {
    fetchMock.mockResolvedValueOnce(Response.json(payload, { status: 502 }));
    await expect(getPublicProductData("canvas-bag", "en")).rejects.toMatchObject({ message, status: 502 });
  });

  it.each(["http", "network"])("still renders a valid product when optional rating loading has a %s failure", async (failure) => {
    fetchMock.mockResolvedValueOnce(Response.json(product));
    if (failure === "http") fetchMock.mockResolvedValueOnce(Response.json({ message: "Rating unavailable" }, { status: 503 }));
    else fetchMock.mockRejectedValueOnce(new Error("connection lost"));
    const result = await getPublicProductData("canvas-bag", "en");
    expect(result?.product.id).toBe(canonicalId);
    expect(result?.ratingSummary).toBeUndefined();
  });
});
