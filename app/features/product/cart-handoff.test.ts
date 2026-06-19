/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeAddToCartError,
  showAddToCartError,
  showAddToCartSuccess,
} from "./cart-handoff";

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    dismiss: toastMocks.dismiss,
    error: toastMocks.error,
    success: toastMocks.success,
  },
}));

beforeEach(() => {
  toastMocks.dismiss.mockClear();
  toastMocks.error.mockClear();
  toastMocks.success.mockClear();
});

const successCopy = {
  successTitle: "Added to cart",
  successDescription: "Your item was added to the cart.",
  viewCart: "View cart",
  continueShopping: "Continue shopping",
};

const errorCopy = {
  errorTitle: "Could not add to cart",
  errorDescription: "Please try again or review the selected options.",
};

describe("product cart handoff", () => {
  it("shows success with safe product context and explicit actions", () => {
    const onViewCart = vi.fn();

    showAddToCartSuccess({
      copy: successCopy,
      context: { productTitle: "Canvas Bag", variantTitle: "Blue" },
      onViewCart,
    });

    expect(toastMocks.success).toHaveBeenCalledWith("Added to cart", {
      description: "Canvas Bag - Blue",
      action: {
        label: "View cart",
        onClick: onViewCart,
      },
      cancel: {
        label: "Continue shopping",
        onClick: expect.any(Function),
      },
    });
  });

  it("dismisses when continuing shopping by default", () => {
    showAddToCartSuccess({ copy: successCopy });

    const options = toastMocks.success.mock.calls[0]?.[1];
    options.cancel.onClick();

    expect(toastMocks.dismiss).toHaveBeenCalled();
  });

  it("normalizes readable error messages without object string output", () => {
    expect(normalizeAddToCartError("[object Object]", errorCopy.errorDescription)).toBe("Please try again or review the selected options.");
    expect(normalizeAddToCartError({ body: { message: "Variant is out of stock" } }, errorCopy.errorDescription)).toBe("Variant is out of stock");
    expect(normalizeAddToCartError({ error: "Please sign in first" }, errorCopy.errorDescription)).toBe("Please sign in first");
    expect(normalizeAddToCartError(null, "Retry add to cart")).toBe("Retry add to cart");
  });

  it("shows a readable add-to-cart error toast", () => {
    showAddToCartError({ error: { response: { error: "Network unavailable" } }, copy: errorCopy });

    expect(toastMocks.error).toHaveBeenCalledWith("Could not add to cart", {
      description: "Network unavailable",
    });
  });
});
