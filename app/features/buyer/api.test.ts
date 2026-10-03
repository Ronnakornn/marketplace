import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ requestApi: vi.fn() }));

vi.mock("#/lib/api-client", () => ({ requestApi: apiMocks.requestApi }));

import { fetchCart, fetchOrder } from "./api";

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
