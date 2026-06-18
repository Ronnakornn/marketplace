/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerCart, BuyerFavoriteProduct } from "#/features/buyer/api";
import { WishlistPage } from "./WishlistPage";

const wishlistMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(async () => ({ id: "cart-1", shops: [], subtotal: 0, currency: "THB" })),
  fetchFavoriteProducts: vi.fn(),
  removeFavoriteProduct: vi.fn(async (_productId: string) => undefined),
  routerPush: vi.fn(),
  showAddToCartError: vi.fn(),
  showAddToCartSuccess: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: wishlistMocks.routerPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: wishlistMocks.toastError,
    success: wishlistMocks.toastSuccess,
  },
}));

vi.mock("#/components/BuyerShell", () => ({
  BuyerTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

vi.mock("#/components/BuyerState", () => ({
  BuyerEmptyState: ({ title, description }: { title: string; description: string }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  ),
  BuyerErrorState: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <section>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Retry</button>
    </section>
  ),
  BuyerLoadingGrid: () => <div data-testid="wishlist-loading">Loading wishlist</div>,
}));

vi.mock("#/components/ui/button", () => ({
  Button: ({ children, asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <button {...props}>{children}</button>
  ),
}));

vi.mock("#/features/buyer/api", () => ({
  addCartItem: wishlistMocks.addCartItem,
  fetchFavoriteProducts: wishlistMocks.fetchFavoriteProducts,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: wishlistMocks.removeFavoriteProduct,
}));

vi.mock("#/features/product/cart-handoff", () => ({
  showAddToCartError: wishlistMocks.showAddToCartError,
  showAddToCartSuccess: wishlistMocks.showAddToCartSuccess,
}));

vi.mock("#/i18n/client", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => ({
    "buyer.noFavoritesDescription": "Save products you like and come back when you are ready.",
    "buyer.noFavoritesTitle": "No saved products yet",
    "buyer.shopMore": "Shop more",
    "buyer.wishlist": "Wishlist",
    "common.loading": "Loading",
  })[key] ?? key,
}));

vi.mock("#/i18n/navigation", () => ({
  useLocalePath: () => (path: string) => `/en${path}`,
}));

vi.mock("#/lib/assets", () => ({
  resolveUploadedImageUrl: (url?: string) => url ?? null,
}));

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...view, client };
}

beforeEach(() => {
  wishlistMocks.addCartItem.mockResolvedValue({ id: "cart-1", shops: [], subtotal: 0, currency: "THB" } satisfies BuyerCart);
  wishlistMocks.fetchFavoriteProducts.mockResolvedValue([createFavorite()]);
  wishlistMocks.removeFavoriteProduct.mockResolvedValue(undefined);
  wishlistMocks.routerPush.mockClear();
  wishlistMocks.showAddToCartError.mockClear();
  wishlistMocks.showAddToCartSuccess.mockClear();
  wishlistMocks.toastError.mockClear();
  wishlistMocks.toastSuccess.mockClear();
  wishlistMocks.addCartItem.mockClear();
  wishlistMocks.fetchFavoriteProducts.mockClear();
  wishlistMocks.removeFavoriteProduct.mockClear();
});

afterEach(() => cleanup());

