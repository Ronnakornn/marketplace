/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyerProduct } from "#/features/product/queries";
import { ProductCard } from "./ProductCard";

const cardMocks = vi.hoisted(() => ({
  addCartItem: vi.fn(async () => ({})),
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchFavoriteStatus: vi.fn(async () => false),
  removeFavoriteProduct: vi.fn(async () => ({})),
  trackProductClick: vi.fn(),
  session: { user: { role: "USER" } } as { user: { role: string } } | null,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...props }: { src: string; alt: string; fill?: boolean; sizes?: string }) => (
    <img src={src} alt={alt} {...props} />
  ),
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

vi.mock("#/features/tracking", () => ({
  useDiscoveryTracking: () => ({ trackProductClick: cardMocks.trackProductClick }),
}));

vi.mock("#/lib/assets", () => ({
  resolveUploadedImageUrl: (url?: string) => url ?? "/placeholder.png",
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: cardMocks.session }),
}));

function renderWithClient(product: BuyerProduct) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ProductCard product={product} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  cardMocks.addCartItem.mockClear();
  cardMocks.addFavoriteProduct.mockClear();
  cardMocks.fetchFavoriteStatus.mockClear();
  cardMocks.removeFavoriteProduct.mockClear();
  cardMocks.trackProductClick.mockClear();
  cardMocks.session = { user: { role: "USER" } };
});

describe("ProductCard", () => {
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
