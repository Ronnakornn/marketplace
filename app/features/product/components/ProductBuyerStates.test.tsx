/**
 * @vitest-environment jsdom
 */
import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsPage } from "#/features/buyer/components/DealsPage";
import { ProductDetailPage } from "./ProductDetailPage";
import { ProductListingPage } from "./ProductListingPage";

const queryMocks = vi.hoisted(() => ({
  productsResponse: { items: [] } as { items: unknown[] },
  productDetailResponse: null as unknown,
  productsError: null as Error | null,
  productDetailError: null as Error | null,
  productsQueryFn: vi.fn(),
  productDetailQueryFn: vi.fn(),
  couponsQueryFn: vi.fn(async () => []),
  addCartItem: vi.fn(async () => ({})),
  session: { user: { role: "USER" } } as { user: { role: string } } | null,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, priority: _priority, ...props }: { src: string; alt: string; fill?: boolean; priority?: boolean }) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  addCartItem: queryMocks.addCartItem,
  addFavoriteProduct: vi.fn(async () => ({})),
  fetchCart: vi.fn(async () => ({ shops: [] })),
  fetchFavoriteStatus: vi.fn(async () => false),
  fetchShopFollowStatus: vi.fn(async () => false),
  followShop: vi.fn(async () => ({})),
  fetchCoupons: queryMocks.couponsQueryFn,
  formatMoney: (cents: number, currency = "THB") => `${currency} ${(cents / 100).toFixed(2)}`,
  removeFavoriteProduct: vi.fn(async () => ({})),
  unfollowShop: vi.fn(async () => ({})),
}));

vi.mock("#/features/chat", () => ({
  createChatRoom: vi.fn(async () => ({ roomId: "room-1" })),
}));

