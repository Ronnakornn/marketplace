/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "#/features/buyer/components/DealsPage";
import { ProductListingPage } from "./ProductListingPage";

const queryMocks = vi.hoisted(() => ({
  productsResponse: { items: [] } as { items: unknown[] },
  productsError: null as Error | null,
  productsQueryFn: vi.fn(),
  couponsQueryFn: vi.fn(async () => []),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
  MobileBottomNavigation: () => <nav />,
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}));

vi.mock("#/components/ui/progress", () => ({
  Progress: () => <div role="progressbar" />,
}));

vi.mock("#/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("#/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("#/features/buyer/api", () => ({
  fetchCoupons: queryMocks.couponsQueryFn,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
}));

vi.mock("#/features/product/components/ProductCard", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

vi.mock("#/features/product/queries", () => ({
  publicProductListQueryOptions: () => ({
    queryKey: ["product", "public", "lists", { locale: "en", limit: 40 }],
    queryFn: queryMocks.productsQueryFn,
  }),
  publicProductSearchQueryOptions: () => ({
    queryKey: ["product", "public", "searches", { locale: "en", limit: 40 }],
    queryFn: queryMocks.productsQueryFn,
  }),
  publicSearchSuggestionsQueryOptions: () => ({
    queryKey: ["product", "public", "suggestions", { locale: "en", limit: 8 }],
    queryFn: async () => ({ items: [] }),
  }),
  publicCategoriesQueryOptions: () => ({
    queryKey: ["product", "public", "categories", { locale: "en" }],
    queryFn: async () => ({ items: [] }),
  }),
  publicBrandsQueryOptions: () => ({
    queryKey: ["product", "public", "brands"],
    queryFn: async () => [],
  }),
  normalizePublicProducts: (response: { items?: unknown[] }) => response.items ?? [],
  normalizePublicCategories: () => [],
  normalizePublicBrands: () => [],
  normalizePublicSearchSuggestions: () => [],
}));

vi.mock("#/i18n/client", () => ({
  formatDate: () => "12:00",
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "buyer.dealFeed": "Deal feed",
    "buyer.dealFeedDescription": "Live deals from the catalog",
    "buyer.endsAt": "Ends at {time}",
    "buyer.endsSoon": "Ends soon",
    "buyer.filterMore": "Filter more",
    "buyer.flashSale": "Flash sale",
    "buyer.limitedDeals": "Limited deals",
    "buyer.noDealsAvailable": "No deals available",
    "buyer.noDealsDescription": "No deal products are available right now.",
    "buyer.sellingFast": "Selling fast",
    "buyer.vouchers": "Vouchers",
    "common.categories": "Categories",
    "common.deals": "Deals",
    "common.search": "Search",
    "product.category": "Category",
    "product.discover": "Discover",
    "product.itemsFound": "{count} items found",
    "product.loadingResults": "Loading results",
    "product.noProductsDescription": "No products match your filters.",
    "product.noProductsFound": "No products found",
    "product.products": "Products",
    "product.recommendedProducts": "Recommended products",
    "product.shopTrustedStores": "Shop trusted stores",
    "product.specialDealsSoon": "Special deals soon",
    "product.soon": "Soon",
    "product.viewAll": "View all",
    "state.loadErrorTitle": "Unable to load products",
    "state.retry": "Retry",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  queryMocks.productsResponse = { items: [] };
  queryMocks.productsError = null;
  queryMocks.productsQueryFn.mockImplementation(async () => {
    if (queryMocks.productsError) throw queryMocks.productsError;
    return queryMocks.productsResponse;
  });
  queryMocks.couponsQueryFn.mockResolvedValue([]);
});

describe("ProductListingPage buyer states", () => {
  it("shows an empty state instead of fallback products", async () => {
    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("No products found")).toBeTruthy();
    expect(screen.getByText("No products match your filters.")).toBeTruthy();
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });

  it("shows an error state with retry when product loading fails", async () => {
    queryMocks.productsError = new Error("catalog unavailable");

    renderWithClient(<ProductListingPage mode="home" />);

    expect(await screen.findByText("Unable to load products")).toBeTruthy();
    expect(screen.getByText("catalog unavailable")).toBeTruthy();

    queryMocks.productsError = null;
    queryMocks.productsResponse = {
      items: [{ id: "product-1", title: "Recovered API product" }],
    };
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => expect(screen.getByText("Recovered API product")).toBeTruthy());
  });
});

describe("DealsPage buyer states", () => {
  it("shows an empty deal state instead of fallback products", async () => {
    renderWithClient(<DealsPage />);

    expect(await screen.findByText("No deals available")).toBeTruthy();
    expect(screen.getByText("No deal products are available right now.")).toBeTruthy();
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });

  it("shows an error state with retry for deal products", async () => {
    queryMocks.productsError = new Error("search unavailable");

    renderWithClient(<DealsPage />);

    expect(await screen.findByText("Unable to load products")).toBeTruthy();
    expect(screen.getByText("search unavailable")).toBeTruthy();

    queryMocks.productsError = null;
    queryMocks.productsResponse = {
      items: [{ id: "product-2", title: "Recovered deal product" }],
    };
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));

    await waitFor(() => expect(screen.getAllByText("Recovered deal product").length).toBeGreaterThan(0));
  });
});
