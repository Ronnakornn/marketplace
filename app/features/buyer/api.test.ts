import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ requestApi: vi.fn() }));

vi.mock("#/lib/api-client", () => ({ requestApi: apiMocks.requestApi }));

import { fetchCart } from "./api";

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
