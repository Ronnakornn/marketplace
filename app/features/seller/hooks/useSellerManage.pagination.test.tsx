/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSellerProducts } from "./useSellerManage";

const { getProducts } = vi.hoisted(() => ({ getProducts: vi.fn() }));

vi.mock("#/lib/eden", () => ({
  api: { api: { seller: { products: { get: getProducts } } } },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
