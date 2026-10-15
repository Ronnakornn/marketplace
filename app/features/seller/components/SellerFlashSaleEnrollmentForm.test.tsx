/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SellerFlashSaleEnrollmentForm } from "./SellerFlashSaleEnrollmentForm";

const { getProducts, enrollItem } = vi.hoisted(() => ({ getProducts: vi.fn(), enrollItem: vi.fn() }));
vi.mock("#/lib/eden", () => ({ api: { api: { seller: {
  products: { get: getProducts },
  "flash-sales": () => ({ items: { post: enrollItem } }),
} } } }));
vi.mock("#/i18n/client", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("#/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: ReactNode }) => <select aria-label="variant" value={value} onChange={(event) => onValueChange(event.target.value)}><option value="" />{children}</select>,
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

function product(number: number) {
  return { id: `product-${number}`, title: `Product ${number}`, variants: [
    { id: `variant-${number}`, title: "Active", sku: `SKU-${number}`, status: "ACTIVE" },
    { id: `inactive-${number}`, title: "Inactive", sku: "HIDDEN", status: "ARCHIVED" },
  ] };
}

function mount(props: ComponentProps<typeof SellerFlashSaleEnrollmentForm> = { flashSaleId: "campaign", shopId: "shop-2" }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><SellerFlashSaleEnrollmentForm {...props} /></QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  getProducts.mockImplementation(async ({ query }: { query: { page: number; q?: string } }) => ({
    data: { data: query.q ? [product(75)] : query.page === 1 ? Array.from({ length: 50 }, (_, index) => product(index + 1)) : [product(51)], meta: { totalCount: query.q ? 1 : 51 } }, error: null,
  }));
  enrollItem.mockResolvedValue({ data: { id: "enrolled" }, error: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("flash sale enrollment product selection", () => {
  it("bounds active shop products to 50 and reaches products past the first page", async () => {
    const { client } = mount();
    await screen.findByRole("option", { name: "Product 50 · Active (SKU-50)" });
    expect(getProducts).toHaveBeenCalledWith({ query: { status: "ACTIVE", shopId: "shop-2", page: 1, limit: 50 } });
    expect(screen.queryByRole("option", { name: /Inactive/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    await screen.findByRole("option", { name: "Product 51 · Active (SKU-51)" });
    expect(getProducts).toHaveBeenLastCalledWith({ query: { status: "ACTIVE", shopId: "shop-2", page: 2, limit: 50 } });
    expect(screen.getByRole("button", { name: "common.next" }).hasAttribute("disabled")).toBe(true);
    client.clear();
  });

  it("retains selected product through search/page changes and enrolls its exact IDs", async () => {
    const { container, client } = mount();
    await screen.findByRole("option", { name: "Product 1 · Active (SKU-1)" });
    fireEvent.change(screen.getByLabelText("variant"), { target: { value: "product-1:variant-1" } });
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    await screen.findByRole("option", { name: /Product 51/ });
    expect(screen.getByLabelText<HTMLSelectElement>("variant").value).toBe("product-1:variant-1");
    fireEvent.change(screen.getByPlaceholderText("seller.manage.pages.promotions.searchProducts"), { target: { value: "  remote  " } });
    fireEvent.click(screen.getByRole("button", { name: "common.search" }));
    await screen.findByRole("option", { name: /Product 75/ });
    expect(getProducts).toHaveBeenLastCalledWith({ query: { status: "ACTIVE", shopId: "shop-2", page: 1, limit: 50, q: "remote" } });
    expect(screen.getByLabelText<HTMLSelectElement>("variant").value).toBe("product-1:variant-1");
    fireEvent.change(screen.getByPlaceholderText("seller.manage.pages.promotions.salePriceBaht"), { target: { value: "12.25" } });
    fireEvent.change(screen.getByPlaceholderText("seller.manage.pages.promotions.stockLimit"), { target: { value: "3" } });
    const form = container.querySelector("form");
    if (!form) throw new Error("Enrollment form missing");
    fireEvent.submit(form);
    await waitFor(() => expect(enrollItem).toHaveBeenCalledWith({ productId: "product-1", variantId: "variant-1", salePriceBaht: "12.25", stockLimit: 3, perUserLimit: null }));
    await waitFor(() => expect(screen.getByLabelText<HTMLSelectElement>("variant").value).toBe(""));
    client.clear();
  });

  it("exposes product failures and recovers through retry", async () => {
    getProducts.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    const { client } = mount();
    await screen.findByText("seller.manage.pages.promotions.productsLoadFailed");
    expect(screen.getByRole("button", { name: "common.next" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "seller.manage.retry" }));
    await screen.findByRole("option", { name: /Product 1 ·/ });
    expect(screen.queryByText("seller.manage.pages.promotions.productsLoadFailed")).toBeNull();
    client.clear();
  });
});
