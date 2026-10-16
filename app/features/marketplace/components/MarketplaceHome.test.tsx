/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import th from "../../../../messages/th.json" with { type: "json" };
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceHome } from "./MarketplaceHome";

const i18nMocks = vi.hoisted(() => ({ locale: "en" as "en" | "th" }));

const queryMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(async () => ({})),
  showAddToCartSuccess: vi.fn(),
  defaultHomeResponse: {
    sections: {
      banners: [{
        id: "banner-1",
        title: "Campaign launch",
        subtitle: "Fresh marketplace deals",
        imageUrl: "/uploads/banner/campaign.avif",
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
          availableStock: 6,
          rating: 4.6,
          product: {
            id: "product-flash",
            title: "Flash marketplace tote",
            coverImage: "/uploads/product_image/flash/main.avif",
            shop: { id: "shop-1", name: "Live Shop", slug: "live-shop" },
          },
          variant: { id: "variant-flash", title: "Standard", currency: "THB" },
        }],
      },
      recommendedProducts: [{
        productId: "product-1",
        title: "Live marketplace tote",
        coverImage: "/uploads/product_image/product-1/main.avif",
        minPrice: 4890,
        maxPrice: 5890,
        currency: "THB",
        rating: 4.8,
        soldCount: 16,
        shop: { id: "shop-1", name: "Live Shop" },
      }],
      newArrivals: [{
        productId: "product-2",
        title: "New arrival cap",
        minPrice: 2190,
        currency: "THB",
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
        rating: 4.2,
        soldCount: 9,
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
  favoriteStatuses: vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, false]))),
  favoriteStatus: vi.fn(async () => false),
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
  MobileBottomNavigation: () => <nav aria-label="Mobile navigation" />,
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
  addCartItem: queryMocks.addCartItem,
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchFavoriteStatus: queryMocks.favoriteStatus,
  fetchFavoriteStatuses: queryMocks.favoriteStatuses,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: vi.fn(async () => ({})),
}));

