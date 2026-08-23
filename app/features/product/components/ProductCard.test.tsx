/**
 * @vitest-environment jsdom
 */
import { type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerProduct } from "#/features/product/queries";
import { ProductCard } from "./ProductCard";

const cardMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(async () => ({})),
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchFavoriteStatus: vi.fn(async () => false),
  removeFavoriteProduct: vi.fn(async () => ({})),
  routerPush: vi.fn(),
  showAddToCartError: vi.fn(),
  showAddToCartSuccess: vi.fn(),
  trackProductClick: vi.fn(),
  session: { user: { role: "USER" } } as { user: { role: string } } | null,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, onClick, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void; prefetch?: boolean }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...props }: { src: string; alt: string; fill?: boolean; sizes?: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: cardMocks.routerPush }),
}));

vi.mock("#/components/ui/badge", () => ({
  Badge: ({ children, ...props }: { children: ReactNode }) => <span {...props}>{children}</span>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, ...props }: { children: ReactNode }) => <button {...props}>{children}</button>,
}));

vi.mock("#/features/buyer/api", () => ({
  addCartItem: cardMocks.addCartItem,
  addFavoriteProduct: cardMocks.addFavoriteProduct,
  fetchFavoriteStatus: cardMocks.fetchFavoriteStatus,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: cardMocks.removeFavoriteProduct,
}));

vi.mock("#/features/product/cart-handoff", () => ({
  showAddToCartError: cardMocks.showAddToCartError,
  showAddToCartSuccess: cardMocks.showAddToCartSuccess,
}));

vi.mock("#/features/tracking", () => ({
  useDiscoveryTracking: () => ({ trackProductClick: cardMocks.trackProductClick }),
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/i18n/client", () => ({
  useTranslations: () => (key: string) => ({
    "cart.handoffAddedTitle": "Added to cart",
    "cart.handoffAddedDescription": "Your item was added to the cart.",
    "cart.handoffErrorTitle": "Could not add to cart",
    "cart.handoffErrorDescription": "Please try again or review the selected options.",
    "cart.viewCart": "View cart",
    "cart.continueShopping": "Continue shopping",
    "common.available": "Available",
    "common.details": "Details",
    "common.unavailable": "Unavailable",
    "product.actionUnavailable": "Add to cart is temporarily unavailable.",
    "product.adding": "Adding",
    "product.addingProductToCart": "Adding {title} to cart",
    "product.addingToCart": "Adding to cart...",
    "product.addToWishlistWithTitle": "Add {title} to wishlist",
    "product.bestSeller": "Best seller",
    "product.discountPercentOff": "{percent}% off",
    "product.itemOutOfStock": "This item is out of stock.",
    "product.inStock": "in stock",
    "product.loginToAddToCart": "Log in to add this item to your cart.",
    "product.onlyBuyerAccountsCanPurchase": "Only buyer accounts can purchase.",
    "product.new": "New",
    "product.openProductDetails": "Open {title} details",
    "product.outOfStock": "Out of stock",
    "product.quickAddToCart": "Quick add {title} to cart",
    "product.removeFromWishlist": "Remove {title} from wishlist",
    "product.signInBuyerWishlist": "Sign in as a buyer to use wishlist",
    "product.soldCount": "{count} sold",
    "product.viewProduct": "View {title}",
    "product.wishlistUnavailable": "Wishlist unavailable",
  })[key] ?? key,
}));

vi.mock("#/lib/assets", () => ({
  resolveUploadedImageUrl: (url?: string) => url ?? "/placeholder.png",
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: cardMocks.session }),
}));

function renderWithClient(product: BuyerProduct, showShopIdentity?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ProductCard product={product} showShopIdentity={showShopIdentity} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  cardMocks.addCartItem.mockClear();
  cardMocks.addFavoriteProduct.mockClear();
  cardMocks.fetchFavoriteStatus.mockClear();
  cardMocks.removeFavoriteProduct.mockClear();
  cardMocks.routerPush.mockClear();
  cardMocks.showAddToCartError.mockClear();
  cardMocks.showAddToCartSuccess.mockClear();
  cardMocks.trackProductClick.mockClear();
  cardMocks.session = { user: { role: "USER" } };
});

