/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GuestAddToCartButton } from "./GuestAddToCartButton";

afterEach(() => window.localStorage.clear());

describe("GuestAddToCartButton", () => {
  it("adds its variant to the browser guest cart", () => {
    render(<GuestAddToCartButton
      variantId="variant-1"
      label="Add Demo Product"
      addedLabel="Added to cart"
      item={{ productId: "product-1", title: "Demo Product", variantTitle: "Default", imageUrl: "https://example.com/product.jpg", unitPrice: 1200, currency: "THB" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Add Demo Product" }));

    expect(JSON.parse(window.localStorage.getItem("marketplace:guest-cart") ?? "[]")).toEqual([
      { variantId: "variant-1", quantity: 1, productId: "product-1", title: "Demo Product", variantTitle: "Default", imageUrl: "https://example.com/product.jpg", unitPrice: 1200, currency: "THB" },
    ]);
    expect(screen.getByText("Added to cart")).toBeTruthy();
  });
});