vi.mock("#/features/product/cart-handoff", () => ({
  showAddToCartError: vi.fn(),
  showAddToCartSuccess: queryMocks.showAddToCartSuccess,
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

vi.mock("#/i18n/client", async () => {
  const actual = await vi.importActual<typeof import("#/i18n/client")>("#/i18n/client");
  return {
  useFormatters: () => ({
    currency: (cents: number) => `$${(cents / 100).toFixed(2)}`,
    date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => actual.formatDate(value, i18nMocks.locale, options),
  }),
  useLocale: () => i18nMocks.locale,
  useTranslations: () => (key: string) => key === "home.endsAt" && i18nMocks.locale === "th" ? th.home.endsAt : ({
    "common.account": "Account",
    "common.cart": "Cart",
    "common.categories": "Categories",
    "common.deals": "Deals",
    "common.home": "Home",
    "common.marketplace": "Marketplace",
    "home.claimVoucher": "Claim voucher",
    "home.coinsCashback": "Coins Cashback",
    "home.endsAt": "Ends {time}",
    "home.extraOff": "Extra 15% off today",
    "home.featuredShopsEmptyDescription": "Featured shops will appear once seller highlights are available.",
    "home.featuredShopsEmptyTitle": "No featured shops yet",
    "home.featuredShopsTitle": "Featured shops",
    "home.flashSale": "Flash Sale",
    "home.freeShipping": "Free Shipping",
    "home.homepageLoadError": "Homepage data failed to load",
    "home.heroKicker": "5.5 Mega Deals",
    "home.heroSubtitle": "Flash deals, free shipping picks, and marketplace favorites curated for quick buying.",
    "home.heroTitle": "Shop fast. Checkout faster.",
    "home.liveCatalog": "Live Catalog",
    "home.limitedTimeDeals": "Limited-time deals",
    "home.loadingMore": "Loading more deals...",
    "home.newArrivalsEmptyDescription": "New products will appear here when sellers publish them.",
    "home.newArrivalsEmptyTitle": "No new arrivals yet",
    "home.newArrivalsSubtitle": "Recently added products from active shops",
    "home.newArrivalsTitle": "New arrivals",
    "home.noFlashSaleDescription": "Active flash deals will appear here when promotions are available.",
    "home.noFlashSaleTitle": "No flash sale right now",
    "home.recentlyViewedEmptyDescription": "Products you open will be shown here for quick access.",
    "home.recentlyViewedEmptyTitle": "No recently viewed products",
    "home.recentlyViewedSubtitle": "Products from your latest browsing activity",
    "home.recentlyViewedTitle": "Recently viewed",
    "home.recommendedEmptyDescription": "Browse products to improve marketplace recommendations.",
    "home.recommendedEmptyTitle": "No recommendations yet",
    "home.recommendedSubtitle": "Fresh picks based on deals and shop momentum",
    "home.recommendedTitle": "Recommended for you",
    "home.saleBadge": "Sale",
    "home.seeAll": "See all",
    "home.selectedShops": "Selected shops",
    "home.shopNow": "Shop now",
    "home.syncedFromApi": "Synced from API",
    "home.upToCashback": "Up to 20%",
    "home.voucherAmount": "THB {amount}",
    "home.voucherAutoApplies": "Voucher auto-applies at cart",
    "home.voucherPercentOff": "{percent}% OFF",
    "home.welcomeBack": "Welcome back, {name}",
    "home.youAreCaughtUp": "You're all caught up",
    "buyer.followersCount": "{count} followers",
    "buyer.productsCount": "{count} products",
    "cart.continueShopping": "Continue shopping",
    "cart.handoffAddedDescription": "Your item was added to the cart.",
    "cart.handoffAddedTitle": "Added to cart",
    "cart.handoffErrorDescription": "Please try again or review the selected options.",
    "cart.handoffErrorTitle": "Could not add to cart",
    "cart.viewCart": "View cart",
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
  };
});

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { id: "buyer-1", role: "USER" } } }),
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
    queryMocks.addCartItem.mockReset().mockResolvedValue({});
    queryMocks.showAddToCartSuccess.mockClear();
    queryMocks.favoriteStatuses.mockClear();
    queryMocks.favoriteStatus.mockClear();
    i18nMocks.locale = "en";
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
    expect(screen.getByRole("img", { name: "Campaign launch" }).getAttribute("src")).toBe("/uploads/banner/campaign.avif");
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

  it("loads one favorite batch across recommended, new and recently viewed product cards", async () => {
    renderWithClient(<MarketplaceHome />);
    expect(await screen.findByText("Live marketplace tote")).toBeTruthy();
    expect(screen.getByText("New arrival cap")).toBeTruthy();
    expect(screen.getByText("Recently viewed bottle")).toBeTruthy();
    await waitFor(() => expect(queryMocks.favoriteStatuses).toHaveBeenCalledExactlyOnceWith(["product-1", "product-2", "product-3"]));
    expect(queryMocks.favoriteStatus).not.toHaveBeenCalled();
  });

  it("refreshes an active cart once after adding a flash sale item", async () => {
    let quantity = 0;
    const fetchCart = vi.fn(async () => quantity);
    queryMocks.addCartItem.mockImplementationOnce(async () => { quantity = 1; return {}; });
    function CartCount() {
      const cart = useQuery({ queryKey: ["buyer-cart", "en"], queryFn: fetchCart });
      return <p data-testid="cart-count">{cart.data ?? 0}</p>;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><CartCount /><MarketplaceHome user={{ role: "USER" }} /></QueryClientProvider>);
    await screen.findByText("Flash marketplace tote");
    await waitFor(() => expect(fetchCart).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(queryMocks.showAddToCartSuccess).toHaveBeenCalledOnce());
    expect(fetchCart).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("cart-count").textContent).toBe("1");
    expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-flash", 1);
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

    expect(await screen.findByText("No recommendations yet")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Shop fast. Checkout faster." })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Flash Sale" })).toBeNull();
    expect(screen.queryByText("No flash sale right now")).toBeNull();
    expect(screen.getByText("No new arrivals yet")).toBeTruthy();
    expect(screen.getByText("No featured shops yet")).toBeTruthy();
    expect(screen.getByText("No recently viewed products")).toBeTruthy();
  });

  it("disables a sold-out flash sale item using API available stock", async () => {
    const response = structuredClone(queryMocks.defaultHomeResponse);
    const flashSale = response.sections.flashSale as { items: Array<Record<string, unknown>> };
    flashSale.items[0]!.availableStock = 0;
    queryMocks.homeResponse = response;

    renderWithClient(<MarketplaceHome />);

    await screen.findByText("Flash marketplace tote");
    expect(screen.getAllByRole("button", { name: "Add" })[0]?.hasAttribute("disabled")).toBe(true);
  });

  it.each([
    { locale: "en", clientTimezone: "Asia/Bangkok", label: "Ends 10/1/26" },
    { locale: "th", clientTimezone: "America/Los_Angeles", label: "สิ้นสุด 1/10/69" },
  ] as const)("hydrates $locale flash expiry at Bangkok midnight across host timezones", async ({ locale, clientTimezone, label }) => {
    const originalTimezone = process.env.TZ;
    i18nMocks.locale = locale;
    queryMocks.homeResponse = { sections: { flashSale: { id: "flash-midnight", title: "Midnight flash sale", description: null, endsAt: "2026-09-30T17:00:00.000Z", items: [] } } };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["marketplace", "home", "test"], queryMocks.homeResponse);
    const ui = <QueryClientProvider client={client}><MarketplaceHome /></QueryClientProvider>;
    const container = document.createElement("div");
    const recoverableError = vi.fn();
    try {
      process.env.TZ = "UTC";
      container.innerHTML = renderToString(ui);
      expect(container.textContent).toContain(label);
      document.body.appendChild(container);
      process.env.TZ = clientTimezone;
      render(ui, { container, hydrate: true, onRecoverableError: recoverableError });
      expect(await screen.findByText(label, { exact: true })).toBeTruthy();
      expect(recoverableError).not.toHaveBeenCalled();
    } finally {
      cleanup();
      client.clear();
      container.remove();
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
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
