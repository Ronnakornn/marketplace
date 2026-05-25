/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MarketplaceHome } from "./MarketplaceHome";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <article>{children}</article>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("#/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("#/features/buyer/api", () => ({
  addCartItem: vi.fn(),
  fetchCoupons: vi.fn(async () => []),
}));

vi.mock("#/features/product/queries", () => ({
  publicProductListQueryOptions: () => ({
    queryKey: ["product", "public", "lists", { locale: "en", limit: 50 }],
    queryFn: async () => ({
      items: [{
        id: "product-1",
        title: "Live marketplace tote",
        description: "API product",
        shop: { id: "shop-1", name: "Live Shop", location: "Bangkok" },
        variants: [{ id: "variant-1", title: "Default", sku: "SKU-1", price: 4890, currency: "THB", stock: 12 }],
        images: [],
      }],
    }),
  }),
  publicCategoriesQueryOptions: () => ({
    queryKey: ["product", "public", "categories", { locale: "en" }],
    queryFn: async () => ({ items: [] }),
  }),
  normalizePublicProducts: (response: { items?: unknown[] }) => response.items ?? [],
  normalizePublicCategories: () => [],
}));

vi.mock("#/i18n/client", () => ({
  useFormatters: () => ({
    currency: (cents: number) => `$${(cents / 100).toFixed(2)}`,
  }),
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "common.account": "Account",
    "common.cart": "Cart",
    "common.categories": "Categories",
    "common.deals": "Deals",
    "common.home": "Home",
    "home.claimVoucher": "Claim voucher",
    "home.extraOff": "Extra 15% off today",
    "home.flashSale": "Flash Sale",
    "home.freeShipping": "Free Shipping",
    "home.heroKicker": "5.5 Mega Deals",
    "home.heroSubtitle": "Flash deals, free shipping picks, and marketplace favorites curated for quick buying.",
    "home.heroTitle": "Shop fast. Checkout faster.",
    "home.liveCatalog": "Live Catalog",
    "home.loadingMore": "Loading more deals...",
    "home.recommendedSubtitle": "Fresh picks based on deals and shop momentum",
    "home.recommendedTitle": "Recommended for you",
    "home.seeAll": "See all",
    "home.shopNow": "Shop now",
    "home.syncedFromApi": "Synced from API",
    "home.upToCashback": "Up to 20%",
    "home.voucherAutoApplies": "Voucher auto-applies at cart",
    "home.youAreCaughtUp": "You're all caught up",
    "product.add": "Add",
    "product.addToCart": "Add to cart",
    "product.adding": "Adding",
    "product.buyNow": "Buy now",
    "product.freeShip": "Free ship",
    "product.noProductsDescription": "No products match your filters.",
    "product.noProductsFound": "No products found",
    "product.outOfStock": "Out of stock",
    "product.saveProduct": "Save product",
    "product.sold": "sold",
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

beforeAll(() => {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: MockIntersectionObserver,
  });
});

describe("MarketplaceHome", () => {
  it("renders marketplace content from the shared public product query", async () => {
    renderWithClient(<MarketplaceHome />);

    expect(screen.getByRole("heading", { name: "Shop fast. Checkout faster." })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeTruthy();
    expect(await screen.findAllByText("Live marketplace tote")).toHaveLength(2);
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });
});
