/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/en.json";
import th from "../../../../messages/th.json";
import { I18nProvider } from "#/i18n/client";
import type { Locale } from "#/i18n/config";
import type { BuyAgainResult } from "../api";
import { BuyAgainButton } from "./BuyAgainButton";

const api = vi.hoisted(() => ({ buyAgain: vi.fn() }));
vi.mock("../api", () => ({ buyAgain: api.buyAgain }));

function renderButton(locale: Locale = "en") {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  client.setQueryData(["buyer-cart"], { subtotal: "0" });
  render(<QueryClientProvider client={client}><I18nProvider locale={locale} messages={locale === "th" ? th : en} fallbackMessages={en}><BuyAgainButton orderId="owned-order" /></I18nProvider></QueryClientProvider>);
  return client;
}

function result(kind: "added" | "partial" | "already_in_cart" = "added"): BuyAgainResult {
  return {
    cartId: "cart-1",
    items: [{
      variantId: "variant-1", productTitle: "Cotton shirt", variantTitle: "Blue", requestedQuantity: 3,
      existingQuantity: kind === "already_in_cart" ? 3 : 0, targetQuantity: 3,
      availableQuantity: kind === "partial" ? 2 : 8, addedQuantity: kind === "already_in_cart" ? 0 : kind === "partial" ? 2 : 3,
      finalQuantity: kind === "partial" ? 2 : 3, unitPrice: "1990", currency: "THB",
      ...(kind === "partial" ? { kind, reason: "STOCK_LIMIT" } : { kind, reason: null }),
    }],
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("BuyAgainButton", () => {
  it("guards immediate repeated clicks, refreshes cart and offers localized cart navigation", async () => {
    let resolve!: (value: BuyAgainResult) => void;
    api.buyAgain.mockImplementation(() => new Promise<BuyAgainResult>(done => { resolve = done; }));
    const client = renderButton();
    const button = screen.getByRole("button", { name: "Buy again" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    await waitFor(() => expect(api.buyAgain).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Checking items..." }).hasAttribute("disabled")).toBe(true);
    await act(async () => resolve(result()));
    expect(await screen.findByText("Added 3 units to your cart.")).toBeTruthy();
    expect(screen.getByText("Added 3. Cart quantity: 3.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open cart" }).getAttribute("href")).toBe("/en/cart");
    expect(client.getQueryState(["buyer-cart"])?.isInvalidated).toBe(true);
    expect(api.buyAgain).toHaveBeenCalledWith("owned-order");
  });

  it("renders partial quantity, skipped reason, and cart action in Thai", async () => {
    const response = result("partial");
    response.items.push({ ...response.items[0], variantId: "variant-2", productTitle: "Unavailable trousers", kind: "skipped", reason: "VARIANT_UNAVAILABLE", addedQuantity: 0, finalQuantity: 0, unitPrice: null, currency: null });
    api.buyAgain.mockResolvedValue(response);
    renderButton("th");
    fireEvent.click(screen.getByRole("button", { name: "ซื้ออีกครั้ง" }));
    expect(await screen.findByText("เพิ่มสินค้า 2 ชิ้นลงตะกร้าแล้ว")).toBeTruthy();
    expect(screen.getByText("เพิ่ม 2 ชิ้น มีในตะกร้า 2 จากที่ต้องการ 3 ชิ้น สต็อกที่เหลือไม่เพียงพอ")).toBeTruthy();
    expect(screen.getByText("ข้ามรายการนี้: ตัวเลือกสินค้านี้ไม่พร้อมขาย")).toBeTruthy();
    expect(screen.getByRole("link", { name: "เปิดตะกร้า" }).getAttribute("href")).toBe("/th/cart");
  });

  it("keeps an all-skipped result on the order page with no cart action", async () => {
    const response = result();
    response.items = [{ ...response.items[0], kind: "skipped", reason: "OUT_OF_STOCK", addedQuantity: 0, finalQuantity: 0 }];
    api.buyAgain.mockResolvedValue(response);
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Buy again" }));
    expect(await screen.findByText("No items could be added. Your cart quantities are unchanged.")).toBeTruthy();
    expect(screen.getByText("Skipped: No stock remains after reservations.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open cart" })).toBeNull();
  });

  it("shows an existing quantity as ready without claiming new additions", async () => {
    api.buyAgain.mockResolvedValue(result("already_in_cart"));
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Buy again" }));
    expect(await screen.findByText("These items are already in your cart at current prices.")).toBeTruthy();
    expect(screen.getByText("Already in cart: 3. Current price applied.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open cart" }).getAttribute("href")).toBe("/en/cart");
  });

  it("shows a localized failure and allows retry", async () => {
    api.buyAgain.mockRejectedValueOnce(new Error("Database unavailable")).mockResolvedValueOnce(result());
    renderButton("th");
    fireEvent.click(screen.getByRole("button", { name: "ซื้ออีกครั้ง" }));
    expect((await screen.findByRole("alert")).textContent).toBe("เพิ่มสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง");
    fireEvent.click(screen.getByRole("button", { name: "ซื้ออีกครั้ง" }));
    expect(await screen.findByText("เพิ่มสินค้า 3 ชิ้นลงตะกร้าแล้ว")).toBeTruthy();
    expect(api.buyAgain).toHaveBeenCalledTimes(2);
  });
});