describe("ProductCard", () => {
  it("hydrates with the anonymous server snapshot when a buyer session is already cached", async () => {
    const product = createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    });
    const createTree = () => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProductCard product={product} />
      </QueryClientProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(createTree());
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, createTree());
    });

    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Hydration failed");
    expect(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ })).toHaveProperty("disabled", false);
    await act(async () => root?.unmount());
    consoleError.mockRestore();
    container.remove();
  });

  it("renders core buyer card metrics and shop context", () => {
    renderWithClient(createProductFixture());

    expect(screen.getByText("Canvas Weekender Bag")).toBeTruthy();
    expect(screen.getByText("THB 12.00 - THB 15.00")).toBeTruthy();
    expect(screen.getByText("THB 18.00")).toBeTruthy();
    expect(screen.getByText("17% off")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("21 sold")).toBeTruthy();
    expect(screen.getByText("Demo Shop")).toBeTruthy();
    expect(screen.getByText("Bangkok")).toBeTruthy();
  });

  it("localizes system-generated product badges", () => {
    renderWithClient(createProductFixture({ badges: ["new", "in_stock", "best_seller"] }));

    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("in stock")).toBeTruthy();
    expect(screen.queryByText("new")).toBeNull();
    expect(screen.queryByText("in_stock")).toBeNull();
  });

  it("can omit redundant shop identity without changing the default", () => {
    renderWithClient(createProductFixture(), false);
    expect(screen.queryByText("Demo Shop")).toBeNull();
    expect(screen.queryByText("Bangkok")).toBeNull();
    expect(screen.getByText("Canvas Weekender Bag")).toBeTruthy();
  });

  it("shows quick add only for exactly one purchasable no-option variant", () => {
    const safeProduct = createProductFixture({
      minPrice: 1200,
      maxPrice: 1200,
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    });
    const { rerender } = renderWithClient(safeProduct);

    expect(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ })).toBeTruthy();

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={client}>
        <ProductCard
          product={createProductFixture({
            variants: [
              { ...createVariant("variant-one", 1200, 4), optionValues: [] },
              { ...createVariant("variant-two", 1500, 2), optionValues: [] },
            ],
            options: [],
          })}
        />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Open Canvas Weekender Bag details/ })).toBeTruthy();
  });

  it("does not track navigation when favorite is clicked", async () => {
    renderWithClient(createProductFixture());

    fireEvent.click(screen.getByRole("button", { name: /Add Canvas Weekender Bag to wishlist/ }));

    await waitFor(() => expect(cardMocks.addFavoriteProduct).toHaveBeenCalledWith("product-1"));
    expect(cardMocks.trackProductClick).not.toHaveBeenCalled();
  });

  it("does not track navigation when quick add is clicked", async () => {
    renderWithClient(createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    }));

    fireEvent.click(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ }));

    await waitFor(() => expect(cardMocks.addCartItem).toHaveBeenCalledWith("variant-safe", 1));
    expect(cardMocks.trackProductClick).not.toHaveBeenCalled();
  });

  it("uses a stable pending label for quick add", async () => {
    let resolveAdd: (value: Record<string, never>) => void = () => {};
    cardMocks.addCartItem.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAdd = resolve;
    }));

    renderWithClient(createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    }));

    fireEvent.click(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ }));

    const pendingButton = await screen.findByRole("button", { name: "Adding Canvas Weekender Bag to cart" });
    expect(pendingButton).toHaveProperty("disabled", true);
    expect(screen.getByText("Adding to cart...")).toBeTruthy();

    resolveAdd({});
    await waitFor(() => expect(cardMocks.showAddToCartSuccess).toHaveBeenCalled());
  });

  it("shows quick-add confirmation and refreshes the buyer cart query after success", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const product = createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    });

    render(
      <QueryClientProvider client={client}>
        <ProductCard product={product} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["buyer-cart"] }));
    expect(cardMocks.showAddToCartSuccess).toHaveBeenCalledWith({
      copy: {
        successTitle: "Added to cart",
        successDescription: "Your item was added to the cart.",
        viewCart: "View cart",
        continueShopping: "Continue shopping",
      },
      context: {
        productTitle: "Canvas Weekender Bag",
        variantTitle: "Default",
      },
      onViewCart: expect.any(Function),
    });

    const successOptions = cardMocks.showAddToCartSuccess.mock.calls[0]?.[0];
    successOptions.onViewCart();
    expect(cardMocks.routerPush).toHaveBeenCalledWith("/en/cart");
    expect(cardMocks.trackProductClick).not.toHaveBeenCalled();
  });

  it("shows readable quick-add error feedback without navigating", async () => {
    const error = { response: { error: "Variant is out of stock" } };
    cardMocks.addCartItem.mockRejectedValueOnce(error);

    renderWithClient(createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    }));

    fireEvent.click(screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ }));

    await waitFor(() => expect(cardMocks.showAddToCartError).toHaveBeenCalledWith({
      error,
      copy: {
        errorTitle: "Could not add to cart",
        errorDescription: "Please try again or review the selected options.",
      },
    }));
    expect((await screen.findAllByText("Variant is out of stock")).length).toBeGreaterThan(0);
    expect(screen.queryByText("[object Object]")).toBeNull();
    expect(cardMocks.showAddToCartSuccess).not.toHaveBeenCalled();
    expect(cardMocks.routerPush).not.toHaveBeenCalled();
    expect(cardMocks.trackProductClick).not.toHaveBeenCalled();
  });

  it("disables quick add for non-buyer accounts", () => {
    cardMocks.session = { user: { role: "SELLER" } };
    const product = createProductFixture({
      variants: [{ ...createVariant("variant-safe", 1200, 4), optionValues: [] }],
      options: [],
    });
    renderWithClient(product);

    const sellerQuickAdd = screen.getByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ });
    expect(sellerQuickAdd).toHaveProperty("disabled", true);
    expect(screen.getByText("Only buyer accounts can purchase.")).toBeTruthy();
  });

  it("keeps ambiguous products on the detail fallback action", () => {
    renderWithClient(createProductFixture({
      variants: [
        { ...createVariant("variant-one", 1200, 4), optionValues: [] },
        { ...createVariant("variant-two", 1500, 2), optionValues: [] },
      ],
      options: [],
    }));

    expect(screen.queryByRole("button", { name: /Quick add Canvas Weekender Bag to cart/ })).toBeNull();

    const detailsLink = screen.getByRole("link", { name: /Open Canvas Weekender Bag details/ });
    expect(detailsLink.getAttribute("href")).toBe("/products/product-1");

    fireEvent.click(detailsLink);
    expect(cardMocks.trackProductClick).toHaveBeenCalledWith({ productId: "product-1", shopId: "shop-1" });
  });

  it("makes out-of-stock state visible and keeps keyboard focus targets accessible", () => {
    renderWithClient(createProductFixture({
      stock: 0,
      variants: [{ ...createVariant("variant-empty", 1200, 0), optionValues: [] }],
      options: [],
      badges: [],
    }));

    expect(screen.getAllByText("Out of stock").length).toBeGreaterThan(0);
    expect(screen.getByText("Unavailable")).toBeTruthy();

    const productLink = screen.getByRole("link", { name: /View Canvas Weekender Bag/ });
    const favoriteButton = screen.getByRole("button", { name: /Add Canvas Weekender Bag to wishlist/ });
    productLink.focus();
    expect(document.activeElement).toBe(productLink);
    favoriteButton.focus();
    expect(document.activeElement).toBe(favoriteButton);
  });
});