describe("WishlistPage", () => {
  it("renders loading and populated wishlist product details", async () => {
    renderWithClient(<WishlistPage />);

    expect(screen.getByTestId("wishlist-loading")).toBeTruthy();
    expect(await screen.findByText("Canvas Weekender Bag")).toBeTruthy();
    expect(screen.getByText("Demo Shop")).toBeTruthy();
    expect(screen.getByText("THB 12.00")).toBeTruthy();
    expect(screen.getByText("Ready to ship")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Canvas Weekender Bag from wishlist" })).toBeTruthy();
  });

  it("renders an empty wishlist state with a shopping handoff", async () => {
    wishlistMocks.fetchFavoriteProducts.mockResolvedValueOnce([]);

    renderWithClient(<WishlistPage />);

    expect(await screen.findByText("No saved products yet")).toBeTruthy();
    expect(screen.getByText("Save products you like and come back when you are ready.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop more" }).getAttribute("href")).toBe("/en/");
  });

  it("renders an error state and retries loading favorites", async () => {
    wishlistMocks.fetchFavoriteProducts
      .mockRejectedValueOnce(new Error("Favorites unavailable"))
      .mockResolvedValueOnce([createFavorite()]);

    renderWithClient(<WishlistPage />);

    expect(await screen.findByText("Favorites unavailable")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Canvas Weekender Bag")).toBeTruthy();
    expect(wishlistMocks.fetchFavoriteProducts).toHaveBeenCalledTimes(2);
  });

  it("removes a wishlist item with optimistic UI feedback", async () => {
    let favorites = [createFavorite()];
    wishlistMocks.fetchFavoriteProducts.mockImplementation(async () => favorites);
    wishlistMocks.removeFavoriteProduct.mockImplementation(async (productId: string) => {
      favorites = favorites.filter((favorite) => favorite.productId !== productId);
    });

    renderWithClient(<WishlistPage />);

    expect(await screen.findByText("Canvas Weekender Bag")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove Canvas Weekender Bag from wishlist" }));

    await waitFor(() => expect(wishlistMocks.removeFavoriteProduct.mock.calls[0]?.[0]).toBe("product-1"));
    await waitFor(() => expect(screen.queryByText("Canvas Weekender Bag")).toBeNull());
    expect(wishlistMocks.toastSuccess).toHaveBeenCalledWith("Removed from wishlist", {
      description: "The product was removed from your saved items.",
    });
  });

  it("adds an available wishlist item to cart and wires the cart handoff", async () => {
    const { client } = renderWithClient(<WishlistPage />);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await screen.findByText("Canvas Weekender Bag");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(wishlistMocks.addCartItem).toHaveBeenCalledWith("variant-1", 1));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["buyer-cart"] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["buyer-cart", "en"] });
    expect(wishlistMocks.showAddToCartSuccess).toHaveBeenCalledWith({
      context: {
        productTitle: "Canvas Weekender Bag",
        variantTitle: "Default",
      },
      onViewCart: expect.any(Function),
    });

    const successOptions = wishlistMocks.showAddToCartSuccess.mock.calls[0]?.[0];
    successOptions.onViewCart();
    expect(wishlistMocks.routerPush).toHaveBeenCalledWith("/en/cart");
  });

  it("keeps add-to-cart disabled for unavailable products and products without a purchase variant", async () => {
    wishlistMocks.fetchFavoriteProducts.mockResolvedValueOnce([
      createFavorite({ id: "favorite-inactive", productId: "product-inactive", title: "Inactive Hoodie", status: "DRAFT" }),
      createFavorite({ id: "favorite-no-variant", productId: "product-no-variant", title: "Configurable Sneakers", purchaseVariant: null }),
      createFavorite({
        id: "favorite-out-of-stock",
        productId: "product-out-of-stock",
        title: "Sold Out Cap",
        purchaseVariant: { id: "variant-empty", title: "Default", stock: 0, currency: "THB", price: 1200 },
      }),
    ]);

    renderWithClient(<WishlistPage />);

    expect(await screen.findByText("Inactive Hoodie")).toBeTruthy();
    expect(screen.getByText("Configurable Sneakers")).toBeTruthy();
    expect(screen.getByText("Sold Out Cap")).toBeTruthy();
    expect(screen.getByText("Product unavailable")).toBeTruthy();
    expect(screen.getByText("Choose options")).toBeTruthy();
    expect(screen.getByText("Out of stock")).toBeTruthy();

    const addButtons = screen.getAllByRole("button", { name: "Add" });
    expect(addButtons).toHaveLength(3);
    for (const button of addButtons) {
      expect(button).toHaveProperty("disabled", true);
    }

    fireEvent.click(addButtons[0]!);
    expect(wishlistMocks.addCartItem).not.toHaveBeenCalled();
  });
});

function createFavorite(overrides: Partial<BuyerFavoriteProduct> = {}): BuyerFavoriteProduct {
  return {
    id: "favorite-1",
    productId: "product-1",
    title: "Canvas Weekender Bag",
    price: 1200,
    currency: "THB",
    status: "ACTIVE",
    imageUrls: ["/uploads/product_image/product-1/main.avif"],
    shop: { id: "shop-1", name: "Demo Shop", slug: "demo-shop", status: "ACTIVE" },
    purchaseVariant: { id: "variant-1", title: "Default", stock: 6, currency: "THB", price: 1200 },
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}
