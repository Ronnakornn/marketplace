/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSellerProducts, useSellerInventory, useSellerShipments } from "./useSellerManage";

const { getProducts, getInventory, getShipments } = vi.hoisted(() => ({ getProducts: vi.fn(), getInventory: vi.fn(), getShipments: vi.fn() }));

vi.mock("#/lib/eden", () => ({
  api: { api: { seller: { products: { get: getProducts }, inventory: { get: getInventory }, shipments: { get: getShipments } } } },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("seller operational list pages", () => {
  it("keeps inventory page, shop and stock filters on the request and cache identity", async () => {
    getInventory.mockImplementation(async ({ query }) => ({ data: { data: [], meta: { totalCount: 65, ...query } }, error: null }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ page }) => useSellerInventory({ page, limit: 20, q: "needle", status: "low", shopId: "shop-1" }), { wrapper, initialProps: { page: 1 } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ page: 3 });
    await waitFor(() => expect(getInventory).toHaveBeenLastCalledWith({ query: { page: 3, limit: 20, q: "needle", status: "low", shopId: "shop-1" } }));
    expect(client.getQueryCache().getAll()).toHaveLength(2);
    client.clear();
  });

  it("sends shipment search and enum status to the server before paging", async () => {
    getShipments.mockResolvedValue({ data: { data: [], meta: { totalCount: 65 } }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSellerShipments({ page: 4, limit: 20, q: "buyer", status: "PENDING_PACK", shopId: "shop-1" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getShipments).toHaveBeenCalledWith({ query: { page: 4, limit: 20, q: "buyer", status: "PENDING_PACK", shopId: "shop-1" } });
    expect(result.current.data?.meta.totalCount).toBe(65);
    client.clear();
  });
});

describe("seller product server pagination", () => {
  it("sends the selected page, page size and shop through both filter cleaners", async () => {
    getProducts.mockResolvedValue({ data: { data: [], meta: { totalCount: 45, page: 3, pageSize: 10 } }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSellerProducts({ q: "shirt", status: "ACTIVE", shopId: "shop-2", page: 3, limit: 10 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProducts).toHaveBeenCalledWith({ query: { q: "shirt", status: "ACTIVE", shopId: "shop-2", page: 3, limit: 10 } });
    expect(result.current.data?.meta.page).toBe(3);
    client.clear();
  });
});
