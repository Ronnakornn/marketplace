/** @vitest-environment jsdom */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartPage } from "./CartPage";

const cartMocks = vi.hoisted(() => ({
  fetchCart: vi.fn(), quoteCheckout: vi.fn(), updateCartItem: vi.fn(), removeCartItem: vi.fn(), clearCart: vi.fn(),
}));

vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a> }));
vi.mock("#/components/BuyerShell", () => ({ BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("#/lib/auth-client", () => ({ useSession: () => ({ data: { user: { id: "buyer-1", role: "USER" } }, isPending: false }) }));
vi.mock("#/i18n/client", () => ({ useLocale: () => "en", useTranslations: () => (key: string) => key }));
vi.mock("#/i18n/navigation", () => ({ useLocalePath: () => (path: string) => path }));
vi.mock("#/features/buyer/api", async () => ({
  ...cartMocks,
  formatMoney: (await vi.importActual<typeof import("#/features/buyer/api")>("#/features/buyer/api")).formatMoney,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("cart exact selection total", () => {
  it("displays the selected subtotal returned by the server quote", async () => {
    cartMocks.fetchCart.mockResolvedValue({ id: "cart-1", currency: "THB", subtotal: "10", shops: [{
      shopId: "shop-1", shopName: "Shop", subtotal: "10", items: [{
        id: "item-1", variantId: "variant-1", productId: "product-1", title: "Product", quantity: 1,
        unitPrice: "10", currency: "THB", availableQuantity: 1,
      }],
    }] });
    cartMocks.quoteCheckout.mockResolvedValue({ subtotal: "9007199254740993", currency: "THB" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CartPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("checkbox", { name: "cart.selectItem" }));
    await waitFor(() => expect(cartMocks.quoteCheckout).toHaveBeenCalledWith({ cartId: "cart-1", cartItemIds: ["item-1"] }));
    expect(await screen.findByText("฿90,071,992,547,409.93")).toBeTruthy();
  });

  it("shows a quote failure rather than a locally computed payable amount", async () => {
    cartMocks.fetchCart.mockResolvedValue({ id: "cart-1", currency: "THB", subtotal: "10", shops: [{
      shopId: "shop-1", shopName: "Shop", subtotal: "10", items: [{
        id: "item-1", variantId: "variant-1", productId: "product-1", title: "Product", quantity: 1,
        unitPrice: "10", currency: "THB", availableQuantity: 1,
      }],
    }] });
    cartMocks.quoteCheckout.mockRejectedValue(new Error("Quote unavailable"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CartPage /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("checkbox", { name: "cart.selectItem" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Quote unavailable");
  });
});
