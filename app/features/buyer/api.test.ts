import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ requestApi: vi.fn() }));

vi.mock("#/lib/api-client", () => ({ requestApi: apiMocks.requestApi }));

import { fetchCart } from "./api";

describe("fetchCart", () => {
  beforeEach(() => {
    apiMocks.requestApi.mockReset();
  });

  it("keeps the nested product id so cart items can link to their product pages", async () => {
    apiMocks.requestApi.mockResolvedValue({
      id: "cart-1",
      currency: "THB",
      shops: [{
        shop: { id: "shop-1", name: "Demo Shop" },
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