function createProductFixture(overrides: Partial<BuyerProduct> = {}): BuyerProduct {
  return {
    id: "product-1",
    title: "Canvas Weekender Bag",
    description: "A sturdy bag",
    price: 1200,
    minPrice: 1200,
    maxPrice: 1500,
    currency: "THB",
    rating: 4.6,
    soldCount: 21,
    stock: 6,
    originalPrice: 1800,
    discountPercent: 17,
    badges: [],
    shop: { id: "shop-1", name: "Demo Shop", location: "Bangkok" },
    brand: { id: "brand-1", name: "Demo Brand", slug: "demo-brand" },
    metaTitle: null,
    metaDescription: null,
    warrantyInfo: null,
    condition: null,
    countryOfOrigin: null,
    highlights: [],
    attributes: [],
    variants: [
      createVariant("variant-red", 1200, 3),
      createVariant("variant-blue", 1500, 3),
    ],
    images: ["/image-1.jpg"],
    video: null,
    options: [{ id: "option-color", name: "Color", values: [{ id: "value-red", value: "Red", colorHex: null }] }],
    ...overrides,
  };
}

function createVariant(id: string, price: number, stock: number): BuyerProduct["variants"][number] {
  return {
    id,
    title: "Default",
    sku: id.toUpperCase(),
    price,
    currency: "THB",
    stock,
    optionValues: [{ optionId: "option-color", optionName: "Color", valueId: "value-red", value: "Red", colorHex: null }],
  };
}
