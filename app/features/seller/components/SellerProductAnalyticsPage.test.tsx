/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import type * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerProductAnalyticsPage } from "./SellerProductAnalyticsPage";
import { SellerShell } from "./SellerShell";
import { useSellerProductAnalytics } from "../hooks/useSellerProductAnalytics";

const refetch = vi.fn();

const analyticsData = {
  summary: {
    views: 1200,
    addToCart: 140,
    orders: 36,
    unitsSold: 52,
    revenue: 245000,
    conversionRate: 3,
    currency: "USD",
    topSkus: [
      {
        productId: "prod_1",
        productTitle: "Cotton Shirt",
        productSlug: "cotton-shirt",
        variantId: "var_1",
        sku: "SHIRT-1",
        title: "Small",
        status: "ACTIVE",
        views: 600,
        addToCart: 80,
        addToCartQuantity: 90,
        orders: 24,
        unitsSold: 32,
        revenue: 160000,
        currency: "USD",
      },
    ],
    lowPerformingProducts: [
      {
        productId: "prod_2",
        title: "Slow Hat",
        slug: "slow-hat",
        status: "ACTIVE",
        coverImage: null,
        shop: { id: "shop_1", name: "Main Shop", slug: "main-shop" },
        views: 200,
        addToCart: 2,
        orders: 0,
        unitsSold: 0,
        revenue: 0,
        conversionRate: 0,
        currency: "USD",
      },
    ],
  },
  daily: [
    { date: "2026-06-01", views: 100, addToCart: 12, orders: 3, unitsSold: 4, revenue: 12000, conversionRate: 3 },
    { date: "2026-06-02", views: 140, addToCart: 18, orders: 5, unitsSold: 7, revenue: 22000, conversionRate: 3.57 },
  ],
  products: [
    {
      productId: "prod_1",
      title: "Cotton Shirt",
      slug: "cotton-shirt",
      status: "ACTIVE",
      coverImage: null,
      shop: { id: "shop_1", name: "Main Shop", slug: "main-shop" },
      views: 700,
      addToCart: 90,
      orders: 28,
      unitsSold: 40,
      revenue: 180000,
      conversionRate: 4,
      currency: "USD",
    },
  ],
  productPagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  skus: [],
};

let analyticsState: ReturnType<typeof makeState> = makeState({ data: analyticsData });
let pathname = "/seller/analytics/products";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => path,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: string }) => <button {...props}>{children}</button>,
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <h3>{children}</h3>,
}));

vi.mock("#/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("#/components/ui/table", () => ({
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, colSpan }: { children: ReactNode; colSpan?: number }) => <td colSpan={colSpan}>{children}</td>,
  TableHead: ({ children }: { children: ReactNode }) => <th>{children}</th>,
  TableHeader: ({ children }: { children: ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

vi.mock("../hooks/useSellerProductAnalytics", async () => {
  return {
    useSellerProductAnalytics: vi.fn(() => analyticsState),
    validateSellerProductAnalyticsRange: (filters: { range: string; from?: string; to?: string }) => {
      if (filters.range !== "custom") return "";
      if (!filters.from || !filters.to) return "Choose both start and end dates for a custom range.";
      return new Date(`${filters.from}T00:00:00.000Z`) > new Date(`${filters.to}T00:00:00.000Z`)
        ? "Custom range start date must be before the end date."
        : "";
    },
  };
});

function makeState(overrides: Partial<any> = {}) {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    refetch,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  analyticsState = makeState({ data: analyticsData });
  pathname = "/seller/analytics/products";
});

describe("Seller product analytics page", () => {
  it("renders summary metrics and analytics sections", () => {
    render(<SellerProductAnalyticsPage />);

    expect(screen.getByRole("heading", { name: "Product Analytics" })).toBeTruthy();
    expect(screen.getByText("1,200")).toBeTruthy();
    expect(screen.getByText("$2,450.00")).toBeTruthy();
    expect(screen.getByText("Daily trend")).toBeTruthy();
    expect(screen.getByText("Cotton Shirt")).toBeTruthy();
    expect(screen.getByText("SHIRT-1")).toBeTruthy();
    expect(screen.getByText("Slow Hat")).toBeTruthy();
  });

  it("changes date range input and passes filters to the hook", () => {
    const hook = vi.mocked(useSellerProductAnalytics);
    render(<SellerProductAnalyticsPage />);

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(hook).toHaveBeenLastCalledWith(expect.objectContaining({ range: "7d" }));

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-06-05" } });
    expect(hook).toHaveBeenLastCalledWith(expect.objectContaining({ range: "custom", from: "2026-06-05" }));
  });

  it("shows loading, empty, error, retry, and custom date validation states", () => {
    analyticsState = makeState({ isLoading: true });
    const { rerender } = render(<SellerProductAnalyticsPage />);
    expect(screen.getByText("Loading chart...")).toBeTruthy();
    expect(screen.getByText("Loading product analytics...")).toBeTruthy();

    analyticsState = makeState({
      data: {
        summary: { views: 0, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0, conversionRate: 0, currency: "USD", topSkus: [], lowPerformingProducts: [] },
        daily: [],
        products: [],
        skus: [],
      },
    });
    rerender(<SellerProductAnalyticsPage />);
    expect(screen.getByText("No product analytics were recorded for this date range.")).toBeTruthy();

    analyticsState = makeState({ error: new Error("Analytics failed") });
    rerender(<SellerProductAnalyticsPage />);
    expect(screen.getByText("Analytics failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-06-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-06-01" } });
    expect(screen.getByText("Custom range start date must be before the end date.")).toBeTruthy();
  });
});

describe("Seller navigation", () => {
  it("exposes Product Analytics route", () => {
    render(
      <SellerShell
        activeShop={{ id: "shop_1", name: "Main Shop", slug: "main-shop", status: "ACTIVE" }}
        activeShops={[]}
        user={{ name: "Seller", email: "seller@example.com" }}
      >
        <div>Seller content</div>
      </SellerShell>,
    );

    expect(screen.getAllByRole("link", { name: /product analytics/i }).some((link) => link.getAttribute("href") === "/seller/analytics/products?shopId=shop_1")).toBe(true);
  });
});
