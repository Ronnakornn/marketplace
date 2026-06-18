/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceHome } from "./MarketplaceHome";

const queryMocks = vi.hoisted(() => ({
  defaultHomeResponse: {
    sections: {
      banners: [{
        id: "banner-1",
        title: "Campaign launch",
        subtitle: "Fresh marketplace deals",
        imageUrl: null,
        mobileImageUrl: null,
        targetUrl: "/search?q=campaign",
      }],
      categories: [{ id: "cat-1", slug: "fashion", name: "Fashion" }],
      flashSale: {
        id: "flash-1",
        title: "Flash Sale",
        description: "Ends soon",
        endsAt: "2026-06-03T12:00:00.000Z",
        items: [{
          id: "flash-item-1",
          salePrice: 3990,
          originalPrice: 4990,
          soldCount: 4,
          stockLimit: 10,
          product: {
            id: "product-flash",
            title: "Flash marketplace tote",
            coverImage: "/uploads/product_image/flash/main.avif",
            shop: { id: "shop-1", name: "Live Shop", slug: "live-shop" },
          },
          variant: { id: "variant-flash", currency: "THB" },
        }],
      },
      recommendedProducts: [{
        productId: "product-1",
        title: "Live marketplace tote",
        coverImage: "/uploads/product_image/product-1/main.avif",
        minPrice: 4890,
        maxPrice: 5890,
        rating: 4.8,
        soldCount: 16,
        shop: { id: "shop-1", name: "Live Shop" },
      }],
      newArrivals: [{
        productId: "product-2",
        title: "New arrival cap",
        minPrice: 2190,
        soldCount: 2,
        shop: { id: "shop-2", name: "Cap Shop" },
      }],
      featuredShops: [{
        id: "shop-1",
        name: "Live Shop",
        slug: "live-shop",
        logoUrl: null,
        coverUrl: null,
        ratingAverage: 4.7,
        ratingCount: 25,
        followerCount: 120,
        productCount: 18,
      }],
      recentlyViewed: [{
        productId: "product-3",
        title: "Recently viewed bottle",
        coverImage: null,
        minPrice: 1590,
        currency: "THB",
        shop: { id: "shop-3", name: "Bottle Shop", slug: "bottle-shop" },
      }],
      promotions: [{
        id: "coupon-1",
        code: "SAVE15",
        title: "15% OFF",
        description: "Selected shops",
      }],
    },
  } as { sections: Record<string, unknown> },
  homeResponse: null as { sections: Record<string, unknown> } | null,
  homeError: null as Error | null,
  homeQueryFn: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...props }: { src: string; alt: string; fill?: boolean; sizes?: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
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
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchFavoriteStatus: vi.fn(async () => false),
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: vi.fn(async () => ({})),
}));

vi.mock("#/features/product/cart-handoff", () => ({
  showAddToCartError: vi.fn(),
  showAddToCartSuccess: vi.fn(),
}));

vi.mock("#/features/marketplace/queries", async () => {
  const actual = await vi.importActual<typeof import("#/features/marketplace/queries")>("#/features/marketplace/queries");
  return {
    ...actual,
    marketplaceHomeQueryOptions: () => ({
      queryKey: ["marketplace", "home", "test"],
      queryFn: queryMocks.homeQueryFn,
    }),
  };
});

vi.mock("#/features/tracking", () => ({
  getAnonymousSessionId: () => "test-session",
  trackDiscoveryEvent: vi.fn(),
  useDiscoveryTracking: () => ({ trackProductClick: vi.fn() }),
  useTrackVisibleProducts: vi.fn(),
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
    "product.noProductsDescription": "No products match your filters.",
    "product.noProductsFound": "No products found",
    "product.outOfStock": "Out of stock",
    "product.saveProduct": "Save product",
    "product.sold": "sold",
    "state.retry": "Retry",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { role: "USER" } } }),
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

afterEach(() => cleanup());

describe("MarketplaceHome", () => {
  beforeEach(() => {
    queryMocks.homeError = null;
    queryMocks.homeResponse = structuredClone(queryMocks.defaultHomeResponse);
    queryMocks.homeQueryFn.mockImplementation(async () => {
      if (queryMocks.homeError) throw queryMocks.homeError;
      return queryMocks.homeResponse ?? queryMocks.defaultHomeResponse;
    });
  });

  it("renders marketplace sections from the discovery homepage API", async () => {
    renderWithClient(<MarketplaceHome />);

    expect(await screen.findByRole("heading", { name: "Campaign launch" }, { timeout: 5_000 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recommended for you" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "New arrivals" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Featured shops" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recently viewed" })).toBeTruthy();
    expect(screen.getAllByText("Live marketplace tote").length).toBeGreaterThan(0);
    expect(screen.getByText("New arrival cap")).toBeTruthy();
    expect(screen.getByText("Recently viewed bottle")).toBeTruthy();
    expect(screen.getAllByText("Live Shop").length).toBeGreaterThan(0);
    expect(screen.queryByText("Canvas Weekender Bag with laptop sleeve")).toBeNull();
  });

  it("renders partial and empty section states when optional API data is missing", async () => {
    queryMocks.homeResponse = {
      sections: {
        categories: [],
        recommendedProducts: [],
        newArrivals: [],
        recentlyViewed: [],
      },
    };

    renderWithClient(<MarketplaceHome />);

    expect(await screen.findByRole("heading", { name: "Shop fast. Checkout faster." })).toBeTruthy();
    expect(screen.getByText("No flash sale right now")).toBeTruthy();
    expect(screen.getByText("No recommendations yet")).toBeTruthy();
    expect(screen.getByText("No new arrivals yet")).toBeTruthy();
    expect(screen.getByText("No featured shops yet")).toBeTruthy();
    expect(screen.getByText("No recently viewed products")).toBeTruthy();
  });

  it("shows an error state with a retry path when homepage loading fails", async () => {
    queryMocks.homeError = new Error("discovery unavailable");

    renderWithClient(<MarketplaceHome />);

    expect(await screen.findByText("Homepage data failed to load")).toBeTruthy();
    expect(screen.queryByText("Live marketplace tote")).toBeNull();

    queryMocks.homeError = null;
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]!);

    await waitFor(() => expect(screen.getAllByText("Live marketplace tote").length).toBeGreaterThan(0));
  });
});
