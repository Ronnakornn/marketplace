import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInitialProductListing } from "./listing-data.server";
import { publicProductSearchQueryOptions } from "./queries";
import { productListingInput } from "./listing-input";

vi.mock("server-only", () => ({}));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3009");
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public listing server data", () => {
  it.each(["en", "th"] as const)("loads the exact first-page input in %s using the client query identity", async (locale) => {
    const response = { items: [], meta: { page: 1, hasNextPage: false } };
    fetchMock.mockResolvedValueOnce(Response.json(response));
    const filters = {
      query: "กระเป๋า bag", categoryId: "fashion", brandId: "brand-1", attributeFilters: "color:blue",
      minPrice: "9007199254740993", maxPrice: "9007199254740994", rating: "4", inStock: "true", sort: "price_asc",
    };
    const result = await getInitialProductListing(filters, locale);
    expect(result?.data).toEqual(response);
    const options = publicProductSearchQueryOptions(productListingInput(filters, locale));
    expect(result?.query).toEqual(options.queryKey.at(-1));
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(new URL(String(url)).origin).toBe("http://127.0.0.1:3009");
    expect(new URL(String(url)).pathname).toBe("/api/search/products");
    expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({
      locale, q: "กระเป๋า bag", categoryId: "fashion", brandId: "brand-1", attributeFilters: "color:blue",
      minPrice: "9007199254740993", maxPrice: "9007199254740994", rating: "4", inStock: "true", sort: "price_asc",
      page: "1", limit: "40",
    });
    expect(request?.cache).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("shares default sorting and invalid rating/stock normalization with the browser", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ items: [] }));
    const result = await getInitialProductListing({ rating: "NaN", inStock: "false" }, "en");
    expect(result?.query).toEqual({ locale: "en", sort: "newest", page: 1, limit: 40 });
    expect(result?.query).toEqual(publicProductSearchQueryOptions(productListingInput({ rating: "NaN", inStock: "false" }, "en")).queryKey.at(-1));
  });

  it.each(["http", "network"])("allows the client to recover when the server request has a %s failure", async (failure) => {
    if (failure === "http") fetchMock.mockResolvedValueOnce(Response.json({ message: "Unavailable" }, { status: 503 }));
    else fetchMock.mockRejectedValueOnce(new Error("Connection refused"));
    expect(await getInitialProductListing({ query: "bag" }, "en")).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
