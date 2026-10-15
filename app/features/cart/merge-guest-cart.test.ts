/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeGuestCartItem } from "#/features/buyer/api";
import { addGuestCartItem, readGuestCart, writeGuestCart } from "./guest-cart";
import { mergeGuestCart } from "./merge-guest-cart";
vi.mock("#/features/buyer/api", () => ({ mergeGuestCartItem: vi.fn() }));
beforeEach(async () => { await mergeGuestCart(null); localStorage.clear(); vi.resetAllMocks(); });

describe("guest cart merge", () => {
  it("sends one request per variant and preserves the partial stock remainder", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }, { variantId: "b", quantity: 3 }]);
    vi.mocked(mergeGuestCartItem).mockResolvedValueOnce({ addedQuantity: 2 }).mockResolvedValueOnce({ addedQuantity: 3 });
    await mergeGuestCart("buyer");
    expect(mergeGuestCartItem).toHaveBeenCalledTimes(2);
    expect(mergeGuestCartItem).toHaveBeenNthCalledWith(1, "buyer", "a", 20);
    expect(readGuestCart()).toEqual([{ variantId: "a", quantity: 18 }]);
  });

  it("shares same-user work and acknowledges against current quantities, preserving additions during flight", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }]);
    let finish!: (value: { addedQuantity: number }) => void;
    vi.mocked(mergeGuestCartItem).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const first = mergeGuestCart("buyer");
    expect(mergeGuestCart("buyer")).toBe(first);
    await Promise.resolve();
    addGuestCartItem("a", 5);
    addGuestCartItem("b", 3);
    finish({ addedQuantity: 20 });
    await first;
    expect(mergeGuestCartItem).toHaveBeenCalledTimes(1);
    expect(readGuestCart()).toEqual([{ variantId: "a", quantity: 5 }, { variantId: "b", quantity: 3 }]);
  });

  it("retains failed variants and retries them on a later merge", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }, { variantId: "b", quantity: 3 }]);
    vi.mocked(mergeGuestCartItem).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ addedQuantity: 3 });
    await mergeGuestCart("buyer");
    expect(readGuestCart()).toEqual([{ variantId: "a", quantity: 20 }]);
    vi.mocked(mergeGuestCartItem).mockResolvedValueOnce({ addedQuantity: 20 });
    await mergeGuestCart("buyer");
    expect(readGuestCart()).toEqual([]);
  });

  it("groups duplicate stored rows into one variant request", async () => {
    writeGuestCart([{ variantId: "a", quantity: 2 }, { variantId: "a", quantity: 3 }]);
    vi.mocked(mergeGuestCartItem).mockResolvedValue({ addedQuantity: 4 });
    await mergeGuestCart("buyer");
    expect(mergeGuestCartItem).toHaveBeenCalledExactlyOnceWith("buyer", "a", 5);
    expect(readGuestCart()).toEqual([{ variantId: "a", quantity: 1 }]);
  });
});


describe("session changes during guest merge", () => {
  it("serializes different accounts and acknowledges pending work before the next account reads the cart", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }, { variantId: "b", quantity: 3 }]);
    let finish!: (value: { addedQuantity: number }) => void;
    vi.mocked(mergeGuestCartItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue({ addedQuantity: 3 });
    const first = mergeGuestCart("A");
    await Promise.resolve();
    const second = mergeGuestCart("B");
    await Promise.resolve();
    const callsBeforeAcknowledgment = vi.mocked(mergeGuestCartItem).mock.calls.length;
    finish({ addedQuantity: 20 });
    await Promise.all([first, second]);
    expect(callsBeforeAcknowledgment).toBe(1);
    expect(mergeGuestCartItem).toHaveBeenCalledTimes(2);
    expect(mergeGuestCartItem).toHaveBeenLastCalledWith("B", "b", 3);
    expect(readGuestCart()).toEqual([]);
  });

  it("stops subsequent variants on signout but preserves the in-flight acknowledgment", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }, { variantId: "b", quantity: 3 }]);
    let finish!: (value: { addedQuantity: number }) => void;
    vi.mocked(mergeGuestCartItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = mergeGuestCart("A");
    await Promise.resolve();
    const signedOut = mergeGuestCart(null);
    finish({ addedQuantity: 2 });
    await Promise.all([first, signedOut]);
    expect(mergeGuestCartItem).toHaveBeenCalledTimes(1);
    expect(readGuestCart()).toEqual([{ variantId: "a", quantity: 18 }, { variantId: "b", quantity: 3 }]);
  });

  it("skips obsolete queued B work when A returns before the pending request settles", async () => {
    writeGuestCart([{ variantId: "a", quantity: 20 }, { variantId: "b", quantity: 3 }]);
    let finish!: (value: { addedQuantity: number }) => void;
    vi.mocked(mergeGuestCartItem).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValue({ addedQuantity: 3 });
    const first = mergeGuestCart("A");
    await Promise.resolve();
    const second = mergeGuestCart("B");
    const third = mergeGuestCart("A");
    finish({ addedQuantity: 20 });
    await Promise.all([first, second, third]);
    expect(mergeGuestCartItem).toHaveBeenCalledTimes(2);
    expect(mergeGuestCartItem).toHaveBeenLastCalledWith("A", "b", 3);
    expect(readGuestCart()).toEqual([]);
  });
});
