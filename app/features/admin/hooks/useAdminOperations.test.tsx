/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAdminCatalogModerationList } from "./useAdminOperations";

const transport = vi.hoisted(() => ({ catalogGet: vi.fn() }));
vi.mock("#/lib/eden", () => ({ api: { api: { admin: { catalog: { products: { get: transport.catalogGet } } } } } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useAdminCatalogModerationList", () => {
  it("forwards the requested page and fetches a distinct cache entry when changing pages", async () => {
    transport.catalogGet.mockImplementation(async ({ query }: { query: { page: number } }) => ({
      data: { data: [{ id: `product-page-${query.page}` }], meta: { totalCount: 20, hasNextPage: query.page === 1 } },
      error: null,
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ page }) => useAdminCatalogModerationList({ page, limit: 10, status: "ACTIVE", q: "cotton" }),
      { initialProps: { page: 1 }, wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(transport.catalogGet).toHaveBeenCalledWith({ query: { page: 1, limit: 10, status: "ACTIVE", q: "cotton" } });
    rerender({ page: 2 });
    await waitFor(() => expect(result.current.data?.data[0]?.id).toBe("product-page-2"));
    expect(transport.catalogGet).toHaveBeenCalledWith({ query: { page: 2, limit: 10, status: "ACTIVE", q: "cotton" } });
    expect(client.getQueryData(["admin", "catalog", "moderation", { page: 1, limit: 10, status: "ACTIVE", q: "cotton" }])).toBeTruthy();
    client.clear();
  });
});
