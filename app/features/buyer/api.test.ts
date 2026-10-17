import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ requestApi: vi.fn() }));

vi.mock("#/lib/api-client", () => ({ requestApi: apiMocks.requestApi }));

import { addCartItem, clearCart, fetchCart, fetchOrder, fetchOrderTracking, removeCartItem, updateCartItem } from "./api";

describe("cart HTTP requests", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("#/lib/api-client")>("#/lib/api-client");
    apiMocks.requestApi.mockImplementation(actual.requestApi);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    apiMocks.requestApi.mockReset();
  });

  it.each([
    ["/api/cart/items/item-1", () => removeCartItem("item-1")],
    ["/api/cart", () => clearCart()],
  ] as const)("deletes %s without advertising an absent JSON body", async (path, remove) => {
    fetchMock.mockImplementation(async (_url, init) => {
      const invalidEmptyJson = init?.body == null && new Headers(init?.headers).has("content-type");
      return new Response(JSON.stringify(invalidEmptyJson
        ? { error: { code: "INVALID_REQUEST", message: "Request failed" } }
        : { success: true }), { status: invalidEmptyJson ? 400 : 200 });
    });

    await expect(remove()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(path, expect.objectContaining({ method: "DELETE", credentials: "include" }));
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("content-type")).toBe(false);
  });

  it("reads the cart without a content type", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "cart-1", shops: [], subtotal: "0", currency: "THB" })));

    expect(await fetchCart("th")).toEqual({ id: "cart-1", shops: [], subtotal: "0", currency: "THB" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cart?locale=th");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has("content-type")).toBe(false);
  });

  it.each([
    ["POST", "/api/cart/items", () => addCartItem("variant-1", 2), '{"variantId":"variant-1","quantity":2}'],
    ["PATCH", "/api/cart/items/item-1", () => updateCartItem("item-1", 3), '{"quantity":3}'],
  ] as const)("keeps JSON serialization for %s cart mutations", async (method, path, mutate, body) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "cart-1", shops: [], subtotal: "0", currency: "THB" })));

    expect(await mutate()).toEqual({ id: "cart-1", shops: [], subtotal: "0", currency: "THB" });
    expect(fetchMock).toHaveBeenCalledWith(path, expect.objectContaining({ method, body, credentials: "include" }));
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("content-type")).toBe("application/json");
  });
});

describe("fetchCart", () => {
  beforeEach(() => {
    apiMocks.requestApi.mockReset();
  });

  it("preserves exact server totals without computing cart prices on the client", async () => {
    apiMocks.requestApi.mockResolvedValue({
      id: "cart-1", currency: "THB", subtotal: "9007199254740993",
      shops: [{ shopId: "shop-1", subtotal: "9007199254740993", items: [
        { id: "item-1", unitPrice: "9007199254740993", quantity: 1, currency: "THB" },
      ] }],
    });
    const cart = await fetchCart();
    expect(cart.subtotal).toBe("9007199254740993");
    expect(cart.shops[0]?.items[0]?.unitPrice).toBe("9007199254740993");
  });

  it("rejects an unsafe numeric price instead of substituting zero", async () => {
    apiMocks.requestApi.mockResolvedValue({
      id: "cart-1", currency: "THB", subtotal: "9007199254740993",
      shops: [{ shopId: "shop-1", subtotal: "9007199254740993", items: [
        { id: "item-1", unitPrice: 9007199254740992, quantity: 1, currency: "THB" },
      ] }],
    });
    await expect(fetchCart()).rejects.toThrow(RangeError);
  });

  it("keeps the nested product id so cart items can link to their product pages", async () => {
    apiMocks.requestApi.mockResolvedValue({
      id: "cart-1",
      currency: "THB",
      subtotal: "9900",
      shops: [{
        shop: { id: "shop-1", name: "Demo Shop" },
        subtotal: "9900",
        items: [{
          id: "item-1",
          product: { id: "product-1", title: "Demo Product", imageUrl: null },
          variant: { id: "variant-1", title: "Standard", price: 9900, currency: "THB" },
          quantity: 1,
          unitPrice: 9900,
          currency: "THB",
        }],
      }],
    });

    const cart = await fetchCart("th");

    expect(cart.shops[0]?.items[0]).toMatchObject({
      id: "item-1",
      productId: "product-1",
      title: "Demo Product",
    });
  });
});


describe("order return and tax projections", () => {
  it("retains server return capacity and exact original tax components", async () => {
    apiMocks.requestApi.mockResolvedValue({ id: "order-1", totalCents: "101", currency: "THB",
      totals: { taxTotal: "0", includedTaxTotal: "7", reportedTaxTotal: "7" },
      items: [{ id: "item-1", quantity: 3, lineTotal: "101", fulfillmentStatus: "DELIVERED", remainingReturnQuantity: 2, hasActiveReturn: false }] });
    const order = await fetchOrder("order-1");
    expect(order.items[0]).toMatchObject({ quantity: 3, remainingReturnQuantity: 2, hasActiveReturn: false });
    expect(order.taxTotals).toEqual({ taxTotal: "0", includedTaxTotal: "7", reportedTaxTotal: "7" });
    expect(order.totalCents).toBe("101");
  });

  it("does not invent return rights when the server projection is absent", async () => {
    apiMocks.requestApi.mockResolvedValue({ id: "order-1", totalCents: "101", items: [{ id: "item-1", quantity: 3, lineTotal: "101", fulfillmentStatus: "DELIVERED" }] });
    const order = await fetchOrder("order-1");
    expect(order.items[0]).toMatchObject({ remainingReturnQuantity: 0, hasActiveReturn: true });
    expect(order.taxTotals).toBeUndefined();
  });

  it("rejects unsafe tax metadata instead of rounding an original receipt", async () => {
    apiMocks.requestApi.mockResolvedValue({ id: "order-1", totalCents: "9007199254740993", items: [],
      totals: { taxTotal: "0", includedTaxTotal: 9007199254740992, reportedTaxTotal: "9007199254740993" } });
    await expect(fetchOrder("order-1")).rejects.toThrow(RangeError);
  });
});

describe("order tracking projection", () => {
  it("preserves the tracking-only DTO without requiring financial order totals", async () => {
    const tracking = {
      orderId: "order-1", orderNo: "ORDER-001", orderStatus: "SHIPPED",
      shipments: [{
        shipmentId: "shipment-1", shopId: "shop-1", shopName: "Parcel Shop", status: "shipped",
        carrier: "Parcel Express", trackingNo: "TRACK-001", shippedAt: "2026-10-10T12:00:00.000Z",
        deliveredAt: null, items: [],
        timeline: [{ label: "Your parcel has been shipped", status: "shipped", timestamp: "2026-10-10T12:00:00.000Z" }],
      }],
    };
    apiMocks.requestApi.mockResolvedValue(tracking);

    expect(await fetchOrderTracking("order-1")).toEqual(tracking);
    expect(apiMocks.requestApi).toHaveBeenLastCalledWith("/api/orders/order-1/tracking");
  });
});