vi.mock("#/features/product/components/ProductCard", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

vi.mock("#/features/product/queries", () => ({
  publicProductListQueryOptions: () => ({
    queryKey: ["product", "public", "lists", { locale: "en", limit: 40 }],
    queryFn: queryMocks.productsQueryFn,
  }),
  publicProductDetailQueryOptions: () => ({
    queryKey: ["product", "public", "details", { locale: "en", productId: "product-1" }],
    queryFn: queryMocks.productDetailQueryFn,
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
  normalizePublicProduct: (response: unknown) => response,
  normalizePublicCategories: () => [],
  normalizePublicBrands: () => [],
  normalizePublicSearchSuggestions: () => [],
}));

vi.mock("#/lib/auth-client", () => ({
  useSession: () => ({ data: queryMocks.session }),
}));

vi.mock("#/lib/assets", () => ({
  resolveUploadedImageUrl: (url?: string) => url ?? "/placeholder.png",
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
    "product.noPurchasableVariant": "No purchasable variant",
    "product.products": "Products",
    "product.recommendedProducts": "Recommended products",
    "product.shopTrustedStores": "Shop trusted stores",
    "product.specialDealsSoon": "Special deals soon",
    "product.soon": "Soon",
    "product.addToCart": "Add to cart",
    "product.buyNow": "Buy now",
    "product.buyerProtection": "Buyer protection",
    "product.followShop": "Follow",
    "product.following": "Following",
    "product.inStock": "in stock",
    "product.noDescription": "No description",
    "product.noReviewsDescription": "No reviews yet.",
    "product.noReviewsTitle": "No reviews",
    "product.relatedProducts": "Related products",
    "product.reviews": "Reviews",
    "product.shippingCalculated": "Shipping calculated at checkout",
    "product.sold": "sold",
    "product.variants": "Variants",
    "product.wishlist": "Wishlist",
    "product.viewAll": "View all",
    "chat.chatSeller": "Chat seller",
    "chat.sellerInbox": "Seller inbox",
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
  queryMocks.productDetailResponse = createProductDetailFixture();
  queryMocks.productsError = null;
  queryMocks.productDetailError = null;
  queryMocks.session = { user: { role: "USER" } };
  queryMocks.addCartItem.mockClear();
  queryMocks.productsQueryFn.mockImplementation(async () => {
    if (queryMocks.productsError) throw queryMocks.productsError;
    return queryMocks.productsResponse;
  });
  queryMocks.productDetailQueryFn.mockImplementation(async () => {
    if (queryMocks.productDetailError) throw queryMocks.productDetailError;
    return queryMocks.productDetailResponse;
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

describe("ProductDetailPage buyer transaction states", () => {
  it("requires option selection before adding to cart and sends selected quantity", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    const addToCart = await screen.findByRole("button", { name: /Add to cart/ });
    expect(addToCart).toHaveProperty("disabled", true);
    expect(screen.getByText("Choose all options before purchasing.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Blue" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "M" }));

    expect(await screen.findByText(/SKU RED-M/)).toBeTruthy();
    expect(addToCart).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    fireEvent.click(addToCart);

    await waitFor(() => expect(queryMocks.addCartItem).toHaveBeenCalledWith("variant-red-m", 2));
  });

  it("does not allow quantity above selected variant stock", async () => {
    renderWithClient(<ProductDetailPage productId="product-1" />);

    await screen.findByRole("button", { name: /Add to cart/ });
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "S" }));

    const incrementButton = screen.getByRole("button", { name: "Increase quantity" });
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);

    expect(screen.getByText("2")).toBeTruthy();
    expect(incrementButton).toHaveProperty("disabled", true);
  });

  it("shows buyer purchase CTAs to anonymous visitors", async () => {
    queryMocks.session = null;

    renderWithClient(<ProductDetailPage productId="product-1" />);

    expect(await screen.findByRole("button", { name: /Add to cart/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Buy now/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Seller inbox")).toBeNull();
  });
});

function createProductDetailFixture() {
  return {
    id: "product-1",
    title: "Variant Product",
    description: "Detailed description",
    price: 1200,
    minPrice: 1200,
    maxPrice: 1500,
    currency: "THB",
    rating: 4.5,
    soldCount: 8,
    stock: 5,
    shop: { id: "shop-1", name: "Demo Shop", location: "Bangkok" },
    brand: { id: "brand-1", name: "Demo Brand", slug: "demo-brand" },
    metaTitle: null,
    metaDescription: null,
    warrantyInfo: "One year",
    condition: "New",
    countryOfOrigin: "TH",
    highlights: ["Ships fast"],
    attributes: [{ key: "material", name: "Material", value: "Cotton", isFilterable: true }],
    images: ["/image-1.jpg", "/image-2.jpg"],
    video: { url: "/video.mp4", contentType: "video/mp4", fileName: "video.mp4" },
    options: [
      {
        id: "option-color",
        name: "Color",
        values: [
          { id: "value-red", value: "Red", colorHex: "#ff0000" },
          { id: "value-blue", value: "Blue", colorHex: "#0000ff" },
        ],
      },
      {
        id: "option-size",
        name: "Size",
        values: [
          { id: "value-s", value: "S", colorHex: null },
          { id: "value-m", value: "M", colorHex: null },
        ],
      },
    ],
    variants: [
      {
        id: "variant-red-s",
        title: "Red / S",
        sku: "RED-S",
        price: 1200,
        currency: "THB",
        stock: 2,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-red", value: "Red", colorHex: "#ff0000" },
          { optionId: "option-size", optionName: "Size", valueId: "value-s", value: "S", colorHex: null },
        ],
      },
      {
        id: "variant-red-m",
        title: "Red / M",
        sku: "RED-M",
        price: 1500,
        currency: "THB",
        stock: 3,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-red", value: "Red", colorHex: "#ff0000" },
          { optionId: "option-size", optionName: "Size", valueId: "value-m", value: "M", colorHex: null },
        ],
      },
      {
        id: "variant-blue-s",
        title: "Blue / S",
        sku: "BLUE-S",
        price: 1300,
        currency: "THB",
        stock: 0,
        optionValues: [
          { optionId: "option-color", optionName: "Color", valueId: "value-blue", value: "Blue", colorHex: "#0000ff" },
          { optionId: "option-size", optionName: "Size", valueId: "value-s", value: "S", colorHex: null },
        ],
      },
    ],
  };
}
