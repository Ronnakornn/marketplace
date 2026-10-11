import { afterEach, describe, expect, it, vi } from "vitest";
import { buyAgain } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("buyAgain API", () => {
  it("posts only the order path with credentials and preserves exact money results", async () => {
    const response = { cartId: "cart-1", items: [{ kind: "added", unitPrice: "9007199254740993123", finalQuantity: 3, addedQuantity: 3 }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await buyAgain("owned-order")).toEqual(response);
    expect(fetch).toHaveBeenCalledWith("/api/orders/owned-order/buy-again", expect.objectContaining({ method: "POST", credentials: "include", body: undefined }));
  });

  it("preserves server status and error code for failed requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "ORDER_NOT_FOUND", message: "Order not found" } }), { status: 404 })));
    await expect(buyAgain("foreign-order")).rejects.toMatchObject({ status: 404, code: "ORDER_NOT_FOUND", message: "Order not found" });
  });
});
